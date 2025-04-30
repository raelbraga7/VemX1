'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/firebase/config';
import { useInvite } from '@/hooks/useInvite';
import { useUser } from '@/contexts/UserContext';
import Link from 'next/link';

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
  const peladaId = searchParams.get('peladaId');
  const cadastroSucesso = searchParams.get('cadastroSucesso');
  const { acceptInvite } = useInvite();
  const { user, loading: userLoading } = useUser();

  // Efeito para processar o convite quando o usuário estiver disponível
  useEffect(() => {
    const processarConvite = async () => {
      if (peladaId && user && !userLoading) {
        try {
          console.log('Processando convite após inicialização do contexto:', {
            peladaId,
            userId: user.uid
          });
          await acceptInvite(peladaId);
        } catch (err) {
          console.error('Erro ao processar convite:', err);
          setError('Erro ao aceitar o convite. Por favor, tente novamente.');
        }
      }
    };

    processarConvite();
  }, [peladaId, user, userLoading, acceptInvite]);

  // Efeito para contar o tempo de bloqueio
  useEffect(() => {
    let intervalo: NodeJS.Timeout;
    
    if (bloqueado && tempoRestante > 0) {
      intervalo = setInterval(() => {
        setTempoRestante(prev => {
          if (prev <= 1000) {
            clearInterval(intervalo);
            setBloqueado(false);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }
    
    return () => {
      if (intervalo) clearInterval(intervalo);
    };
  }, [bloqueado, tempoRestante]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar se está bloqueado
    if (bloqueado) {
      setError(`Muitas tentativas de login. Aguarde ${Math.ceil(tempoRestante / 1000)} segundos antes de tentar novamente.`);
      return;
    }
    
    // Verificar tentativas de login
    if (tentativasDeLogin >= MAX_TENTATIVAS) {
      setBloqueado(true);
      setTempoRestante(tempoBloqueio);
      tentativasDeLogin = 0;
      setError(`Muitas tentativas de login. Aguarde ${tempoBloqueio / 1000} segundos antes de tentar novamente.`);
      return;
    }
    
    setLoading(true);
    setError('');
    setResetSuccess(false);

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {peladaId ? 'Entre para participar da pelada' : 'Entre na sua conta'}
          </h2>
          {peladaId && (
            <p className="mt-2 text-center text-sm text-gray-600">
              Você foi convidado para uma pelada! Faça login para participar.
            </p>
          )}
          {cadastroSucesso && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
              <p className="text-center text-sm text-green-600">
                Conta criada com sucesso! Por favor, faça login para continuar.
              </p>
            </div>
          )}
          {resetSuccess && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
              <p className="text-center text-sm text-green-600">
                Email de redefinição enviado! Verifique sua caixa de entrada.
              </p>
            </div>
          )}
          {bloqueado && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
              <p className="text-center text-sm text-red-600">
                Conta temporariamente bloqueada. Aguarde {Math.ceil(tempoRestante / 1000)} segundos.
              </p>
            </div>
          )}
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <button
                type="button"
                onClick={handleResetPassword}
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Esqueceu sua senha?
              </button>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || bloqueado}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Entrando...' : bloqueado ? `Aguarde (${Math.ceil(tempoRestante / 1000)}s)` : 'Entrar'}
            </button>
          </div>
        </form>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Não tem uma conta?{' '}
            <Link
              href={peladaId ? `/cadastro?peladaId=${peladaId}` : '/cadastro'}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
} 