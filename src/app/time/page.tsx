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
  Timestamp
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';

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

export default function TimeSelecionado() {
  const { user } = useUser();
  const [notification, setNotification] = useState('');
  const [teams, setTeams] = useState<Time[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [peladaId, setPeladaId] = useState<string | null>(null);
  const [peladaCodigo, setPeladaCodigo] = useState<string>('');
  const [timesSelecionados, setTimesSelecionados] = useState<TimeSelecionado[]>([]);

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
          const peladaData = peladaDoc.data();
          setPeladaId(peladaDoc.id);
          setPeladaCodigo(peladaData.codigo || '');
          setIsOwner(peladaData.ownerId === user.uid);

          // Agora que temos o ID da pelada, podemos buscar os times
          buscarTimes(peladaDoc.id);
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

      // Verificar se o ranking já existe para esta pelada
      const peladaSnapshot = await getDocs(query(collection(db, 'peladas'), where('id', '==', peladaId)));
      if (!peladaSnapshot.empty) {
        const peladaDoc = peladaSnapshot.docs[0];
        const peladaData = peladaDoc.data();
        
        // Se não existir o campo rankingTimes, criar um objeto vazio
        if (!peladaData.rankingTimes) {
          await updateDoc(peladaRef, {
            rankingTimes: {}
          });
        }
        
        // Adicionar o time ao ranking
        await updateDoc(peladaRef, {
          [`rankingTimes.${timeId}`]: rankingTime
        });
      }
    } catch (error) {
      console.error('Erro ao adicionar time ao ranking:', error);
      toast.error('Erro ao adicionar time ao ranking');
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
    if (timesSelecionados.length !== 2) {
      toast.error('Selecione exatamente 2 times para iniciar a partida!');
      return;
    }

    localStorage.setItem(`timesSelecionados_${peladaId}`, JSON.stringify(timesSelecionados));
    
    // Redireciona para a nova página de partida-time em vez da página de confirmação
    window.location.href = `/pelada/${peladaId}/partida-time`;
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
            <Link href="/dashboard">
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
        <div className="flex justify-between items-center mb-6">
          <div className="text-gray-600">Código da Pelada: {peladaCodigo}</div>
        </div>
        
        {isOwner && (
          <button 
            className="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-md flex items-center justify-center space-x-2 mb-8"
            onClick={handleAddTeam}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <span>Novo Time</span>
          </button>
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
                    <div key={jogador.id} className="flex items-center mb-2">
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
            disabled={timesSelecionados.length !== 2}
            className={`py-3 px-4 rounded-md flex items-center justify-center mb-4 mt-auto transition-all duration-300 ${
              timesSelecionados.length === 2
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
    </div>
  );
} 