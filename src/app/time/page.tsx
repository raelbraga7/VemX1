'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import { LogoutButton } from '@/components/LogoutButton';

export default function TimePage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Redirecionar para login se não estiver autenticado
    if (!userLoading && !user) {
      router.push('/login');
      return;
    }

    // Inicialização da página
    const initPage = async () => {
      try {
        // Aqui você pode carregar dados específicos de times
        // Por exemplo: const times = await buscarTimes(user.uid);
        
        setLoading(false);
      } catch (error) {
        console.error('Erro ao carregar dados de times:', error);
        setLoading(false);
      }
    };

    if (user) {
      initPage();
    }
  }, [user, userLoading, router]);

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1d4ed8]"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Será redirecionado pelo useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-black text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">VemX1</h1>
          <div className="flex items-center gap-4">
            <button 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              onClick={() => router.push('/assinatura')}
            >
              Assinatura
            </button>
            <LogoutButton />
          </div>
        </div>
      </header>
      
      {/* Menu de navegação */}
      <div className="bg-white border-b border-gray-200 mb-6">
        <div className="container mx-auto">
          <div className="flex space-x-8 border-b">
            <Link href="/dashboard" className="relative py-4 px-6 font-medium text-sm text-gray-500 hover:text-gray-700">
              PELADA
            </Link>
            <button className="relative py-4 px-6 font-medium text-sm text-blue-600">
              TIME
              <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500"></div>
            </button>
          </div>
        </div>
      </div>
      
      {/* Conteúdo principal */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Coluna da Esquerda */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Meus Times</h2>
              <div className="space-y-4">
                <button
                  onClick={() => alert('Funcionalidade em desenvolvimento')}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Criar Novo Time
                </button>
              </div>
            </div>
          </div>
          
          {/* Coluna da Direita */}
          <div className="lg:col-span-3">
            <div className="bg-black text-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-6">Estatísticas de Times</h2>
              
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <p className="text-center text-lg mb-4">
                  Em breve você poderá gerenciar seus times aqui.
                </p>
                <p className="text-center text-sm text-gray-400">
                  Esta funcionalidade está em desenvolvimento. 
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="font-medium mb-2 text-blue-400">Jogos Recentes</h3>
                  <p className="text-sm text-gray-400">Nenhum jogo encontrado</p>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="font-medium mb-2 text-blue-400">Próximos Jogos</h3>
                  <p className="text-sm text-gray-400">Nenhum jogo agendado</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 