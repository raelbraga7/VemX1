import { db } from './config';
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
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
    const userDoc = await getDoc(doc(db, 'users', uid));
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
 * Calcula as estatísticas de um jogador em uma partida
 */
const calcularEstatisticasJogador = (
  uid: string, 
  partida: Partida, 
  timeVencedor: 'A' | 'B' | null
): { gols: number; assistencias: number; vitoria: boolean } => {
  // Inicializa as estatísticas
  let gols = 0;
  let assistencias = 0;
  let vitoria = false;
  
  // Verifica se o jogador está em algum dos times
  const estaNoTimeA = partida.timeA.jogadores.includes(uid);
  const estaNoTimeB = partida.timeB.jogadores.includes(uid);
  
  if (!estaNoTimeA && !estaNoTimeB) {
    return { gols: 0, assistencias: 0, vitoria: false };
  }
  
  // Determina em qual time o jogador está
  const timeJogador = estaNoTimeA ? 'A' : 'B';
  
  // Verifica se o time do jogador venceu
  if (timeVencedor === timeJogador) {
    vitoria = true;
  }
  
  // Busca as estatísticas da partida para o jogador
  if (partida.estatisticas && partida.estatisticas[uid]) {
    gols = partida.estatisticas[uid].gols || 0;
    assistencias = partida.estatisticas[uid].assistencias || 0;
  }
  
  return { gols, assistencias, vitoria };
};

/**
 * Calcula o ranking de jogadores de uma pelada
 */
export const calcularRankingPelada = async (peladaId: string): Promise<PlayerStats[]> => {
  try {
    // Verifica se o usuário está autenticado
    if (!auth.currentUser) {
      console.error('Tentativa de calcular ranking sem autenticação');
      throw new Error('Usuário não autenticado');
    }

    console.log('Iniciando cálculo de ranking para pelada:', peladaId);
    
    // Busca a pelada
    const pelada = await getPeladaById(peladaId);
    if (!pelada) {
      console.error('Pelada não encontrada:', peladaId);
      throw new Error('Pelada não encontrada');
    }

    // Verifica se o usuário tem permissão para ver a pelada
    const userIsOwner = pelada.ownerId === auth.currentUser.uid;
    const userIsPlayer = pelada.players.includes(auth.currentUser.uid);
    
    if (!userIsOwner && !userIsPlayer) {
      console.error('Usuário não tem permissão para ver esta pelada');
      throw new Error('Sem permissão para ver esta pelada');
    }
    
    console.log('Pelada encontrada:', {
      id: pelada.id,
      nome: pelada.nome,
      numJogadores: pelada.players.length,
      jogadores: pelada.players,
      userIsOwner,
      userIsPlayer
    });
    
    // Busca todas as partidas concluídas da pelada
    const partidas = await getPartidasByPeladaId(peladaId);
    console.log('Partidas encontradas:', {
      quantidade: partidas.length,
      partidas: partidas.map(p => ({
        id: p.id,
        data: p.data,
        timeA: p.timeA.jogadores.length,
        timeB: p.timeB.jogadores.length,
        placar: `${p.timeA.score} x ${p.timeB.score}`,
        temEstatisticas: !!p.estatisticas
      }))
    });
    
    // Inicializa o mapa de estatísticas dos jogadores
    const statsMap = new Map<string, PlayerStats>();
    
    // Inicializa as estatísticas para todos os jogadores da pelada
    for (const uid of pelada.players) {
      const userData = await getUserById(uid);
      console.log('Dados do usuário carregados:', {
        uid,
        nome: userData?.nome || 'Jogador Desconhecido'
      });
      
      statsMap.set(uid, {
        uid,
        nome: userData?.nome || 'Jogador Desconhecido',
        vitorias: 0,
        gols: 0,
        assistencias: 0,
        pontos: 0
      });
    }
    
    console.log('Estatísticas inicializadas para', statsMap.size, 'jogadores');
    
    // Calcula as estatísticas para cada partida
    for (const partida of partidas) {
      console.log('Processando partida:', {
        id: partida.id,
        placar: `${partida.timeA.score} x ${partida.timeB.score}`,
        estatisticas: partida.estatisticas
      });
      
      // Determina qual time venceu
      let timeVencedor: 'A' | 'B' | null = null;
      if (partida.timeA.score > partida.timeB.score) {
        timeVencedor = 'A';
      } else if (partida.timeB.score > partida.timeA.score) {
        timeVencedor = 'B';
      }
      
      // Processa cada jogador da pelada
      for (const uid of pelada.players) {
        const { gols, assistencias, vitoria } = calcularEstatisticasJogador(uid, partida, timeVencedor);
        
        // Atualiza as estatísticas do jogador
        const playerStats = statsMap.get(uid)!;
        const statsAnteriores = { ...playerStats };
        
        playerStats.gols += gols;
        playerStats.assistencias += assistencias;
        if (vitoria) {
          playerStats.vitorias += 1;
        }
        
        // Calcula a pontuação total
        playerStats.pontos = (playerStats.vitorias * 3) + (playerStats.gols * 2) + playerStats.assistencias;
        
        console.log('Estatísticas atualizadas:', {
          jogador: playerStats.nome,
          antes: statsAnteriores,
          depois: { ...playerStats },
          partidaAtual: { gols, assistencias, vitoria }
        });
        
        statsMap.set(uid, playerStats);
      }
    }
    
    // Converte o mapa para um array e ordena por pontuação
    const ranking = Array.from(statsMap.values()).sort((a, b) => b.pontos - a.pontos);
    
    console.log('Ranking final calculado:', ranking);
    
    return ranking;
  } catch (error) {
    console.error('Erro ao calcular ranking:', {
      error,
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined
    });
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

    // Converte o objeto de ranking em um array
    const rankingArray = Object.entries(ranking).map(([uid, data]) => ({
      uid,
      nome: data.nome || '',
      vitorias: data.vitorias || 0,
      gols: data.gols || 0,
      assistencias: data.assistencias || 0,
      pontos: data.pontos || 0
    }));

    // Ordena por pontos
    return rankingArray.sort((a, b) => b.pontos - a.pontos);
  } catch (error) {
    console.error('Erro ao buscar ranking:', error);
    throw error;
  }
}; 