'use client';

import { useState } from 'react';
import JogoEmAndamento, { TimeJogo } from './JogoEmAndamento';
import { Time } from '@/types/pelada';

interface TimesGeradosModalProps {
  isOpen: boolean;
  onClose: () => void;
  times: Time[];
  peladaId: string;
}

export default function TimesGeradosModal({ isOpen, onClose, times, peladaId }: TimesGeradosModalProps) {
  const [timesSelecionados, setTimesSelecionados] = useState<number[]>([]);
  const [jogoIniciado, setJogoIniciado] = useState(false);

  const handleSelecaoTime = (indexTime: number) => {
    setTimesSelecionados(prev => {
      if (prev.includes(indexTime)) {
        return prev.filter(t => t !== indexTime);
      }
      if (prev.length >= 2) {
        return [...prev.slice(1), indexTime];
      }
      return [...prev, indexTime];
    });
  };

  const handleConfirmar = () => {
    if (timesSelecionados.length === 2) {
      setJogoIniciado(true);
    }
  };

  const handleFinalizarJogo = () => {
    setJogoIniciado(false);
    onClose();
  };

  if (!isOpen) return null;

  if (jogoIniciado && timesSelecionados.length === 2) {
    const timesJogo: [TimeJogo, TimeJogo] = [
      {
        id: timesSelecionados[0] + 1,
        nome: `Time ${timesSelecionados[0] + 1}`,
        cor: times[timesSelecionados[0]].cor,
        jogadores: times[timesSelecionados[0]].jogadores.map(nome => ({
          id: nome,
          nome,
          gols: 0,
          assistencias: 0
        })),
        placar: 0
      },
      {
        id: timesSelecionados[1] + 1,
        nome: `Time ${timesSelecionados[1] + 1}`,
        cor: times[timesSelecionados[1]].cor,
        jogadores: times[timesSelecionados[1]].jogadores.map(nome => ({
          id: nome,
          nome,
          gols: 0,
          assistencias: 0
        })),
        placar: 0
      }
    ];

    return (
      <div className="fixed inset-0 bg-white z-50">
        <JogoEmAndamento 
          times={timesJogo}
          onFinalizarJogo={handleFinalizarJogo}
          peladaId={peladaId}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] flex flex-col">
        <div className="p-3 sm:p-6 flex-1 overflow-y-auto">
          <div className="space-y-4 sm:space-y-6">
            <div className="sticky top-0 bg-white pb-3 sm:pb-4 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-bold text-[#0d1b2a]">Times Gerados</h2>
              
              {timesSelecionados.length === 2 && (
                <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between gap-2 sm:gap-4">
                    <div className="flex-1">
                      <h3 className="font-medium text-sm sm:text-base mb-1 sm:mb-2" style={{ color: times[timesSelecionados[0]].cor }}>
                        Time {timesSelecionados[0] + 1}
                      </h3>
                    </div>
                    
                    <div className="text-xl sm:text-2xl font-bold text-gray-400">
                      X
                    </div>
                    
                    <div className="flex-1 text-right">
                      <h3 className="font-medium text-sm sm:text-base mb-1 sm:mb-2" style={{ color: times[timesSelecionados[1]].cor }}>
                        Time {timesSelecionados[1] + 1}
                      </h3>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {times.map((time, index) => (
                <div 
                  key={index}
                  onClick={() => handleSelecaoTime(index)}
                  className={`p-3 sm:p-4 rounded-lg border cursor-pointer transition-all ${
                    timesSelecionados.includes(index) 
                      ? 'ring-2 ring-[#1d4ed8] border-[#1d4ed8]' 
                      : 'border-gray-200 hover:border-[#1d4ed8]'
                  }`}
                  style={{ borderColor: timesSelecionados.includes(index) ? time.cor : undefined }}
                >
                  <h3 className="font-medium text-sm sm:text-base mb-1 sm:mb-2" style={{ color: time.cor }}>
                    Time {index + 1} {timesSelecionados.includes(index) && 
                      `(${timesSelecionados.indexOf(index) + 1}º)`
                    }
                  </h3>
                  <ul className="space-y-0.5 sm:space-y-1">
                    {time.jogadores.map((jogador, idx) => (
                      <li key={idx} className="text-xs sm:text-sm text-gray-600">
                        • {jogador}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white p-3 sm:p-4 border-t border-gray-200">
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={timesSelecionados.length !== 2}
              className="w-full sm:w-auto px-4 py-2 bg-[#1d4ed8] text-white rounded-lg hover:bg-[#1d4ed8]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              Iniciar Jogo
            </button>
          </div>

          <p className="text-xs sm:text-sm text-gray-500 text-center mt-2">
            {timesSelecionados.length === 2 
              ? 'Clique em Iniciar Jogo para começar'
              : `Selecione ${2 - timesSelecionados.length} time${timesSelecionados.length === 1 ? '' : 's'} para jogar`
            }
          </p>
        </div>
      </div>
    </div>
  );
} 