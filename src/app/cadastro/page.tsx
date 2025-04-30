'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/firebase/config';
import { createUser } from '@/firebase/userService';
import Link from 'next/link';

interface Jogador {
  id: string;
  nome: string;
  gols: number;
  assistencias: number;
}

export default function Cadastro() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const peladaId = searchParams.get('peladaId');
  const convidadoPor = searchParams.get('convidadoPor');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação de campos vazios
    if (!email || !password || !nome) {
      setError('Todos os campos são obrigatórios');
      return;
    }

    // Validação de formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Por favor, insira um email válido');
      return;
    }

    // Validação de força da senha
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    // Validação de nome
    if (nome.trim().length < 3) {
      setError('O nome deve ter pelo menos 3 caracteres');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Iniciando cadastro...', { email, nome, peladaId, convidadoPor });
      
      // Criar usuário com email e senha
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('Usuário criado no Firebase Auth:', userCredential.user.uid);
      
      // Criar perfil do usuário no Firestore com informação de convite
      await createUser(userCredential.user.uid, nome.trim(), email, convidadoPor || undefined);
      console.log('Perfil do usuário criado no Firestore');

      // Fazer logout para garantir que o usuário faça login novamente
      await auth.signOut();
      
      // Redirecionar para a página de login com mensagem de sucesso
      if (peladaId) {
        router.push(`/login?peladaId=${peladaId}&cadastroSucesso=true${convidadoPor ? `&convidadoPor=${convidadoPor}` : ''}`);
      } else {
        router.push('/login?cadastroSucesso=true');
      }
    } catch (err: unknown) {
      console.error('Erro detalhado no cadastro:', err);
      let mensagemErro = 'Erro ao criar conta. Tente novamente.';
      
      // Traduzir mensagens de erro do Firebase
      const firebaseError = err as { code: string };
      console.log('Código do erro:', firebaseError.code);
      
      switch (firebaseError.code) {
        case 'auth/email-already-in-use':
          mensagemErro = 'Este email já está em uso. Por favor, use outro email ou faça login.';
          break;
        case 'auth/invalid-email':
          mensagemErro = 'O formato do email é inválido. Por favor, verifique e tente novamente.';
          break;
        case 'auth/weak-password':
          mensagemErro = 'A senha é muito fraca. Use pelo menos 6 caracteres, incluindo letras e números.';
          break;
        case 'auth/network-request-failed':
          mensagemErro = 'Erro de conexão. Verifique sua internet e tente novamente.';
          break;
        case 'auth/operation-not-allowed':
          mensagemErro = 'O cadastro com email e senha está desabilitado. Entre em contato com o suporte.';
          break;
        case 'auth/too-many-requests':
          mensagemErro = 'Muitas tentativas de cadastro. Por favor, aguarde alguns minutos e tente novamente.';
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Criar sua conta
          </h2>
          {peladaId && (
            <p className="mt-2 text-center text-sm text-gray-600">
              Você foi convidado para uma pelada! Crie sua conta para participar.
            </p>
          )}
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="nome" className="sr-only">
                Nome
              </label>
              <input
                id="nome"
                name="nome"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
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
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
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
                autoComplete="new-password"
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
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </div>
        </form>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Já tem uma conta?{' '}
            <Link
              href={peladaId ? `/login?peladaId=${peladaId}` : '/login'}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Faça login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
} 