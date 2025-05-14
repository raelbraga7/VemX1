'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { getPelada, PeladaData } from '@/firebase/peladaService';
import { createPeladaNotification } from '@/firebase/notificationService';
import PeladaConfigModal from '@/components/PeladaConfigModal';
import RankingTable from '@/components/RankingTable';
import SeasonTable from '@/components/SeasonTable';
import { LogoutButton } from '@/components/LogoutButton';
import Link from 'next/link';
import InviteButton from '@/components/InviteButton';
import { verificarAssinaturaAtiva } from '@/firebase/assinaturaService';

interface Time {
  nome: string;
  cor: string;
  jogadores: string[];
  placar: number;
}

export default function PaginaPelada() {
  const { user } = useUser();
  const params = useParams();
  const searchParams = useSearchParams();
  const [showModal, setShowModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [times] = useState<Time[]>([]);
  const [peladaData, setPeladaData] = useState<PeladaData | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [temAssinaturaAtiva, setTemAssinaturaAtiva] = useState(false);
  const [verificandoAssinatura, setVerificandoAssinatura] = useState(true);
  const [bannerFechado, setBannerFechado] = useState(false);

  useEffect(() => {
    // Verificar se o banner foi fechado anteriormente
    if (typeof window !== 'undefined') {
      const bannerStatus = localStorage.getItem('bannerFechado');
      setBannerFechado(bannerStatus === 'true');
    }
  }, []);

  const fecharBanner = () => {
    localStorage.setItem('bannerFechado', 'true');
    setBannerFechado(true);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const id = params?.id;
        if (!id || typeof id !== 'string') {
          throw new Error('ID da pelada inválido');
        }

        // Verifica se deve abrir a modal
        const showModalParam = searchParams?.get('showModal');
        if (showModalParam === 'true') {
          setShowConfigModal(true);
        }

        // Busca os dados da pelada
        const pelada = await getPelada(id);
        setPeladaData(pelada);
        const isDono = pelada.ownerId === user?.uid;
        setIsOwner(isDono);
        console.log('Verificação de dono da pelada:', {
          peladaOwnerId: pelada.ownerId,
          currentUserId: user?.uid,
          isDono: isDono
        });
        
        // Verificar assinatura somente se for o dono da pelada
        if (isDono) {
          await verificarAssinatura(user?.uid);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Erro ao inicializar página:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar página');
        setLoading(false);
      }
    };

    init();
  }, [params?.id, searchParams, user?.uid]);

  // Adicionando função para verificar assinatura
  const verificarAssinatura = async (userId: string | undefined) => {
    if (!userId) return;
    
    try {
      const assinaturaAtiva = await verificarAssinaturaAtiva(userId);
      setTemAssinaturaAtiva(assinaturaAtiva);
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
    } finally {
      setVerificandoAssinatura(false);
    }
  };

  const handleConfigSaved = async (peladaId: string) => {
    setShowConfigModal(false);
    try {
      if (user) {
        // Tenta criar a notificação, mas não bloqueia o fluxo se falhar
        await createPeladaNotification(
          user.uid,
          peladaId,
          'Configurações Atualizadas',
          'As configurações da pelada foram atualizadas'
        ).catch(err => console.error('Erro ao criar notificação:', err));
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Erro: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Gerenciar Pelada</h1>
          <LogoutButton />
        </div>
        
        {/* Navegação PELADA/TIME */}
        <div className="bg-white border-b border-gray-200 mb-6">
          <div className="container mx-auto">
            <div className="flex space-x-8 border-b">
              <Link href={`/pelada/${params?.id}`} className="relative py-4 px-6 font-medium text-sm text-blue-600">
                PELADA
                <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500"></div>
              </Link>
              <Link href="/time" className="relative py-4 px-6 font-medium text-sm text-gray-500 hover:text-gray-700">
                TIME
              </Link>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Coluna da Esquerda */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Ações</h2>
              <div className="space-y-4">
                {peladaData?.ownerId === user?.uid && (
                  <>
                    <button
                      onClick={() => setShowConfigModal(true)}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Configurar Pelada
                    </button>
                    <InviteButton peladaId={params?.id as string} />
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Coluna da Direita */}
          <div className="lg:col-span-3">
            {/* Season Table */}
            {peladaData && (
              <div className="mb-8">
                <SeasonTable 
                  peladaId={params?.id as string}
                  temporada={peladaData.temporada}
                  isOwner={isOwner}
                />
              </div>
            )}

            {/* Ranking Table */}
            <div className="bg-black rounded-lg shadow-lg overflow-hidden">
              <div className="p-4 sm:p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Ranking dos Jogadores</h2>
                <RankingTable peladaId={params?.id as string} />
              </div>
            </div>
          </div>
        </div>

        {showModal && times.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Times Gerados</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                Fechar
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {times.map((time, index) => (
                <div 
                  key={index}
                  className="p-4 rounded-lg border"
                  style={{ borderColor: time.cor }}
                >
                  <h3 className="font-medium mb-2" style={{ color: time.cor }}>
                    {time.nome}
                  </h3>
                  <ul className="space-y-1">
                    {time.jogadores.map((jogador, idx) => (
                      <li key={idx} className="text-sm text-gray-600">
                        • {jogador}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Config Modal */}
        {showConfigModal && (
          <PeladaConfigModal
            isOpen={showConfigModal}
            onClose={() => setShowConfigModal(false)}
            onSave={handleConfigSaved}
            peladaId={params?.id as string}
          />
        )}

        {/* Banner de Acesso Limitado - Exibe apenas para o dono da pelada */}
        {isOwner && !temAssinaturaAtiva && !verificandoAssinatura && !bannerFechado && (
          <div className="fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg max-w-xs">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold">Acesso Limitado</h3>
              <button 
                onClick={fecharBanner}
                className="text-white hover:text-gray-200 ml-2"
                aria-label="Fechar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <p className="text-sm mb-3">Algumas funcionalidades estão bloqueadas. Assine um plano para desbloquear.</p>
            <button 
              onClick={() => window.location.href = '/dashboard'}
              className="w-full bg-white text-blue-600 py-2 px-4 rounded hover:bg-blue-100 transition-colors font-medium"
            >
              Ver Planos
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 