'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { 
  doc, 
  updateDoc, 
  onSnapshot, 
  arrayUnion, 
  arrayRemove, 
  getDoc
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getUserById, type UserData } from '@/firebase/userService';
import { sendConfirmationRequestToAllPlayers } from '@/firebase/notificationService';
import { toast } from 'react-hot-toast';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import { Jogador, PeladaData, RankingPlayer } from '@/types/pelada';

interface JogadorInfo extends Omit<Jogador, 'dataConfirmacao'> {
  confirmado: boolean;
  isOwner?: boolean;
  ranking?: RankingPlayer;
  dataConfirmacao: string;
}

interface Time {
  id: number;
  nome: string;
  cor: string;
  jogadores: Jogador[];
  selecionado: boolean;
}

interface PeladaUpdate {
  confirmados: ReturnType<typeof arrayUnion>;
  players?: ReturnType<typeof arrayUnion>;
  [key: `ranking.${string}`]: RankingPlayer;
}

// Cache em memória compartilhado entre componentes
interface CacheEntry {
  data: UserData;
  timestamp: number;
}

const CACHE_EXPIRATION_TIME = 1000 * 60 * 30; // 30 minutos
const userCacheMap = new Map<string, CacheEntry>();

// Função para limpar cache expirado
const limparCacheExpirado = () => {
  const agora = Date.now();
  for (const [key, entry] of userCacheMap.entries()) {
    if (agora - entry.timestamp > CACHE_EXPIRATION_TIME) {
      userCacheMap.delete(key);
    }
  }
};

// Limpa cache a cada 15 minutos
setInterval(limparCacheExpirado, 1000 * 60 * 15);

// Hook personalizado para gerenciar o carregamento de jogadores
const useJogadores = (peladaId: string, peladaData: PeladaData | null, isMounted: boolean) => {
  const { user } = useUser();
  const [jogadoresConfirmados, setJogadoresConfirmados] = useState<JogadorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const carregarInfoJogadores = useCallback(async () => {
    if (!peladaData || !isMounted) {
      setLoading(false);
      return;
    }

    console.log('DEBUG: Iniciando carregamento de jogadores para:', peladaId);
    console.log('DEBUG: Dados da pelada disponíveis:', {
      nome: peladaData.nome,
      ownerId: peladaData.ownerId,
      currentUser: user?.uid,
      isDono: user?.uid === peladaData.ownerId,
      playersCount: peladaData.players?.length || 0,
      rankingCount: Object.keys(peladaData.ranking || {}).length || 0,
      confirmadosCount: peladaData.confirmados?.length || 0,
      confirmados: peladaData.confirmados?.map(j => ({
        uid: j.uid,
        nome: j.nome,
        dataConfirmacao: j.dataConfirmacao
      }))
    });

    // CORREÇÃO CRÍTICA: Garantir que usamos o ranking como fonte principal de dados
    // mesmo que o jogador não esteja na lista de confirmados
    let jogadoresInfo: JogadorInfo[] = [];
    
    // PASSO 1: Usamos o ranking como fonte primária e definitiva de jogadores
    if (peladaData.ranking && Object.keys(peladaData.ranking).length > 0) {
      console.log('DEBUG: Usando dados do ranking como fonte única e primária de jogadores');
      jogadoresInfo = Object.entries(peladaData.ranking).map(([uid, rankingData]) => {
        // Verificamos se o jogador está confirmado na lista de confirmados
        const confirmado = peladaData.confirmados?.some(j => j.uid === uid) || false;
        const confirmacaoData = peladaData.confirmados?.find(j => j.uid === uid)?.dataConfirmacao || '';
        const isOwner = uid === peladaData.ownerId;
        
        return {
          uid,
          nome: rankingData.nome || `Jogador ${uid.substring(0, 5)}`,
          email: '',
          confirmado,
          isOwner,
          ranking: rankingData,
          dataConfirmacao: confirmacaoData
        } as JogadorInfo;
      });
      
      console.log('DEBUG: Total de jogadores do ranking:', jogadoresInfo.length);
    }
    
    // PASSO 2: Enriquecemos os dados com informações do Firebase (nome, email, etc.)
    const jogadoresRelevantes = new Set<string>(
      // Filtra IDs inválidos ou undefined
      Object.keys(peladaData.ranking || {}).filter(id => id && id !== 'undefined')
    );
    
    console.log('DEBUG: Total de jogadores relevantes para enriquecer:', jogadoresRelevantes.size);
    console.log('DEBUG: Lista de IDs de jogadores relevantes:', Array.from(jogadoresRelevantes));
    
    // Enriquece dados com informações do Firebase
    const cache = new Map<string, CacheEntry>();
    const jogadoresArray = Array.from(jogadoresRelevantes);
    const batchSize = 5;
    
    for (let i = 0; i < jogadoresArray.length; i += batchSize) {
      const batch = jogadoresArray.slice(i, i + batchSize);
      const batchPromises = batch.map(async (uid) => {
        // Verifica se uid é válido
        if (!uid) {
          console.error('DEBUG: ID do jogador indefinido ou nulo, ignorando...');
          return null;
        }
        
        let userData: UserData | null = null;
        
        // Verifica o cache
        const cachedEntry = cache.get(uid);
        if (cachedEntry && Date.now() - cachedEntry.timestamp < 5 * 60 * 1000) {
          userData = cachedEntry.data;
        } else {
          console.log(`DEBUG: Buscando dados do jogador ${uid} do Firebase`);
          userData = await getUserById(uid);
          if (userData) {
            cache.set(uid, { data: userData, timestamp: Date.now() });
          } else {
            console.error(`DEBUG: Dados do jogador ${uid} não encontrados`);
          }
        }

        if (userData) {
          // Verifica se este jogador já existe em jogadoresInfo
          const jogadorExistente = jogadoresInfo.find(j => j.uid === uid);
          
          if (jogadorExistente) {
            // Atualiza dados do jogador existente
            jogadorExistente.nome = userData.nome || jogadorExistente.nome;
            jogadorExistente.email = userData.email || jogadorExistente.email;
            jogadorExistente.photoURL = userData.photoURL || jogadorExistente.photoURL;
            return null; // Não retorna nada, pois já atualizamos o objeto existente
          } else {
            // Cria um novo jogador
            const confirmado = peladaData.confirmados?.some(j => j.uid === uid) || false;
            const isOwner = uid === peladaData.ownerId;
            const ranking = peladaData.ranking?.[uid];

            const jogador: JogadorInfo = {
              uid,
              nome: userData.nome || 'Desconhecido',
              email: userData.email || '',
              photoURL: userData.photoURL,
              confirmado,
              isOwner,
              ranking,
              dataConfirmacao: peladaData.confirmados?.find(j => j.uid === uid)?.dataConfirmacao || ''
            };
            
            return jogador;
          }
        }
        
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      // Adiciona apenas os novos jogadores (aqueles que não retornaram null)
      const novosJogadores = batchResults.filter((j): j is JogadorInfo => j !== null);
      jogadoresInfo.push(...novosJogadores);
    }

    // Limpa o cache expirado
    limparCacheExpirado();

    if (isMounted) {
      console.log('DEBUG: Total de jogadores carregados:', jogadoresInfo.length);
      console.log('DEBUG: Jogadores:', jogadoresInfo.map(j => ({
        nome: j.nome,
        uid: j.uid,
        confirmado: j.confirmado,
        isOwner: j.isOwner
      })));
      
      if (jogadoresInfo.length === 0) {
        console.warn('DEBUG: ALERTA! Nenhum jogador carregado. Isso não deveria acontecer com a nova lógica.');
      }
      
      // Garante que o dono está sempre presente na lista
      if (user?.uid && peladaData.ownerId === user.uid) {
        const donoExistente = jogadoresInfo.find(j => j.uid === user.uid);
        if (!donoExistente) {
          console.log('DEBUG: Adicionando o dono (usuário atual) à lista de jogadores');
          jogadoresInfo.push({
            uid: user.uid,
            nome: user.email?.split('@')[0] || 'Dono',
            email: user.email || '',
            confirmado: peladaData.confirmados?.some(j => j.uid === user.uid) || false,
            isOwner: true,
            ranking: peladaData.ranking?.[user.uid],
            dataConfirmacao: peladaData.confirmados?.find(j => j.uid === user.uid)?.dataConfirmacao || ''
          });
        }
      }
      
      setJogadoresConfirmados(jogadoresInfo);
      setLoading(false);
    }
  }, [peladaData, isMounted, user, peladaId]);

  // Carrega os jogadores quando os dados da pelada mudam
  useEffect(() => {
    if (peladaData) {
      console.log('DEBUG: Verificando dados da pelada antes de carregar jogadores:', {
        id: peladaData.id,
        totalPlayers: peladaData.players?.length || 0,
        totalRanking: Object.keys(peladaData.ranking || {}).length || 0,
        totalConfirmados: peladaData.confirmados?.length || 0,
        isDono: user?.uid === peladaData.ownerId
      });
      
      // DEBUG: Verifica todos os jogadores do ranking diretamente
      if (peladaData.ranking) {
        console.log('DEBUG: Jogadores do ranking:', Object.keys(peladaData.ranking).map(uid => ({
          uid,
          nome: peladaData.ranking?.[uid]?.nome || 'Desconhecido'
        })));
      }
      
      carregarInfoJogadores();
    }
  }, [peladaData, carregarInfoJogadores, user]);

  return {
    jogadoresConfirmados,
    loading,
    error,
    setError
  };
};

// Hook personalizado para gerenciar a confirmação de presença
const useConfirmacao = (
  user: { uid: string; email?: string | null } | null, 
  peladaId: string, 
  convidadoPor: string | null, 
  router: { push: (path: string) => void }, 
  status: string | null
) => {
  const [processando, setProcessando] = useState(false);
  const [error, setError] = useState('');

  const processarConfirmacao = useCallback(async (confirmado: boolean) => {
    if (!user || !peladaId) return;

    setProcessando(true);
    setError('');

    try {
      const peladaRef = doc(db, 'peladas', peladaId);
      const peladaDoc = await getDoc(peladaRef);

      if (!peladaDoc.exists()) {
        toast.error('Pelada não encontrada');
        router.push('/dashboard');
        return;
      }

      const pelada = peladaDoc.data() as PeladaData;
      const userInfo = await getUserById(user.uid);
      const nomeJogador = userInfo?.nome || user.email?.split('@')[0] || 'Usuário';

      if (confirmado) {
        // Verifica se o jogador já está confirmado
        const jaConfirmado = pelada.confirmados?.some(j => j.uid === user.uid);
        if (jaConfirmado) {
          toast('Você já está confirmado nesta pelada');
          setProcessando(false);
          return;
        }

        // CORREÇÃO: Removemos a verificação de limite máximo de jogadores confirmados
        // Os limites na tela (quantidadeTimes * jogadoresPorTime) são apenas para exibição visual
        // e não devem impedir que os jogadores confirmem presença
        
        // Prepara os dados do jogador
        const jogadorData: Jogador = {
          uid: user.uid,
          nome: nomeJogador,
          email: userInfo?.email || user.email || '',
          dataConfirmacao: new Date().toISOString(),
          convidadoPor: convidadoPor || null
        };

        if (userInfo?.photoURL) {
          jogadorData.photoURL = userInfo.photoURL;
        }

        // Verifica se o jogador já está no ranking
        const jaTemRanking = pelada.ranking && pelada.ranking[user.uid];

        // Prepara o objeto de atualização
        const updateObj: Partial<PeladaUpdate> = {
          confirmados: arrayUnion(jogadorData)
        };

        // Adiciona à lista de players apenas se não estiver lá
        if (!pelada.players?.includes(user.uid)) {
          updateObj.players = arrayUnion(user.uid);
        }

        // Adiciona ao ranking se ainda não estiver
        if (!jaTemRanking) {
          const rankingKey = `ranking.${user.uid}` as const;
          updateObj[rankingKey] = {
            jogos: 0,
            vitorias: 0,
            derrotas: 0,
            empates: 0,
            gols: 0,
            assistencias: 0,
            pontos: 0,
            nome: nomeJogador
          };
        }

        // Atualiza todos os dados necessários em uma única operação
        await updateDoc(peladaRef, updateObj);
        
        // CORREÇÃO: Atualiza dados localmente para garantir consistência
        // após a atualização do Firestore
        const peladaAposConfirmacao = await getDoc(peladaRef);
        if (peladaAposConfirmacao.exists()) {
          const dadosAtualizados = {
            ...peladaAposConfirmacao.data(),
            id: peladaId
          } as PeladaData;
          
          // Atualiza o cache local
          localStorage.setItem(`pelada_${peladaId}`, JSON.stringify(dadosAtualizados));
        }
        
        toast.success('Presença confirmada com sucesso!');

        // Redireciona apenas se veio de uma notificação
        if (status) {
          router.push('/dashboard');
        }
      } else {
        // Remove o jogador da lista de confirmados mas mantém no ranking
        const confirmacaoExistente = pelada.confirmados?.find(j => j.uid === user.uid);
        if (confirmacaoExistente) {
          // Verifica se o jogador está no ranking
          const jaTemRanking = pelada.ranking && pelada.ranking[user.uid];
          
          // Prepara o objeto de atualização
          const updateObj: Partial<PeladaUpdate> = {
            confirmados: arrayRemove(confirmacaoExistente)
          };
          
          // Garante que o jogador permaneça no ranking
          if (!jaTemRanking) {
            const rankingKey = `ranking.${user.uid}` as const;
            updateObj[rankingKey] = {
              jogos: 0,
              vitorias: 0,
              derrotas: 0,
              empates: 0,
              gols: 0,
              assistencias: 0,
              pontos: 0,
              nome: nomeJogador
            };
          }
          
          // Atualiza o Firestore
          await updateDoc(peladaRef, updateObj);
          
          // CORREÇÃO: Atualiza dados localmente após remover a confirmação
          const peladaAposCancelamento = await getDoc(peladaRef);
          if (peladaAposCancelamento.exists()) {
            const dadosAtualizados = {
              ...peladaAposCancelamento.data(),
              id: peladaId
            } as PeladaData;
            
            // Atualiza o cache local
            localStorage.setItem(`pelada_${peladaId}`, JSON.stringify(dadosAtualizados));
          }
          
          toast('Presença cancelada');
        } else {
          toast('Você não estava confirmado nesta pelada');
        }

        // Redireciona apenas se veio de uma notificação
        if (status) {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      console.error('Erro ao processar confirmação:', err);
      setError('Erro ao processar confirmação');
      toast.error('Erro ao processar sua solicitação. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }, [user, peladaId, convidadoPor, router, status]);

  return {
    processando,
    error,
    setError,
    processarConfirmacao
  };
};

// Hook personalizado para gerenciar o envio de convites
const useConvites = (
  user: { uid: string; email?: string | null } | null, 
  peladaId: string, 
  peladaData: PeladaData | null
) => {
  const [processandoConvites, setProcessandoConvites] = useState(false);
  const [error, setError] = useState('');

  const enviarConvites = async () => {
    if (!user || !peladaData) {
      toast.error('Erro: Dados incompletos');
      return;
    }

    if (!peladaData.id) {
      toast.error('ID da pelada não encontrado');
      return;
    }

    setProcessandoConvites(true);

    try {
      // Obter a lista de jogadores confirmados
      const jogadoresConfirmados = new Set(peladaData.confirmados?.map(j => j.uid) || []);
      
      // Filtra jogadores que ainda não confirmaram
      const jogadoresParaConvidar = Object.keys(peladaData.ranking || {})
        .filter(uid => !jogadoresConfirmados.has(uid));

      // Verificar se há jogadores para convidar
      if (jogadoresParaConvidar.length === 0) {
        toast('Todos os jogadores já foram convidados ou confirmaram presença', {
          duration: 3000,
          icon: '✓',
        });
        setProcessandoConvites(false);
        return;
      }

      console.log(`Enviando solicitações para ${jogadoresParaConvidar.length} jogadores:`, jogadoresParaConvidar);

      // Obtém a versão mais recente da pelada
      const peladaRef = doc(db, 'peladas', peladaData.id);
      const peladaDoc = await getDoc(peladaRef);
      
      if (!peladaDoc.exists()) {
        toast.error('Pelada não encontrada');
        return;
      }
      
      const dadosAtuais = peladaDoc.data() as PeladaData;
      
      // Prepara os dados atualizados da pelada
      const peladaAtualizada = {
        ...dadosAtuais,
        id: peladaData.id, // Garante que o ID está presente
        nome: dadosAtuais.nome || peladaData.nome
      };
      
      // Enviar notificações para todos os jogadores
      const totalNotificados = await sendConfirmationRequestToAllPlayers(
        peladaData.id, 
        peladaAtualizada.nome || 'Nova Pelada'
      );
      
      if (totalNotificados && totalNotificados > 0) {
        toast.success(`${totalNotificados} solicitações de confirmação enviadas com sucesso!`);
      } else {
        toast('Todos os jogadores já foram convidados ou confirmaram presença', {
          duration: 3000,
          icon: '✓',
        });
      }
    } catch (error) {
      console.error('Erro ao enviar solicitações de confirmação:', error);
      toast.error('Erro ao enviar solicitações de confirmação');
    } finally {
      setProcessandoConvites(false);
    }
  };

  return {
    processandoConvites,
    error,
    setError,
    enviarConvites
  };
};

// Hook personalizado para gerenciar a geração de times
const useGeracaoTimes = (peladaData: PeladaData | null, peladaId: string) => {
  const [times, setTimes] = useState<Time[]>([]);
  const [timesParaJogar, setTimesParaJogar] = useState<number[]>([]);
  const [modalAberta, setModalAberta] = useState(false);

  // Função para embaralhar array
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Função para gerar times aleatórios
  const gerarTimes = useCallback(() => {
    try {
      console.log("DEBUG: Iniciando geração de times com dados:", {
        totalConfirmados: peladaData?.confirmados?.length || 0,
        jogadoresPorTime: peladaData?.jogadoresPorTime || 5,
        quantidadeTimes: peladaData?.quantidadeTimes || 2
      });

      if (!peladaData?.confirmados || peladaData.confirmados.length === 0) {
        toast('Não há jogadores confirmados para gerar times', {
          icon: '⚠️',
          duration: 3000
        });
        console.error("Erro: Lista de confirmados vazia ou indefinida");
        return;
      }

      // Filtra apenas jogadores confirmados e verifica se são objetos válidos
      const jogadoresConfirmados = peladaData.confirmados.filter(jogador => 
        jogador && typeof jogador === 'object' && jogador.uid
      );

      console.log("DEBUG: Total de jogadores válidos confirmados:", jogadoresConfirmados.length);
      
      // Verificação mais flexível: permite gerar times mesmo com menos jogadores
      // que o configurado, desde que haja pelo menos 4 jogadores (2 por time mínimo)
      const minJogadoresPorTime = Math.max(2, Math.min(peladaData.jogadoresPorTime, 5));
      
      if (jogadoresConfirmados.length < 4) {
        toast('São necessários pelo menos 4 jogadores confirmados para gerar times!', {
          icon: '⚠️',
          duration: 3000
        });
        console.error("Erro: Menos de 4 jogadores confirmados");
        return;
      }

      // Embaralha os jogadores
      console.log("DEBUG: Embaralhando jogadores");
      const jogadoresEmbaralhados = shuffleArray(jogadoresConfirmados);
      const novosTimes: Time[] = [];

      // Calcula o número de times com base no número de jogadores disponíveis
      const numJogadores = jogadoresEmbaralhados.length;
      
      // Garante que sempre crie pelo menos 2 times, mesmo com poucos jogadores
      let numTimes = Math.min(
        peladaData.quantidadeTimes,
        Math.max(2, Math.floor(numJogadores / minJogadoresPorTime))
      );
      
      // Se tivermos poucos jogadores, limitamos a 2 times
      if (numJogadores < 10) {
        numTimes = 2;
      }
      
      console.log("DEBUG: Vai gerar", numTimes, "times com", numJogadores, "jogadores");

      // Calcula jogadores por time baseado no total disponível
      const jogadoresPorTimeReal = Math.floor(numJogadores / numTimes);
      
      console.log("DEBUG: Jogadores por time:", jogadoresPorTimeReal);

      // Distribui os jogadores entre os times
      for (let i = 0; i < numTimes; i++) {
        const timeJogadores = jogadoresEmbaralhados.slice(
          i * jogadoresPorTimeReal,
          (i + 1) * jogadoresPorTimeReal
        );

        console.log(`DEBUG: Time ${i+1} criado com ${timeJogadores.length} jogadores`);

        novosTimes.push({
          id: i + 1,
          nome: `Time ${i + 1}`,
          cor: peladaData.coresTimes?.[i] || '#1d4ed8',
          jogadores: timeJogadores,
          selecionado: false
        });
      }

      // Verifica se há jogadores restantes
      const jogadoresRestantes = jogadoresEmbaralhados.slice(
        numTimes * jogadoresPorTimeReal
      );

      console.log("DEBUG: Jogadores restantes:", jogadoresRestantes.length);

      // Distribui os jogadores restantes entre os times
      if (jogadoresRestantes.length > 0 && novosTimes.length > 0) {
        jogadoresRestantes.forEach((jogador, index) => {
          const timeIndex = index % novosTimes.length;
          novosTimes[timeIndex].jogadores.push(jogador);
          console.log(`DEBUG: Jogador ${jogador.nome || jogador.uid} adicionado ao Time ${timeIndex + 1}`);
        });
      }

      // Salva os times gerados no localStorage
      try {
        localStorage.setItem(`timesGerados_${peladaId}`, JSON.stringify(novosTimes));
        console.log('DEBUG: Times gerados salvos no localStorage');
      } catch (localStorageError) {
        console.error('DEBUG: Erro ao salvar times no localStorage:', localStorageError);
        // Continua mesmo com erro no localStorage
      }

      console.log("DEBUG: Times gerados com sucesso:", novosTimes.map(t => ({
        id: t.id,
        nome: t.nome,
        jogadores: t.jogadores.length
      })));

      setTimes(novosTimes);
      setTimesParaJogar([]);
    } catch (error) {
      console.error("ERRO NA GERAÇÃO DE TIMES:", error);
      toast('Erro ao gerar times. Verifique o console para mais detalhes.', {
        icon: '❌',
        duration: 5000
      });
    }
  }, [peladaData, peladaId]);

  const handleGerarTimes = useCallback(() => {
    try {
      console.log("DEBUG: handleGerarTimes iniciado", {
        confirmados: peladaData?.confirmados?.length || 0
      });
      
      if (!peladaData?.confirmados) {
        toast('Não foi possível gerar times: dados da pelada não encontrados', {
          icon: '⚠️'
        });
        return;
      }

      if (peladaData.confirmados.length === 0) {
        toast('Não há jogadores confirmados para gerar times!', {
          icon: '⚠️'
        });
        return;
      }

      // Verificação mais flexível - pelo menos 4 jogadores para fazer 2 times
      if (peladaData.confirmados.length < 4) {
        toast('São necessários pelo menos 4 jogadores confirmados para gerar times!', {
          icon: '⚠️'
        });
        return;
      }

      console.log("DEBUG: Chamando gerarTimes");
      gerarTimes();
      console.log("DEBUG: Abrindo modal");
      setModalAberta(true);
    } catch (error) {
      console.error("ERRO AO INICIAR GERAÇÃO DE TIMES:", error);
      toast('Erro ao iniciar geração de times', {
        icon: '❌'
      });
    }
  }, [peladaData, gerarTimes]);

  const handleSelecionarTime = useCallback((timeId: number) => {
    setTimes(times => times.map(time => ({
      ...time,
      selecionado: time.id === timeId ? !time.selecionado : time.selecionado
    })));

    setTimesParaJogar(atual => {
      if (atual.includes(timeId)) {
        return atual.filter(id => id !== timeId);
      }
      if (atual.length < 2) {
        return [...atual, timeId];
      }
      return [atual[1], timeId];
    });
  }, []);

  const handleFecharModal = () => {
    setModalAberta(false);
    setTimesParaJogar([]);
    setTimes([]);
  };

  const handleEmbaralharTimes = () => {
    gerarTimes();
  };

  return {
    times,
    timesParaJogar,
    modalAberta,
    handleGerarTimes,
    handleSelecionarTime,
    handleFecharModal,
    handleEmbaralharTimes
  };
};

// Hook personalizado para gerenciar o início da partida
const useIniciarPartida = (
  peladaId: string, 
  times: Time[], 
  timesParaJogar: number[], 
  router: { push: (path: string) => void }
) => {
  const handleIniciarPartida = () => {
    if (timesParaJogar.length !== 2) {
      toast('Selecione exatamente 2 times para jogar!', {
        icon: '⚠️'
      });
      return;
    }

    const timesSelecionados = times.filter(time => timesParaJogar.includes(time.id));
    
    // Prepara os times para a partida
    const timesPartida = timesSelecionados.map(time => ({
      ...time,
      jogadores: time.jogadores.map(j => ({
        ...j,
        gols: 0,
        assistencias: 0
      })),
      gols: 0
    }));

    // Salva os times no localStorage para recuperar na página da partida
    localStorage.setItem(`timesPartida_${peladaId}`, JSON.stringify(timesPartida));
    
    // Salva a data de início da partida
    const dataInicio = new Date().toISOString();
    localStorage.setItem(`dataInicioPartida_${peladaId}`, dataInicio);
    
    // Atualiza o status da pelada no Firestore
    updateDoc(doc(db, 'peladas', peladaId), {
      status: 'em_andamento',
      dataInicio: dataInicio,
      timesPartida: timesPartida
    }).then(() => {
      toast.success('Partida iniciada com sucesso!');
    // Redireciona para a página da partida
      router.push(`/pelada/${peladaId}/partida`);
    }).catch(err => {
      console.error('Erro ao iniciar partida:', err);
      toast.error('Erro ao iniciar partida. Tente novamente.');
    });
  };

  return { handleIniciarPartida };
};

export default function ConfirmarPresenca() {
  const { user, loading: userLoading } = useUser();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const status = searchParams.get('status');
  const convidadoPor = searchParams.get('convidadoPor');
  const [error, setError] = useState('');
  const [peladaData, setPeladaData] = useState<PeladaData | null>(null);
  const peladaId = params.id as string;
  const [isMounted, setIsMounted] = useState(true);

  // CORREÇÃO: Adicionar uma flag para forçar a atualização dos jogadores após confirmação
  const [forcarAtualizacao, setForcarAtualizacao] = useState(0);
  
  const { loading, error: jogadoresError } = 
    useJogadores(peladaId, peladaData, isMounted);
  
  const { processando, error: confirmacaoError, processarConfirmacao: processarConfirmacaoOriginal } = useConfirmacao(
    user,
    peladaId,
    convidadoPor,
    router,
    status
  );
  
  // CORREÇÃO: Wrapper para processarConfirmacao que força atualização após confirmar
  const processarConfirmacao = useCallback(async (confirmado: boolean) => {
    await processarConfirmacaoOriginal(confirmado);
    // Espera um pouco e então força a atualização dos jogadores
    setTimeout(() => {
      setForcarAtualizacao(prev => prev + 1);
    }, 500);
  }, [processarConfirmacaoOriginal]);
  
  const { processandoConvites, error: convitesError, enviarConvites } = useConvites(
    user,
    peladaId,
    peladaData
  );
  
  const { 
    times, 
    timesParaJogar, 
    modalAberta, 
    handleGerarTimes, 
    handleSelecionarTime, 
    handleFecharModal, 
    handleEmbaralharTimes 
  } = useGeracaoTimes(peladaData, peladaId);
  
  const { handleIniciarPartida } = useIniciarPartida(peladaId, times, timesParaJogar, router);

  // Atualiza o estado de erro geral
  useEffect(() => {
    if (jogadoresError) setError(jogadoresError);
    if (confirmacaoError) setError(confirmacaoError);
    if (convitesError) setError(convitesError);
  }, [jogadoresError, confirmacaoError, convitesError]);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Processa confirmação inicial se houver status na URL
  useEffect(() => {
    if (status === 'confirm') {
      processarConfirmacao(true);
    } else if (status === 'reject') {
      processarConfirmacao(false);
    }
  }, [status, processarConfirmacao]);

  // CORREÇÃO: Adicionar useEffect para observar forcarAtualizacao 
  // e recarregar os dados da pelada do Firestore após uma confirmação
  useEffect(() => {
    if (forcarAtualizacao > 0 && peladaId && user) {
      console.log('DEBUG: Forçando atualização após confirmação');
      const peladaRef = doc(db, 'peladas', peladaId);
      getDoc(peladaRef).then(doc => {
        if (doc.exists()) {
          const dadosAtualizados = {
            ...doc.data(),
            id: peladaId
          } as PeladaData;
          
          // CORREÇÃO: Verificar explicitamente se o usuário está na lista de confirmados
          const usuarioConfirmado = dadosAtualizados.confirmados?.some(j => j.uid === user.uid);
          console.log('DEBUG: Status de confirmação do usuário após atualização:', {
            uid: user.uid,
            confirmado: usuarioConfirmado,
            totalConfirmados: dadosAtualizados.confirmados?.length || 0,
            confirmadosUIDs: dadosAtualizados.confirmados?.map(j => j.uid)
          });
          
          // Atualiza o estado com os dados mais recentes
          setPeladaData(dadosAtualizados);
          
          // Atualiza o cache local
          localStorage.setItem(`pelada_${peladaId}`, JSON.stringify(dadosAtualizados));
          
          console.log('DEBUG: Dados da pelada recarregados após confirmação');
        }
      }).catch(err => {
        console.error('Erro ao forçar atualização:', err);
      });
    }
  }, [forcarAtualizacao, peladaId, user]);

  // Notificação de limite de jogadores excedido
  useEffect(() => {
    if (peladaData && !loading) {
      const totalConfirmados = peladaData.confirmados?.length || 0;
      const limitePeladaConfig = (peladaData.quantidadeTimes || 2) * (peladaData.jogadoresPorTime || 5);
      
      if (totalConfirmados > limitePeladaConfig) {
        // Usar chave no localStorage para garantir que a notificação apareça apenas uma vez por sessão
        const notificationKey = `limite_excedido_${peladaId}`;
        if (!localStorage.getItem(notificationKey)) {
          toast(`Limite de jogadores configurado (${limitePeladaConfig}) foi excedido. Há ${totalConfirmados} jogadores confirmados.`, {
            duration: 5000,
            icon: 'ℹ️'
          });
          localStorage.setItem(notificationKey, 'true');
        }
      }
    }
  }, [peladaData, loading, peladaId]);

  // CORREÇÃO: Readicionar a lógica de carregamento da pelada
  // Carrega dados da pelada
  useEffect(() => {
    if (!peladaId) {
      console.error('DEBUG: PeladaId não fornecido');
      setError('ID da pelada não fornecido');
      return;
    }

    if (userLoading) {
      console.log('DEBUG: Aguardando carregamento do usuário...');
      return;
    }

    if (!user) {
      console.error('DEBUG: Usuário não autenticado');
      router.push('/login?redirect=' + encodeURIComponent(`/pelada/${peladaId}/confirmar`));
      return;
    }

    console.log('=== DEBUG: Iniciando carregamento da pelada ===');
    console.log('PeladaId:', peladaId);
    console.log('UserId:', user.uid);

    // Primeiro tenta carregar os dados do cache local
    try {
      const cachedPeladaData = localStorage.getItem(`pelada_${peladaId}`);
      if (cachedPeladaData) {
        const parsedData = JSON.parse(cachedPeladaData) as PeladaData;
        console.log('DEBUG: Dados do cache local encontrados:', {
          nome: parsedData.nome,
          id: peladaId
        });
        // Define os dados do cache imediatamente para melhorar UX
        setPeladaData({
          ...parsedData,
          id: peladaId // Garante que o ID esteja presente
        });
      }
    } catch (err) {
      console.error('Erro ao carregar cache local:', err);
    }

    // Use onSnapshot para obter atualizações em tempo real
    const peladaRef = doc(db, 'peladas', peladaId);
    const unsubscribe = onSnapshot(peladaRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const typedData = {
          ...data,
          id: peladaId
        } as PeladaData;
        
        // Atualiza seu estado local com os dados mais recentes
        setPeladaData(typedData);
        localStorage.setItem(`pelada_${peladaId}`, JSON.stringify(typedData));
        
        console.log('DEBUG: Dados atualizados via onSnapshot:', {
          confirmados: typedData.confirmados?.length || 0,
          usuarioConfirmado: typedData.confirmados?.some(j => j.uid === user.uid) || false
        });
      }
    });

    // Limpar o listener quando o componente for desmontado
    return () => {
      unsubscribe();
    };
  }, [peladaId, user, userLoading, router]);
  
  // Limpar confirmações automáticas - executado uma vez quando a página carrega
  useEffect(() => {
    const limparConfirmacoesAutomaticas = async () => {
      if (!peladaData || !user) return;

      // Verifica se é o dono da pelada
      const isOwner = user.uid === peladaData.ownerId;
      
      // CORREÇÃO: Desativar a limpeza automática que está causando o problema
      // Se não for o dono, não faz nada
      if (!isOwner) return;

      // CORREÇÃO: Esta lógica está causando o problema - desativando-a temporariamente
      // Obtém o documento da pelada
      // const peladaRef = doc(db, 'peladas', peladaId);
      
      // CORREÇÃO: Não limpar confirmações, isso está causando o problema
      // Filtra para manter apenas o dono como confirmado
      // const confirmadosAtualizados = peladaData.confirmados?.filter(j => j.uid === peladaData.ownerId) || [];
      
      // Atualiza a pelada no Firestore
      // try {
      //   await updateDoc(peladaRef, {
      //     confirmados: confirmadosAtualizados
      //   });
      //   console.log('Confirmações automáticas removidas com sucesso');
      // } catch (error) {
      //   console.error('Erro ao limpar confirmações automáticas:', error);
      // }
      
      // CORREÇÃO: Em vez disso, apenas log para debug
      console.log('DEBUG: Limpeza automática desativada - mantendo todas as confirmações', {
        userId: user.uid,
        isOwner,
        totalConfirmados: peladaData.confirmados?.length || 0,
        confirmados: peladaData.confirmados?.map(j => j.uid)
      });
    };

    limparConfirmacoesAutomaticas();
  }, [peladaData, user, peladaId]);

  if (userLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Verificando autenticação...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Carregando dados da pelada...</p>
        {peladaId && (
          <p className="text-gray-500 text-sm mt-2">ID: {peladaId}</p>
        )}
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Tentar novamente
        </button>
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

  if (!peladaData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Pelada não encontrada</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-5xl mx-auto p-4">
        <div className="bg-blue-500 text-white p-8 rounded-lg mb-6">
          <h1 className="text-3xl font-bold mb-6">Confirmar Presença</h1>
          
          <div className="grid grid-cols-2 gap-x-20 gap-y-4">
            <div>
              <h3 className="text-sm opacity-80">Times:</h3>
              <p className="text-xl font-semibold">{peladaData?.quantidadeTimes || 2} times</p>
            </div>
            
            <div>
              <h3 className="text-sm opacity-80">Jogadores por Time:</h3>
              <p className="text-xl font-semibold">{peladaData?.jogadoresPorTime || 5} jogadores</p>
            </div>
            
            <div>
              <h3 className="text-sm opacity-80">Total de Jogadores:</h3>
              <p className="text-xl font-semibold">{(peladaData?.quantidadeTimes || 2) * (peladaData?.jogadoresPorTime || 5)} jogadores</p>
            </div>
            
            <div>
              <h3 className="text-sm opacity-80">Confirmados:</h3>
              <p className="text-xl font-semibold text-green-300">{peladaData?.confirmados?.length || 0} jogadores</p>
            </div>
          </div>
        </div>
        
        {/* Botões de ação */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {peladaData.confirmados?.some(j => j.uid === user?.uid) ? (
            <button
              onClick={() => processarConfirmacao(false)}
              disabled={processando}
              className="flex items-center justify-center bg-red-600 text-white py-4 px-6 rounded-md hover:bg-red-700 transition-colors disabled:opacity-70"
            >
              <span className="mr-2">✕</span> Cancelar Presença
            </button>
          ) : (
            <button
              onClick={() => processarConfirmacao(true)}
              disabled={processando}
              className="flex items-center justify-center bg-blue-500 text-white py-4 px-6 rounded-md hover:bg-blue-600 transition-colors disabled:opacity-70"
            >
              <span className="mr-2">✓</span> Confirmar Presença
            </button>
          )}
          
          <button
            onClick={enviarConvites}
            disabled={processandoConvites}
            className="flex items-center justify-center bg-green-500 text-white py-4 px-6 rounded-md hover:bg-green-600 transition-colors disabled:opacity-70"
          >
            <span className="mr-2">📩</span> Enviar Solicitações
          </button>
        </div>
        
        {/* Lista de jogadores */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Lista de Jogadores</h2>
          <ul className="bg-white rounded-lg shadow overflow-hidden">
            {Object.entries(peladaData?.ranking || {}).map(([uid, rankingData]) => {
              // Verificar diretamente se o jogador está confirmado
              const confirmado = peladaData.confirmados?.some(j => j.uid === uid) || false;
              const isOwner = uid === peladaData.ownerId;
              
              return (
                <li 
                  key={uid} 
                  className="flex items-center border-b border-gray-100 p-4 last:border-0"
                >
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white mr-4">
                    <span>{rankingData.nome?.charAt(0).toUpperCase() || 'U'}</span>
                  </div>
                  <span>{rankingData.nome}</span>
                  {isOwner && <span className="ml-2 text-gray-500 text-sm">(Dono)</span>}
                  {confirmado && <span className="ml-2 text-green-500 text-sm">(Confirmado)</span>}
                  {uid === user?.uid && !confirmado && (
                    <button 
                      onClick={() => processarConfirmacao(true)}
                      className="ml-auto px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                    >
                      Confirmar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Botão flutuante para gerar times */}
      {user?.uid === peladaData?.ownerId && peladaData?.confirmados?.length > 0 && (
        <button
          onClick={handleGerarTimes}
          className="fixed bottom-8 right-8 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <GroupsIcon />
        </button>
      )}

      {/* Modal de Times */}
      <Dialog 
        open={modalAberta} 
        onClose={handleFecharModal}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <div className="flex justify-between items-center">
            <Typography variant="h6">Times Gerados</Typography>
              <Button 
                onClick={handleEmbaralharTimes}
                startIcon={<ShuffleIcon />}
              >
                Embaralhar
              </Button>
          </div>
        </DialogTitle>
        <DialogContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {times.map((time) => (
              <div
                key={time.id}
                onClick={() => handleSelecionarTime(time.id)}
                className={`p-4 rounded-lg border-2 cursor-pointer ${
                  time.selecionado 
                    ? 'border-blue-600 bg-blue-50' 
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                style={{ borderColor: time.selecionado ? time.cor : undefined }}
              >
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold">{time.nome}</h4>
                  <span className={`px-2 py-1 rounded-full text-sm ${
                    time.selecionado 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {time.selecionado ? 'Selecionado' : 'Selecionar'}
                  </span>
                </div>
                <ul className="space-y-2">
                  {time.jogadores.map((jogador) => (
                    <li key={jogador.uid} className="text-sm">
                      {jogador.nome}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFecharModal}>
            Cancelar
          </Button>
          <Button
            onClick={handleIniciarPartida}
            variant="contained"
            startIcon={<SportsSoccerIcon />}
            disabled={timesParaJogar.length !== 2}
          >
            Iniciar Partida
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
} 