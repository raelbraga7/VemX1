'use client';

import WelcomeHeader from '@/components/WelcomeHeader';
import RecentMatches from '@/components/RecentMatches';
import { useUser } from '@/contexts/UserContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
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
import Link from 'next/link';
import { verificarAssinaturaAtiva } from '@/firebase/assinaturaService';
import { Dialog } from '@headlessui/react';
import { PLANOS } from '@/lib/planos';

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
  const searchParams = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedPeladaId, setSelectedPeladaId] = useState<string | null>(null);
  const [loadingPelada, setLoadingPelada] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [peladaData, setPeladaData] = useState<PeladaData | null>(null);
  const [notifications, setNotifications] = useState<Array<Notification & { id: string }>>([]);
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);
  const [temAssinaturaAtiva, setTemAssinaturaAtiva] = useState(false);
  const [verificandoAssinatura, setVerificandoAssinatura] = useState(true);
  const [isPlanosModalOpen, setIsPlanosModalOpen] = useState(false);
  const [loadingPlano, setLoadingPlano] = useState<string | null>(null);
  const [bannerFechado, setBannerFechado] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
  }, [user, loading, router]);

  // Verificar parâmetros de URL para pagamento
  useEffect(() => {
    const pagamento = searchParams?.get('pagamento');
    const plano = searchParams?.get('plano');
    
    if (pagamento) {
      console.log(`[Dashboard] Detectado parâmetro de pagamento: ${pagamento}, plano: ${plano}`);
      
      if (pagamento === 'sucesso') {
        const planoNome = plano === 'premium' ? 'Premium' : 'Básico';
        toast.success(`Pagamento do plano ${planoNome} aprovado! Sua assinatura está ativa.`);
        
        // Verificar assinatura novamente com força
        if (user?.uid) {
          console.log(`[Dashboard] Forçando verificação de assinatura após pagamento para usuário: ${user.uid}`);
          setVerificandoAssinatura(true);
          
          // Pequeno delay para garantir que o webhook teve tempo de processar
          setTimeout(async () => {
            try {
              // Verificar assinatura no Firestore
              const assinaturaAtiva = await verificarAssinaturaAtiva(user.uid);
              console.log(`[Dashboard] Status da assinatura após pagamento: ${assinaturaAtiva ? 'Ativa' : 'Inativa'}`);
              
              // Atualizar o estado e recarregar a página se não estiver ativa ainda
              setTemAssinaturaAtiva(assinaturaAtiva);
              setVerificandoAssinatura(false);
              
              if (!assinaturaAtiva) {
                console.log('[Dashboard] Assinatura ainda não ativa. Recarregando página em 2 segundos...');
                setTimeout(() => {
                  window.location.reload();
                }, 2000);
              }
            } catch (error) {
              console.error('[Dashboard] Erro ao verificar assinatura após pagamento:', error);
              setVerificandoAssinatura(false);
            }
          }, 1500);
        }
      } else if (pagamento === 'pendente') {
        toast.info('Seu pagamento está pendente de processamento. Você receberá uma notificação quando for aprovado.');
      } else if (pagamento === 'falha') {
        toast.error('Houve um problema com seu pagamento. Por favor, tente novamente.');
      }
      
      // Limpar os parâmetros da URL para evitar problemas de estado
      if (window.history.replaceState) {
        const url = window.location.href.split('?')[0];
        window.history.replaceState({path: url}, '', url);
      }
    }
  }, [searchParams, user, toast]);

  // Verificar assinatura do usuário separadamente
  useEffect(() => {
    if (!user?.uid) return;
    
    console.log(`[Dashboard] Configurando listener da assinatura para usuário: ${user.uid}`);
    
    // Configurar um listener para o documento do usuário no Firestore
    const userRef = doc(db, 'usuarios', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const userData = docSnapshot.data();
        const statusAssinatura = userData?.statusAssinatura;
        const isAtiva = statusAssinatura === 'ativa' || statusAssinatura === 'teste';
        
        console.log(`[Dashboard] Atualização em tempo real - Status da assinatura: ${statusAssinatura}`);
        
        setTemAssinaturaAtiva(isAtiva);
        setVerificandoAssinatura(false);
        
        // Se o status acabou de mudar para ativo, mostrar toast de confirmação
        if (isAtiva && !temAssinaturaAtiva) {
          const planoNome = userData?.plano === 'premium' ? 'Premium' : 'Básico';
          toast.success(`Sua assinatura do plano ${planoNome} está ativa!`);
        }
      } else {
        console.log(`[Dashboard] Documento do usuário não encontrado no listener`);
        setTemAssinaturaAtiva(false);
        setVerificandoAssinatura(false);
      }
    }, (error) => {
      console.error('[Dashboard] Erro no listener de assinatura:', error);
      setVerificandoAssinatura(false);
    });
    
    // Registrar o listener para limpeza posterior
    registerListener(unsubscribe);
    
    // Verificação inicial em caso de problemas com o listener
    const verificarAssinaturaInicial = async () => {
      try {
        console.log(`[Dashboard] Verificação inicial do status da assinatura`);
        setVerificandoAssinatura(true);
        const assinaturaAtiva = await verificarAssinaturaAtiva(user.uid);
        console.log(`[Dashboard] Status inicial da assinatura: ${assinaturaAtiva ? 'Ativa' : 'Inativa'}`);
        setTemAssinaturaAtiva(assinaturaAtiva);
      } catch (error) {
        console.error('[Dashboard] Erro ao verificar assinatura inicial:', error);
      } finally {
        setVerificandoAssinatura(false);
      }
    };
    
    verificarAssinaturaInicial();
    
    // Cleanup: o listener será limpo pela função clearAllListeners() no useEffect de limpeza global
    
  }, [user]);

  // Efeito para verificar a assinatura sempre que o componente fica visível
  useEffect(() => {
    // Esta função será chamada quando a página ficar visível (quando o usuário voltar para ela)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user?.uid) {
        console.log('[Dashboard] Página ficou visível - verificando assinatura novamente');
        const verificarAssinaturaNovamente = async () => {
          try {
            setVerificandoAssinatura(true);
            const assinaturaAtiva = await verificarAssinaturaAtiva(user.uid);
            console.log(`[Dashboard] Status atualizado da assinatura: ${assinaturaAtiva ? 'Ativa' : 'Inativa'}`);
            setTemAssinaturaAtiva(assinaturaAtiva);
          } catch (error) {
            console.error('[Dashboard] Erro ao verificar assinatura:', error);
          } finally {
            setVerificandoAssinatura(false);
          }
        };
        verificarAssinaturaNovamente();
      }
    };

    // Adicionar o listener para o evento de visibilidade
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Quando o componente é montado, verificar imediatamente (útil para navegação entre páginas)
    if (user?.uid) {
      console.log('[Dashboard] Re-montagem/navegação detectada - verificando assinatura');
      const verificarAssinaturaNovamente = async () => {
        try {
          setVerificandoAssinatura(true);
          const assinaturaAtiva = await verificarAssinaturaAtiva(user.uid);
          console.log(`[Dashboard] Status atualizado da assinatura: ${assinaturaAtiva ? 'Ativa' : 'Inativa'}`);
          setTemAssinaturaAtiva(assinaturaAtiva);
        } catch (error) {
          console.error('[Dashboard] Erro ao verificar assinatura:', error);
        } finally {
          setVerificandoAssinatura(false);
        }
      };
      verificarAssinaturaNovamente();
    }

    // Limpar o listener quando o componente for desmontado
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Efeito para verificar o localStorage quando o componente monta
  useEffect(() => {
    // Recuperar o estado da assinatura do localStorage (útil quando volta da página "time")
    const recuperarEstadoAssinatura = () => {
      if (typeof localStorage !== 'undefined' && user?.uid) {
        const estadoSalvo = localStorage.getItem('assinaturaAtiva');
        console.log(`[Dashboard] Estado da assinatura recuperado do localStorage: ${estadoSalvo}`);
        
        // Se não há estado salvo, verifica diretamente no Firestore
        if (estadoSalvo === null) {
          console.log('[Dashboard] Nenhum estado salvo, verificando direto no Firestore');
          return;
        }
        
        const assinaturaAtivaLocalStorage = estadoSalvo === 'true';
        
        // Se o estado salvo indica que o usuário não tem assinatura, garantimos que isso se reflita no estado
        // Isso evita que a UI mostre incorretamente funcionalidades premium
        if (!assinaturaAtivaLocalStorage) {
          console.log('[Dashboard] Definindo assinatura como inativa com base no localStorage');
          setTemAssinaturaAtiva(false);
          
          // Ainda assim, verificamos o status atual para atualizar caso tenha mudado
          verificarAssinaturaAtiva(user.uid)
            .then(assinaturaAtiva => {
              console.log(`[Dashboard] Verificação de confirmação: ${assinaturaAtiva ? 'Ativa' : 'Inativa'}`);
              setTemAssinaturaAtiva(assinaturaAtiva);
            })
            .catch(error => {
              console.error('[Dashboard] Erro ao verificar assinatura na inicialização:', error);
            });
        }
      }
    };
    
    recuperarEstadoAssinatura();
  }, [user]);

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

  // Links para checkout da Hotmart (substitua pelos seus links reais)
  const HOTMART_URLS = {
    premium: 'https://pay.hotmart.com/M99700196W?off=r5di19vt'
  };

  // Função para lidar com a escolha de plano
  const handleCTA = async (plano: string) => {
    if (!user) {
      toast.error('Você precisa estar logado para assinar um plano');
      return;
    }

    setLoadingPlano(plano);

    try {
      // Redirecionar para a página de checkout da Hotmart
      window.location.href = HOTMART_URLS[plano as 'premium'];
    } catch (error) {
      console.error('Erro ao iniciar checkout:', error);
      toast.error('Erro ao processar pagamento. Tente novamente.');
    } finally {
      setLoadingPlano(null);
    }
  };

  // Função para forçar verificação completa do estado da assinatura
  const forcarVerificacaoAssinatura = useCallback(async () => {
    if (!user?.uid) return;
    
    console.log('[Dashboard] Forçando verificação completa da assinatura');
    try {
      setVerificandoAssinatura(true);
      
      // Primeiro define como false para garantir que a UI não mostre recursos premium incorretamente
      setTemAssinaturaAtiva(false);
      
      // Então consulta o Firestore para obter o estado real
      const assinaturaAtiva = await verificarAssinaturaAtiva(user.uid);
      console.log(`[Dashboard] Status da assinatura após verificação forçada: ${assinaturaAtiva ? 'Ativa' : 'Inativa'}`);
      
      // Atualiza com o valor real
      setTemAssinaturaAtiva(assinaturaAtiva);
      
      // Salva no localStorage para referência futura
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('assinaturaAtiva', assinaturaAtiva ? 'true' : 'false');
        console.log(`[Dashboard] Salvando estado verificado no localStorage: ${assinaturaAtiva}`);
      }
    } catch (error) {
      console.error('[Dashboard] Erro na verificação forçada:', error);
      // Em caso de erro, mantém como false para segurança
      setTemAssinaturaAtiva(false);
      
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('assinaturaAtiva', 'false');
      }
    } finally {
      setVerificandoAssinatura(false);
    }
  }, [user]);

  // Executar verificação forçada na montagem do componente
  useEffect(() => {
    forcarVerificacaoAssinatura();
  }, [forcarVerificacaoAssinatura]);

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
        <div className="bg-white border-b border-gray-200 mb-6">
          <div className="container mx-auto">
            <div className="flex space-x-8 border-b">
              <button 
                onClick={() => {
                  // Verificar status da assinatura ao clicar na navegação "PELADA"
                  if (user?.uid) {
                    console.log('[Dashboard] Navegação para Pelada - verificando assinatura');
                    verificarAssinaturaAtiva(user.uid)
                      .then(assinaturaAtiva => {
                        console.log(`[Dashboard] Status na navegação: ${assinaturaAtiva ? 'Ativa' : 'Inativa'}`);
                        setTemAssinaturaAtiva(assinaturaAtiva);
                      })
                      .catch(error => {
                        console.error('[Dashboard] Erro ao verificar assinatura na navegação:', error);
                      });
                  }
                }}
                className="relative py-4 px-6 font-medium text-sm text-blue-600"
              >
                PELADA
                <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500"></div>
              </button>
              <Link 
                href="/time" 
                className="relative py-4 px-6 font-medium text-sm text-gray-500 hover:text-gray-700"
                onClick={() => {
                  // Armazenar no localStorage que o usuário não tem assinatura (caso não tenha)
                  // para que possa ser recuperado quando voltar
                  if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('assinaturaAtiva', temAssinaturaAtiva ? 'true' : 'false');
                    console.log(`[Dashboard] Salvando estado da assinatura ao navegar: ${temAssinaturaAtiva}`);
                  }
                }}
              >
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
                {isOwner && selectedPeladaId && (
                  <>
                    <div className="relative group">
                      <button
                        onClick={() => temAssinaturaAtiva ? setIsConfigModalOpen(true) : toast.error('Assine um plano para configurar sua pelada')}
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
                        <InviteButton peladaId={selectedPeladaId} />
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
            {!loadingPelada && selectedPeladaId && peladaData && (
              <div className="col-span-1 md:col-span-2">
                <SeasonTable 
                  peladaId={selectedPeladaId}
                  temporada={peladaData.temporada}
                  isOwner={isOwner && temAssinaturaAtiva}
                  tipoTela="pelada"
                />
              </div>
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

      {/* Modal de Planos */}
      <Dialog open={isPlanosModalOpen} onClose={() => setIsPlanosModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Dialog.Panel className="w-full max-w-md mx-auto bg-black text-white rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 sm:p-6 text-center">
              <Dialog.Title className="text-xl sm:text-2xl font-bold mb-4">
                Assine o VemX1
              </Dialog.Title>
              
              <div className="mx-auto">
                {/* Plano Premium */}
                <div className="bg-black/40 rounded-xl p-4 sm:p-6 border-2 border-[#1d4ed8] relative">
                  <div className="absolute top-0 right-0 left-0 bg-[#1d4ed8] text-white py-1 text-sm rounded-t-xl font-bold">
                    Plano VemX1
                  </div>
                  <div className="text-xl font-bold mb-2 mt-6">Plano Premium</div>
                  <div className="text-3xl font-bold mb-4">
                    R${PLANOS.PREMIUM.preco}
                    <span className="text-sm text-gray-400">/mês</span>
                  </div>
                  <ul className="text-left text-sm space-y-2 mb-4">
                    <li className="flex items-center">
                      <span className="text-[#1d4ed8] mr-2 text-xl">✓</span>
                      Jogadores ILIMITADOS
                    </li>
                    <li className="flex items-center">
                      <span className="text-[#1d4ed8] mr-2 text-xl">✓</span>
                      Peladas ILIMITADAS
                    </li>
                    <li className="flex items-center">
                      <span className="text-[#1d4ed8] mr-2 text-xl">✓</span>
                      Estatísticas avançadas
                    </li>
                    <li className="flex items-center">
                      <span className="text-[#1d4ed8] mr-2 text-xl">✓</span>
                      Suporte prioritário
                    </li>
                    <li className="flex items-center">
                      <span className="text-[#1d4ed8] mr-2 text-xl">✓</span>
                      Cancele quando quiser
                    </li>
                  </ul>
                  <button 
                    onClick={() => handleCTA('premium')}
                    disabled={loadingPlano === 'premium'}
                    className="bg-[#1d4ed8] hover:bg-[#1d4ed8]/90 text-white px-4 py-3 w-full rounded-lg text-lg font-medium transition-all hover:scale-105 hover:shadow-lg hover:shadow-[#1d4ed8]/20 disabled:opacity-70"
                  >
                    {loadingPlano === 'premium' ? 'Processando...' : 'Assinar Agora'}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setIsPlanosModalOpen(false)}
                className="mt-6 px-4 py-1 text-sm text-gray-300 hover:text-white"
              >
                Fechar
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      <NotificationsPanel
        isOpen={isNotificationsPanelOpen}
        notifications={notifications}
        onClose={() => setIsNotificationsPanelOpen(false)}
        onMarkAllAsRead={handleMarkAllAsRead}
        onConfirm={handleConfirm}
        onReject={handleReject}
      />

      {!temAssinaturaAtiva && !verificandoAssinatura && !bannerFechado && (
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
            onClick={() => setIsPlanosModalOpen(true)}
            className="w-full bg-white text-blue-600 py-2 px-4 rounded hover:bg-blue-100 transition-colors font-medium"
          >
            Ver Planos
          </button>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
} 