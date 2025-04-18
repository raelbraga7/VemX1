'use client';

import { useState, useEffect, useRef } from 'react';
import { salvarPartidaFinalizada } from '@/firebase/matchService';

interface Jogador {
  id: string;
  nome: string;
  gols: number;
  assistencias: number;
}

export interface TimeJogo {
  id: number;
  nome: string;
  cor: string;
  jogadores: Jogador[];
  gols?: number;
  placar: number;
}

interface JogoEmAndamentoProps {
  times: [TimeJogo, TimeJogo];
  onFinalizarJogo: () => void;
  peladaId: string;
}

export default function JogoEmAndamento({ times, onFinalizarJogo, peladaId }: JogoEmAndamentoProps) {
  const [tempo, setTempo] = useState(600); // 10 minutos por padrão
  const [editandoTempo, setEditandoTempo] = useState(false);
  const [minutos, setMinutos] = useState('10');
  const [segundos, setSegundos] = useState('00');
  const [rodando, setRodando] = useState(false);
  const [ultimaAcao, setUltimaAcao] = useState<{ timeCor: string; jogadorId: string } | null>(null);
  const [resultadoJogo, setResultadoJogo] = useState<string | null>(null);
  const jogadorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [jogadores, setJogadores] = useState<Record<string, Jogador[]>>({
    [times[0].cor]: times[0].jogadores.map(j => ({ id: j.id, nome: j.nome, gols: 0, assistencias: 0 })),
    [times[1].cor]: times[1].jogadores.map(j => ({ id: j.id, nome: j.nome, gols: 0, assistencias: 0 }))
  });
  const [timesState, setTimesState] = useState<[TimeJogo, TimeJogo]>([
    { ...times[0], placar: 0 },
    { ...times[1], placar: 0 }
  ]);

  useEffect(() => {
    let intervalo: NodeJS.Timeout;
    if (rodando && tempo > 0) {
      intervalo = setInterval(() => {
        setTempo(t => {
          if (t <= 1) {
            setRodando(false);
            const time1 = timesState[0];
            const time2 = timesState[1];
            
            if (time1.placar > time2.placar) {
              setResultadoJogo(`Vitória do ${time1.nome}!`);
            } else if (time2.placar > time1.placar) {
              setResultadoJogo(`Vitória do ${time2.nome}!`);
            } else {
              setResultadoJogo('Empate!');
            }
            
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalo);
  }, [rodando, tempo, timesState]);

  useEffect(() => {
    if (ultimaAcao && jogadorRef.current) {
      jogadorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [ultimaAcao]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, []);

  useEffect(() => {
    setTimesState([
      { ...times[0], placar: jogadores[times[0].cor].reduce((acc, j) => acc + j.gols, 0) },
      { ...times[1], placar: jogadores[times[1].cor].reduce((acc, j) => acc + j.gols, 0) }
    ]);
  }, [jogadores, times]);

  const formatarTempo = (segundos: number) => {
    const mins = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${mins.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
  };

  const handleSetTempo = () => {
    const mins = parseInt(minutos) || 0;
    const segs = parseInt(segundos) || 0;
    const novoTempo = (mins * 60) + segs;
    setTempo(novoTempo);
    setEditandoTempo(false);
  };

  const handleTempoKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSetTempo();
    }
  };

  const registrarGol = (timeCor: string, jogadorId: string, incremento: number = 1) => {
    setJogadores(prev => ({
      ...prev,
      [timeCor]: prev[timeCor].map(j => {
        if (j.id === jogadorId) {
          const novosGols = Math.max(0, j.gols + incremento);
          return { ...j, gols: novosGols };
        }
        return j;
      })
    }));
    setUltimaAcao({ timeCor, jogadorId });

    // Atualiza o placar do time
    setTimesState(prev => prev.map(time => {
      if (time.cor === timeCor) {
        const novosPontos = jogadores[timeCor].reduce((acc, j) => acc + j.gols, 0) + (incremento > 0 ? 1 : -1);
        return {
          ...time,
          placar: Math.max(0, novosPontos)
        };
      }
      return time;
    }) as [TimeJogo, TimeJogo]);

    setTimeout(() => {
      if (jogadorRef.current) {
        jogadorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const registrarAssistencia = (timeCor: string, jogadorId: string, incremento: number = 1) => {
    setJogadores(prev => ({
      ...prev,
      [timeCor]: prev[timeCor].map(j => {
        if (j.id === jogadorId) {
          const novasAssistencias = Math.max(0, j.assistencias + incremento);
          return { ...j, assistencias: novasAssistencias };
        }
        return j;
      })
    }));
    setUltimaAcao({ timeCor, jogadorId });

    setTimeout(() => {
      if (jogadorRef.current) {
        jogadorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const finalizarJogo = async () => {
    try {
      // Salva a partida no Firestore
      await salvarPartidaFinalizada(
        peladaId,
        {
          nome: timesState[0].nome,
          cor: timesState[0].cor,
          jogadores: jogadores[timesState[0].cor],
          placar: timesState[0].placar
        },
        {
          nome: timesState[1].nome,
          cor: timesState[1].cor,
          jogadores: jogadores[timesState[1].cor],
          placar: timesState[1].placar
        }
      );

      // Chama o callback de finalização
      onFinalizarJogo();
    } catch (error) {
      console.error('Erro ao finalizar jogo:', error);
      alert('Erro ao salvar a partida. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col h-screen">
      {/* Cronômetro e Controles - Fixo no topo */}
      <div className="sticky top-0 z-10 bg-white p-4 rounded-xl mx-4 mt-4 shadow-lg">
        <div className="flex items-center justify-between">
          {editandoTempo ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={minutos}
                onChange={(e) => setMinutos(e.target.value.replace(/\D/g, ''))}
                className="w-16 text-4xl font-mono font-bold text-center border-2 border-[#4339CA] rounded-lg"
                placeholder="00"
                maxLength={2}
                onKeyPress={handleTempoKeyPress}
                autoFocus
              />
              <span className="text-4xl font-mono font-bold text-[#4339CA]">:</span>
              <input
                type="text"
                value={segundos}
                onChange={(e) => setSegundos(e.target.value.replace(/\D/g, ''))}
                className="w-16 text-4xl font-mono font-bold text-center border-2 border-[#4339CA] rounded-lg"
                placeholder="00"
                maxLength={2}
                onKeyPress={handleTempoKeyPress}
              />
              <button
                onClick={handleSetTempo}
                className="ml-2 px-3 py-2 bg-[#4339CA] text-white rounded-lg hover:bg-opacity-90"
              >
                OK
              </button>
            </div>
          ) : (
            <div 
              className="text-5xl font-mono font-bold text-[#4339CA] cursor-pointer hover:opacity-80"
              onClick={() => {
                if (!rodando) {
                  const tempoAtual = formatarTempo(tempo);
                  setMinutos(tempoAtual.split(':')[0]);
                  setSegundos(tempoAtual.split(':')[1]);
                  setEditandoTempo(true);
                }
              }}
            >
              {formatarTempo(tempo)}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => {
                const mins = parseInt(minutos) || 0;
                const segs = parseInt(segundos) || 0;
                setTempo((mins * 60) + segs);
                setRodando(false);
              }}
              className="w-12 h-12 rounded-full bg-[#4339CA] text-white flex items-center justify-center hover:bg-opacity-90"
            >
              🔄
            </button>
            <button
              onClick={() => setRodando(!rodando)}
              className="w-12 h-12 rounded-full bg-[#4339CA] text-white flex items-center justify-center hover:bg-opacity-90"
            >
              {rodando ? '⏸' : '▶'}
            </button>
            {tempo === 0 ? (
              <button
                onClick={finalizarJogo}
                className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-opacity-90 animate-pulse"
                title="Finalizar jogo e salvar estatísticas"
              >
                🏁
              </button>
            ) : (
              <button
                onClick={finalizarJogo}
                className="w-12 h-12 rounded-full bg-[#4339CA] text-white flex items-center justify-center hover:bg-opacity-90"
                title="Finalizar jogo"
              >
                🏁
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo com rolagem */}
      <div className="flex-1 overflow-y-auto" ref={containerRef}>
        {/* Placar */}
        <div className="p-4">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: timesState[0].cor }}>
                <span className="text-white font-bold">{timesState[0].nome}</span>
                <span className="text-white">⚽</span>
                <span className="text-white font-bold ml-auto">{timesState[0].placar}</span>
              </div>
            </div>
            <div className="font-bold text-gray-600">VS</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: timesState[1].cor }}>
                <span className="text-white font-bold">{timesState[1].nome}</span>
                <span className="text-white">⚽</span>
                <span className="text-white font-bold ml-auto">{timesState[1].placar}</span>
              </div>
            </div>
          </div>

          {/* Mensagem de Resultado */}
          {resultadoJogo && (
            <div className="bg-white p-4 rounded-xl shadow-lg mb-6">
              <div className="text-3xl font-bold text-center text-[#4339CA] animate-bounce">
                {resultadoJogo}
              </div>
              <button
                onClick={onFinalizarJogo}
                className="mt-4 w-full py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-opacity-90 flex items-center justify-center gap-2"
              >
                <span>Escolher Outros Times para Jogar</span>
                <span>👥</span>
              </button>
            </div>
          )}

          {/* Times */}
          <div className="space-y-4">
            {timesState.map((time, timeIndex) => (
              <div 
                key={timeIndex}
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: time.cor }}
              >
                <div className="p-4">
                  <h2 className="text-2xl font-bold text-white mb-4">{time.nome}</h2>
                  <div className="space-y-4">
                    {jogadores[time.cor].map((jogador, index) => (
                      <div 
                        key={jogador.id} 
                        ref={ultimaAcao?.timeCor === time.cor && ultimaAcao?.jogadorId === jogador.id ? jogadorRef : null}
                        className="flex items-center justify-between bg-white bg-opacity-10 p-3 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-white text-lg">{index + 1}. {jogador.nome}</span>
                          <span className="text-white text-sm">G: {jogador.gols} A: {jogador.assistencias}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => registrarGol(time.cor, jogador.id)}
                            className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-3 py-1 rounded"
                          >
                            Gol
                          </button>
                          <button
                            onClick={() => registrarAssistencia(time.cor, jogador.id)}
                            className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-3 py-1 rounded"
                          >
                            Assist
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 