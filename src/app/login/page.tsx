'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/firebase/config';
import { useInvite } from '@/hooks/useInvite';
import { useUser } from '@/contexts/UserContext';
import Link from 'next/link';
import { signInWithGoogle, getGoogleRedirectResult } from '@/firebase/auth';

// Contador improvisado para evitar bloqueio por muitas tentativas
let tentativasDeLogin = 0;
const MAX_TENTATIVAS = 5;
const tempoBloqueio = 30000; // 30 segundos

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [tempoRestante, setTempoRestante] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const peladaId = searchParams?.get('peladaId') || null;
  const cadastroSucesso = searchParams?.get('cadastroSucesso') || null;
  const { acceptInvite } = useInvite();
  const { user, loading: userLoading } = useUser();
  
  // Referência para controlar se o convite já foi processado nesta sessão
  const conviteProcessadoRef = useRef(false);
  
  // Controle de redirecionamento em andamento
  const redirecionandoRef = useRef(false);
  
  // Verificar se um peladaId já foi processado usando localStorage
  const peladaJaProcessada = useCallback((pid: string, uid: string) => {
    if (typeof window === 'undefined') return false;
    
    const processadosKey = `convites_processados_${uid}`;
    const processados = JSON.parse(localStorage.getItem(processadosKey) || '{}');
    
    return !!processados[pid];
  }, []);
  
  // Marcar um peladaId como processado
  const marcarPeladaProcessada = useCallback((pid: string, uid: string) => {
    if (typeof window === 'undefined') return;
    
    const processadosKey = `convites_processados_${uid}`;
    const processados = JSON.parse(localStorage.getItem(processadosKey) || '{}');
    
    processados[pid] = true;
    localStorage.setItem(processadosKey, JSON.stringify(processados));
  }, []);

  // Efeito para processar o convite quando o usuário estiver disponível
  useEffect(() => {
    let isMounted = true;
    
    const processarConvite = async () => {
      // Verifica se há um peladaId, se o usuário está logado e se não está em processo de redirecionamento
      if (!peladaId || !user || userLoading || redirecionandoRef.current) {
        return;
      }
      
      // Verifica se o convite já foi processado em sessões anteriores
      if (peladaJaProcessada(peladaId, user.uid)) {
        console.log('Convite já foi processado anteriormente, redirecionando diretamente');
        redirecionandoRef.current = true;
        router.push(`/pelada/${peladaId}`);
        return;
      }
      
      // Verifica se o convite já foi processado nesta sessão
      if (conviteProcessadoRef.current) {
        return;
      }
      
      // Marca como processado para evitar processamento duplicado
      conviteProcessadoRef.current = true;
      redirecionandoRef.current = true;
      
      try {
        console.log('Processando convite após inicialização do contexto:', {
          peladaId,
          userId: user.uid
        });
        
        await acceptInvite(peladaId);
        
        // Marcar o convite como processado no localStorage para persistir entre recarregamentos
        if (isMounted) {
          marcarPeladaProcessada(peladaId, user.uid);
        }
        
        // Já houve redirecionamento no acceptInvite, não precisamos fazer nada mais
      } catch (err) {
        console.error('Erro ao processar convite:', err);
        if (isMounted) {
          setError('Erro ao aceitar o convite. Por favor, tente novamente.');
          redirecionandoRef.current = false;
          // Se falhou, permite tentar novamente
          conviteProcessadoRef.current = false;
        }
      }
    };

    processarConvite();
    
    return () => {
      isMounted = false;
    };
  }, [peladaId, user, userLoading, acceptInvite, router, peladaJaProcessada, marcarPeladaProcessada]);

  // Efeito para redirecionar se já estiver logado
  useEffect(() => {
    if (user && !userLoading && !peladaId && !redirecionandoRef.current) {
      redirecionandoRef.current = true;
      router.push('/dashboard');
    }
  }, [user, userLoading, router, peladaId]);

  // Efeito para verificar se há resultado de redirecionamento do Google ao carregar
  useEffect(() => {
    const verificarRedirecionamentoGoogle = async () => {
      try {
        // Verifica se já está em processo de redirecionamento
        if (redirecionandoRef.current) {
          console.log('Já estamos em processo de redirecionamento, ignorando verificação do Google');
          return;
        }
        
        // Apenas tenta obter o resultado se o usuário não estiver logado
        if (!user && !userLoading) {
          console.log('Verificando se há resultado de redirecionamento do Google...');
          setLoading(true);
          
          // Verifica no localStorage se houve tentativa de login recente
          const loginInitiated = localStorage.getItem('google_login_initiated') === 'true';
          const loginTimestamp = parseInt(localStorage.getItem('google_login_timestamp') || '0', 10);
          const timeElapsed = Date.now() - loginTimestamp;
          
          if (loginInitiated) {
            console.log(`Detectada tentativa de login recente (${timeElapsed / 1000}s atrás)`);
          }
          
          // Chamada para obter o resultado do redirecionamento
          const googleUser = await getGoogleRedirectResult();
          
          if (googleUser) {
            console.log('Login com Google por redirecionamento bem-sucedido:', googleUser.uid);
            // Limpar flags de login
            localStorage.removeItem('google_login_initiated');
            localStorage.removeItem('google_login_timestamp');
            
            // Se não tiver peladaId, redireciona para o dashboard
            if (!peladaId) {
              redirecionandoRef.current = true;
              router.push('/dashboard');
            }
            // Se tiver peladaId, o outro useEffect vai cuidar de processar o convite
          } else if (loginInitiated && timeElapsed < 60000) {
            // Se tentamos login há menos de 1 minuto e não temos resultado, 
            // provavelmente o redirecionamento está em andamento ou falhou
            console.log('Login iniciado recentemente, mas não há resultado. Possível falha ou redirecionamento em andamento.');
          }
        }
      } catch (err) {
        console.error('Erro ao processar redirecionamento do Google:', err);
        setError('Erro ao processar login com Google. Tente novamente.');
        
        // Limpar flags para evitar loops
        localStorage.removeItem('google_login_initiated');
        localStorage.removeItem('google_login_timestamp');
      } finally {
        setLoading(false);
      }
    };
    
    verificarRedirecionamentoGoogle();
  }, [user, userLoading, router, peladaId]);

  // Contagem regressiva quando bloqueado
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (bloqueado && tempoRestante > 0) {
      intervalId = setInterval(() => {
        setTempoRestante(prev => {
          if (prev <= 1000) {
            setBloqueado(false);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }

    return () => clearInterval(intervalId);
  }, [bloqueado, tempoRestante]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (bloqueado) {
      setError(`Aguarde ${Math.ceil(tempoRestante / 1000)} segundos antes de tentar novamente.`);
      return;
    }
    
    if (tentativasDeLogin >= MAX_TENTATIVAS) {
      setBloqueado(true);
      setTempoRestante(tempoBloqueio);
      setError(`Muitas tentativas de login. Tente novamente em ${tempoBloqueio / 1000} segundos ou redefina sua senha.`);
      return;
    }
    
    if (!email || !password) {
      setError('Por favor, preencha todos os campos');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      // Limpar caracteres invisíveis que podem ser copiados acidentalmente
      const emailLimpo = email.trim();
      const senhaLimpa = password;

      console.log('Tentando login com:', { email: emailLimpo, senhaLength: senhaLimpa.length });
      
      // Faz o login
      const userCredential = await signInWithEmailAndPassword(auth, emailLimpo, senhaLimpa);
      console.log('Login realizado com sucesso:', userCredential.user.uid);
      
      // Resetar tentativas após sucesso
      tentativasDeLogin = 0;

      // Se não tiver peladaId, redireciona para o dashboard
      if (!peladaId) {
        router.push('/dashboard');
      }
      // Se tiver peladaId, o useEffect vai cuidar de processar o convite
    } catch (err: unknown) {
      console.error('Erro detalhado no login:', err);
      
      // Incrementar contador de tentativas
      tentativasDeLogin++;
      
      const firebaseError = err as { code: string, message: string };
      console.log('Código do erro:', firebaseError.code);
      console.log('Mensagem completa:', firebaseError.message);
      
      // Verificar se o Firebase está retornando um código de erro específico
      switch (firebaseError.code) {
        case 'auth/invalid-email':
          setError('Email inválido. Verifique se digitou corretamente.');
          break;
        case 'auth/user-disabled':
          setError('Esta conta foi desativada. Entre em contato com o suporte.');
          break;
        case 'auth/user-not-found':
          setError('Não encontramos uma conta com este email. Verifique seu email ou crie uma nova conta.');
          break;
        case 'auth/wrong-password':
          setError('Senha incorreta. Tente novamente ou redefina sua senha.');
          break;
        case 'auth/invalid-credential':
          setError('Email ou senha incorretos. Verifique suas credenciais e tente novamente.');
          break;
        case 'auth/too-many-requests':
          setBloqueado(true);
          setTempoRestante(tempoBloqueio);
          setError('Muitas tentativas de login. Sua conta foi temporariamente bloqueada por segurança. Tente novamente mais tarde ou redefina sua senha.');
          break;
        case 'auth/network-request-failed':
          setError('Erro de conexão. Verifique sua internet e tente novamente.');
          break;
        default:
          setError(`Erro ao fazer login: ${firebaseError.message}`);
      }
      
      // Limpar senha após erro para evitar reenvio de senha incorreta
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setLoading(true);
      
      console.log('Iniciando login com Google...');
      
      // Registrar tentativa no localStorage
      localStorage.setItem('google_login_initiated', 'true');
      localStorage.setItem('google_login_timestamp', Date.now().toString());
      
      // Salvar URL atual incluindo o peladaId se houver
      if (peladaId) {
        localStorage.setItem('login_redirect_pelada_id', peladaId);
      }
      
      const googleUser = await signInWithGoogle();
      
      if (googleUser) {
        // Login bem sucedido via popup, limpar flags
        localStorage.removeItem('google_login_initiated');
        localStorage.removeItem('google_login_timestamp');
        
        console.log('Login com Google bem sucedido via popup');
        
        // Se não tiver peladaId, redireciona para o dashboard
        if (!peladaId) {
          router.push('/dashboard');
        }
        // Se tiver peladaId, o outro useEffect vai cuidar de processar o convite
      } else {
        // signInWithGoogle retornou null, o que significa que o login continuará
        // via redirecionamento. Nada a fazer aqui, apenas aguardar o redirecionamento.
        console.log('Login com Google iniciado via redirecionamento');
      }
    } catch (err) {
      console.error('Erro no login com Google:', err);
      setError('Erro ao fazer login com Google. Tente novamente.');
      
      // Limpar flags em caso de erro
      localStorage.removeItem('google_login_initiated');
      localStorage.removeItem('google_login_timestamp');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Por favor, insira seu email para redefinir a senha');
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
      setResetSuccess(true);
      setError('');
      // Reset de contadores para permitir login após reset de senha
      tentativasDeLogin = 0;
      setBloqueado(false);
    } catch (err) {
      console.error('Erro ao enviar email de redefinição de senha:', err);
      const firebaseError = err as { code: string };
      
      if (firebaseError.code === 'auth/user-not-found') {
        setError('Não encontramos um usuário com este email');
      } else {
        setError('Erro ao enviar email de redefinição. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Acesse sua conta
        </h2>
        {cadastroSucesso && (
          <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded text-green-800 text-center">
            Cadastro realizado com sucesso! Agora você pode fazer login.
          </div>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {resetSuccess ? (
            <div className="text-center">
              <p className="text-green-600 text-lg mb-4">
                Um email com instruções para redefinir sua senha foi enviado para {email}. 
                Verifique sua caixa de entrada.
              </p>
              <p className="mt-8">
                <button
                  onClick={() => setResetSuccess(false)}
                  className="text-blue-600 underline"
                >
                  Voltar para login
                </button>
              </p>
            </div>
          ) : (
            <>
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      disabled={loading || bloqueado}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Senha
                  </label>
                  <div className="mt-1">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      disabled={loading || bloqueado}
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <span className="block sm:inline">{error}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      className="font-medium text-blue-600 hover:text-blue-500"
                      disabled={loading || bloqueado || !email}
                    >
                      Esqueceu sua senha?
                    </button>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
                    disabled={loading || bloqueado}
                  >
                    {loading ? 'Entrando...' : 'Entrar'}
                  </button>
                </div>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">
                      Ou continue com
                    </span>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={handleGoogleLogin}
                    className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled={loading || bloqueado}
                  >
                    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" width="24" height="24">
                      <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                        <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                        <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                        <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
                        <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                      </g>
                    </svg>
                    Entrar com Google
                  </button>
                </div>
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Não tem uma conta?{' '}
                  <Link 
                    href={peladaId ? `/cadastro?peladaId=${peladaId}` : '/cadastro'} 
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    Registre-se
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 