import { db } from './config';
import { collection, query, where, orderBy, limit, getDocs, addDoc, doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { auth } from './config';
import { addPeladaToUser } from './userService';

export interface Jogador {
  uid: string;
  nome: string;
  email: string;
  photoURL?: string;
  dataConfirmacao?: string;
}

export interface RankingPlayer {
  jogos: number;
  vitorias: number;
  derrotas: number;
  empates: number;
  gols: number;
  assistencias: number;
  pontos: number;
}

export interface PeladaData {
  nome: string;
  descricao: string;
  ownerId: string;
  players: string[];
  ranking: { [key: string]: RankingPlayer };
  createdAt: Date;
  quantidadeTimes: number;
  jogadoresPorTime: number;
  coresTimes: string[];
  confirmados: Jogador[];
}

export interface Pelada {
  id: string;
  nome: string;
  ownerId: string;
  players: string[];
  createdAt: Timestamp;
  status: string;
}

/**
 * Cria uma nova pelada no Firestore
 * @param peladaData Dados da pelada
 * @returns ID da pelada criada
 * @throws Erro se o usuário não estiver autenticado ou ocorrer algum problema
 */
export const criarPelada = async (peladaData: PeladaData): Promise<string> => {
  try {
    // Verifica se o usuário está autenticado
    if (!auth.currentUser) {
      console.error('Tentativa de criar pelada sem autenticação');
      throw new Error("Usuário não autenticado");
    }

    // Valida o nome da pelada
    if (!peladaData.nome || peladaData.nome.trim().length === 0) {
      throw new Error("Nome da pelada é obrigatório");
    }

    // Garante que os arrays existam e que o owner esteja na lista de players
    const dadosParaSalvar = {
      ...peladaData,
      createdAt: new Date(),
      players: [...(peladaData.players || []), peladaData.ownerId],
      confirmados: peladaData.confirmados || [],
      ranking: peladaData.ranking || {}
    };

    console.log('Criando pelada com dados:', {
      nome: dadosParaSalvar.nome,
      ownerId: dadosParaSalvar.ownerId,
      players: dadosParaSalvar.players,
      confirmados: dadosParaSalvar.confirmados
    });

    // Cria a pelada no Firestore
    const peladaRef = await addDoc(collection(db, 'peladas'), dadosParaSalvar);

    console.log('Pelada criada com sucesso:', {
      id: peladaRef.id,
      dados: dadosParaSalvar
    });

    // Retorna o ID da pelada criada
    return peladaRef.id;
  } catch (error) {
    console.error('Erro detalhado ao criar pelada:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Erro desconhecido',
      authState: auth.currentUser ? 'Autenticado' : 'Não autenticado'
    });
    throw error;
  }
};

export const verificarECorrigirDonoPelada = async (peladaId: string): Promise<void> => {
  try {
    const peladaRef = doc(db, 'peladas', peladaId);
    const peladaDoc = await getDoc(peladaRef);
    
    if (!peladaDoc.exists()) {
      throw new Error('Pelada não encontrada');
    }

    const peladaData = peladaDoc.data() as PeladaData;
    
    // Se não tem dono definido, define o primeiro jogador como dono
    if (!peladaData.ownerId && peladaData.players && peladaData.players.length > 0) {
      await updateDoc(peladaRef, {
        ownerId: peladaData.players[0]
      });
      console.log('Dono da pelada corrigido:', peladaData.players[0]);
    }

    // Garante que o dono está na lista de players
    if (peladaData.ownerId && !peladaData.players.includes(peladaData.ownerId)) {
      const novosPlayers = [...peladaData.players, peladaData.ownerId];
      await updateDoc(peladaRef, {
        players: novosPlayers
      });
      console.log('Lista de jogadores atualizada para incluir o dono');
    }
  } catch (error) {
    console.error('Erro ao verificar/corrigir dono da pelada:', error);
    throw error;
  }
};

export const getPelada = async (peladaId: string): Promise<PeladaData> => {
  const peladaRef = doc(db, 'peladas', peladaId);
  const peladaSnap = await getDoc(peladaRef);
  
  if (!peladaSnap.exists()) {
    throw new Error('Pelada não encontrada');
  }
  
  return peladaSnap.data() as PeladaData;
};

export const getPeladasByUser = async (userId: string): Promise<{ id: string; data: PeladaData }[]> => {
  try {
    const q = query(collection(db, 'peladas'), where('players', 'array-contains', userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data() as PeladaData
    }));
  } catch (error) {
    console.error('Erro ao buscar peladas do usuário:', error);
    throw new Error('Não foi possível buscar as peladas');
  }
};

export const buscarPeladaMaisRecente = async (userId: string): Promise<{ id: string; data: PeladaData } | null> => {
  try {
    const peladasRef = collection(db, 'peladas');
    const q = query(
      peladasRef,
      where('players', 'array-contains', userId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      data: doc.data() as PeladaData
    };
  } catch (error) {
    console.error('Erro ao buscar pelada mais recente:', error);
    throw error;
  }
};

export const addPlayerToPelada = async (peladaId: string, playerId: string): Promise<void> => {
  try {
    const peladaRef = doc(db, 'peladas', peladaId);
    const peladaDoc = await getDoc(peladaRef);
    
    if (!peladaDoc.exists()) {
      throw new Error('Pelada não encontrada');
    }

    const peladaData = peladaDoc.data() as PeladaData;
    
    // Verifica se o jogador já está na lista
    if (!peladaData.players.includes(playerId)) {
      await updateDoc(peladaRef, {
        players: [...peladaData.players, playerId]
      });
    }
  } catch (error) {
    console.error('Erro ao adicionar jogador à pelada:', error);
    throw error;
  }
};

export const adicionarJogadorPelada = async (peladaId: string, jogadorId: string): Promise<void> => {
  try {
    console.log('Adicionando jogador à pelada:', {
      peladaId,
      jogadorId
    });

    const peladaRef = doc(db, 'peladas', peladaId);
    const peladaDoc = await getDoc(peladaRef);

    if (!peladaDoc.exists()) {
      throw new Error('Pelada não encontrada');
    }

    const peladaData = peladaDoc.data() as PeladaData;
    const players = peladaData.players || [];
    const ranking = peladaData.ranking || {};

    if (!players.includes(jogadorId)) {
      console.log('Adicionando novo jogador à lista:', jogadorId);
      
      // Inicializa o ranking do jogador se não existir
      if (!ranking[jogadorId]) {
        ranking[jogadorId] = {
          jogos: 0,
          vitorias: 0,
          derrotas: 0,
          empates: 0,
          gols: 0,
          assistencias: 0,
          pontos: 0
        };
      }

      await updateDoc(peladaRef, {
        players: [...players, jogadorId],
        ranking: ranking
      });

      // Adiciona a pelada ao usuário
      await addPeladaToUser(jogadorId, peladaId);

      console.log('Jogador adicionado com sucesso:', {
        peladaId,
        jogadorId,
        totalJogadores: players.length + 1
      });
    } else {
      console.log('Jogador já está na pelada:', jogadorId);
    }
  } catch (error) {
    console.error('Erro ao adicionar jogador à pelada:', {
      error,
      peladaId,
      jogadorId,
      errorMessage: error instanceof Error ? error.message : 'Erro desconhecido'
    });
    throw error;
  }
};

/**
 * Remove um jogador da pelada
 * @param peladaId ID da pelada
 * @param jogadorId ID do jogador a ser removido
 * @throws Erro se o usuário não for o dono da pelada ou ocorrer algum problema
 */
export const removerJogadorPelada = async (peladaId: string, jogadorId: string): Promise<void> => {
  try {
    console.log('Removendo jogador da pelada:', {
      peladaId,
      jogadorId
    });

    const peladaRef = doc(db, 'peladas', peladaId);
    const peladaDoc = await getDoc(peladaRef);

    if (!peladaDoc.exists()) {
      throw new Error('Pelada não encontrada');
    }

    const peladaData = peladaDoc.data() as PeladaData;

    // Verifica se o usuário atual é o dono da pelada
    if (peladaData.ownerId !== auth.currentUser?.uid) {
      throw new Error('Apenas o dono da pelada pode remover jogadores');
    }

    // Verifica se o jogador existe na pelada
    if (!peladaData.players.includes(jogadorId)) {
      throw new Error('Jogador não encontrado na pelada');
    }

    // Remove o jogador da lista de players
    const playersAtualizados = peladaData.players.filter(id => id !== jogadorId);

    // Remove o jogador do ranking
    const rankingAtualizado = { ...peladaData.ranking };
    delete rankingAtualizado[jogadorId];

    // Remove o jogador da lista de confirmados
    const confirmadosAtualizados = peladaData.confirmados.filter(j => j.nome !== jogadorId);

    // Atualiza a pelada
    await updateDoc(peladaRef, {
      players: playersAtualizados,
      ranking: rankingAtualizado,
      confirmados: confirmadosAtualizados
    });

    console.log('Jogador removido com sucesso:', {
      peladaId,
      jogadorId,
      totalJogadores: playersAtualizados.length
    });
  } catch (error) {
    console.error('Erro ao remover jogador da pelada:', {
      error,
      peladaId,
      jogadorId,
      errorMessage: error instanceof Error ? error.message : 'Erro desconhecido'
    });
    throw error;
  }
};

export const atualizarPelada = async (peladaId: string, updates: Partial<PeladaData>): Promise<void> => {
  const peladaRef = doc(db, 'peladas', peladaId);
  await updateDoc(peladaRef, updates);
}; 