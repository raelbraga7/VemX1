import React from 'react';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

interface JogadorDetalhes {
  id: string;
  nome: string;
  photoURL?: string | null;
  vitorias?: number;
  gols?: number;
  assistencias?: number;
  pontos?: number;
  jogos?: number;
  derrotas?: number;
  empates?: number;
}

interface TimeStats {
  vitorias: number;
  derrotas: number;
  gols: number;
  assistencias: number;
  pontos: number;
  jogos: number;
  nome?: string;
  timeName?: string;
}

interface PlayerCardProps {
  jogador: JogadorDetalhes | null;
  timeStats?: TimeStats | null;
  aberta: boolean;
  onClose: () => void;
}

export default function PlayerCard({ jogador, timeStats, aberta, onClose }: PlayerCardProps) {
  if (!jogador) return null;

  // Definir qual conjunto de estatísticas mostrar (time ou pelada)
  const exibirEstatsTime = !!timeStats?.timeName;

  return (
    <Dialog
      open={aberta}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        style: { 
          borderRadius: '8px', 
          backgroundColor: 'transparent',
          boxShadow: 'none',
          overflow: 'hidden',
          maxWidth: '340px',
          margin: '0 auto'
        }
      }}
    >
      <div className="bg-[#141e33] text-white overflow-hidden rounded-lg shadow-xl">
        {/* Barra superior */}
        <div className="bg-[#4285f4] py-4 px-4 relative">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="text-5xl font-bold tracking-tight">
                {(exibirEstatsTime ? (timeStats?.pontos || 0) : (jogador.pontos || 0)).toFixed(1)}
              </div>
              <div className="bg-[#f8a200] text-white px-3 py-1 rounded-md relative ml-1">
                <span className="font-bold text-base">JOG</span>
                <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs px-1 rounded-md transform rotate-12 font-bold">
                  PRO
                </div>
              </div>
            </div>
            <IconButton 
              edge="end" 
              size="small"
              onClick={onClose} 
              aria-label="fechar"
              sx={{ color: 'white' }}
            >
              <CloseIcon />
            </IconButton>
          </div>
        </div>
        
        <div className="p-5 pb-6">
          {/* Avatar e Nome */}
          <div className="flex flex-col items-center mb-8 mt-5">
            <div className="w-20 h-20 bg-[#4285f4] rounded-full flex items-center justify-center text-white text-4xl font-bold border-2 border-yellow-400 mb-4">
              {jogador.nome.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-2xl font-bold text-white uppercase tracking-wide">
              {jogador.nome}
            </h2>
            {exibirEstatsTime && timeStats?.timeName && (
              <span className="text-sm text-yellow-400 mt-1">Time: {timeStats.timeName}</span>
            )}
          </div>

          {/* Estatísticas principais - primeira linha */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-[#1a2747] rounded-lg py-3 px-2 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-yellow-400">
                {exibirEstatsTime ? (timeStats?.vitorias || 0) : (jogador.vitorias || 0)}
              </span>
              <span className="text-xs text-gray-400 mt-1">VIT</span>
            </div>
            
            <div className="bg-[#1a2747] rounded-lg py-3 px-2 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-yellow-400">
                {exibirEstatsTime ? (timeStats?.gols || 0) : (jogador.gols || 0)}
              </span>
              <span className="text-xs text-gray-400 mt-1">GOL</span>
            </div>

            <div className="bg-[#1a2747] rounded-lg py-3 px-2 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-yellow-400">
                {exibirEstatsTime ? (timeStats?.assistencias || 0) : (jogador.assistencias || 0)}
              </span>
              <span className="text-xs text-gray-400 mt-1">ASS</span>
            </div>
          </div>

          {/* Estatísticas principais - segunda linha */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-[#1a2747] rounded-lg py-3 px-2 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-yellow-400">
                {exibirEstatsTime ? (timeStats?.jogos || 0) : (jogador.jogos || 0)}
              </span>
              <span className="text-xs text-gray-400 mt-1">JGS</span>
            </div>
            
            <div className="bg-[#1a2747] rounded-lg py-3 px-2 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-yellow-400">
                {exibirEstatsTime 
                  ? (timeStats?.jogos && timeStats.jogos > 0 && timeStats.vitorias 
                     ? Math.round((timeStats.vitorias / timeStats.jogos) * 100) : 0)
                  : (jogador.jogos && jogador.jogos > 0 && jogador.vitorias 
                     ? Math.round((jogador.vitorias / jogador.jogos) * 100) : 0)
                }
              </span>
              <span className="text-xs text-gray-400 mt-1">VIT%</span>
            </div>

            <div className="bg-[#1a2747] rounded-lg py-3 px-2 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-yellow-400">
                {(exibirEstatsTime ? (timeStats?.pontos || 0) : (jogador.pontos || 0)).toFixed(1)}
              </span>
              <span className="text-xs text-gray-400 mt-1">PTS</span>
            </div>
          </div>

          {/* Rodapé */}
          <div className="flex justify-between items-center">
            <div className="text-yellow-400">
              {/* Lógica para exibir número de estrelas baseado na pontuação */}
              {(() => {
                const pontos = exibirEstatsTime ? (timeStats?.pontos || 0) : (jogador.pontos || 0);
                if (pontos < 20) return <span className="text-3xl">★</span>;
                if (pontos < 40) return <span className="text-3xl">★★</span>;
                if (pontos < 60) return <span className="text-3xl">★★★</span>;
                if (pontos < 80) return <span className="text-3xl">★★★★</span>;
                return <span className="text-3xl">★★★★★</span>;
              })()}
            </div>
            <div className="text-gray-400 text-sm font-light">
              {exibirEstatsTime ? 'TIME' : 'PELADA'} - VEMX1
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
} 