'use client';

import WelcomeHeader from '@/components/WelcomeHeader';
import RecentMatches from '@/components/RecentMatches';
import { useUser } from '@/contexts/UserContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CriarPeladaModal from '@/components/CriarPeladaModal';
import PeladaConfigModal from '@/components/PeladaConfigModal';
import RankingTable from '@/components/RankingTable';
import SeasonTable from '@/components/SeasonTable';
import { buscarPeladaMaisRecente } from '@/firebase/peladaService';
import InviteButton from '@/components/InviteButton';
import { checkPeladaPermissions } from '@/firebase/permissionService';
import { doc, updateDoc, arrayUnion, arrayRemove, collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { toast } from 'react-toastify';
import NotificationsPanel from '@/components/NotificationsPanel';
import { Notification } from '@/types/notification';
import { auth } from '@/firebase/config';

interface Temporada {
  inicio: Timestamp;
  fim: Timestamp;
  nome: string;
  status: 'ativa' | 'encerrada' | 'aguardando';
}

interface PeladaData {
  id: string;
  nome: string;
  ownerId: string;
  players: string[];
  ranking: {
    [key: string]: {
      jogos: number;
      vitorias: number;
      derrotas: number;
      empates: number;
      gols: number;
      assistencias: number;
      pontos: number;
      nome: string;
    };
  };
  temporada?: Temporada;
}

interface Jogador {
  id: string;
  nome: string;
  photoURL: string | null;
  dataConfirmacao?: string;
}

// Array global para armazenar as funções de cancelamento de listeners
const activeListeners: Array<() => void> = [];

// Função para registrar listeners
const registerListener = (unsubscribe: () => void) => {
  activeListeners.push(unsubscribe);
};

// Função para limpar todos os listeners antes do logout
const clearAllListeners = () => {
  console.log(`Limpando ${activeListeners.length} listeners ativos antes do logout`);
  
  // Copia o array para evitar problemas de índice durante a iteração
  [...activeListeners].forEach((unsubscribe, index) => {
    try {
      unsubscribe();
      console.log(`Listener ${index} cancelado com sucesso`);
    } catch (err) {
      console.error(`Erro ao cancelar listener ${index}:`, err);
    }
  });
  
  // Limpa o array
  activeListeners.length = 0;
};

export default function Dashboard() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedPeladaId, setSelectedPeladaId] = useState<string | null>(null);
  const [loadingPelada, setLoadingPelada] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [peladaData, setPeladaData] = useState<PeladaData | null>(null);
  const [notifications, setNotifications] = useState<Array<Notification & { id: string }>>([]);
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
  }, [user, loading, router]);

  useEffect(() => {
    const carregarPeladaRecente = async () => {
      if (!user?.uid) return;

      try {
        setLoadingPelada(true);
        const pelada = await buscarPeladaMaisRecente(user.uid);
        if (pelada) {
          setSelectedPeladaId(pelada.id);
          // Verifica se o usuário é dono da pelada
          const permissions = await checkPeladaPermissions(user.uid, pelada.id);
          setIsOwner(permissions.isOwner);
          
          // Configura um listener para a pelada
          const peladaRef = doc(db, 'peladas', pelada.id);
          const unsubscribe = onSnapshot(peladaRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
              const dadosPelada = docSnapshot.data() as PeladaData;
              setPeladaData(dadosPelada);
            }
          }, (error) => {
            console.error('Erro ao monitorar pelada:', error);
          });

          // Registra o listener usando nossa função personalizada
          registerListener(unsubscribe);
        }
      } catch (error) {
        console.error('Erro ao carregar pelada recente:', error);
      } finally {
        setLoadingPelada(false);
      }
    };

    carregarPeladaRecente();
    
    // Cleanup: limpa todos os listeners quando o componente for desmontado
    return () => {
      clearAllListeners();
    };
  }, [user]);

  const handlePeladaCreated = async (peladaId: string) => {
    setSelectedPeladaId(peladaId);
    setIsOwner(true);
    setIsModalOpen(false);
  };

  const handlePeladaConfigured = async (peladaId: string) => {
    setIsConfigModalOpen(false);
    
    // Recarregar os dados da pelada para garantir que estamos exibindo os dados mais atualizados
    try {
      if (user?.uid) {
        setLoadingPelada(true);
        // Se a pelada foi configurada, atualizamos o ID selecionado
        setSelectedPeladaId(peladaId);
        
        // Verificamos permissões para esta pelada específica
        if (peladaId) {
          const permissions = await checkPeladaPermissions(user.uid, peladaId);
          setIsOwner(permissions.isOwner);
        } 
        // Caso contrário, buscamos a pelada mais recente
        else {
          const pelada = await buscarPeladaMaisRecente(user.uid);
          if (pelada) {
            setSelectedPeladaId(pelada.id);
            const permissions = await checkPeladaPermissions(user.uid, pelada.id);
            setIsOwner(permissions.isOwner);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao recarregar dados da pelada:', error);
    } finally {
      setLoadingPelada(false);
    }
  };

  const handleConfirm = async (notification: Notification) => {
    if (!user || !notification.peladaId) return;

    try {
      const peladasRef = collection(db, 'peladas');
      const peladaRef = doc(peladasRef, notification.peladaId);
      
      const jogador: Jogador = {
        id: user.uid,
        nome: user.displayName || user.email?.split('@')[0] || 'Usuário',
        photoURL: user.photoURL || null,
        dataConfirmacao: new Date().toISOString()
      };

      await updateDoc(peladaRef, {
        confirmados: arrayUnion(jogador)
      });

      const notificationsRef = collection(db, 'notifications');
      const notificationRef = doc(notificationsRef, notification.id);
      await updateDoc(notificationRef, {
        read: true,
        respondido: true,
        resposta: 'confirmado'
      });

      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );

      toast.success('Presença confirmada com sucesso!');
      router.push(`/pelada/${notification.peladaId}/confirmar`);
    } catch (error) {
      console.error('Erro ao confirmar presença:', error);
      toast.error('Erro ao confirmar presença. Tente novamente.');
    }
  };

  const handleReject = async (notification: Notification) => {
    if (!user || !notification.peladaId) return;

    try {
      const peladasRef = collection(db, 'peladas');
      const peladaRef = doc(peladasRef, notification.peladaId);
      
      const jogador: Jogador = {
        id: user.uid,
        nome: user.displayName || user.email?.split('@')[0] || 'Usuário',
        photoURL: user.photoURL || null
      };

      await updateDoc(peladaRef, {
        confirmados: arrayRemove(jogador)
      });

      const notificationsRef = collection(db, 'notifications');
      const notificationRef = doc(notificationsRef, notification.id);
      await updateDoc(notificationRef, {
        read: true,
        respondido: true,
        resposta: 'recusado'
      });

      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );

      toast.info('Presença recusada');
    } catch (error) {
      console.error('Erro ao recusar presença:', error);
      toast.error('Erro ao recusar presença. Tente novamente.');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const notificationsRef = collection(db, 'notifications');
      await Promise.all(
        notifications
          .filter(n => !n.read)
          .map(n => updateDoc(doc(notificationsRef, n.id), { read: true }))
      );

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('Todas as notificações foram marcadas como lidas');
    } catch (error) {
      console.error('Erro ao marcar todas notificações como lidas:', error);
      toast.error('Erro ao marcar notificações como lidas');
    }
  };

  // Função de logout que limpa listeners e faz o logout - agora dentro do componente
  const handleLogout = async () => {
    try {
      // Primeiro limpa todos os listeners ativos
      clearAllListeners();
      
      // Agora faz logout com segurança
      await auth.signOut();
      
      // Limpa localStorage
      localStorage.clear();
      
      // Redireciona para login
      router.push('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao sair da conta. Tente novamente.');
    }
  };

  if (loading) {
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
      <WelcomeHeader onLogout={handleLogout} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Coluna da Esquerda */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Ações</h2>
              <div className="space-y-4">
                {isOwner && selectedPeladaId && (
                  <>
                    <button
                      onClick={() => setIsConfigModalOpen(true)}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Configurar Pelada
                    </button>
                    <InviteButton peladaId={selectedPeladaId} />
                  </>
                )}
                {!selectedPeladaId && (
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Criar Nova Pelada
                  </button>
                )}
              </div>
            </div>
            
            {/* Últimas Partidas */}
            <div className="mt-6">
              <RecentMatches />
            </div>
          </div>

          {/* Coluna da Direita (Ranking e Temporada) */}
          <div className="lg:col-span-3">
            {/* Season Table */}
            {selectedPeladaId && peladaData && (
              <SeasonTable 
                peladaId={selectedPeladaId}
                temporada={peladaData.temporada}
                isOwner={isOwner}
              />
            )}

            {/* Ranking Table */}
            <div className="bg-black rounded-lg shadow overflow-hidden">
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-white">Ranking</h2>
                </div>
                
                {loadingPelada ? (
                  <div className="animate-pulse space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div className="h-4 bg-gray-800 rounded w-1/3"></div>
                        <div className="h-4 bg-gray-800 rounded w-1/4"></div>
                      </div>
                    ))}
                  </div>
                ) : selectedPeladaId ? (
                  <RankingTable peladaId={selectedPeladaId} />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-300 mb-4">
                      Você ainda não participa de nenhuma pelada.
                    </p>
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      Criar Minha Primeira Pelada
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Criação */}
      <CriarPeladaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handlePeladaCreated}
      />

      {/* Modal de Configuração */}
      {isConfigModalOpen && selectedPeladaId && (
        <PeladaConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          onSave={handlePeladaConfigured}
          peladaId={selectedPeladaId}
        />
      )}

      <NotificationsPanel
        isOpen={isNotificationsPanelOpen}
        notifications={notifications}
        onClose={() => setIsNotificationsPanelOpen(false)}
        onMarkAllAsRead={handleMarkAllAsRead}
        onConfirm={handleConfirm}
        onReject={handleReject}
      />
    </div>
  );
} 