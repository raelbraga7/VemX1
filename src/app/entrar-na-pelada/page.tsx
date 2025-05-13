'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { useInvite } from '@/hooks/useInvite';
import { getUser } from '@/firebase/userService';
import Link from 'next/link';

export default function EntrarNaPelada() {
  const searchParams = useSearchParams();
  const peladaId = searchParams?.get('id') || null;
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { acceptInvite, loading: inviteLoading } = useInvite();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!peladaId) {
      router.push('/dashboard');
      return;
    }

    // Se não estiver carregando e não tiver usuário, redireciona para login
    if (!userLoading && !user) {
      router.push(`/login?peladaId=${peladaId}`);
      return;
    }

    // Se tiver usuário, processa o convite
    if (user) {
      const processarConvite = async () => {
        try {
          // Verifica se o usuário existe no Firestore
          const userData = await getUser(user.uid);
          
          if (!userData) {
            // Se o usuário não existe no Firestore, redireciona para o cadastro
            router.push(`/cadastro?peladaId=${peladaId}`);
            return;
          }

          // Se existe, processa o convite
          await acceptInvite(peladaId);
          // O redirecionamento para a página de confirmação é feito dentro do acceptInvite
        } catch (err) {
          if (err instanceof Error) {
            setError(err.message);
          } else {
            setError('Erro ao processar convite');
          }
        }
      };

      processarConvite();
    }
  }, [user, userLoading, peladaId, router, acceptInvite]);

  if (userLoading || inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Processando convite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Erro</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="flex justify-end">
              <Link
                href="/dashboard"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Voltar ao Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
} 