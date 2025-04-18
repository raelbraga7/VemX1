import { db } from './config';
import { collection, addDoc, Timestamp, doc, updateDoc } from 'firebase/firestore';

// Interface para os dados da partida
interface GameData {
  title: string;
  date: string;
  location: string;
  createdAt?: Timestamp;
  teams?: {
    team1: {
      name: string;
      color: string;
      players: string[];
      score: number;
    };
    team2: {
      name: string;
      color: string;
      players: string[];
      score: number;
    };
  };
  status?: 'pending' | 'in_progress' | 'finished';
}

// Função para adicionar uma partida ao Firestore
export const addGame = async (gameData: GameData) => {
  try {
    // Adiciona timestamp e status padrão
    const gameWithMetadata = {
      ...gameData,
      createdAt: Timestamp.now(),
      status: gameData.status || 'pending',
    };

    const gameRef = collection(db, 'games');
    const docRef = await addDoc(gameRef, gameWithMetadata);
    
    console.log('Partida adicionada com sucesso:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Erro ao adicionar partida:", error);
    throw new Error(error instanceof Error ? error.message : "Erro ao adicionar partida");
  }
};

// Função para atualizar o placar da partida
export const updateGameScore = async (team1Score: number, team2Score: number) => {
  try {
    const gameRef = collection(db, 'games');
    const docRef = await addDoc(gameRef, {
      'teams.team1.score': team1Score,
      'teams.team2.score': team2Score,
      updatedAt: Timestamp.now(),
    });
    
    console.log('Placar atualizado com sucesso');
    return docRef.id;
  } catch (error) {
    console.error("Erro ao atualizar placar:", error);
    throw new Error(error instanceof Error ? error.message : "Erro ao atualizar placar");
  }
};

// Função para finalizar uma partida
export const finishGame = async (gameId: string) => {
  try {
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      status: 'finished',
      finishedAt: Timestamp.now(),
    });
    
    console.log('Partida finalizada com sucesso');
    return gameId;
  } catch (error) {
    console.error("Erro ao finalizar partida:", error);
    throw new Error(error instanceof Error ? error.message : "Erro ao finalizar partida");
  }
};

// Interface para os dados da partida
export interface DadosPartida {
  quantidadeTimes: number;
  jogadoresPorTime: number;
  coresDosTimes: string[];
  criadoPor: string;
  dataCriacao: Date;
}

// Função para salvar a partida
export const salvarPartida = async (dadosPartida: DadosPartida) => {
  try {
    const docRef = await addDoc(collection(db, 'partidas'), dadosPartida);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao salvar a partida:', error);
    throw error;
  }
}; 