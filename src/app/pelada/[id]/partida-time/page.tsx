'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, getDoc, arrayUnion, DocumentData, FieldValue } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { toast } from 'react-hot-toast';
import { 
  IconButton, 
  Tooltip, 
  Button, 
  TextField, 
  Fab, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import FlagIcon from '@mui/icons-material/Flag';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import Link from 'next/link';

interface Jogador {
  id: string;
  uid?: string;
  nome: string;
  gols: number;
  assistencias: number;
}

interface Time {
  id: string;
  nome: string;
  cor: string;
  jogadores: Jogador[];
  gols: number;
}

interface TimeOriginal {
  id: string;
  name: string;
  jogadores: {
    id: string;
    nome: string;
    photoURL?: string | null;
    dataEntrada: string;
  }[];
}

interface TimeSelecionado {
  id: string;
  name: string;
}

interface RankingTimeUpdate {
  id?: string;
  nome?: string;
  vitorias?: number;
  derrotas?: number;
  golsPro?: number;
  golsContra?: number;
  saldoGols?: number;
  pontos?: number;
  historico?: FieldValue;
}

interface JogadorEstatistica {
  gols: number;
  assistencias: number;
  vitorias: number;
  derrotas: number;
  pontos: number;
  jogos: number;
  empates: number;
}

type Vencedor = Time | 'empate';

export default function PartidaTime() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeA, setTimeA] = useState<Time | null>(null);
  const [timeB, setTimeB] = useState<Time | null>(null);
  const [minutos, setMinutos] = useState(25);
  const [segundos, setSegundos] = useState(0);
  const [rodando, setRodando] = useState(false);
  const [tempoAcabou, setTempoAcabou] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  
  // Referência para a função de finalizar partida
  const finalizarPartidaRef = useRef<() => Promise<boolean>>(async () => false);

  // Carregar times do localStorage
  useEffect(() => {
    try {
      const timesSelecionadosString = localStorage.getItem(`timesSelecionados_${params.id}`);
      if (!timesSelecionadosString) {
        setError('Nenhum time selecionado');
        return;
      }

      const timesSelecionados = JSON.parse(timesSelecionadosString) as TimeSelecionado[];
      if (timesSelecionados.length !== 2) {
        setError('Número incorreto de times selecionados');
        return;
      }

      // Buscar os detalhes dos times selecionados
      const buscarDetalhesDosTimes = async () => {
        try {
          const timeAOriginal = await getDoc(doc(db, 'times', timesSelecionados[0].id));
          const timeBOriginal = await getDoc(doc(db, 'times', timesSelecionados[1].id));
          
          if (!timeAOriginal.exists() || !timeBOriginal.exists()) {
            setError('Um ou mais times não foram encontrados');
            return;
          }

          const timeAData = timeAOriginal.data() as TimeOriginal;
          const timeBData = timeBOriginal.data() as TimeOriginal;

          // Convertendo para o formato da interface Time
          const timeAFormatado: Time = {
            id: timeAOriginal.id,
            nome: timeAData.name,
            cor: 'blue', // Time A é azul
            gols: 0,
            jogadores: timeAData.jogadores.map(j => ({
              id: j.id,
              uid: j.id, // Para compatibilidade
              nome: j.nome,
              gols: 0,
              assistencias: 0
            }))
          };

          const timeBFormatado: Time = {
            id: timeBOriginal.id,
            nome: timeBData.name,
            cor: 'red', // Time B é vermelho
            gols: 0,
            jogadores: timeBData.jogadores.map(j => ({
              id: j.id,
              uid: j.id, // Para compatibilidade
              nome: j.nome,
              gols: 0,
              assistencias: 0
            }))
          };

          setTimeA(timeAFormatado);
          setTimeB(timeBFormatado);
          setLoading(false);
        } catch (err) {
          console.error('Erro ao carregar detalhes dos times:', err);
          setError('Erro ao carregar detalhes dos times');
          setLoading(false);
        }
      };

      buscarDetalhesDosTimes();
    } catch (err) {
      console.error('Erro ao carregar times selecionados:', err);
      setError('Erro ao carregar times selecionados');
      setLoading(false);
    }
  }, [params.id]);

  // Função para determinar o vencedor
  const determinarVencedor = useCallback((): Vencedor | null => {
    if (!timeA || !timeB) return null;
    if ((timeA.gols ?? 0) > (timeB.gols ?? 0)) return timeA;
    if ((timeB.gols ?? 0) > (timeA.gols ?? 0)) return timeB;
    return 'empate';
  }, [timeA, timeB]);

  // Definição da função handleFinalizarPartida
  const handleFinalizarPartida = useCallback(async () => {
    if (!timeA || !timeB || !params.id || typeof params.id !== 'string') return false;

    try {
      // Certificar-se de que todos os jogadores têm IDs válidos antes de continuar
      const jogadoresTimeAValidos = timeA.jogadores.filter(j => (j.id && j.id !== 'undefined') || (j.uid && j.uid !== 'undefined'));
      const jogadoresTimeBValidos = timeB.jogadores.filter(j => (j.id && j.id !== 'undefined') || (j.uid && j.uid !== 'undefined'));
      
      // Atualizar os times com apenas jogadores válidos
      const timeAValido = { ...timeA, jogadores: jogadoresTimeAValidos };
      const timeBValido = { ...timeB, jogadores: jogadoresTimeBValidos };
      
      // Determinar o vencedor
      const vencedor = determinarVencedor();
      const timeAVenceu = vencedor === timeA;
      const timeBVenceu = vencedor === timeB;
      const empate = vencedor === 'empate';
      
      console.log('DEBUG: Resultado da partida:', {
        timeA: timeA.nome,
        golsA: timeA.gols,
        timeB: timeB.nome,
        golsB: timeB.gols,
        vencedor: timeAVenceu ? timeA.nome : timeBVenceu ? timeB.nome : 'Empate'
      });

      // Referência para a pelada no Firestore
      const peladaRef = doc(db, 'peladas', params.id);
      
      // Atualiza o ranking de times
      try {
        const timeAId = timeA?.id?.toString() || '';
        const timeBId = timeB?.id?.toString() || '';
        const peladaDoc = await getDoc(peladaRef);
        
        if (peladaDoc.exists()) {
          const peladaData = peladaDoc.data();
          const rankingTimes = peladaData.rankingTimes || {};

          // Objeto para armazenar as atualizações que serão aplicadas
          const rankingTimesUpdates: { [key: string]: RankingTimeUpdate | FieldValue } = {};
          
          // Objeto para atualizar estatísticas dos jogadores por time
          const estatisticasJogadoresUpdates: { [key: string]: any } = {};

          // Inicializar estrutura de estatísticas por time se não existir
          if (!peladaData.estatisticasTime) {
            estatisticasJogadoresUpdates['estatisticasTime'] = {};
          }

          // Calcular pontos e atualizações com base no resultado
          if (timeAId && timeBId) {
            // Atualizar Time A
            const timeARanking = rankingTimes[timeAId] || {
              vitorias: 0, 
              derrotas: 0, 
              golsPro: 0, 
              golsContra: 0, 
              saldoGols: 0, 
              pontos: 0
            };

            // Atualizar Time B
            const timeBRanking = rankingTimes[timeBId] || {
              vitorias: 0, 
              derrotas: 0, 
              golsPro: 0, 
              golsContra: 0, 
              saldoGols: 0, 
              pontos: 0
            };

            // Contabilizar os gols
            const timeAGols = timeA?.gols || 0;
            const timeBGols = timeB?.gols || 0;

            // Atualizar estatísticas do Time A
            let timeAUpdate: RankingTimeUpdate = {
              golsPro: (timeARanking.golsPro || 0) + timeAGols,
              golsContra: (timeARanking.golsContra || 0) + timeBGols,
            };

            // Atualizar estatísticas do Time B
            let timeBUpdate: RankingTimeUpdate = {
              golsPro: (timeBRanking.golsPro || 0) + timeBGols,
              golsContra: (timeBRanking.golsContra || 0) + timeAGols,
            };

            // Verificar o resultado (vitória, derrota, empate)
            if (timeAGols > timeBGols) {
              // Time A venceu
              timeAUpdate = {
                ...timeAUpdate,
                vitorias: (timeARanking.vitorias || 0) + 1,
                pontos: (timeARanking.pontos || 0) + 3,
              };
              timeBUpdate = {
                ...timeBUpdate,
                derrotas: (timeBRanking.derrotas || 0) + 1,
              };
            } else if (timeBGols > timeAGols) {
              // Time B venceu
              timeBUpdate = {
                ...timeBUpdate,
                vitorias: (timeBRanking.vitorias || 0) + 1,
                pontos: (timeBRanking.pontos || 0) + 3,
              };
              timeAUpdate = {
                ...timeAUpdate,
                derrotas: (timeARanking.derrotas || 0) + 1,
              };
            } else {
              // Empate
              timeAUpdate = {
                ...timeAUpdate,
                pontos: (timeARanking.pontos || 0) + 1,
              };
              timeBUpdate = {
                ...timeBUpdate,
                pontos: (timeBRanking.pontos || 0) + 1,
              };
            }

            // Calcular o saldo de gols
            timeAUpdate.saldoGols = (timeAUpdate.golsPro || 0) - (timeAUpdate.golsContra || 0);
            timeBUpdate.saldoGols = (timeBUpdate.golsPro || 0) - (timeBUpdate.golsContra || 0);

            // Preparar atualizações para o Firestore
            rankingTimesUpdates[`rankingTimes.${timeAId}`] = {
              id: timeAId,
              nome: timeA?.nome || `Time ${timeAId}`,
              vitorias: timeAUpdate.vitorias || timeARanking.vitorias || 0,
              derrotas: timeAUpdate.derrotas || timeARanking.derrotas || 0,
              golsPro: timeAUpdate.golsPro || timeARanking.golsPro || 0,
              golsContra: timeAUpdate.golsContra || timeARanking.golsContra || 0,
              saldoGols: timeAUpdate.saldoGols || timeARanking.saldoGols || 0,
              pontos: timeAUpdate.pontos || timeARanking.pontos || 0
            };

            rankingTimesUpdates[`rankingTimes.${timeBId}`] = {
              id: timeBId,
              nome: timeB?.nome || `Time ${timeBId}`,
              vitorias: timeBUpdate.vitorias || timeBRanking.vitorias || 0,
              derrotas: timeBUpdate.derrotas || timeBRanking.derrotas || 0,
              golsPro: timeBUpdate.golsPro || timeBRanking.golsPro || 0,
              golsContra: timeBUpdate.golsContra || timeBRanking.golsContra || 0,
              saldoGols: timeBUpdate.saldoGols || timeBRanking.saldoGols || 0,
              pontos: timeBUpdate.pontos || timeBRanking.pontos || 0
            };

            // Adicionar informações do histórico de partidas
            const historicoPartida = {
              data: new Date(),
              timeA: {
                id: timeAId,
                nome: timeA.nome,
                gols: timeA.gols,
                venceu: timeAVenceu
              },
              timeB: {
                id: timeBId,
                nome: timeB.nome,
                gols: timeB.gols,
                venceu: timeBVenceu
              },
              empate: empate
            };

            // Adicionar histórico à atualização
            rankingTimesUpdates['historico'] = arrayUnion(historicoPartida);

            // Atualizar estatísticas dos jogadores do Time A
            jogadoresTimeAValidos.forEach(jogador => {
              const jogadorId = jogador.id || jogador.uid || '';
              if (!jogadorId) return;
              
              // Buscar estatísticas existentes do jogador neste time
              const estatisticasTime = peladaData.estatisticasTime || {};
              const estatisticasDoTime = estatisticasTime[timeAId] || {};
              const jogadorStats = estatisticasDoTime[jogadorId] || {
                gols: 0,
                assistencias: 0,
                vitorias: 0,
                derrotas: 0,
                pontos: 0,
                jogos: 0,
                empates: 0
              };
              
              // Calcular pontos com base na nova tabela:
              // Gol: +2, Assistência: +1, Vitória: +7, Derrota: -6, Empate: +1, Participação: +0.5
              const pontosPorGols = (jogador.gols || 0) * 2;
              const pontosPorAssistencias = (jogador.assistencias || 0) * 1;
              const pontosPorResultado = timeAVenceu ? 7 : (timeBVenceu ? -6 : 1); // Vitória, derrota ou empate
              const pontosPorParticipacao = 0.5; // Apenas por participar da partida
              
              const pontosDaPartida = pontosPorGols + pontosPorAssistencias + pontosPorResultado + pontosPorParticipacao;
              
              // Atualizar estatísticas do jogador
              const novasEstatisticas: JogadorEstatistica = {
                gols: (jogadorStats.gols || 0) + (jogador.gols || 0),
                assistencias: (jogadorStats.assistencias || 0) + (jogador.assistencias || 0),
                vitorias: (jogadorStats.vitorias || 0) + (timeAVenceu ? 1 : 0),
                derrotas: (jogadorStats.derrotas || 0) + (timeBVenceu ? 1 : 0),
                pontos: (jogadorStats.pontos || 0) + pontosDaPartida,
                jogos: (jogadorStats.jogos || 0) + 1,
                empates: (jogadorStats.empates || 0) + (empate ? 1 : 0)
              };
              
              // Adicionar à lista de atualizações
              estatisticasJogadoresUpdates[`estatisticasTime.${timeAId}.${jogadorId}`] = novasEstatisticas;
            });
            
            // Atualizar estatísticas dos jogadores do Time B
            jogadoresTimeBValidos.forEach(jogador => {
              const jogadorId = jogador.id || jogador.uid || '';
              if (!jogadorId) return;
              
              // Buscar estatísticas existentes do jogador neste time
              const estatisticasTime = peladaData.estatisticasTime || {};
              const estatisticasDoTime = estatisticasTime[timeBId] || {};
              const jogadorStats = estatisticasDoTime[jogadorId] || {
                gols: 0,
                assistencias: 0,
                vitorias: 0,
                derrotas: 0,
                pontos: 0,
                jogos: 0,
                empates: 0
              };
              
              // Calcular pontos com base na nova tabela:
              // Gol: +2, Assistência: +1, Vitória: +7, Derrota: -6, Empate: +1, Participação: +0.5
              const pontosPorGols = (jogador.gols || 0) * 2;
              const pontosPorAssistencias = (jogador.assistencias || 0) * 1;
              const pontosPorResultado = timeBVenceu ? 7 : (timeAVenceu ? -6 : 1); // Vitória, derrota ou empate
              const pontosPorParticipacao = 0.5; // Apenas por participar da partida
              
              const pontosDaPartida = pontosPorGols + pontosPorAssistencias + pontosPorResultado + pontosPorParticipacao;
              
              // Atualizar estatísticas do jogador
              const novasEstatisticas: JogadorEstatistica = {
                gols: (jogadorStats.gols || 0) + (jogador.gols || 0),
                assistencias: (jogadorStats.assistencias || 0) + (jogador.assistencias || 0),
                vitorias: (jogadorStats.vitorias || 0) + (timeBVenceu ? 1 : 0),
                derrotas: (jogadorStats.derrotas || 0) + (timeAVenceu ? 1 : 0),
                pontos: (jogadorStats.pontos || 0) + pontosDaPartida,
                jogos: (jogadorStats.jogos || 0) + 1,
                empates: (jogadorStats.empates || 0) + (empate ? 1 : 0)
              };
              
              // Adicionar à lista de atualizações
              estatisticasJogadoresUpdates[`estatisticasTime.${timeBId}.${jogadorId}`] = novasEstatisticas;
            });

            console.log('DEBUG: Atualizando ranking de times...', rankingTimesUpdates);
            console.log('DEBUG: Atualizando estatísticas de jogadores por time...', estatisticasJogadoresUpdates);

            // Aplicar as atualizações no Firestore
            await updateDoc(peladaRef, { ...rankingTimesUpdates, ...estatisticasJogadoresUpdates });
            console.log('DEBUG: Ranking de times e estatísticas de jogadores atualizados com sucesso!');
          }
        }
      } catch (error) {
        console.error('DEBUG: Erro ao atualizar ranking de times:', error);
      }
      
      toast.success('Partida finalizada com sucesso!');
      
      // Limpar dados temporários do localStorage
      localStorage.removeItem(`timesSelecionados_${params.id}`);
      
      // Redirecionar para a página de times
      setTimeout(() => {
        router.push('/time');
      }, 1500);

      return true;
    } catch (error) {
      console.error('Erro ao finalizar partida:', error);
      toast.error('Erro ao finalizar a partida');
      return false;
    }
  }, [timeA, timeB, params.id, determinarVencedor, router]);

  // Funções de manipulação
  const handleGol = useCallback((timeId: string, jogadorId: string, incremento: boolean = true) => {
    const time = timeA?.id === timeId ? timeA : timeB?.id === timeId ? timeB : null;
    if (!time) return;

    const novoTime: Time = {
      ...time,
      gols: incremento ? (time.gols + 1) : Math.max(0, time.gols - 1),
      jogadores: time.jogadores.map((j: Jogador) => {
        // Verifica tanto id quanto uid
        const idMatch = j.id === jogadorId || j.uid === jogadorId;
        if (idMatch) {
          return {
            ...j,
            gols: incremento ? (j.gols + 1) : Math.max(0, j.gols - 1)
          };
        }
        return j;
      })
    };

    if (timeA?.id === timeId) {
      setTimeA(novoTime);
    } else {
      setTimeB(novoTime);
    }
  }, [timeA, timeB]);

  const handleAssistencia = useCallback((timeId: string, jogadorId: string, incremento: boolean = true) => {
    const time = timeA?.id === timeId ? timeA : timeB?.id === timeId ? timeB : null;
    if (!time) return;

    const novoTime: Time = {
      ...time,
      jogadores: time.jogadores.map((j: Jogador) => {
        // Verifica tanto id quanto uid
        const idMatch = j.id === jogadorId || j.uid === jogadorId;
        if (idMatch) {
          return {
            ...j,
            assistencias: incremento ? (j.assistencias + 1) : Math.max(0, j.assistencias - 1)
          };
        }
        return j;
      })
    };

    if (timeA?.id === timeId) {
      setTimeA(novoTime);
    } else {
      setTimeB(novoTime);
    }
  }, [timeA, timeB]);

  const handleToggleCronometro = () => {
    setRodando(!rodando);
  };

  const handleResetCronometro = () => {
    setMinutos(25);
    setSegundos(0);
    setRodando(false);
    setTempoAcabou(false);
  };

  const handleAjustarTempo = (tipo: 'minutos' | 'segundos', incremento: boolean) => {
    if (!rodando) {
      if (tipo === 'minutos') {
        setMinutos(m => incremento ? Math.min(99, m + 1) : Math.max(0, m - 1));
      } else {
        setSegundos(s => {
          if (incremento) {
            if (s === 59) {
              setMinutos(m => Math.min(99, m + 1));
              return 0;
            }
            return s + 1;
          } else {
            if (s === 0 && minutos > 0) {
              setMinutos(m => m - 1);
              return 59;
            }
            return Math.max(0, s - 1);
          }
        });
      }
    }
  };

  // Atualiza a referência sempre que a função mudar
  useEffect(() => {
    finalizarPartidaRef.current = handleFinalizarPartida;
  }, [handleFinalizarPartida]);

  // Efeito para o cronômetro (apenas regressivo)
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (rodando) {
      intervalId = setInterval(() => {
        // Contagem regressiva
        if (minutos === 0 && segundos === 0) {
          setRodando(false);
          setTempoAcabou(true);
          
          // Determine o vencedor quando o tempo acabar
          const vencedor = determinarVencedor();
          
          if (vencedor === 'empate') {
            toast('Tempo esgotado! A partida terminou empatada!');
          } else if (vencedor) {
            toast.success(`Tempo esgotado! ${vencedor.nome} venceu a partida!`);
          } else {
            toast('Tempo esgotado!');
          }
          
          // Finalize a partida automaticamente
          finalizarPartidaRef.current().then(success => {
            if (success) {
              // Sucesso, redirecionamento já está sendo tratado em handleFinalizarPartida
            } else {
              // Falha ao finalizar automaticamente
              toast.error('Erro ao atualizar ranking automaticamente. Use o botão Finalizar Partida.');
            }
          });
          
          return;
        }
        
        if (segundos === 0) {
          setMinutos(m => m - 1);
          setSegundos(59);
        } else {
          setSegundos(s => s - 1);
        }
      }, 1000);
    }

    return () => {
      clearInterval(intervalId);
    };
  }, [rodando, minutos, segundos, determinarVencedor]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
        <Link href="/time">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Voltar para Times
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Cronômetro */}
        <div className="bg-white rounded-lg p-8 mb-8 shadow-md">
          <div className="flex justify-center items-center space-x-2">
            <div className="flex flex-col items-center">
              <IconButton onClick={() => handleAjustarTempo('minutos', false)} disabled={rodando}>
                <ArrowDownwardIcon />
              </IconButton>
              <TextField
                value={minutos.toString().padStart(2, '0')}
                onChange={(e) => setMinutos(Math.max(0, Math.min(99, parseInt(e.target.value) || 0)))}
                InputProps={{ readOnly: rodando }}
                size="small"
                sx={{ width: '70px', textAlign: 'center', input: { textAlign: 'center', fontSize: '2rem' } }}
              />
              <IconButton onClick={() => handleAjustarTempo('minutos', true)} disabled={rodando}>
                <ArrowUpwardIcon />
              </IconButton>
            </div>
            <div className="text-4xl">:</div>
            <div className="flex flex-col items-center">
              <IconButton onClick={() => handleAjustarTempo('segundos', false)} disabled={rodando}>
                <ArrowDownwardIcon />
              </IconButton>
              <TextField
                value={segundos.toString().padStart(2, '0')}
                onChange={(e) => setSegundos(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                InputProps={{ readOnly: rodando }}
                size="small"
                sx={{ width: '70px', textAlign: 'center', input: { textAlign: 'center', fontSize: '2rem' } }}
              />
              <IconButton onClick={() => handleAjustarTempo('segundos', true)} disabled={rodando}>
                <ArrowUpwardIcon />
              </IconButton>
            </div>
          </div>
          
          <div className="flex justify-center mt-4 space-x-4">
            <IconButton 
              color="primary" 
              onClick={handleResetCronometro} 
              sx={{ bgcolor: 'rgba(0, 0, 0, 0.08)' }}
            >
              <RefreshIcon />
            </IconButton>
            <IconButton 
              color="primary" 
              onClick={handleToggleCronometro} 
              sx={{ bgcolor: 'rgba(0, 0, 0, 0.08)' }}
            >
              {rodando ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
          </div>
        </div>
        
        {/* Placar */}
        <div className="flex justify-center items-center text-5xl font-bold mb-8">
          <div className="text-blue-600">{timeA?.gols || 0}</div>
          <div className="mx-6 text-gray-600">vs</div>
          <div className="text-red-600">{timeB?.gols || 0}</div>
        </div>
        <div className="flex justify-center items-center text-xl font-medium mb-8">
          <div className="text-blue-600">{timeA?.nome}</div>
          <div className="mx-6 text-gray-600"></div>
          <div className="text-red-600">{timeB?.nome}</div>
        </div>
        
        {/* Times e Jogadores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Time A */}
          <div className="border-2 border-blue-500 rounded-lg overflow-hidden">
            <div className="bg-blue-500 text-white p-4">
              <h2 className="text-xl font-bold">{timeA?.nome}</h2>
            </div>
            <div className="p-4">
              {timeA?.jogadores.map((jogador) => (
                <div key={jogador.id} className="mb-4 p-4 border-b">
                  <div className="text-lg font-medium mb-2">{jogador.nome}</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600">G: {jogador.gols}</span>
                      <IconButton 
                        size="small" 
                        onClick={() => handleGol(timeA.id, jogador.id, true)}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleGol(timeA.id, jogador.id, false)}
                        disabled={jogador.gols === 0}
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600">A: {jogador.assistencias}</span>
                      <IconButton 
                        size="small" 
                        onClick={() => handleAssistencia(timeA.id, jogador.id, true)}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleAssistencia(timeA.id, jogador.id, false)}
                        disabled={jogador.assistencias === 0}
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Time B */}
          <div className="border-2 border-red-500 rounded-lg overflow-hidden">
            <div className="bg-red-500 text-white p-4">
              <h2 className="text-xl font-bold">{timeB?.nome}</h2>
            </div>
            <div className="p-4">
              {timeB?.jogadores.map((jogador) => (
                <div key={jogador.id} className="mb-4 p-4 border-b">
                  <div className="text-lg font-medium mb-2">{jogador.nome}</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600">G: {jogador.gols}</span>
                      <IconButton 
                        size="small" 
                        onClick={() => handleGol(timeB.id, jogador.id, true)}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleGol(timeB.id, jogador.id, false)}
                        disabled={jogador.gols === 0}
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600">A: {jogador.assistencias}</span>
                      <IconButton 
                        size="small" 
                        onClick={() => handleAssistencia(timeB.id, jogador.id, true)}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleAssistencia(timeB.id, jogador.id, false)}
                        disabled={jogador.assistencias === 0}
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Botão Finalizar Partida */}
        <div className="fixed bottom-6 right-6">
          {tempoAcabou ? (
            <Fab 
              variant="extended" 
              color="secondary" 
              onClick={async () => {
                const rankingAtualizado = await handleFinalizarPartida();
                if (rankingAtualizado) {
                  toast.success('Partida finalizada e ranking atualizado!');
                }
              }}
              sx={{ px: 3 }}
            >
              <FlagIcon sx={{ mr: 1 }} />
              FINALIZAR PARTIDA
            </Fab>
          ) : (
            rodando ? null : (
              <Fab
                variant="extended"
                color="primary"
                onClick={handleToggleCronometro}
                sx={{ px: 3 }}
              >
                <PlayArrowIcon sx={{ mr: 1 }} />
                INICIAR PARTIDA
              </Fab>
            )
          )}
        </div>
      </div>
    </div>
  );
} 