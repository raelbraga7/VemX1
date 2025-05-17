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
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
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

  // Verificar se há resultado de redirecionamento do Google ao carregar
  useEffect(() => {
    const verificarRedirecionamentoGoogle = async () => {
      try {
        // Verifica se já está em processo de redirecionamento
        if (redirecionandoRef.current) {
          return;
        }
        
        // Apenas tenta obter o resultado se o usuário não estiver logado
        if (!user && !userLoading) {
          console.log('Verificando se há resultado de redirecionamento do Google...');
          setLoading(true);
          const googleUser = await getGoogleRedirectResult();
          
          if (googleUser) {
            console.log('Login com Google por redirecionamento bem-sucedido:', googleUser.uid);
            
            // Se não tiver peladaId, redireciona para o dashboard
            if (!peladaId) {
              redirecionandoRef.current = true;
              router.push('/dashboard');
            }
            // Se tiver peladaId, o outro useEffect vai cuidar de processar o convite
          }
        }
      } catch (err) {
        console.error('Erro ao processar redirecionamento do Google:', err);
        setError('Erro ao processar login com Google. Tente novamente.');
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
    if (bloqueado) {
      setError(`Aguarde ${Math.ceil(tempoRestante / 1000)} segundos antes de tentar novamente.`);
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const googleUser = await signInWithGoogle();
      // Em caso de redirecionamento, googleUser será null
      // O resultado será processado no useEffect ao retornar
      if (googleUser) {
        console.log('Login com Google realizado com sucesso via popup:', googleUser.uid);
        
        // Resetar tentativas após sucesso
        tentativasDeLogin = 0;
        
        // Se não tiver peladaId, redireciona para o dashboard
        if (!peladaId) {
          router.push('/dashboard');
        }
        // Se tiver peladaId, o useEffect vai cuidar de processar o convite
      } else {
        console.log('Redirecionando para autenticação do Google...');
        // Não fazemos nada aqui, pois haverá um redirecionamento
        // O resultado será processado no useEffect quando o usuário retornar
      }
    } catch (err: unknown) {
      console.error('Erro no login com Google:', err);
      
      const googleError = err as { code?: string, message: string };
      
      // O usuário cancelou o login
      if (googleError.code === 'auth/cancelled-popup-request' || 
          googleError.code === 'auth/popup-closed-by-user') {
        setError('Login cancelado. Tente novamente.');
      } else if (googleError.code === 'auth/unauthorized-domain') {
        setError('Este domínio não está autorizado para login com Google. Entre em contato com o suporte.');
      } else {
        setError('Erro ao fazer login com Google. Tente novamente ou use email e senha.');
      }
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail) {
      setError('Por favor, informe seu email para redefinir a senha');
      return;
    }
    
    setResetLoading(true);
    setError('');
    
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSuccess(true);
      setShowResetForm(false);
      console.log('Email de redefinição enviado para:', resetEmail);
    } catch (err) {
      console.error('Erro ao enviar email de redefinição:', err);
      setError('Não foi possível enviar o email de redefinição. Verifique se o email está correto.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="w-full max-w-md px-4 py-6 sm:px-6">
        <div className="text-center mb-4">
          <h2 className="text-3xl font-extrabold text-white">
            VemX1
          </h2>
          {cadastroSucesso && (
            <div className="mt-1 p-2 bg-green-100 text-green-800 rounded text-center text-sm">
              Cadastro realizado com sucesso! Faça login para continuar.
            </div>
          )}
        </div>

        <div className="bg-gray-900 px-4 py-6 shadow sm:rounded-lg sm:px-8 text-white">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
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
                  className="appearance-none block w-full px-3 py-2 border border-gray-700 bg-gray-800 rounded-md shadow-sm placeholder-gray-500 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={loading || bloqueado}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
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
                  className="appearance-none block w-full px-3 py-2 border border-gray-700 bg-gray-800 rounded-md shadow-sm placeholder-gray-500 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={loading || bloqueado}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => setShowResetForm(true)}
                  className="font-medium text-blue-400 hover:text-blue-300 focus:outline-none focus:underline transition ease-in-out duration-150"
                >
                  Esqueceu sua senha?
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-2 rounded relative text-sm" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            {resetSuccess && (
              <div className="bg-green-900 border border-green-700 text-green-100 px-4 py-2 rounded relative text-sm" role="alert">
                <span className="block sm:inline">
                  Um link para redefinir sua senha foi enviado para o seu e-mail.
                </span>
              </div>
            )}

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed"
                disabled={loading || bloqueado}
              >
                {loading ? 'Entrando...' : bloqueado ? `Bloqueado (${Math.ceil(tempoRestante / 1000)}s)` : 'Entrar'}
              </button>
            </div>
          </form>

          {showResetForm && (
            <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-gray-200 mb-3">Redefinir senha</h3>
              <form onSubmit={handleResetPassword}>
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-gray-300">
                    Email
                  </label>
                  <div className="mt-1">
                    <input
                      id="reset-email"
                      name="email"
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-700 bg-gray-800 rounded-md shadow-sm placeholder-gray-500 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      disabled={resetLoading}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowResetForm(false)}
                    className="text-sm font-medium text-gray-400 hover:text-gray-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400"
                    disabled={resetLoading}
                  >
                    {resetLoading ? 'Enviando...' : 'Enviar link'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-900 text-gray-400">
                  Ou continue com
                </span>
              </div>
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex justify-center items-center py-2 px-4 border border-gray-700 rounded-md shadow-sm text-sm font-medium text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                disabled={loading}
              >
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" width="24" height="24">
                  <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                    <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                    <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                    <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                    <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                  </g>
                </svg>
                Google
              </button>
            </div>
          </div>

          <div className="mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-900 text-gray-400">
                  Não tem uma conta?
                </span>
              </div>
            </div>

            <div className="mt-3 text-center">
              <Link 
                href={peladaId ? `/cadastro?peladaId=${peladaId}` : '/cadastro'} 
                className="font-medium text-blue-400 hover:text-blue-300"
              >
                Registre-se
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 