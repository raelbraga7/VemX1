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
import { toast } from 'react-hot-toast';

interface Time {
  nome: string;
  cor: string;
  jogadores: string[];
  placar: number;
}

export default function PaginaPelada() {
  const { user, temAssinaturaAtiva, verificandoAssinatura, isConvidado } = useUser();
  const params = useParams();
  const searchParams = useSearchParams();
  const peladaId = params.id as string;

  const [pelada, setPelada] = useState<PeladaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [activeTab, setActiveTab] = useState('Configurações');
  const [isOwner, setIsOwner] = useState(false);

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
        setPelada(pelada);
        const isDono = pelada.ownerId === user?.uid;
        setIsOwner(isDono);
        console.log('Verificação de dono da pelada:', {
          peladaOwnerId: pelada.ownerId,
          currentUserId: user?.uid,
          isDono: isDono
        });
        
        setLoading(false);
      } catch (err) {
        console.error('Erro ao inicializar página:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar página');
        setLoading(false);
      }
    };

    init();
  }, [params?.id, searchParams, user?.uid]);

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
              <button className="relative py-4 px-6 font-medium text-sm text-blue-600">
                PELADA
                <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500"></div>
              </button>
              <Link href={`/time?peladaId=${params?.id}`} replace>
                <button className="relative py-4 px-6 font-medium text-sm text-gray-500 hover:text-gray-700">
                  TIME
                </button>
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
                {pelada?.ownerId === user?.uid && (
                  <>
                    <div className="relative group">
                      <button
                        onClick={() => temAssinaturaAtiva ? setShowConfigModal(true) : toast.error('Assine um plano para configurar sua pelada')}
                        className={`w-full px-4 py-2 ${temAssinaturaAtiva ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'} text-white rounded-lg transition-colors`}
                        disabled={!temAssinaturaAtiva}
                      >
                        Configurar Pelada
                      </button>
                      {!temAssinaturaAtiva && !verificandoAssinatura && (
                        <div className="hidden group-hover:block absolute -top-12 left-1/2 transform -translate-x-1/2 bg-red-600 text-white p-2 rounded shadow-lg text-xs z-10 w-48 text-center">
                          Assine um plano para desbloquear
                        </div>
                      )}
                    </div>
                    
                    <div className="relative group">
                      {temAssinaturaAtiva ? (
                        <InviteButton peladaId={peladaId} />
                      ) : (
                        <button
                          onClick={() => toast.error('Assine um plano para convidar jogadores')}
                          className="w-full inline-flex items-center justify-center px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed"
                          disabled={true}
                        >
                          <svg
                            className="h-5 w-5 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                            />
                          </svg>
                          Copiar Link de Convite
                        </button>
                      )}
                      {!temAssinaturaAtiva && !verificandoAssinatura && (
                        <div className="hidden group-hover:block absolute -top-12 left-1/2 transform -translate-x-1/2 bg-red-600 text-white p-2 rounded shadow-lg text-xs z-10 w-48 text-center">
                          Assine um plano para desbloquear
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Coluna da Direita */}
          <div className="lg:col-span-3">
            {/* Season Table */}
            {pelada && (
              <div className="mb-8">
                <SeasonTable 
                  peladaId={peladaId}
                  temporada={pelada.temporada}
                  isOwner={isOwner && temAssinaturaAtiva}
                  tipoTela="pelada"
                />
              </div>
            )}

            {/* Ranking Table */}
            <div className="bg-black rounded-lg shadow-lg overflow-hidden">
              <div className="p-4 sm:p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Ranking dos Jogadores</h2>
                <RankingTable peladaId={peladaId} />
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
            peladaId={peladaId}
          />
        )}

        {/* Banner de Acesso Limitado - Apenas para donos da pelada que não sejam convidados */}
        {isOwner && !temAssinaturaAtiva && !verificandoAssinatura && !isConvidado && (
          <div className="fixed bottom-4 left-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg max-w-xs">
            <h3 className="font-bold mb-2">Acesso Limitado</h3>
            <p className="text-sm mb-3">Algumas funcionalidades estão bloqueadas. Assine um plano para desbloquear.</p>
            <button 
              onClick={() => setShowConfigModal(true)}
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