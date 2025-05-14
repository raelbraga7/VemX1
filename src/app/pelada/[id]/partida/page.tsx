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
  const [partidaFinalizada, setPartidaFinalizada] = useState(false);
  const [resumoPartida, setResumoPartida] = useState<{
    timeA?: Time;
    timeB?: Time;
    vencedor: 'timeA' | 'timeB' | 'empate' | null;
    placar: string;
  }>({ vencedor: null, placar: '' });
  
  // Referência para a função de finalizar partida
  const finalizarPartidaRef = useRef<() => Promise<boolean>>(async () => false);

  // Função para carregar os times salvos
  const carregarTimesSalvos = useCallback(() => {
    try {
      // Busca os times gerados na página de confirmação
      const timesPartidaString = localStorage.getItem(`timesPartida_${params?.id}`);
      console.log('Buscando times da partida:', timesPartidaString);
      
      if (timesPartidaString) {
        const times = JSON.parse(timesPartidaString) as Time[];
        console.log('Times da partida encontrados:', times);
        
        // Reseta os gols e assistências dos times e garante IDs válidos
        const timesResetados = times.map(time => ({
          ...time,
          gols: 0,
          jogadores: time.jogadores
            .filter(j => j.nome) // Garante que só jogadores com nome sejam incluídos
            .map(j => ({
              id: j.id || `jogador-${j.nome.replace(/\s+/g, '-').toLowerCase()}`,
              uid: j.uid || '',
              nome: j.nome,
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
  }, [params?.id]);

  // Carregar times salvos quando o componente montar
  useEffect(() => {
    carregarTimesSalvos();
  }, [carregarTimesSalvos]);

  // Carregar times do localStorage
  useEffect(() => {
    try {
      // DEBUG: Verificação de todos os itens no localStorage com padrão de nomes relacionados
      console.log('DEBUG: Verificando todos os itens do localStorage relacionados a times:');
      Object.keys(localStorage).forEach(key => {
        if (key.includes('times') || key.includes('Time')) {
          console.log(`DEBUG: Item ${key}:`, localStorage.getItem(key));
        }
      });
      
      const peladaId = params?.id;
      console.log('DEBUG: ID da pelada para busca:', peladaId);
      
      // Tenta todas as fontes de dados em sequência:
      // 1. localStorage principal
      let timesString = localStorage.getItem(`timesPartida_${peladaId}`);
      let fonte = 'localStorage principal';
      
      // 2. Backup no localStorage
      if (!timesString) {
        console.log('DEBUG: Tentando backup no localStorage');
        timesString = localStorage.getItem(`timesPartidaBackup_${peladaId}`);
        fonte = 'localStorage backup';
      }
      
      // 3. Nome genérico no localStorage
      if (!timesString) {
        console.log('DEBUG: Tentando nome genérico no localStorage');
        timesString = localStorage.getItem(`timesUltimos`);
        fonte = 'localStorage genérico';
      }
      
      // 4. sessionStorage
      if (!timesString) {
        console.log('DEBUG: Tentando sessionStorage');
        timesString = sessionStorage.getItem(`timesPartida_${peladaId}`);
        fonte = 'sessionStorage';
      }
      
      // 5. Variável global
      if (!timesString) {
        console.log('DEBUG: Tentando variável global');
        try {
          // @ts-expect-error - Acessando propriedade dinâmica do objeto window
          const timesGlobal = window.timesPartidaGlobal;
          if (timesGlobal) {
            timesString = JSON.stringify(timesGlobal);
            fonte = 'variável global';
          }
        } catch (e) {
          console.warn('DEBUG: Erro ao acessar variável global', e);
        }
      }
      
      // 6. Firestore
      if (!timesString) {
        console.log('DEBUG: Tentando buscar do Firestore - carregamento assíncrono');
        if (peladaId && typeof peladaId === 'string') {
          getDoc(doc(db, 'peladas', peladaId)).then(docSnap => {
            if (docSnap.exists()) {
              const peladaData = docSnap.data();
              if (peladaData?.timesPartidaAtual) {
                console.log('DEBUG: Times encontrados no Firestore');
                const timesFirestore = peladaData.timesPartidaAtual;
                
                // Salvar nos backups locais para uso futuro
                localStorage.setItem(`timesPartida_${peladaId}`, JSON.stringify(timesFirestore));
                
                if (timesFirestore.length === 2) {
                  setTimeA(timesFirestore[0]);
                  setTimeB(timesFirestore[1]);
                  setLoading(false);
        return;
                } else {
                  console.error('DEBUG: Número incorreto de times no Firestore:', timesFirestore.length);
                  setError('Número incorreto de times no Firestore');
                }
              }
            }
          }).catch(error => {
            console.error('DEBUG: Erro ao buscar times do Firestore:', error);
          });
        }
      }
      
      // 7. Último recurso - timesGerados
      if (!timesString) {
        console.warn('DEBUG: Tentando buscar times alternativos em timesGerados_');
        const timesGeradosString = localStorage.getItem(`timesGerados_${peladaId}`) ||
          localStorage.getItem(`timesPartida_${peladaId}`) ||
          '';
        
        if (timesGeradosString) {
          console.log('DEBUG: Times encontrados em timesGerados_');
          const timesGerados = JSON.parse(timesGeradosString);
          // Adaptar o formato se necessário e salvar como timesPartida
          const timesAdaptados = timesGerados.map((time: Time) => ({
            ...time,
            gols: 0,
            jogadores: time.jogadores.map((j: Jogador) => ({
              ...j,
              gols: 0,
              assistencias: 0
            }))
          }));
          
          if (timesAdaptados.length >= 2) {
            // Selecionar os dois primeiros times
            const timesSelecionados = [timesAdaptados[0], timesAdaptados[1]];
            console.log('DEBUG: Salvando times alternativos encontrados:', timesSelecionados);
            
            // Salvar em todas as fontes de backup
            localStorage.setItem(`timesPartida_${peladaId}`, JSON.stringify(timesSelecionados));
            localStorage.setItem(`timesPartidaBackup_${peladaId}`, JSON.stringify(timesSelecionados));
            localStorage.setItem(`timesUltimos`, JSON.stringify(timesSelecionados));
            sessionStorage.setItem(`timesPartida_${peladaId}`, JSON.stringify(timesSelecionados));
            
            setTimeA(timesSelecionados[0]);
            setTimeB(timesSelecionados[1]);
            setLoading(false);
            return;
          }
        }
        
        setError('Nenhum time encontrado em nenhuma fonte de dados');
        return;
      }

      console.log(`DEBUG: Times encontrados na fonte: ${fonte}`);
      const times = JSON.parse(timesString) as Time[];
      if (times.length !== 2) {
        console.error('DEBUG: Número incorreto de times:', times.length);
        setError('Número incorreto de times');
        return;
      }

      console.log('DEBUG: Times carregados com sucesso:', times.map(t => ({
        id: t.id,
        nome: t.nome,
        jogadores: t.jogadores.map(j => j.nome)
      })));
      
      // Salvar em todas as fontes de backup para garantir consistência
      localStorage.setItem(`timesPartida_${peladaId}`, JSON.stringify(times));
      localStorage.setItem(`timesPartidaBackup_${peladaId}`, JSON.stringify(times));
      localStorage.setItem(`timesUltimos`, JSON.stringify(times));
      sessionStorage.setItem(`timesPartida_${peladaId}`, JSON.stringify(times));

      setTimeA(times[0]);
      setTimeB(times[1]);
      setLoading(false);
    } catch (err) {
      console.error('Erro ao carregar times:', err);
      setError('Erro ao carregar times');
      setLoading(false);
    }
  }, [params?.id]);

  // Adiciona listener para sincronização em tempo real do ranking
  useEffect(() => {
    if (!params?.id || typeof params?.id !== 'string') return;

    const peladaRef = doc(db, 'peladas', params?.id);
    
    const unsubscribe = onSnapshot(peladaRef, (doc) => {
      const data = doc.data() as PeladaData | undefined;
      if (data?.ranking) {
        console.log('Ranking atualizado:', data.ranking);
      }
    }, (error) => {
      console.error('Erro ao observar ranking:', error);
    });

    return () => unsubscribe();
  }, [params?.id]);

  // Função para determinar o vencedor
  const determinarVencedor = useCallback((): Vencedor | null => {
    if (!timeA || !timeB) return null;
    
    const timeAGols = timeA.gols || 0;
    const timeBGols = timeB.gols || 0;
    
    if (timeAGols > timeBGols) {
      // Atualiza o resumo da partida quando determina um vencedor
      setResumoPartida({
        timeA,
        timeB,
        vencedor: 'timeA',
        placar: `${timeAGols} x ${timeBGols}`
      });
      return timeA;
    }
    
    if (timeBGols > timeAGols) {
      // Atualiza o resumo da partida quando determina um vencedor
      setResumoPartida({
        timeA,
        timeB,
        vencedor: 'timeB',
        placar: `${timeAGols} x ${timeBGols}`
      });
      return timeB;
    }
    
    // Caso de empate
    setResumoPartida({
      timeA,
      timeB,
      vencedor: 'empate',
      placar: `${timeAGols} x ${timeBGols}`
    });
    return 'empate';
  }, [timeA, timeB]);

  // Definição da função handleFinalizarPartida
  const handleFinalizarPartida = useCallback(async () => {
    if (!timeA || !timeB || !params?.id || typeof params?.id !== 'string') return false;

    try {
      // Certificar-se de que todos os jogadores têm IDs válidos antes de continuar
      const jogadoresTimeAValidos = timeA.jogadores.filter(j => (j.id && j.id !== 'undefined') || (j.uid && j.uid !== 'undefined'));
      const jogadoresTimeBValidos = timeB.jogadores.filter(j => (j.id && j.id !== 'undefined') || (j.uid && j.uid !== 'undefined'));
      
      // Atualizar os times com apenas jogadores válidos
      const timeAValido = { ...timeA, jogadores: jogadoresTimeAValidos };
      const timeBValido = { ...timeB, jogadores: jogadoresTimeBValidos };
      
      const timeAGols = timeAValido.gols || 0;
      const timeBGols = timeBValido.gols || 0;
      
      const timeAVenceu = timeAGols > timeBGols;
      const timeBVenceu = timeBGols > timeAGols;
      const empate = timeAGols === timeBGols;

      // Busca o documento da pelada
      const peladaRef = doc(db, 'peladas', params?.id);
      const peladaDoc = await getDoc(peladaRef);
      const peladaData = peladaDoc.data();

      if (!peladaData) {
        throw new Error('Dados da pelada não encontrados');
      }

      // Prepara as atualizações do ranking para todos os jogadores
      const rankingFinal: Record<string, RankingUpdate> = { ...(peladaData.ranking || {}) };

      // Processa jogadores do Time A
      for (const jogador of timeAValido.jogadores) {
        // Obter o ID válido, priorizando uid se estiver disponível
        const jogadorId = jogador.uid || jogador.id;
        if (!jogadorId || jogadorId === 'undefined') continue;

        const resultado = timeAVenceu ? 'vitoria' : (empate ? 'empate' : 'derrota');
        
        // Obter contagem exata de gols e assistências
        const golsNum = Number(jogador.gols) || 0;
        const assistenciasNum = Number(jogador.assistencias) || 0;

        // Obter ranking atual ou criar base se não existir
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

        // Log para diagnóstico
        console.log(`[DEBUG] Jogador: ${jogador.nome}, ID: ${jogadorId}`);
        console.log(`[DEBUG] Gols na partida atual: ${golsNum}`);
        console.log(`[DEBUG] Gols no ranking antes: ${rankingAtual.gols}`);
        console.log(`[DEBUG] Gols no ranking depois: ${rankingAtual.gols + golsNum}`);

        // Calcula os pontos com a tabela de pontuação
        const pontosPorVitoria = resultado === 'vitoria' ? 7 : 0;
        const pontosPorDerrota = resultado === 'derrota' ? -6 : 0;
        const pontosPorEmpate = resultado === 'empate' ? 1 : 0;
        const pontosPorGols = golsNum * 2; // +2 pontos na tabela por cada gol
        const pontosPorAssistencias = assistenciasNum * 1; // +1 ponto na tabela por cada assistência
        const pontosPorParticipacao = 0.5; // +0.5 ponto na tabela por participação
        
        const pontosTotais = Math.max(0, (rankingAtual.pontos || 0) + 
                            pontosPorVitoria + 
                            pontosPorDerrota + 
                            pontosPorEmpate + 
                            pontosPorGols + 
                            pontosPorAssistencias +
                            pontosPorParticipacao);

        // Salvar no ranking final - Usar o golsNum EXATAMENTE como está no estado do jogador
        rankingFinal[jogadorId] = {
          jogos: (rankingAtual.jogos || 0) + 1,
          gols: (rankingAtual.gols || 0) + golsNum, // Adiciona exatamente os gols desta partida
          assistencias: (rankingAtual.assistencias || 0) + assistenciasNum,
          vitorias: (rankingAtual.vitorias || 0) + (resultado === 'vitoria' ? 1 : 0),
          derrotas: (rankingAtual.derrotas || 0) + (resultado === 'derrota' ? 1 : 0),
          empates: (rankingAtual.empates || 0) + (resultado === 'empate' ? 1 : 0),
          pontos: pontosTotais,
          nome: jogador.nome
        };
      }

      // Processa jogadores do Time B
      for (const jogador of timeBValido.jogadores) {
        // Obter o ID válido, priorizando uid se estiver disponível
        const jogadorId = jogador.uid || jogador.id;
        if (!jogadorId || jogadorId === 'undefined') continue;

        const resultado = timeBVenceu ? 'vitoria' : (empate ? 'empate' : 'derrota');
        
        // Obter contagem exata de gols e assistências
        const golsNum = Number(jogador.gols) || 0;
        const assistenciasNum = Number(jogador.assistencias) || 0;

        // Obter ranking atual ou criar base se não existir
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

        // Log para diagnóstico
        console.log(`[DEBUG] Jogador: ${jogador.nome}, ID: ${jogadorId}`);
        console.log(`[DEBUG] Gols na partida atual: ${golsNum}`);
        console.log(`[DEBUG] Gols no ranking antes: ${rankingAtual.gols}`);
        console.log(`[DEBUG] Gols no ranking depois: ${rankingAtual.gols + golsNum}`);

        // Calcula os pontos com a tabela de pontuação
        const pontosPorVitoria = resultado === 'vitoria' ? 7 : 0;
        const pontosPorDerrota = resultado === 'derrota' ? -6 : 0;
        const pontosPorEmpate = resultado === 'empate' ? 1 : 0;
        const pontosPorGols = golsNum * 2; // +2 pontos na tabela por cada gol
        const pontosPorAssistencias = assistenciasNum * 1; // +1 ponto na tabela por cada assistência
        const pontosPorParticipacao = 0.5; // +0.5 ponto na tabela por participação
        
        const pontosTotais = Math.max(0, (rankingAtual.pontos || 0) + 
                            pontosPorVitoria + 
                            pontosPorDerrota + 
                            pontosPorEmpate + 
                            pontosPorGols + 
                            pontosPorAssistencias +
                            pontosPorParticipacao);

        // Salvar no ranking final - Usar o golsNum EXATAMENTE como está no estado do jogador
        rankingFinal[jogadorId] = {
          jogos: (rankingAtual.jogos || 0) + 1,
          gols: (rankingAtual.gols || 0) + golsNum, // Adiciona exatamente os gols desta partida
          assistencias: (rankingAtual.assistencias || 0) + assistenciasNum,
          vitorias: (rankingAtual.vitorias || 0) + (resultado === 'vitoria' ? 1 : 0),
          derrotas: (rankingAtual.derrotas || 0) + (resultado === 'derrota' ? 1 : 0),
          empates: (rankingAtual.empates || 0) + (resultado === 'empate' ? 1 : 0),
          pontos: pontosTotais,
          nome: jogador.nome
        };
      }
      
      // Log final para diagnosticar o ranking completo
      console.log('[DEBUG] Ranking final completo:', JSON.stringify(rankingFinal, null, 2));

      // Verifica se há alguma atualização para ser feita
      if (Object.keys(rankingFinal).length === 0) {
        console.error('Nenhuma atualização de ranking para enviar!');
        toast.error('Não foi possível atualizar o ranking: nenhum jogador válido');
        return false;
      }

      // Salva o resultado da partida e atualiza o ranking
      await updateDoc(peladaRef, {
        ranking: rankingFinal,
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
      });

      // Atualiza o estado com informações da partida finalizada
      setPartidaFinalizada(true);
      
      console.log('Ranking atualizado com sucesso!');
      toast.success('Ranking atualizado com sucesso!');
      return true;
    } catch (error) {
      console.error('Erro ao finalizar partida:', error);
      toast.error('Erro ao finalizar a partida');
      return false;
    }
  }, [timeA, timeB, params?.id]);
  
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

  // Função para abrir o modal
  const handleOpenModal = useCallback(async () => {
    try {
      setLoading(true);
      
      // Tenta finalizar a partida e atualizar o ranking, mas não bloqueia se falhar
      try {
        const rankingAtualizado = await handleFinalizarPartida();
        console.log('Ranking atualizado com sucesso:', rankingAtualizado);
      } catch (rankingError) {
        console.error('Erro ao tentar atualizar o ranking:', rankingError);
        // Continua mesmo com erro no ranking
      }

      // Preparar para a próxima partida
      // Busca os times gerados da página anterior com fallbacks
      const timesGeradosString = localStorage.getItem(`timesGerados_${params?.id}`) || 
                               localStorage.getItem(`timesPartida_${params?.id}`) ||
                               localStorage.getItem(`timesUltimos`);
      
      if (timesGeradosString) {
        try {
          // Usa os times disponíveis
          const times = JSON.parse(timesGeradosString) as Time[];
          console.log('Times carregados para seleção:', times);
          
          // Reseta os gols e assistências dos times
          const timesResetados = times.map(time => ({
            ...time,
            gols: 0,
            jogadores: time.jogadores
              .filter(j => j.nome) // Garante que só jogadores com nome sejam incluídos
              .map(j => ({
                id: j.id || `jogador-${j.nome.replace(/\s+/g, '-').toLowerCase()}`,
                uid: j.uid || '',
                nome: j.nome,
                gols: 0,
                assistencias: 0
              }))
          }));

          setTimesSalvos(timesResetados);
          setTimesSelecionados(timesResetados.map(time => ({
            id: time.id,
            selecionado: false
          })));
          
          // Abre o modal com o resumo da partida
          setOpenModal(true);
          setPartidaFinalizada(true);
          console.log('Modal aberto com times carregados');
        } catch (parseError) {
          console.error('Erro ao processar times:', parseError);
          toast.error('Formato de times inválido');
          
          // Mesmo com erro, tenta abrir o modal
          setOpenModal(true);
          setPartidaFinalizada(true);
        }
      } else {
        console.warn('Nenhum time encontrado para seleção');
        toast.error('Não foi possível carregar os times. Tente novamente.');
        setOpenModal(true);
        setPartidaFinalizada(true);
      }
    } catch (error) {
      console.error('Erro ao abrir modal:', error);
      toast.error('Erro ao abrir o modal de finalização');
      // Última tentativa de abrir o modal mesmo com erro
      setOpenModal(true);
      setPartidaFinalizada(true);
    } finally {
      setLoading(false);
    }
  }, [handleFinalizarPartida, params?.id]);

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
            console.log('Resultado da finalização automática da partida:', success);
            toast.success('Ranking atualizado automaticamente!');
            setPartidaFinalizada(true);
            
            // Abre o modal automaticamente após finalizar a partida
            setTimeout(() => {
              handleOpenModal();
              console.log('Modal aberto automaticamente após finalizar partida');
            }, 1500); // Pequeno delay para dar tempo das toast notifications
          }).catch(error => {
            console.error('Erro ao atualizar ranking automaticamente:', error);
            toast.error('Erro ao atualizar ranking automaticamente. Abrindo modal mesmo assim.');
            
            // Mesmo com erro, tenta abrir o modal
            setTimeout(() => {
              setPartidaFinalizada(true);
              handleOpenModal();
              console.log('Modal aberto mesmo após erro na finalização');
            }, 1500);
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
  }, [rodando, minutos, segundos, determinarVencedor, handleOpenModal]);

  const handleCloseModal = () => {
    setOpenModal(false);
    setPartidaFinalizada(false);
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
      if (!params?.id || typeof params.id !== 'string') {
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

      // Filtra jogadores com IDs inválidos (considerando tanto id quanto uid)
      const jogadoresTimeAValidos = novoTimeA.jogadores.filter(j => (j.id && j.id !== 'undefined') || (j.uid && j.uid !== 'undefined'));
      const jogadoresTimeBValidos = novoTimeB.jogadores.filter(j => (j.id && j.id !== 'undefined') || (j.uid && j.uid !== 'undefined'));

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
          id: j.id || '',
          uid: j.uid || '',
          nome: j.nome,
          gols: 0,
          assistencias: 0
        }))
      };

      const timeBResetado = {
        ...novoTimeB,
        gols: 0,
        jogadores: jogadoresTimeBValidos.map(j => ({
          id: j.id || '',
          uid: j.uid || '',
          nome: j.nome,
          gols: 0,
          assistencias: 0
        }))
      };

      // Salva os times selecionados para a partida
      const timesPartida = [timeAResetado, timeBResetado];
      
      // DEBUG: Log completo dos times antes de salvar
      console.log('DEBUG: Times a serem salvos no localStorage:', JSON.stringify(timesPartida, null, 2));
      
      // SOLUÇÃO 1: Garantir que o ID da pelada esteja correto
      const peladaId = params?.id;
      console.log('DEBUG: ID da pelada utilizado:', peladaId);
      
      try {
        // Código de salvamento com verificação de sucesso
        localStorage.setItem(`timesPartida_${peladaId}`, JSON.stringify(timesPartida));
        // Verificar se foi salvo corretamente
        const verificacao = localStorage.getItem(`timesPartida_${peladaId}`);
        if (!verificacao) {
          throw new Error('Falha ao verificar times salvos');
        }
        console.log('Times salvos com sucesso no localStorage principal');
        
        // Backups adicionais
        localStorage.setItem(`timesPartidaBackup_${peladaId}`, JSON.stringify(timesPartida));
        localStorage.setItem(`timesUltimos`, JSON.stringify(timesPartida));
        sessionStorage.setItem(`timesPartida_${peladaId}`, JSON.stringify(timesPartida));
        
        // SOLUÇÃO 4: Salvar em uma variável global
        try {
          // @ts-expect-error - Adicionar ao objeto window para emergência
          window.timesPartidaGlobal = timesPartida;
        } catch (e) {
          console.warn('DEBUG: Não foi possível salvar na variável global', e);
        }
        
        // SOLUÇÃO 5: Atualizar no Firestore (opcional)
        try {
          if (peladaId && typeof peladaId === 'string') {
            const peladaRef = doc(db, 'peladas', peladaId);
            updateDoc(peladaRef, {
              timesPartidaAtual: timesPartida
            }).then(() => {
              console.log('DEBUG: Times salvos no Firestore com sucesso');
            }).catch(e => {
              console.error('DEBUG: Erro ao salvar times no Firestore', e);
            });
          }
        } catch (e) {
          console.error('DEBUG: Erro ao atualizar times no Firestore', e);
        }
      } catch (storageError) {
        console.error('Erro ao salvar no localStorage:', storageError);
        toast.error('Erro ao salvar os times. Verificando alternativas...');
        
        // Tenta usar apenas o sessionStorage como último recurso
        try {
          sessionStorage.setItem(`timesPartida_${peladaId}`, JSON.stringify(timesPartida));
          console.log('Times salvos no sessionStorage como alternativa');
        } catch (e) {
          console.error('Erro crítico: Não foi possível salvar os times em nenhum local', e);
          toast.error('Erro crítico: Não foi possível salvar os times');
        }
      }

      // Atualiza os times e fecha o modal
      setTimeA(timeAResetado);
      setTimeB(timeBResetado);
      setOpenModal(false);
      
      // Reseta o estado de partida finalizada
      setPartidaFinalizada(false);
      
      // Reseta o cronômetro
      handleResetCronometro();
      
      toast.success('Próxima partida iniciada!');
    } catch (error) {
      console.error('Erro ao salvar times:', error);
      toast.error('Erro ao iniciar nova partida');
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-red-600 mb-4">{error}</div>
        <Button
          variant="contained"
          onClick={() => router.push(`/pelada/${params?.id}/confirmar`)}
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

      {/* Modal de Finalizar Partida */}
      <Dialog open={openModal} onClose={handleCloseModal} maxWidth="md" fullWidth>
        <DialogTitle>
          {partidaFinalizada ? 'Partida Finalizada' : 'Próxima Partida'}
        </DialogTitle>
        <DialogContent>
          {partidaFinalizada && resumoPartida.timeA && resumoPartida.timeB && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-bold text-center mb-3">Resumo da Partida</h3>
              
              <div className="flex justify-center items-center gap-4 mb-4">
                <div className="flex flex-col items-center">
                  <div className="text-2xl font-bold" style={{ color: resumoPartida.timeA.cor }}>
                    {resumoPartida.timeA.nome}
                  </div>
                  <div className="text-3xl font-bold">
                    {resumoPartida.timeA.gols}
                  </div>
                </div>
                
                <div className="text-xl font-bold text-gray-500 mx-4">X</div>
                
                <div className="flex flex-col items-center">
                  <div className="text-2xl font-bold" style={{ color: resumoPartida.timeB.cor }}>
                    {resumoPartida.timeB.nome}
                  </div>
                  <div className="text-3xl font-bold">
                    {resumoPartida.timeB.gols}
                  </div>
                </div>
              </div>
              
              <div className="text-center mb-4 font-medium">
                {resumoPartida.vencedor === 'timeA' ? (
                  <span className="text-green-600">{resumoPartida.timeA.nome} venceu!</span>
                ) : resumoPartida.vencedor === 'timeB' ? (
                  <span className="text-green-600">{resumoPartida.timeB.nome} venceu!</span>
                ) : (
                  <span className="text-blue-600">Partida empatada!</span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-bold mb-2" style={{ color: resumoPartida.timeA.cor }}>
                    {resumoPartida.timeA.nome} - Destaques
                  </h4>
                  <div className="space-y-1">
                    {resumoPartida.timeA.jogadores
                      .filter(j => j.gols > 0 || j.assistencias > 0)
                      .sort((a, b) => (b.gols * 2 + b.assistencias) - (a.gols * 2 + a.assistencias))
                      .slice(0, 3)
                      .map((jogador, idx) => (
                        <div key={`destaqueA-${idx}`} className="text-sm">
                          {jogador.nome}: {jogador.gols} gols, {jogador.assistencias} assistências
                        </div>
                      ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-bold mb-2" style={{ color: resumoPartida.timeB.cor }}>
                    {resumoPartida.timeB.nome} - Destaques
                  </h4>
                  <div className="space-y-1">
                    {resumoPartida.timeB.jogadores
                      .filter(j => j.gols > 0 || j.assistencias > 0)
                      .sort((a, b) => (b.gols * 2 + b.assistencias) - (a.gols * 2 + a.assistencias))
                      .slice(0, 3)
                      .map((jogador, idx) => (
                        <div key={`destaqueB-${idx}`} className="text-sm">
                          {jogador.nome}: {jogador.gols} gols, {jogador.assistencias} assistências
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <h3 className="font-bold mb-4">Selecione os times para a próxima partida:</h3>
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
