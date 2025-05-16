import { db } from './config';
import { collection, doc, getDoc, getDocs, query, where, Timestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth } from './config';

export interface PlayerStats {
  uid: string;
  nome: string;
  vitorias: number;
  gols: number;
  assistencias: number;
  pontos: number;
}

export interface Pelada {
  id: string;
  nome: string;
  ownerId: string;
  players: string[];
  createdAt: Timestamp;
  status: string;
}

export interface Partida {
  id: string;
  peladaId: string;
  data: Timestamp;
  timeA: {
    nome: string;
    jogadores: string[];
    score: number;
  };
  timeB: {
    nome: string;
    jogadores: string[];
    score: number;
  };
  status: string;
  estatisticas?: {
    [uid: string]: {
      gols: number;
      assistencias: number;
    };
  };
}

interface RankingData {
  nome: string;
  vitorias: number;
  gols: number;
  assistencias: number;
  pontos: number;
}

// Cache para armazenar os rankings calculados
const rankingCache = new Map<string, { data: PlayerStats[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos em milissegundos

/**
 * Busca a pelada pelo ID
 */
export const getPeladaById = async (peladaId: string): Promise<Pelada | null> => {
  try {
    const peladaDoc = await getDoc(doc(db, 'peladas', peladaId));
    if (peladaDoc.exists()) {
      return {
        id: peladaDoc.id,
        ...peladaDoc.data()
      } as Pelada;
    }
    return null;
  } catch (error) {
    console.error('Erro ao buscar pelada:', error);
    throw error;
  }
};

/**
 * Busca todas as partidas concluídas de uma pelada
 */
export const getPartidasByPeladaId = async (peladaId: string): Promise<Partida[]> => {
  try {
    const partidasRef = collection(db, 'partidas');
    const q = query(
      partidasRef,
      where('peladaId', '==', peladaId),
      where('status', '==', 'concluída')
    );
    
    const querySnapshot = await getDocs(q);
    const partidas: Partida[] = [];
    
    querySnapshot.forEach((doc) => {
      partidas.push({
        id: doc.id,
        ...doc.data()
      } as Partida);
    });
    
    return partidas;
  } catch (error) {
    console.error('Erro ao buscar partidas:', error);
    throw error;
  }
};

/**
 * Busca os dados de um usuário pelo ID
 */
export const getUserById = async (uid: string): Promise<{ nome: string } | null> => {
  try {
    // ⚠️ CORRIGIDO: Buscar primeiro na coleção 'usuarios'
    let userDoc = await getDoc(doc(db, 'usuarios', uid));
    
    if (userDoc.exists()) {
      return userDoc.data() as { nome: string };
    }
    
    // ⚠️ FALLBACK: Se não encontrar na coleção 'usuarios', tentar na coleção 'users'
    userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as { nome: string };
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    throw error;
  }
};

/**
 * Calcula o ranking de jogadores de uma pelada com cache
 */
export const calcularRankingPelada = async (peladaId: string): Promise<PlayerStats[]> => {
  try {
    // Verifica cache
    const cachedRanking = rankingCache.get(peladaId);
    if (cachedRanking && Date.now() - cachedRanking.timestamp < CACHE_DURATION) {
      console.log('Retornando ranking do cache para pelada:', peladaId);
      return cachedRanking.data;
    }

    // Verifica autenticação
    if (!auth.currentUser) {
      throw new Error('Usuário não autenticado');
    }

    // Busca pelada e verifica permissões
    const pelada = await getPeladaById(peladaId);
    if (!pelada) {
      throw new Error('Pelada não encontrada');
    }

    const userIsOwner = pelada.ownerId === auth.currentUser.uid;
    const userIsPlayer = pelada.players.includes(auth.currentUser.uid);
    
    if (!userIsOwner && !userIsPlayer) {
      throw new Error('Sem permissão para ver esta pelada');
    }

    // Busca partidas e calcula ranking em batch
    const partidas = await getPartidasByPeladaId(peladaId);
    const rankingMap = new Map<string, RankingData>();

    // Inicializa ranking para todos os jogadores
    for (const playerId of pelada.players) {
      const userData = await getUserById(playerId);
      if (userData) {
        rankingMap.set(playerId, {
          nome: userData.nome,
          vitorias: 0,
          gols: 0,
          assistencias: 0,
          pontos: 0
        });
      }
    }

    // Processa todas as partidas de uma vez
    for (const partida of partidas) {
      const timeVencedor = partida.timeA.score > partida.timeB.score ? 'A' : 
                          partida.timeB.score > partida.timeA.score ? 'B' : null;

      // Atualiza estatísticas para todos os jogadores da partida
      const processarTime = (time: 'A' | 'B') => {
        const jogadores = time === 'A' ? partida.timeA.jogadores : partida.timeB.jogadores;
        const venceu = timeVencedor === time;

        for (const uid of jogadores) {
          const rankingJogador = rankingMap.get(uid);
          if (rankingJogador) {
            const stats = partida.estatisticas?.[uid] || { gols: 0, assistencias: 0 };
            
            rankingJogador.gols += stats.gols;
            rankingJogador.assistencias += stats.assistencias;
            if (venceu) {
              rankingJogador.vitorias += 1;
              rankingJogador.pontos += 3;
            }
            rankingJogador.pontos += stats.gols * 2 + stats.assistencias;
          }
        }
      };

      processarTime('A');
      processarTime('B');
    }

    // Converte o Map para array e ordena
    const rankingFinal = Array.from(rankingMap.entries()).map(([uid, data]) => ({
      uid,
      ...data
    })).sort((a, b) => b.pontos - a.pontos);

    // Atualiza o cache
    rankingCache.set(peladaId, {
      data: rankingFinal,
      timestamp: Date.now()
    });

    return rankingFinal;
  } catch (error) {
    console.error('Erro ao calcular ranking:', error);
    throw error;
  }
};

/**
 * Busca o ranking atual diretamente do documento da pelada
 */
export const getRankingAtual = async (peladaId: string): Promise<PlayerStats[]> => {
  try {
    // Verifica se o usuário está autenticado
    if (!auth.currentUser) {
      console.error('Tentativa de buscar ranking sem autenticação');
      throw new Error('Usuário não autenticado');
    }

    console.log('Buscando ranking atual da pelada:', peladaId);
    
    // Busca o documento da pelada
    const peladaRef = doc(db, 'peladas', peladaId);
    const peladaDoc = await getDoc(peladaRef);
    
    if (!peladaDoc.exists()) {
      throw new Error('Pelada não encontrada');
    }

    const peladaData = peladaDoc.data();
    const ranking = (peladaData?.ranking || {}) as { [key: string]: RankingData };

    // Garante que o dono está no ranking
    if (peladaData.ownerId && !ranking[peladaData.ownerId]) {
      const ownerData = await getUserById(peladaData.ownerId);
      if (ownerData) {
        ranking[peladaData.ownerId] = {
          nome: ownerData.nome,
          vitorias: 0,
          gols: 0,
          assistencias: 0,
          pontos: 0
        };
        
        // Atualiza o documento da pelada com o ranking do dono
        await updateDoc(peladaRef, {
          [`ranking.${peladaData.ownerId}`]: ranking[peladaData.ownerId]
        });
      }
    }

    // Converte o objeto de ranking em um array e busca os nomes dos usuários
    const rankingPromises = Object.entries(ranking).map(async ([uid, data]) => {
      // Busca os dados do usuário
      const userData = await getUserById(uid);
      
      return {
        uid,
        nome: userData?.nome || data.nome || 'Jogador Desconhecido',
        vitorias: data.vitorias || 0,
        gols: data.gols || 0,
        assistencias: data.assistencias || 0,
        pontos: data.pontos || 0
      };
    });

    // Aguarda todas as promessas serem resolvidas
    const rankingArray = await Promise.all(rankingPromises);

    // Ordena por pontos
    return rankingArray.sort((a, b) => b.pontos - a.pontos);
  } catch (error) {
    console.error('Erro ao buscar ranking:', error);
    throw error;
  }
}; 