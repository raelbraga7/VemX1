import { db } from './config';
import { collection, query, where, orderBy, limit, getDocs, Timestamp, addDoc } from 'firebase/firestore';
import { auth } from './config';

export interface Match {
  id: string;
  data: Timestamp;
  timeA: {
    nome: string;
    score: number;
    jogadores: string[];
  };
  timeB: {
    nome: string;
    score: number;
    jogadores: string[];
  };
  status: string;
  peladaId: string;
  estatisticas?: {
    [uid: string]: {
      gols: number;
      assistencias: number;
    };
  };
}

interface Jogador {
  id: string;
  nome: string;
  gols: number;
  assistencias: number;
}

export const salvarPartidaFinalizada = async (
  peladaId: string,
  timeA: { nome: string; cor: string; jogadores: Jogador[]; placar: number },
  timeB: { nome: string; cor: string; jogadores: Jogador[]; placar: number }
) => {
  try {
    // Verifica se o usuário está autenticado
    if (!auth.currentUser) {
      throw new Error('Usuário não autenticado');
    }

    // Prepara as estatísticas
    const estatisticas: { [uid: string]: { gols: number; assistencias: number } } = {};
    
    // Adiciona estatísticas dos jogadores do time A
    timeA.jogadores.forEach(jogador => {
      estatisticas[jogador.id] = {
        gols: jogador.gols,
        assistencias: jogador.assistencias
      };
    });

    // Adiciona estatísticas dos jogadores do time B
    timeB.jogadores.forEach(jogador => {
      estatisticas[jogador.id] = {
        gols: jogador.gols,
        assistencias: jogador.assistencias
      };
    });

    // Cria o documento da partida
    const partidaData = {
      peladaId,
      data: Timestamp.now(),
      timeA: {
        nome: timeA.nome,
        score: timeA.placar,
        jogadores: timeA.jogadores.map(j => j.id)
      },
      timeB: {
        nome: timeB.nome,
        score: timeB.placar,
        jogadores: timeB.jogadores.map(j => j.id)
      },
      status: 'concluída',
      estatisticas
    };

    // Salva no Firestore
    const docRef = await addDoc(collection(db, 'partidas'), partidaData);
    console.log('Partida salva com sucesso:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao salvar partida:', error);
    throw error;
  }
};

export const getRecentMatches = async (limitCount: number = 5): Promise<Match[]> => {
  try {
    console.log('Iniciando busca de partidas recentes...');
    const partidasRef = collection(db, 'partidas');
    
    const q = query(
      partidasRef,
      where('status', '==', 'concluída'),
      orderBy('data', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const matches: Match[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      matches.push({
        id: doc.id,
        data: data.data,
        timeA: {
          nome: data.timeA.nome,
          score: data.timeA.score,
          jogadores: data.timeA.jogadores
        },
        timeB: {
          nome: data.timeB.nome,
          score: data.timeB.score,
          jogadores: data.timeB.jogadores
        },
        status: data.status,
        peladaId: data.peladaId,
        estatisticas: data.estatisticas
      });
    });

    console.log(`Encontradas ${matches.length} partidas recentes`);
    return matches;
  } catch (error) {
    console.error('Erro ao buscar partidas:', error);
    throw error;
  }
}; 