'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/firebase/config';
import { createUser } from '@/firebase/userService';
import Link from 'next/link';
import { signInWithGoogle } from '@/firebase/auth';

// Tipos para erros
interface GoogleError {
  code?: string;
  message: string;
}

export default function Cadastro() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const peladaId = searchParams?.get('peladaId') || null;
  const convidadoPor = searchParams?.get('convidadoPor') || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome || !email || !password) {
      setError('Todos os campos são obrigatórios');
      return;
    }
    
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Criar usuário no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Atualizar perfil com nome
      await updateProfile(user, {
        displayName: nome
      });
      
      // Criar ou atualizar perfil do usuário no Firestore
      await createUser(
        user.uid, 
        nome,
        email,
        convidadoPor || undefined
      );
      
      console.log('Usuário cadastrado com sucesso:', user);
      
      // Redirecionar para a página apropriada
      if (peladaId) {
        router.push(`/login?peladaId=${peladaId}${convidadoPor ? `&convidadoPor=${convidadoPor}` : ''}&cadastroSucesso=true`);
      } else {
        router.push('/login?cadastroSucesso=true');
      }
    } catch (error: unknown) {
      console.error('Erro ao criar conta:', error);
      
      const firebaseError = error as GoogleError;
      
      // Tratar erros específicos
      let mensagemErro = '';
      switch (firebaseError.code) {
        case 'auth/email-already-in-use':
          mensagemErro = 'Este email já está sendo usado. Tente fazer login.';
          break;
        case 'auth/invalid-email':
          mensagemErro = 'O email informado é inválido.';
          break;
        case 'auth/weak-password':
          mensagemErro = 'A senha é muito fraca. Use pelo menos 6 caracteres.';
          break;
        default:
          mensagemErro = `Erro ao criar conta. Por favor, tente novamente mais tarde. (${firebaseError.code})`;
          break;
      }
      
      setError(mensagemErro);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError('');

    try {
      // Login com Google
      const googleUser = await signInWithGoogle();
      console.log('Login com Google realizado com sucesso:', googleUser);

      // Verificar se o usuário existe
      if (!googleUser) {
        console.log('Usuário do Google é nulo, provavelmente redirecionado. A autenticação continuará após o redirecionamento.');
        return; // Sair da função, o usuário será redirecionado
      }

      // Verificar se já temos um nome para o perfil
      const displayName = googleUser.displayName || 'Usuário Google';
      const userEmail = googleUser.email || '';

      // Criar ou atualizar perfil do usuário no Firestore
      await createUser(
        googleUser.uid, 
        displayName,
        userEmail,
        convidadoPor || undefined
      );
      
      console.log('Perfil do usuário criado/atualizado no Firestore');

      // Redirecionar para a página apropriada
      if (peladaId) {
        router.push(`/login?peladaId=${peladaId}${convidadoPor ? `&convidadoPor=${convidadoPor}` : ''}&cadastroSucesso=true`);
      } else {
        router.push('/login?cadastroSucesso=true');
      }
    } catch (err: unknown) {
      console.error('Erro no cadastro com Google:', err);
      
      const googleError = err as GoogleError;
      
      // O usuário cancelou o login
      if (googleError.code === 'auth/cancelled-popup-request' || 
          googleError.code === 'auth/popup-closed-by-user') {
        setError('Cadastro cancelado. Tente novamente.');
      } else {
        setError('Erro ao cadastrar com Google. Tente novamente ou use email e senha.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="w-full max-w-md px-3 py-4 sm:px-6 sm:py-6">
        <div className="text-center mb-3 sm:mb-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            VemX1
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-gray-400">
            {peladaId ? 'Você foi convidado para uma pelada!' : 'Entre para o mundo das peladas organizadas'}
          </p>
        </div>

        <div className="bg-gray-900 px-3 py-4 sm:px-8 sm:py-6 shadow rounded-lg">
          <form className="space-y-3 sm:space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="nome" className="block text-xs sm:text-sm font-medium text-gray-300">
                Nome completo
              </label>
              <div className="mt-1">
                <input
                  id="nome"
                  name="nome"
                  type="text"
                  autoComplete="name"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="appearance-none block w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-700 bg-gray-800 rounded-md shadow-sm placeholder-gray-500 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-xs sm:text-sm font-medium text-gray-300">
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
                  className="appearance-none block w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-700 bg-gray-800 rounded-md shadow-sm placeholder-gray-500 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-gray-300">
                Senha
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-700 bg-gray-800 rounded-md shadow-sm placeholder-gray-500 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm"
                  disabled={loading}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                A senha deve ter pelo menos 6 caracteres
              </p>
            </div>

            {error && (
              <div className="bg-red-900 border border-red-700 text-red-100 px-2 sm:px-4 py-1.5 sm:py-2 rounded relative text-xs sm:text-sm" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-1.5 sm:py-2 px-3 sm:px-4 border border-transparent rounded-md shadow-sm text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? 'Cadastrando...' : 'Cadastrar'}
              </button>
            </div>
          </form>

          <div className="mt-3 sm:mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-xs sm:text-sm">
                <span className="px-2 bg-gray-900 text-gray-400">
                  Ou continue com
                </span>
              </div>
            </div>

            <div className="mt-2 sm:mt-3">
              <button
                type="button"
                onClick={handleGoogleSignUp}
                className="w-full flex justify-center items-center py-1.5 sm:py-2 px-3 sm:px-4 border border-gray-700 rounded-md shadow-sm text-xs sm:text-sm font-medium text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                disabled={loading}
              >
                <svg className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" viewBox="0 0 24 24" width="24" height="24">
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

          <div className="mt-3 sm:mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-xs sm:text-sm">
                <span className="px-2 bg-gray-900 text-gray-400">
                  Já tem uma conta?
                </span>
              </div>
            </div>

            <div className="mt-2 sm:mt-3 text-center">
              <Link
                href={peladaId ? `/login?peladaId=${peladaId}` : '/login'}
                className="font-medium text-blue-400 hover:text-blue-300 text-xs sm:text-sm"
              >
                Faça login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 