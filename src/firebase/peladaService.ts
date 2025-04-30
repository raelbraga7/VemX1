import { db } from './config';
import { collection, query, where, orderBy, limit, getDocs, addDoc, doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { auth } from './config';
import { addPeladaToUser, getUserById } from './userService';
import { Jogador, PeladaData, RankingPlayer } from '@/types/pelada';

export interface Pelada {
  id: string;
  nome: string;
  ownerId: string;
  players: string[];
  createdAt: Timestamp;
  status: string;
}

export type { PeladaData } from '@/types/pelada';

/**
 * Cria uma nova pelada no Firestore
 * @param peladaData Dados da pelada
 * @returns ID da pelada criada
 * @throws Erro se o usuário não estiver autenticado ou ocorrer algum problema
 */
export const criarPelada = async (peladaData: Omit<PeladaData, 'id'>): Promise<string> => {
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

    // Busca os dados do dono para inicializar o ranking
    const ownerData = await getUserById(peladaData.ownerId);
    if (!ownerData) {
      throw new Error("Dados do dono não encontrados");
    }

    // Garante que os arrays existam
    const players = [...new Set([...(peladaData.players || []), peladaData.ownerId])];
    const confirmados = Array.isArray(peladaData.confirmados) ? peladaData.confirmados : [];
    const ranking: { [key: string]: RankingPlayer } = {};

    // Inicializa o ranking para todos os jogadores
    for (const playerId of players) {
      try {
        const userData = await getUserById(playerId);
        if (userData) {
          ranking[playerId] = {
            jogos: 0,
            vitorias: 0,
            derrotas: 0,
            empates: 0,
            gols: 0,
            assistencias: 0,
            pontos: 0,
            nome: userData.nome
          };

          // Adiciona APENAS o dono da pelada aos confirmados automaticamente
          if (playerId === peladaData.ownerId) {
            const jaConfirmado = confirmados.some(j => j.uid === playerId);
            if (!jaConfirmado) {
              const novoJogador: Jogador = {
                uid: playerId,
                nome: userData.nome,
                email: userData.email,
                dataConfirmacao: new Date().toISOString()
              };
              if (userData.photoURL) {
                novoJogador.photoURL = userData.photoURL;
              }
              confirmados.push(novoJogador);
            }
          }
        }
      } catch (error) {
        console.error(`Erro ao buscar dados do jogador ${playerId}:`, error);
      }
    }

    const dadosParaSalvar = {
      ...peladaData,
      createdAt: new Date(),
      players,
      confirmados,
      ranking,
      quantidadeTimes: peladaData.quantidadeTimes || 2,
      jogadoresPorTime: peladaData.jogadoresPorTime || 5,
      coresTimes: peladaData.coresTimes || ['#1E90FF', '#FF4444'],
      nome: peladaData.nome.trim(),
      descricao: peladaData.descricao?.trim() || '',
      ownerId: peladaData.ownerId
    };

    console.log('Criando pelada com dados:', {
      nome: dadosParaSalvar.nome,
      ownerId: dadosParaSalvar.ownerId,
      players: dadosParaSalvar.players,
      confirmados: dadosParaSalvar.confirmados,
      ranking: dadosParaSalvar.ranking,
      quantidadeTimes: dadosParaSalvar.quantidadeTimes,
      jogadoresPorTime: dadosParaSalvar.jogadoresPorTime
    });

    // Cria a pelada no Firestore
    const peladaRef = await addDoc(collection(db, 'peladas'), dadosParaSalvar);
    const peladaId = peladaRef.id;
    
    // Atualiza o documento com o campo id
    await updateDoc(peladaRef, { id: peladaId });

    // Adiciona a pelada para cada jogador
    await Promise.all(players.map(playerId => addPeladaToUser(playerId, peladaId)));

    console.log('Pelada criada com sucesso:', {
      id: peladaId,
      totalJogadores: players.length,
      totalConfirmados: confirmados.length
    });

    return peladaId;
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
  
  const data = peladaSnap.data();
  
  // Garante que o id esteja definido
  return {
    ...data,
    id: peladaId
  } as PeladaData;
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

export const adicionarJogadorPelada = async (peladaId: string, jogadorId: string): Promise<void> => {
  try {
    console.log('Adicionando jogador à pelada:', {
      peladaId,
      jogadorId
    });

    if (!peladaId || !jogadorId) {
      throw new Error('PeladaId e jogadorId são obrigatórios');
    }

    const peladaRef = doc(db, 'peladas', peladaId);
    const peladaDoc = await getDoc(peladaRef);

    if (!peladaDoc.exists()) {
      throw new Error('Pelada não encontrada');
    }

    const peladaData = peladaDoc.data() as PeladaData;
    
    // Busca os dados do jogador
    const userData = await getUserById(jogadorId);
    if (!userData) {
      throw new Error('Dados do jogador não encontrados');
    }

    const players = peladaData.players || [];
    const ranking = peladaData.ranking || {};
    const confirmados = Array.isArray(peladaData.confirmados) ? peladaData.confirmados : [];

    // Verifica se o jogador já está confirmado
    const jaConfirmado = confirmados.some(jogador => jogador.uid === jogadorId);
    
    // CORREÇÃO: Removemos a verificação de limite de jogadores confirmados
    // Vamos manter apenas o limite de jogadores no ranking (30 por dono)
    // O limite de jogadores confirmados será gerenciado na tela de confirmação
    
    // Verifica o limite de jogadores no ranking (máximo 30 por dono)
    const LIMITE_RANKING_POR_DONO = 30;
    if (!ranking[jogadorId] && Object.keys(ranking).length >= LIMITE_RANKING_POR_DONO) {
      throw new Error(`Limite máximo de jogadores no ranking atingido (${LIMITE_RANKING_POR_DONO} jogadores)`);
    }
    
    if (!players.includes(jogadorId) || !jaConfirmado) {
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
          pontos: 0,
          nome: userData.nome
        };
      }

      // Prepara o objeto do jogador confirmado
      const novoJogador: Jogador = {
        uid: jogadorId,
        nome: userData.nome,
        email: userData.email,
        dataConfirmacao: new Date().toISOString()
      };

      // Adiciona photoURL apenas se existir
      if (userData.photoURL) {
        novoJogador.photoURL = userData.photoURL;
      }

      // Prepara os dados para atualização
      const updateData: Partial<PeladaData> = {
        ranking
      };

      // Adiciona o jogador à lista de players se ainda não estiver
      if (!players.includes(jogadorId)) {
        updateData.players = [...players, jogadorId];
      }

      // NÃO adicionar automaticamente aos confirmados
      // O jogador deve confirmar manualmente clicando no botão de confirmação

      console.log('Dados para atualização:', updateData);

      // Atualiza a pelada
      await updateDoc(peladaRef, updateData);

      // Adiciona a pelada ao usuário
      await addPeladaToUser(jogadorId, peladaId);

      console.log('Jogador adicionado com sucesso:', {
        peladaId,
        jogadorId,
        totalJogadores: updateData.players?.length || players.length + 1
      });
    } else {
      console.log('Jogador já está na pelada e confirmado:', jogadorId);
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

    // Remove o jogador da lista de confirmados usando o uid
    const confirmadosAtualizados = peladaData.confirmados.filter(jogador => jogador.uid !== jogadorId);

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
  try {
    console.log('Atualizando pelada:', {
      peladaId,
      campos: Object.keys(updates)
    });
    
    // Verifica se a pelada existe
    const peladaRef = doc(db, 'peladas', peladaId);
    const peladaDoc = await getDoc(peladaRef);
    
    if (!peladaDoc.exists()) {
      throw new Error('Pelada não encontrada');
    }
    
    const peladaAtual = peladaDoc.data() as PeladaData;
    
    // CORREÇÃO: Em vez de sobrescrever, vamos garantir que os dados críticos sejam preservados
    // e apenas os campos específicos da atualização sejam alterados
    
    // Criamos um objeto de atualização que mantém a estrutura original
    const updateData: Partial<PeladaData> = {};
    
    // Adicionamos apenas os campos que foram especificados no objeto 'updates'
    Object.keys(updates).forEach(key => {
      // @ts-expect-error - campo dinâmico
      updateData[key] = updates[key];
    });
    
    // IMPORTANTE: Verificar explicitamente se campos críticos estão sendo sobrescritos
    // e garantir que os dados existentes sejam preservados corretamente
    
    // Se os campos críticos não forem explicitamente atualizados, usamos os valores existentes
    if (!updateData.players) {
      updateData.players = peladaAtual.players || [];
    }
    
    if (!updateData.ranking) {
      updateData.ranking = peladaAtual.ranking || {};
    }
    
    if (!updateData.confirmados) {
      updateData.confirmados = peladaAtual.confirmados || [];
    }
    
    console.log('Dados finais para atualização:', {
      totalPlayers: updateData.players.length,
      totalRanking: Object.keys(updateData.ranking).length,
      totalConfirmados: updateData.confirmados.length
    });
    
    // Atualiza a pelada no Firestore com a estrutura completa
    await updateDoc(peladaRef, updateData);
    console.log('Pelada atualizada com sucesso');
    
    // Armazena no localStorage para acesso rápido
    localStorage.setItem(`pelada_${peladaId}`, JSON.stringify({
      ...peladaAtual,
      ...updateData,
      id: peladaId
    }));
    
  } catch (error) {
    console.error('Erro ao atualizar pelada:', error);
    throw error;
  }
}; 