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

  useEffect(() => {
    const init = async () => {
      try {
        const id = params?.id;
        if (!id || typeof id !== 'string') {
          throw new Error('ID da pelada inválido');
        }
        
        // Salvar o ID da pelada no localStorage para referência futura
        if (typeof window !== 'undefined') {
          localStorage.setItem('ultimaPeladaIdVisitada', id);
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
          <div className="flex gap-4">
            {peladaData?.ownerId === user?.uid && (
              <button
                onClick={() => setShowConfigModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Configurar Pelada
              </button>
            )}
            <LogoutButton />
          </div>
        </div>
        
        {/* Menu de navegação */}
        <div className="bg-white border-b border-gray-200 mb-6">
          <div className="container mx-auto">
            <div className="flex space-x-8 border-b">
              <button className="relative py-4 px-6 font-medium text-sm text-blue-600">
                PELADA
                <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500"></div>
              </button>
              <Link href="/time" className="relative py-4 px-6 font-medium text-sm text-gray-500 hover:text-gray-700">
                TIME
              </Link>
            </div>
          </div>
        </div>
        
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
          <h2 className="text-xl font-semibold mb-4">Ranking dos Jogadores</h2>
          <RankingTable peladaId={params?.id as string} />
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
      </div>
    </div>
  );
} 