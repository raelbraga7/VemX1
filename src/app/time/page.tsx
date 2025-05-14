'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/firebase/config';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  deleteDoc,
  getDocs,
  query,
  where,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { DocumentData } from 'firebase/firestore';
import SeasonTable from '@/components/SeasonTable';
import PlayerCard from '@/components/PlayerCard';
import { useJogadorStats } from '@/hooks/useJogadorStats';
import { useJogadorTimeStats } from '@/hooks/useJogadorTimeStats';
import { Dialog } from '@headlessui/react';
import { PLANOS } from '@/lib/planos';

interface Jogador {
  id: string;
  nome: string;
  photoURL?: string | null;
  dataEntrada: string;
}

interface Time {
  id: string;
  name: string;
  jogadores: Jogador[];
  peladaId: string;
  createdAt: Timestamp;
}

interface RankingTime {
  id: string;
  nome: string;
  vitorias: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  saldoGols: number;
  pontos: number;
}

interface TimeSelecionado {
  id: string;
  name: string;
}

interface PeladaData {
  id?: string;
  nome: string;
  ownerId: string;
  players: string[];
  codigo: string;
  temporada?: {
    inicio: Timestamp;
    fim: Timestamp;
    nome: string;
    status: 'ativa' | 'encerrada' | 'aguardando';
  }
}

interface RankingTimeUpdate {
  vitorias?: number;
  derrotas?: number;
  golsPro?: number;
  golsContra?: number;
  saldoGols?: number;
  pontos?: number;
}

export default function TimeSelecionado() {
  const { user, temAssinaturaAtiva, verificandoAssinatura } = useUser();
  const [notification, setNotification] = useState('');
  const [teams, setTeams] = useState<Time[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [peladaId, setPeladaId] = useState<string | null>(null);
  const [peladaCodigo, setPeladaCodigo] = useState<string>('');
  const [timesSelecionados, setTimesSelecionados] = useState<TimeSelecionado[]>([]);
  const [peladaData, setPeladaData] = useState<PeladaData | null>(null);
  const [jogadorSelecionado, setJogadorSelecionado] = useState<Jogador | null>(null);
  const [modalAberta, setModalAberta] = useState<boolean>(false);
  const [timeDoJogador, setTimeDoJogador] = useState<string | null>(null);
  const [isPlanosModalOpen, setIsPlanosModalOpen] = useState(false);
  const [loadingPlano, setLoadingPlano] = useState<string | null>(null);
  
  // Buscar estatísticas gerais do jogador (pelada)
  const { stats: jogadorStats } = useJogadorStats(
    jogadorSelecionado?.id || '', 
    peladaId
  );
  
  // Buscar estatísticas específicas do jogador no time
  const { stats: jogadorTimeStats } = useJogadorTimeStats(
    jogadorSelecionado?.id || '',
    timeDoJogador
  );

  // Carregar a pelada do usuário e verificar se ele é o dono
  useEffect(() => {
    if (!user) return;

    const carregarPelada = async () => {
      try {
        setLoading(true);
        
        // Busca a pelada do usuário atual
        const peladasRef = collection(db, 'peladas');
        const q = query(peladasRef, where('players', 'array-contains', user.uid));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const peladaDoc = snapshot.docs[0];
          const peladaDocData = peladaDoc.data();
          
          // Armazenar os dados completos da pelada
          setPeladaData({
            id: peladaDoc.id,
            ...peladaDocData as PeladaData
          });
          
          // Manter para compatibilidade com o código existente
          setPeladaId(peladaDoc.id);
          setPeladaCodigo(peladaDocData.codigo || '');
          const isUserOwner = peladaDocData.ownerId === user.uid;
          setIsOwner(isUserOwner);

          // Agora que temos o ID da pelada, podemos buscar os times
          buscarTimes(peladaDoc.id);
          
          // Verificar times existentes e adicionar ao ranking se necessário
          await verificarTimesSemRanking(peladaDoc.id, peladaDocData);
        }
      } catch (error) {
        console.error('Erro ao carregar pelada:', error);
        toast.error('Erro ao carregar dados da pelada');
      } finally {
        setLoading(false);
      }
    };

    carregarPelada();
  }, [user]);

  // Buscar e ouvir alterações nos times
  const buscarTimes = (peladaIdParam: string) => {
    const timesRef = collection(db, 'times');
    const q = query(timesRef, where('peladaId', '==', peladaIdParam));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const timesList: Time[] = [];
      
      snapshot.forEach((doc) => {
        const timeData = doc.data() as Time;
        timesList.push({
          ...timeData,
          id: doc.id
        });
      });
      
      // Ordenar os times por data de criação
      timesList.sort((a, b) => {
        return a.createdAt.seconds - b.createdAt.seconds;
      });
      
      setTeams(timesList);
    }, (error) => {
      console.error('Erro ao buscar times:', error);
      toast.error('Erro ao buscar times');
    });
    
    // Retornar a função de limpeza para cancelar a inscrição quando o componente for desmontado
    return unsubscribe;
  };

  // Adicionar o time ao ranking da pelada
  const adicionarTimeAoRanking = async (timeId: string, timeName: string, peladaId: string) => {
    try {
      const peladaRef = doc(db, 'peladas', peladaId);
      
      // Criar objeto de ranking do time
      const rankingTime: RankingTime = {
        id: timeId,
        nome: timeName,
        vitorias: 0,
        derrotas: 0,
        golsPro: 0,
        golsContra: 0,
        saldoGols: 0,
        pontos: 0
      };

      // Obter o documento da pelada
      const peladaDoc = await getDoc(peladaRef);
      
      if (peladaDoc.exists()) {
        const peladaData = peladaDoc.data();
        
        // Objeto para armazenar as atualizações que serão aplicadas
        let updateData: { [key: string]: RankingTimeUpdate } = {};
        
        // Se não existir o campo rankingTimes, inicializar com um objeto vazio
        if (!peladaData.rankingTimes) {
          updateData = { rankingTimes: {} };
          // Aplicar a atualização inicial
          await updateDoc(peladaRef, updateData);
        }
        
        // Adicionar o time ao ranking com caminho específico
        updateData = {};
        updateData[`rankingTimes.${timeId}`] = rankingTime;
        
        // Aplicar a atualização do time
        await updateDoc(peladaRef, updateData);
        
        console.log(`Time ${timeName} adicionado ao ranking da pelada ${peladaId}`);
      } else {
        console.error('Documento da pelada não encontrado');
        toast.error('Erro ao adicionar time ao ranking: Pelada não encontrada');
      }
    } catch (error) {
      console.error('Erro ao adicionar time ao ranking:', error);
      toast.error('Erro ao adicionar time ao ranking');
    }
  };

  // Função para verificar times existentes e adicioná-los ao ranking se necessário
  const verificarTimesSemRanking = async (peladaId: string, peladaData: DocumentData) => {
    try {
      // Buscar todos os times da pelada
      const timesRef = collection(db, 'times');
      const q = query(timesRef, where('peladaId', '==', peladaId));
      const timesSnapshot = await getDocs(q);
      
      if (timesSnapshot.empty) return;
      
      // Verificar o ranking existente
      const rankingTimes = peladaData.rankingTimes || {};
      const timesParaAdicionar: {id: string, nome: string}[] = [];
      
      // Identificar times que não estão no ranking
      timesSnapshot.forEach((doc) => {
        const timeData = doc.data();
        if (!rankingTimes[doc.id]) {
          timesParaAdicionar.push({
            id: doc.id,
            nome: timeData.name
          });
        }
      });
      
      // Adicionar times ao ranking
      if (timesParaAdicionar.length > 0) {
        console.log(`Adicionando ${timesParaAdicionar.length} times existentes ao ranking`);
        
        const peladaRef = doc(db, 'peladas', peladaId);
        
        // Criar estrutura de ranking se não existir
        if (!peladaData.rankingTimes) {
          await updateDoc(peladaRef, { rankingTimes: {} });
        }
        
        // Adicionar cada time ao ranking
        for (const time of timesParaAdicionar) {
          await adicionarTimeAoRanking(time.id, time.nome, peladaId);
        }
        
        toast.success('Times existentes adicionados ao ranking');
      }
    } catch (error) {
      console.error('Erro ao verificar times sem ranking:', error);
    }
  };

  const handleAddTeam = async () => {
    if (!user || !peladaId) {
      toast.error('Você precisa estar em uma pelada para criar times');
      return;
    }

    if (!isOwner) {
      toast.error('Apenas o dono da pelada pode criar times');
      return;
    }

    if (!temAssinaturaAtiva) {
      toast.error('Assine um plano para criar times');
      return;
    }

    // Verificar se já atingiu o limite de 6 times
    if (teams.length >= 6) {
      toast.error('Limite máximo de 6 times atingido');
      setNotification('Limite máximo de 6 times atingido!');
      setTimeout(() => {
        setNotification('');
      }, 5000);
      return;
    }

    try {
      const teamLetter = String.fromCharCode(65 + teams.length); // A, B, C, etc.
      const timeRef = doc(collection(db, 'times'));
      const teamName = `Time ${teamLetter}`;
      
      const newTeam = {
        id: timeRef.id,
        name: teamName,
        jogadores: [],
        peladaId,
        createdAt: Timestamp.now()
      };
      
      // Criar o time no Firestore
      await setDoc(timeRef, newTeam);
      
      // Adicionar o time ao ranking da pelada
      await adicionarTimeAoRanking(timeRef.id, teamName, peladaId);
      
      setNotification(`Novo time ${teamLetter} adicionado!`);
      
      // Auto-esconder a notificação após 5 segundos
      setTimeout(() => {
        setNotification('');
      }, 5000);
    } catch (error) {
      console.error('Erro ao criar time:', error);
      toast.error('Erro ao criar time');
    }
  };

  const handleRemoveTeam = async (teamId: string) => {
    if (!user || !isOwner) {
      toast.error('Apenas o dono da pelada pode remover times');
      return;
    }

    try {
      // Remover o time da coleção de times
      await deleteDoc(doc(db, 'times', teamId));
      
      // Remover o time do ranking da pelada, se existir
      if (peladaId) {
        const peladaRef = doc(db, 'peladas', peladaId);
        await updateDoc(peladaRef, {
          [`rankingTimes.${teamId}`]: null
        });
      }
      
      setNotification("Time removido!");
      
      // Auto-esconder a notificação após 5 segundos
      setTimeout(() => {
        setNotification('');
      }, 5000);
    } catch (error) {
      console.error('Erro ao remover time:', error);
      toast.error('Erro ao remover time');
    }
  };

  const handleJoinTeam = async (teamId: string, teamName: string) => {
    if (!user) return;

    try {
      // Verificar se o usuário já está em algum time
      let userTeamId: string | null = null;
      
      for (const team of teams) {
        const userInTeam = team.jogadores.some(j => j.id === user.uid);
        if (userInTeam) {
          userTeamId = team.id;
          break;
        }
      }

      // Se o usuário já estiver em outro time, remova-o primeiro
      if (userTeamId) {
        await handleLeaveTeam(userTeamId);
      }

      // Adiciona o usuário ao time selecionado
      const timeRef = doc(db, 'times', teamId);
      
      const novoJogador: Jogador = {
        id: user.uid,
        nome: user.displayName || user.email?.split('@')[0] || 'Usuário',
        photoURL: user.photoURL || null,
        dataEntrada: new Date().toISOString()
      };
      
      await updateDoc(timeRef, {
        jogadores: arrayUnion(novoJogador)
      });

      setNotification(`Você entrou no ${teamName}`);
      
      setTimeout(() => {
        setNotification('');
      }, 5000);
    } catch (error) {
      console.error('Erro ao entrar no time:', error);
      toast.error('Erro ao entrar no time');
    }
  };

  const handleLeaveTeam = async (teamId: string) => {
    if (!user) return;

    try {
      const timeRef = doc(db, 'times', teamId);
      const time = teams.find(t => t.id === teamId);
      
      if (!time) return;
      
      const jogador = time.jogadores.find(j => j.id === user.uid);
      
      if (jogador) {
        await updateDoc(timeRef, {
          jogadores: arrayRemove(jogador)
        });
      }

      setNotification("Você saiu do time");
      
      setTimeout(() => {
        setNotification('');
      }, 5000);
    } catch (error) {
      console.error('Erro ao sair do time:', error);
      toast.error('Erro ao sair do time');
    }
  };

  // Verifica se o usuário atual está em um time
  const isUserInTeam = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return false;
    
    return team.jogadores.some(jogador => jogador.id === user?.uid);
  };

  const handleSelecionarAdversario = (team: Time) => {
    if (timesSelecionados.length >= 2 && !timesSelecionados.some(t => t.id === team.id)) {
      toast.error('Você já selecionou 2 times para jogar!');
      return;
    }

    if (timesSelecionados.some(t => t.id === team.id)) {
      setTimesSelecionados(prev => prev.filter(t => t.id !== team.id));
      toast.success(`Time ${team.name} removido da seleção`);
    } else {
      setTimesSelecionados(prev => [...prev, { id: team.id, name: team.name }]);
      toast.success(`Time ${team.name} selecionado!`);
    }
  };

  const handleIniciarPartida = () => {
    if (!temAssinaturaAtiva) {
      toast.error('Assine um plano para iniciar partidas');
      return;
    }

    if (timesSelecionados.length !== 2) {
      toast.error('Selecione exatamente 2 times para iniciar a partida!');
      return;
    }

    localStorage.setItem(`timesSelecionados_${peladaId}`, JSON.stringify(timesSelecionados));
    
    // Redireciona para a nova página de partida-time em vez da página de confirmação
    window.location.href = `/pelada/${peladaId}/partida-time`;
  };

  // Adicionar função para abrir a carta do jogador
  const handleAbrirCartaJogador = (jogador: Jogador, timeId: string) => {
    setJogadorSelecionado(jogador);
    setTimeDoJogador(timeId);
    setModalAberta(true);
  };

  // Adicionar função para fechar o modal
  const handleFecharModal = () => {
    setModalAberta(false);
    setJogadorSelecionado(null);
  };

  // Links para checkout da Hotmart (substitua pelos seus links reais)
  const HOTMART_URLS = {
    basico: 'https://pay.hotmart.com/M99700196W?off=r5di19vt',
    premium: 'https://pay.hotmart.com/M99700196W?off=r5di19vt'
  };

  // Função para lidar com a escolha de plano
  const handleCTA = async (plano: string) => {
    if (!user) {
      toast.error('Você precisa estar logado para assinar um plano.');
      return;
    }

    setLoadingPlano(plano);

    try {
      // Redirecionar para a página de checkout da Hotmart
      window.location.href = HOTMART_URLS[plano as 'basico' | 'premium'];
    } catch (error) {
      console.error('Erro na assinatura:', error);
      toast.error('Falha ao iniciar o pagamento. Tente novamente.');
    } finally {
      setLoadingPlano(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-semibold py-6">Time Selecionado</h2>
          
          <div className="flex space-x-8 border-b">
            <Link href={peladaId ? `/pelada/${peladaId}` : "/dashboard"}>
              <button className="relative py-4 px-6 font-medium text-sm text-gray-500 hover:text-gray-700">
                PELADA
              </button>
            </Link>
            <Link href="/time">
              <button className="relative py-4 px-6 font-medium text-sm text-blue-600">
                TIME
                <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500"></div>
              </button>
            </Link>
          </div>
        </div>
      </div>
      
      {notification && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-md z-50 flex items-center">
          <span>{notification}</span>
          <button 
            onClick={() => setNotification('')}
            className="text-white ml-3 font-bold"
          >
            ✕
          </button>
        </div>
      )}
      
      <div className="container mx-auto px-4 py-6">
        {/* Adicionando o componente de cronômetro da temporada no topo */}
        {peladaId && (
          <div className="mb-6">
            <SeasonTable 
              peladaId={peladaId} 
              temporada={peladaData?.temporada} 
              isOwner={isOwner && temAssinaturaAtiva}
              tipoTela="time"
            />
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <div className="text-gray-600">Código da Pelada: {peladaCodigo}</div>
        </div>
        
        {isOwner && (
          <div className="relative group">
            <button 
              className={`w-full ${temAssinaturaAtiva ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 cursor-not-allowed'} text-white py-3 px-4 rounded-md flex items-center justify-center space-x-2 mb-8`}
              onClick={temAssinaturaAtiva ? handleAddTeam : () => toast.error('Assine um plano para criar times')}
              disabled={!temAssinaturaAtiva}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              <span>Novo Time</span>
            </button>
            {!temAssinaturaAtiva && !verificandoAssinatura && (
              <div className="hidden group-hover:block absolute -top-12 left-1/2 transform -translate-x-1/2 bg-red-600 text-white p-2 rounded shadow-lg text-xs z-10 w-48 text-center">
                Assine um plano para desbloquear
              </div>
            )}
          </div>
        )}
        
        {teams.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p>Nenhum time criado ainda.</p>
            {isOwner && (
              <p className="mt-2">Clique no botão acima para criar um novo time.</p>
            )}
            {!isOwner && (
              <p className="mt-2">Aguarde o organizador da pelada criar os times.</p>
            )}
          </div>
        ) : (
          teams.map((team) => (
            <div 
              key={team.id} 
              className={`bg-white rounded-lg shadow-md overflow-hidden transition-all duration-300 
                ${timesSelecionados.some(t => t.id === team.id) 
                  ? 'border-4 border-blue-500 transform scale-[1.02]' 
                  : 'border border-gray-200'}`}
            >
              <div className="flex justify-between items-center p-6 bg-gray-50 relative">
                <h3 className="text-xl font-semibold">{team.name}</h3>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  {team.jogadores.length} jogadores
                </span>
                {isOwner && team.jogadores.length === 0 && (
                  <button 
                    onClick={() => handleRemoveTeam(team.id)}
                    className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-600 z-10"
                  >
                    ✕
                  </button>
                )}
              </div>
              
              <div className="p-6 flex justify-between items-center border-t border-gray-200">
                {isUserInTeam(team.id) ? (
                  <button 
                    className="bg-orange-500 text-white py-2 px-4 rounded hover:bg-orange-600"
                    onClick={() => handleLeaveTeam(team.id)}
                  >
                    Sair do {team.name}
                  </button>
                ) : (
                  <button 
                    className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
                    onClick={() => handleJoinTeam(team.id, team.name)}
                  >
                    Participar do {team.name}
                  </button>
                )}
                <button 
                  className={`py-2 px-4 rounded transition-colors ${
                    timesSelecionados.some(t => t.id === team.id)
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                  onClick={() => handleSelecionarAdversario(team)}
                >
                  {timesSelecionados.some(t => t.id === team.id) 
                    ? 'Selecionado ✓' 
                    : 'Selecionar Time'}
                </button>
              </div>
              
              {team.jogadores.length > 0 ? (
                <div className="bg-blue-50 p-6">
                  {team.jogadores.map((jogador) => (
                    <div 
                      key={jogador.id} 
                      className="flex items-center mb-2 cursor-pointer hover:bg-blue-100 p-2 rounded-md transition-colors"
                      onClick={() => handleAbrirCartaJogador(jogador, team.id)}
                    >
                      <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">
                        {jogador.nome.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="text-gray-700">
                        {jogador.nome} {jogador.id === user?.uid && '(Você)'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-600">
                  <h3 className="text-lg font-medium mb-2">Aguardando jogadores...</h3>
                  <p className="text-sm text-gray-500">
                    Clique em &quot;Participar do {team.name}&quot; para entrar neste time
                  </p>
                </div>
              )}
            </div>
          ))
        )}
        
        <div className="flex-1 mt-auto">
          <button 
            onClick={handleIniciarPartida}
            disabled={timesSelecionados.length !== 2 || !temAssinaturaAtiva}
            className={`py-3 px-4 rounded-md flex items-center justify-center mb-4 mt-auto transition-all duration-300 ${
              timesSelecionados.length === 2 && temAssinaturaAtiva
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
            style={{ position: 'fixed', bottom: '20px', right: '20px', width: 'calc(100% - 40px)', maxWidth: '200px' }}
          >
            {timesSelecionados.length === 2 
              ? 'Iniciar Partida' 
              : `Selecione mais ${2 - timesSelecionados.length} time(s)`}
          </button>
        </div>
      </div>
      
      {/* Banner de Acesso Limitado - Apenas para donos da pelada */}
      {isOwner && !temAssinaturaAtiva && !verificandoAssinatura && (
        <div className="fixed bottom-4 left-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg max-w-xs">
          <h3 className="font-bold mb-2">Acesso Limitado</h3>
          <p className="text-sm mb-3">Algumas funcionalidades estão bloqueadas. Assine um plano para desbloquear.</p>
          <button 
            onClick={() => setIsPlanosModalOpen(true)}
            className="w-full bg-white text-blue-600 py-2 px-4 rounded hover:bg-blue-100 transition-colors font-medium"
          >
            Ver Planos
          </button>
        </div>
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
      
      {/* Componente de carta do jogador */}
      {jogadorSelecionado && (
        <PlayerCard 
          jogador={{
            ...jogadorSelecionado,
            vitorias: jogadorStats?.vitorias || 0,
            gols: jogadorStats?.gols || 0,
            assistencias: jogadorStats?.assistencias || 0,
            pontos: jogadorStats?.pontos || 0,
            jogos: jogadorStats?.jogos || 0,
            derrotas: jogadorStats?.derrotas || 0,
            empates: jogadorStats?.empates || 0
          }}
          timeStats={{
            ...jogadorTimeStats,
            vitorias: jogadorTimeStats?.vitorias || 0,
            derrotas: jogadorTimeStats?.derrotas || 0,
            gols: jogadorTimeStats?.gols || 0,
            assistencias: jogadorTimeStats?.assistencias || 0,
            pontos: jogadorTimeStats?.pontos || 0,
            jogos: jogadorTimeStats?.jogos || 0
          }}
          aberta={modalAberta}
          onClose={handleFecharModal}
        />
      )}
    </div>
  );
} 