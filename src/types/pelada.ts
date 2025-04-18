export interface Jogador {
  nome: string;
  dataConfirmacao: string;
}

export interface Time {
  nome: string;
  cor: string;
  jogadores: string[];
  placar: number;
}

export interface PeladaConfig {
  quantidadeTimes: number;
  jogadoresPorTime: number;
  coresTimes: string[];
  confirmados: Jogador[];
  dataCriacao: string;
} 