'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/firebase/config';
import { useInvite } from '@/hooks/useInvite';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const peladaId = searchParams.get('peladaId');
  const { acceptInvite } = useInvite();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Fazer login com email e senha
      await signInWithEmailAndPassword(auth, email, password);
      
      // Se tiver um peladaId na URL, processa o convite
      if (peladaId) {
        try {
          await acceptInvite(peladaId);
          return; // O redirecionamento será feito pelo acceptInvite
        } catch (inviteError) {
          console.error('Erro ao processar convite:', inviteError);
          // Mesmo que dê erro no convite, redirecionamos para a pelada
          router.push(`/pelada/${peladaId}`);
          return;
        }
      }
      
      router.push('/dashboard');
    } catch (err: unknown) {
      console.error('Erro no login:', err);
      let mensagemErro = 'Erro ao fazer login. Tente novamente.';
      
      // Traduzir mensagens de erro do Firebase
      const firebaseError = err as { code: string };
      if (firebaseError.code === 'auth/user-not-found') {
        mensagemErro = 'Usuário não encontrado.';
      } else if (firebaseError.code === 'auth/wrong-password') {
        mensagemErro = 'Senha incorreta.';
      } else if (firebaseError.code === 'auth/invalid-email') {
        mensagemErro = 'Email inválido.';
      }
      
      setError(mensagemErro);
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

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
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