'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, getDoc, arrayUnion, DocumentData } from 'firebase/firestore';
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

interface Jogador {
  id: string;
  uid?: string;
  nome: string;
  gols: number;
  assistencias: number;
}

interface Time {
  id: number;
  nome: string;
  cor: string;
  jogadores: Jogador[];
  gols: number;
}

interface RankingData {
  jogos: number;
  gols: number;
  assistencias: number;
  vitorias: number;
  derrotas: number;
  empates: number;
  pontos: number;
  nome?: string;
}

interface PeladaData extends DocumentData {
  ranking: {
    [key: string]: RankingData;
  };
}

type Vencedor = Time | 'empate';

interface TimeSelecionado {
  id: number;
  selecionado: boolean;
}

interface RankingUpdate {
  jogos: number;
  gols: number;
  assistencias: number;
  vitorias: number;
  derrotas: number;
  empates: number;
  pontos: number;
  nome: string;
}

export default function Partida() {
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
  const [timesSalvos, setTimesSalvos] = useState<Time[]>([]);
  const [timesSelecionados, setTimesSelecionados] = useState<TimeSelecionado[]>([]);
  
  // Referência para a função de finalizar partida
  const finalizarPartidaRef = useRef<() => Promise<boolean>>(async () => false);

  // Função para carregar os times salvos
  const carregarTimesSalvos = useCallback(() => {
    try {
      // Busca os times gerados na página de confirmação
      const timesPartidaString = localStorage.getItem(`timesPartida_${params.id}`);
      console.log('Buscando times da partida:', timesPartidaString);
      
      if (timesPartidaString) {
        const times = JSON.parse(timesPartidaString) as Time[];
        console.log('Times da partida encontrados:', times);
        
        // Reseta os gols e assistências dos times
        const timesResetados = times.map(time => ({
          ...time,
          gols: 0,
          jogadores: time.jogadores.map(j => ({
            ...j,
            gols: 0,
            assistencias: 0
          }))
        }));

        setTimesSalvos(timesResetados);
      } else {
        console.log('Nenhum time encontrado no localStorage');
      }
    } catch (error) {
      console.error('Erro ao carregar times salvos:', error);
    }
  }, [params.id]);

  // Carregar times salvos quando o componente montar
  useEffect(() => {
    carregarTimesSalvos();
  }, [carregarTimesSalvos]);

  // Carregar times do localStorage
  useEffect(() => {
    try {
      const timesString = localStorage.getItem(`timesPartida_${params.id}`);
      if (!timesString) {
        setError('Nenhum time encontrado');
        return;
      }

      const times = JSON.parse(timesString) as Time[];
      if (times.length !== 2) {
        setError('Número incorreto de times');
        return;
      }

      setTimeA(times[0]);
      setTimeB(times[1]);
      setLoading(false);
    } catch (err) {
      console.error('Erro ao carregar times:', err);
      setError('Erro ao carregar times');
      setLoading(false);
    }
  }, [params.id]);

  // Adiciona listener para sincronização em tempo real do ranking
  useEffect(() => {
    if (!params.id || typeof params.id !== 'string') return;

    const peladaRef = doc(db, 'peladas', params.id);
    const unsubscribe = onSnapshot(peladaRef, (doc) => {
      const data = doc.data() as PeladaData | undefined;
      if (data?.ranking) {
        console.log('Ranking atualizado:', data.ranking);
      }
    }, (error) => {
      console.error('Erro ao observar ranking:', error);
    });

    return () => unsubscribe();
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
      
      // Log para depuração
      if (timeA.jogadores.length !== jogadoresTimeAValidos.length || 
          timeB.jogadores.length !== jogadoresTimeBValidos.length) {
        console.warn('DEBUG: Alguns jogadores com IDs inválidos foram removidos:', {
          timeA: timeA.jogadores.length - jogadoresTimeAValidos.length,
          timeB: timeB.jogadores.length - jogadoresTimeBValidos.length
        });
      }
      
      console.log('DEBUG: Times válidos para calcular ranking:', {
        timeA: {
          nome: timeAValido.nome,
          gols: timeAValido.gols,
          jogadores: timeAValido.jogadores.map(j => ({ id: j.id, nome: j.nome, gols: j.gols, assistencias: j.assistencias }))
        },
        timeB: {
          nome: timeBValido.nome,
          gols: timeBValido.gols,
          jogadores: timeBValido.jogadores.map(j => ({ id: j.id, nome: j.nome, gols: j.gols, assistencias: j.assistencias }))
        }
      });
      
      const timeAVenceu = (timeAValido.gols ?? 0) > (timeBValido.gols ?? 0);
      const timeBVenceu = (timeBValido.gols ?? 0) > (timeAValido.gols ?? 0);
      const empate = (timeAValido.gols ?? 0) === (timeBValido.gols ?? 0);

      // Busca o documento da pelada
      const peladaRef = doc(db, 'peladas', params.id);
      const peladaDoc = await getDoc(peladaRef);
      const peladaData = peladaDoc.data();

      if (!peladaData) {
        throw new Error('Dados da pelada não encontrados');
      }

      console.log('DEBUG: Dados originais da pelada:', {
        peladaId: params.id,
        rankingExistente: Object.keys(peladaData.ranking || {}).length
      });

      // Prepara as atualizações do ranking para todos os jogadores
      const rankingUpdates: { [key: string]: RankingUpdate } = {};
      // Objeto para armazenar o ranking direto (sem notação de ponto)
      const rankingDireto: Record<string, RankingUpdate> = {};

      // Processa jogadores do Time A
      for (const jogador of timeAValido.jogadores) {
        // Obter o ID válido, priorizando uid se estiver disponível
        const jogadorId = jogador.uid || jogador.id;
        if (!jogadorId || jogadorId === 'undefined') {
          console.warn('DEBUG: Jogador sem ID válido:', jogador.nome);
          continue;
        }

        const resultado = timeAVenceu ? 'vitoria' : (empate ? 'empate' : 'derrota');
        const golsNum = Number(jogador.gols) || 0;
        const assistenciasNum = Number(jogador.assistencias) || 0;

        console.log(`DEBUG: Processando jogador do Time A: ${jogador.nome} (${jogadorId})`, {
          resultado,
          gols: golsNum,
          assistencias: assistenciasNum
        });

        const rankingAtual = peladaData.ranking?.[jogadorId] || {
          jogos: 0,
          gols: 0,
          assistencias: 0,
          vitorias: 0,
          derrotas: 0,
          empates: 0,
          pontos: 0,
          nome: jogador.nome
        };

        console.log(`DEBUG: Ranking atual do jogador ${jogador.nome}:`, rankingAtual);

        // Calcula os pontos com a nova tabela de pontuação
        const pontosPorVitoria = resultado === 'vitoria' ? 7 : 0;
        const pontosPorDerrota = resultado === 'derrota' ? -6 : 0;
        const pontosPorEmpate = resultado === 'empate' ? 1 : 0;
        const pontosPorGols = golsNum * 2; // +2 por gol
        const pontosPorAssistencias = assistenciasNum * 1; // +1 por assistência
        const pontosPorParticipacao = 0.5; // +0.5 por participação
        
        const pontosTotais = Math.max(0, (rankingAtual.pontos || 0) + 
                             pontosPorVitoria + 
                             pontosPorDerrota + 
                             pontosPorEmpate + 
                             pontosPorGols + 
                             pontosPorAssistencias +
                             pontosPorParticipacao);

        const novoRanking: RankingUpdate = {
          jogos: (rankingAtual.jogos || 0) + 1,
          gols: (rankingAtual.gols || 0) + golsNum,
          assistencias: (rankingAtual.assistencias || 0) + assistenciasNum,
          vitorias: (rankingAtual.vitorias || 0) + (resultado === 'vitoria' ? 1 : 0),
          derrotas: (rankingAtual.derrotas || 0) + (resultado === 'derrota' ? 1 : 0),
          empates: (rankingAtual.empates || 0) + (resultado === 'empate' ? 1 : 0),
          pontos: pontosTotais,
          nome: jogador.nome
        };

        console.log(`DEBUG: Novo ranking do jogador ${jogador.nome}:`, {
          pontosPorVitoria,
          pontosPorDerrota,
          pontosPorEmpate,
          pontosPorGols,
          pontosPorAssistencias,
          pontosPorParticipacao,
          pontosTotais,
          novoRanking
        });

        rankingUpdates[`ranking.${jogadorId}`] = novoRanking;
        rankingDireto[jogadorId] = novoRanking;
      }

      // Processa jogadores do Time B
      for (const jogador of timeBValido.jogadores) {
        // Obter o ID válido, priorizando uid se estiver disponível
        const jogadorId = jogador.uid || jogador.id;
        if (!jogadorId || jogadorId === 'undefined') {
          console.warn('DEBUG: Jogador sem ID válido:', jogador.nome);
          continue;
        }

        const resultado = timeBVenceu ? 'vitoria' : (empate ? 'empate' : 'derrota');
        const golsNum = Number(jogador.gols) || 0;
        const assistenciasNum = Number(jogador.assistencias) || 0;

        console.log(`DEBUG: Processando jogador do Time B: ${jogador.nome} (${jogadorId})`, {
          resultado,
          gols: golsNum,
          assistencias: assistenciasNum
        });

        const rankingAtual = peladaData.ranking?.[jogadorId] || {
          jogos: 0,
          gols: 0,
          assistencias: 0,
          vitorias: 0,
          derrotas: 0,
          empates: 0,
          pontos: 0,
          nome: jogador.nome
        };

        console.log(`DEBUG: Ranking atual do jogador ${jogador.nome}:`, rankingAtual);

        // Calcula os pontos com a nova tabela de pontuação
        const pontosPorVitoria = resultado === 'vitoria' ? 7 : 0;
        const pontosPorDerrota = resultado === 'derrota' ? -6 : 0;
        const pontosPorEmpate = resultado === 'empate' ? 1 : 0;
        const pontosPorGols = golsNum * 2; // +2 por gol
        const pontosPorAssistencias = assistenciasNum * 1; // +1 por assistência
        const pontosPorParticipacao = 0.5; // +0.5 por participação
        
        const pontosTotais = Math.max(0, (rankingAtual.pontos || 0) + 
                             pontosPorVitoria + 
                             pontosPorDerrota + 
                             pontosPorEmpate + 
                             pontosPorGols + 
                             pontosPorAssistencias +
                             pontosPorParticipacao);

        const novoRanking: RankingUpdate = {
          jogos: (rankingAtual.jogos || 0) + 1,
          gols: (rankingAtual.gols || 0) + golsNum,
          assistencias: (rankingAtual.assistencias || 0) + assistenciasNum,
          vitorias: (rankingAtual.vitorias || 0) + (resultado === 'vitoria' ? 1 : 0),
          derrotas: (rankingAtual.derrotas || 0) + (resultado === 'derrota' ? 1 : 0),
          empates: (rankingAtual.empates || 0) + (resultado === 'empate' ? 1 : 0),
          pontos: pontosTotais,
          nome: jogador.nome
        };

        console.log(`DEBUG: Novo ranking do jogador ${jogador.nome}:`, {
          pontosPorVitoria,
          pontosPorDerrota,
          pontosPorEmpate,
          pontosPorGols,
          pontosPorAssistencias,
          pontosPorParticipacao,
          pontosTotais,
          novoRanking
        });

        rankingUpdates[`ranking.${jogadorId}`] = novoRanking;
        rankingDireto[jogadorId] = novoRanking;
      }

      console.log('DEBUG: Atualizações do ranking preparadas:', Object.keys(rankingUpdates).length, 'jogadores');
      
      // Verifica se há alguma atualização para ser feita
      if (Object.keys(rankingUpdates).length === 0) {
        console.error('DEBUG: Nenhuma atualização de ranking para enviar!');
        toast.error('Não foi possível atualizar o ranking: nenhum jogador válido');
        return false;
      }

      // Adicionar o historico ao objeto de atualizações
      const updatesWithHistory = {
        ...rankingUpdates,
        historico: arrayUnion({
          data: new Date(),
          timeA: {
            ...timeAValido,
            venceu: timeAVenceu,
          },
          timeB: {
            ...timeBValido,
            venceu: timeBVenceu,
          },
          empate: empate
        })
      };

      console.log('DEBUG: Enviando atualizações para o Firestore...');
      
      // Salva o resultado da partida e atualiza o ranking em uma única operação
      await updateDoc(peladaRef, updatesWithHistory);

      // Segunda tentativa - atualizar apenas o ranking usando o objeto direto
      try {
        console.log('DEBUG: Tentando segunda atualização usando objeto direto...');
        await updateDoc(peladaRef, { 
          ranking: rankingDireto 
        });
        console.log('DEBUG: Segunda atualização concluída com sucesso');
      } catch (err) {
        console.error('DEBUG: Erro na segunda tentativa:', err);
      }

      // Verifica se o ranking foi realmente atualizado
      const peladaAposAtualizacao = await getDoc(peladaRef);
      if (peladaAposAtualizacao.exists()) {
        const dataAposAtualizacao = peladaAposAtualizacao.data();
        console.log('DEBUG: Verificação pós-atualização:', {
          rankingAposAtualizacao: Object.keys(dataAposAtualizacao.ranking || {}).length,
          primeirosJogadores: Object.entries(dataAposAtualizacao.ranking || {})
            .slice(0, 3)
            .map(([id, data]) => ({ id, pontos: (data as RankingData).pontos }))
        });
        
        // CORREÇÃO: Atualizar diretamente o ranking para cada jogador
        // Isso garante que os updates não sejam mesclados incorretamente
        if (Object.keys(rankingUpdates).length > 0) {
          // Definir o tipo corretamente para evitar erros de tipo
          const rankingFinal: Record<string, RankingData> = {};
          
          // Cria um objeto com o ranking completo
          if (dataAposAtualizacao.ranking) {
            // Copiar os dados do ranking atual
            Object.entries(dataAposAtualizacao.ranking).forEach(([key, value]) => {
              rankingFinal[key] = value as RankingData;
            });
            
            // Aplicar os updates do ranking atual
            Object.entries(rankingUpdates).forEach(([key, value]) => {
              const jogadorId = key.replace('ranking.', '');
              rankingFinal[jogadorId] = value;
            });
            
            // Atualiza o documento com o ranking completo de uma vez
            try {
              console.log('DEBUG: Realizando atualização de ranking final...');
              await updateDoc(peladaRef, {
                ranking: rankingFinal
              });
              console.log('DEBUG: Ranking final atualizado com sucesso!');
            } catch (updateError) {
              console.error('DEBUG: Erro na atualização final do ranking:', updateError);
            }
          }
        }
      }

      console.log('DEBUG: Ranking atualizado com sucesso!');
      toast.success('Ranking atualizado com sucesso!');
      return true;
    } catch (error) {
      console.error('Erro ao finalizar partida:', error);
      toast.error('Erro ao atualizar o ranking');
      return false;
    }
  }, [timeA, timeB, params.id]);
  
  // Funções de manipulação
  const handleGol = useCallback((timeId: number, jogadorId: string, incremento: boolean = true) => {
    const time = timeId === 1 ? timeA : timeB;
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

    if (timeId === 1) {
      setTimeA(novoTime);
    } else {
      setTimeB(novoTime);
    }
  }, [timeA, timeB]);

  const handleAssistencia = useCallback((timeId: number, jogadorId: string, incremento: boolean = true) => {
    const time = timeId === 1 ? timeA : timeB;
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

    if (timeId === 1) {
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

  const handleTempoChange = (tipo: 'minutos' | 'segundos', valor: string) => {
    if (!rodando) {
      const num = parseInt(valor, 10);
      if (isNaN(num)) return;

      if (tipo === 'minutos') {
        setMinutos(Math.max(0, Math.min(99, num)));
      } else {
        setSegundos(Math.max(0, Math.min(59, num)));
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
          
          // Determina o vencedor
          const vencedor = determinarVencedor();
          if (!vencedor) return;

          if (vencedor === 'empate') {
            toast('Tempo esgotado! A partida terminou empatada!');
          } else {
            toast.success(`Tempo esgotado! ${vencedor.nome} venceu a partida!`);
          }
          
          // Atualiza automaticamente o ranking quando o tempo acabar
          finalizarPartidaRef.current().then(success => {
            if (success) {
              toast.success('Ranking atualizado automaticamente!');
            }
          }).catch(error => {
            console.error('Erro ao atualizar ranking automaticamente:', error);
            toast.error('Erro ao atualizar ranking automaticamente. Use o botão Finalizar Partida.');
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
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [rodando, minutos, segundos, determinarVencedor]);

  const handleOpenModal = async () => {
    try {
      setLoading(true);
      
      const rankingAtualizado = await handleFinalizarPartida();
      
      if (!rankingAtualizado) {
        toast.error('Erro ao atualizar o ranking');
        return;
      }

      // Busca os times gerados da página anterior
      const timesGeradosString = localStorage.getItem(`timesGerados_${params.id}`);
      if (timesGeradosString) {
        const timesGerados = JSON.parse(timesGeradosString) as Time[];
        console.log('Times gerados encontrados:', timesGerados);
        
        // Reseta os gols e assistências dos times
        const timesResetados = timesGerados.map(time => ({
          ...time,
          gols: 0,
          jogadores: time.jogadores.map(j => ({
            ...j,
            gols: 0,
            assistencias: 0
          }))
        }));

        setTimesSalvos(timesResetados);
        setTimesSelecionados(timesResetados.map(time => ({
          id: time.id,
          selecionado: false
        })));
        setOpenModal(true);
      } else {
        console.log('Nenhum time encontrado');
        toast.error('Nenhum time disponível. Por favor, gere os times na página de confirmação.');
        router.push(`/pelada/${params.id}/confirmar`);
      }
    } catch (error) {
      console.error('Erro ao abrir modal:', error);
      toast.error('Erro ao carregar times');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setOpenModal(false);
  };

  const handleSelecionarTime = (timeId: number) => {
    setTimesSelecionados(prev => {
      const timesSelecionadosCount = prev.filter(t => t.selecionado).length;
      const timeAtual = prev.find(t => t.id === timeId);
      
      if (!timeAtual) return prev;

      // Se o time já está selecionado, apenas desmarca
      if (timeAtual.selecionado) {
        return prev.map(t => t.id === timeId ? { ...t, selecionado: false } : t);
      }

      // Se já tem 2 times selecionados e tenta selecionar outro, impede
      if (timesSelecionadosCount >= 2) {
        toast.error('Já foram selecionados 2 times');
        return prev;
      }

      // Seleciona o time
      return prev.map(t => t.id === timeId ? { ...t, selecionado: true } : t);
    });
  };

  const handleEncerrarDia = async () => {
    try {
      if (!params.id || typeof params.id !== 'string') {
        throw new Error('ID da pelada não encontrado');
      }

      // Limpa os times do localStorage
      localStorage.removeItem('timesGerados');
      localStorage.removeItem('timesPartida');
      
      // Atualiza o status da pelada para 'encerrada' e limpa os confirmados
      const peladaRef = doc(db, 'peladas', params.id);
      await updateDoc(peladaRef, {
        status: 'encerrada',
        dataEncerramento: new Date(),
        confirmados: [], // Limpa a lista de confirmados
        historico: arrayUnion({
          data: new Date(),
          tipo: 'encerramento',
          mensagem: 'Pelada encerrada'
        })
      });
      
      toast.success('Pelada encerrada com sucesso!');
      
      // Redireciona para o dashboard
      router.push('/dashboard');
      
    } catch (error) {
      console.error('Erro ao encerrar a pelada:', error);
      toast.error('Erro ao encerrar a pelada');
    }
  };

  const handleSalvarTimes = async () => {
    try {
      const timesSelecionadosArray = timesSelecionados.filter(t => t.selecionado);
      
      if (timesSelecionadosArray.length !== 2) {
        toast.error('Selecione exatamente 2 times');
        return;
      }

      const novoTimeA = timesSalvos.find(t => t.id === timesSelecionadosArray[0].id);
      const novoTimeB = timesSalvos.find(t => t.id === timesSelecionadosArray[1].id);

      if (!novoTimeA || !novoTimeB) {
        toast.error('Times selecionados não encontrados');
        return;
      }

      // Filtra jogadores com IDs inválidos
      const jogadoresTimeAValidos = novoTimeA.jogadores.filter(j => j.id && j.id !== 'undefined');
      const jogadoresTimeBValidos = novoTimeB.jogadores.filter(j => j.id && j.id !== 'undefined');

      // Log para depuração se jogadores foram removidos
      if (novoTimeA.jogadores.length !== jogadoresTimeAValidos.length || 
          novoTimeB.jogadores.length !== jogadoresTimeBValidos.length) {
        console.warn('DEBUG: Alguns jogadores com IDs inválidos foram removidos ao salvar times:', {
          timeA: novoTimeA.jogadores.length - jogadoresTimeAValidos.length,
          timeB: novoTimeB.jogadores.length - jogadoresTimeBValidos.length
        });
      }

      // Reseta os gols e assistências dos times selecionados
      const timeAResetado = {
        ...novoTimeA,
        gols: 0,
        jogadores: jogadoresTimeAValidos.map(j => ({
          ...j,
          gols: 0,
          assistencias: 0
        }))
      };

      const timeBResetado = {
        ...novoTimeB,
        gols: 0,
        jogadores: jogadoresTimeBValidos.map(j => ({
          ...j,
          gols: 0,
          assistencias: 0
        }))
      };

      // Salva os times selecionados para a partida
      const timesPartida = [timeAResetado, timeBResetado];
      localStorage.setItem(`timesPartida_${params.id}`, JSON.stringify(timesPartida));

      // Reseta estados
      setMinutos(25);
      setSegundos(0);
      setTempoAcabou(false);
      setRodando(false);

      handleCloseModal();
      
      // Recarrega a página para iniciar nova partida
      window.location.reload();
    } catch (error) {
      console.error('Erro ao salvar times:', error);
      toast.error('Erro ao salvar os times');
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-red-600 mb-4">{error}</div>
        <Button
          variant="contained"
          onClick={() => router.push(`/pelada/${params.id}/confirmar`)}
        >
          Voltar
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Cronômetro e Controles */}
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex flex-col items-center mb-6">
          {/* Cronômetro */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center">
              <Tooltip title="Diminuir minutos">
                <span>
                  <IconButton 
                    size="small" 
                    onClick={() => handleAjustarTempo('minutos', false)}
                    disabled={rodando}
                  >
                    <ArrowDownwardIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <TextField
                value={minutos.toString().padStart(2, '0')}
                onChange={(e) => handleTempoChange('minutos', e.target.value)}
                disabled={rodando}
                inputProps={{
                  style: { 
                    textAlign: 'center',
                    fontSize: '2rem',
                    width: '3ch',
                    padding: '0.5rem'
                  }
                }}
                variant="standard"
              />
              <Tooltip title="Aumentar minutos">
                <span>
                  <IconButton 
                    size="small" 
                    onClick={() => handleAjustarTempo('minutos', true)}
                    disabled={rodando}
                  >
                    <ArrowUpwardIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </div>

            <span className="text-4xl">:</span>

            <div className="flex items-center">
              <Tooltip title="Diminuir segundos">
                <span>
                  <IconButton 
                    size="small" 
                    onClick={() => handleAjustarTempo('segundos', false)}
                    disabled={rodando}
                  >
                    <ArrowDownwardIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <TextField
                value={segundos.toString().padStart(2, '0')}
                onChange={(e) => handleTempoChange('segundos', e.target.value)}
                disabled={rodando}
                inputProps={{
                  style: { 
                    textAlign: 'center',
                    fontSize: '2rem',
                    width: '3ch',
                    padding: '0.5rem'
                  }
                }}
                variant="standard"
              />
              <Tooltip title="Aumentar segundos">
                <span>
                  <IconButton 
                    size="small" 
                    onClick={() => handleAjustarTempo('segundos', true)}
                    disabled={rodando}
                  >
                    <ArrowUpwardIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </div>
          </div>

          {/* Controles */}
          <div className="flex gap-2">
            <Tooltip title="Reiniciar">
              <span>
                <IconButton onClick={handleResetCronometro} color="primary">
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={rodando ? "Pausar" : "Iniciar"}>
              <span>
                <IconButton 
                  onClick={handleToggleCronometro} 
                  color="primary"
                  disabled={minutos === 0 && segundos === 0}
                >
                  {rodando ? <PauseIcon /> : <PlayArrowIcon />}
                </IconButton>
              </span>
            </Tooltip>
          </div>
        </div>

        {/* Placar */}
        <div className="flex justify-center items-center gap-4 mb-8">
          <div className="flex flex-col items-center">
            <div className={`text-3xl font-bold mb-2 ${tempoAcabou && ((timeA?.gols ?? 0) > (timeB?.gols ?? 0)) ? 'text-yellow-500' : ''}`} 
                 style={{ color: timeA?.cor }}>
              {timeA?.gols ?? 0}
            </div>
            <div className={`font-bold ${tempoAcabou && ((timeA?.gols ?? 0) > (timeB?.gols ?? 0)) ? 'text-yellow-500' : ''}`}>
              {timeA?.nome}
            </div>
          </div>

          <div className="flex flex-col items-center mx-4">
            <div className="text-xl font-bold text-gray-600 mb-2">VS</div>
            {tempoAcabou && ((timeA?.gols ?? 0) === (timeB?.gols ?? 0)) && (
              <div className="text-blue-600 font-medium text-sm">Empate</div>
            )}
          </div>

          <div className="flex flex-col items-center">
            <div className={`text-3xl font-bold mb-2 ${tempoAcabou && ((timeB?.gols ?? 0) > (timeA?.gols ?? 0)) ? 'text-yellow-500' : ''}`}
                 style={{ color: timeB?.cor }}>
              {timeB?.gols ?? 0}
            </div>
            <div className={`font-bold ${tempoAcabou && ((timeB?.gols ?? 0) > (timeA?.gols ?? 0)) ? 'text-yellow-500' : ''}`}>
              {timeB?.nome}
            </div>
          </div>
        </div>
      </div>

      {/* Times */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Time A */}
        <div className="bg-white rounded-xl shadow-lg p-6" style={{ borderTop: `4px solid ${timeA?.cor}` }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: timeA?.cor }}>
            {timeA?.nome}
          </h2>
          <div className="space-y-4">
            {timeA?.jogadores.map((jogador: Jogador, index: number) => {
              // Usar uid ou id, o que estiver disponível
              const jogadorKey = jogador.uid || jogador.id || `index-${index}`;
              return (
                <div key={`timeA-${jogadorKey}`} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg">
                <div className="font-medium">{jogador.nome}</div>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span>G: {jogador.gols}</span>
                    <div className="flex gap-1">
                        <IconButton size="small" onClick={() => handleGol(1, jogadorKey, true)}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                        <IconButton size="small" onClick={() => handleGol(1, jogadorKey, false)}>
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>A: {jogador.assistencias}</span>
                    <div className="flex gap-1">
                        <IconButton size="small" onClick={() => handleAssistencia(1, jogadorKey, true)}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                        <IconButton size="small" onClick={() => handleAssistencia(1, jogadorKey, false)}>
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Time B */}
        <div className="bg-white rounded-xl shadow-lg p-6" style={{ borderTop: `4px solid ${timeB?.cor}` }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: timeB?.cor }}>
            {timeB?.nome}
          </h2>
          <div className="space-y-4">
            {timeB?.jogadores.map((jogador: Jogador, index: number) => {
              // Usar uid ou id, o que estiver disponível
              const jogadorKey = jogador.uid || jogador.id || `index-${index}`;
              return (
                <div key={`timeB-${jogadorKey}`} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg">
                <div className="font-medium">{jogador.nome}</div>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span>G: {jogador.gols}</span>
                    <div className="flex gap-1">
                        <IconButton size="small" onClick={() => handleGol(2, jogadorKey, true)}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                        <IconButton size="small" onClick={() => handleGol(2, jogadorKey, false)}>
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>A: {jogador.assistencias}</span>
                    <div className="flex gap-1">
                        <IconButton size="small" onClick={() => handleAssistencia(2, jogadorKey, true)}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                        <IconButton size="small" onClick={() => handleAssistencia(2, jogadorKey, false)}>
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Botão flutuante de finalizar */}
      <Fab
        color="error"
        variant="extended"
        onClick={handleOpenModal}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
        }}
      >
        <FlagIcon sx={{ mr: 1 }} />
        Finalizar Partida
      </Fab>

      {/* Modal de Times Gerados */}
      <Dialog open={openModal} onClose={handleCloseModal} maxWidth="md" fullWidth>
        <DialogTitle>Times Gerados</DialogTitle>
        <DialogContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
            {timesSalvos.map(time => {
              const selecionado = timesSelecionados.find(t => t.id === time.id)?.selecionado;
              return (
                <div
                  key={time.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selecionado ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => handleSelecionarTime(time.id)}
                >
                  <div className="font-bold mb-2 flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: time.cor }}
                    ></div>
                    <span>{time.nome}</span>
                  </div>
                  <div className="space-y-1">
                    {time.jogadores.map((jogador, index) => (
                      <div key={`modal-time-${time.id}-jogador-${index}`} className="text-sm text-gray-600">
                        {jogador.nome}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>CANCELAR</Button>
          <Button 
            onClick={handleEncerrarDia} 
            color="error"
            variant="contained"
          >
            ENCERRAR O DIA
          </Button>
          <Button 
            onClick={handleSalvarTimes} 
            variant="contained"
            disabled={timesSelecionados.filter(t => t.selecionado).length !== 2}
          >
            INICIAR PARTIDA
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
} 
