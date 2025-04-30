export interface Jogador {
  uid: string;
  id?: string;
  nome: string;
  email: string;
  photoURL?: string;
  dataConfirmacao: string;
  convidadoPor?: string | null;
}

export interface Time {
  nome: string;
  cor: string;
  jogadores: string[];
  placar: number;
}

export interface RankingPlayer {
  jogos: number;
  vitorias: number;
  derrotas: number;
  empates: number;
  gols: number;
  assistencias: number;
  pontos: number;
  nome: string;
}

export interface PeladaData {
  id: string;
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
  temporada?: {
    inicio: Date;
    fim: Date;
    nome: string;
    status: 'ativa' | 'encerrada' | 'aguardando';
  };
}

export interface PeladaConfig {
  quantidadeTimes: number;
  jogadoresPorTime: number;
  coresTimes: string[];
  confirmados: Jogador[];
  dataCriacao: string;
} 