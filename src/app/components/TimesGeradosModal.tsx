'use client';

import { useState } from 'react';
import JogoEmAndamento, { TimeJogo } from './JogoEmAndamento';
import { Time } from '@/types/pelada';
import { toast } from 'react-hot-toast';

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
    if (timesSelecionados.length !== 2) {
      toast.error('Selecione exatamente 2 times para iniciar a partida!');
      return;
    }

    // Salva os times selecionados no localStorage no formato esperado pela página partida-time
    const timesSelecionadosFormatados = timesSelecionados.map(index => ({
      id: times[index].nome, // Usamos o nome como ID já que Time não tem id
      name: times[index].nome
    }));
    
    // Armazena no localStorage para recuperar na página de partida
    localStorage.setItem(`timesSelecionados_${peladaId}`, JSON.stringify(timesSelecionadosFormatados));
    
    // Redireciona para a página de partida-time
    window.location.href = `/pelada/${peladaId}/partida-time`;
    
    // Se por algum motivo o redirecionamento falhar, inicia o jogo localmente
    setTimeout(() => {
      if (window.location.pathname.indexOf('/partida-time') === -1) {
        setJogoIniciado(true);
      }
    }, 500);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Times Gerados</h2>
        </div>

        <div className="overflow-auto flex-1 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {times.map((time, index) => (
              <div 
                key={index}
                onClick={() => handleSelecaoTime(index)}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  timesSelecionados.includes(index) 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-blue-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium">{time.nome}</h3>
                  <div 
                    className="w-6 h-6 rounded-full" 
                    style={{ backgroundColor: time.cor || '#3b82f6' }}
                  ></div>
                </div>
                <ul className="space-y-2">
                  {time.jogadores.map((jogador, jIndex) => (
                    <li key={jIndex} className="text-sm text-gray-700">
                      {jogador}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
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