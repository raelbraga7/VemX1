'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { doc, updateDoc, onSnapshot, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getUserById, type UserData } from '@/firebase/userService';
import { sendConfirmationRequestToAllPlayers } from '@/firebase/notificationService';
import { toast } from 'react-toastify';
import { Fab, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Chip } from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';

interface Jogador {
  id: string;
  nome: string;
  dataConfirmacao: string;
  convidadoPor?: string | null;
}

interface PeladaData {
  nome: string;
  descricao: string;
  ownerId: string;
  players: string[];
  ranking: Record<string, {
    jogos: number;
    vitorias: number;
    derrotas: number;
    empates: number;
    gols: number;
    assistencias: number;
    pontos: number;
  }>;
  createdAt: Date;
  quantidadeTimes: number;
  jogadoresPorTime: number;
  coresTimes: string[];
  confirmados: Jogador[];
}

interface JogadorInfo {
  id: string;
  nome: string;
  dataConfirmacao: string;
  confirmado: boolean;
  convidadoPor?: string | null;
  isOwner?: boolean;
}

interface Time {
  id: number;
  nome: string;
  cor: string;
  jogadores: Jogador[];
  selecionado: boolean;
}

// Cache em memória compartilhado entre componentes
const userCacheMap = new Map<string, UserData>();

// Função para gerenciar cache local
const useLocalCache = (key: string, data: PeladaData | null) => {
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Erro ao salvar no cache local:', error);
    }
  }, [key, data]);

  const getCachedData = useCallback(() => {
    try {
      const cached = localStorage.getItem(key);
      return cached ? JSON.parse(cached) as PeladaData : null;
    } catch (error) {
      console.error('Erro ao ler cache local:', error);
      return null;
    }
  }, [key]);

  return { getCachedData };
};

export default function ConfirmarPresenca() {
  const { user } = useUser();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const status = searchParams.get('status');
  const convidadoPor = searchParams.get('convidadoPor');
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [error, setError] = useState('');
  const [peladaData, setPeladaData] = useState<PeladaData | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [jogadoresConfirmados, setJogadoresConfirmados] = useState<JogadorInfo[]>([]);
  const [modalAberta, setModalAberta] = useState(false);
  const [times, setTimes] = useState<Time[]>([]);
  const [timesParaJogar, setTimesParaJogar] = useState<number[]>([]);
  
  // Chave única para cache local
  const cacheKey = useMemo(() => `pelada_${params?.id}_data`, [params?.id]);
  const { getCachedData } = useLocalCache(cacheKey, peladaData);

  // Função otimizada para carregar informações dos jogadores
  const carregarInfoJogadores = useCallback(async (pelada: PeladaData) => {
    try {
      const todosJogadoresIds = new Set([
        ...pelada.players,
        ...(pelada.confirmados?.map(j => j.id) || [])
      ]);

      const idsParaBuscar = Array.from(todosJogadoresIds).filter(
        id => !userCacheMap.has(id) && id !== null && id !== undefined
      );

      // Limita o número de chamadas simultâneas para evitar sobrecarga
      const batchSize = 10;
      for (let i = 0; i < idsParaBuscar.length; i += batchSize) {
        const batch = idsParaBuscar.slice(i, i + batchSize);
        const novosUsuarios = await Promise.all(
          batch.map(async (jogadorId) => {
            try {
              const userInfo = await getUserById(jogadorId);
              return [jogadorId, userInfo] as const;
            } catch (error) {
              console.error('Erro ao buscar informações do jogador:', error);
              return [jogadorId, null] as const;
            }
          })
        );

        novosUsuarios.forEach(([id, info]) => {
          if (info && typeof id === 'string') {
            userCacheMap.set(id, info);
          }
        });
      }

      // Ordena os jogadores: dono primeiro, depois confirmados, depois não confirmados
      const jogadoresInfo = Array.from(todosJogadoresIds)
        .map(jogadorId => {
          const userInfo = userCacheMap.get(jogadorId);
          const confirmacao = pelada.confirmados?.find(c => c.id === jogadorId);
          const isOwner = jogadorId === pelada.ownerId;
          
          return {
            id: jogadorId,
            nome: userInfo?.nome || 'Usuário',
            dataConfirmacao: confirmacao?.dataConfirmacao || '',
            confirmado: !!confirmacao,
            convidadoPor: confirmacao?.convidadoPor,
            isOwner
          };
        })
        .sort((a, b) => {
          if (a.isOwner) return -1;
          if (b.isOwner) return 1;
          if (a.confirmado && !b.confirmado) return -1;
          if (!a.confirmado && b.confirmado) return 1;
          return 0;
        });

      setJogadoresConfirmados(jogadoresInfo);
    } catch (error) {
      console.error('Erro ao carregar informações dos jogadores:', error);
    }
  }, []);

  // Efeito para carregar dados iniciais e configurar listener
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const configurarListener = async () => {
      try {
        if (!params?.id || typeof params.id !== 'string') {
          throw new Error('ID da pelada inválido');
        }
        
        const peladaId = params.id;
        const peladaRef = doc(db, 'peladas', peladaId);
        
        // Tenta carregar do cache local primeiro
        const cachedData = getCachedData();
        if (cachedData) {
          setPeladaData(cachedData);
          setLoading(false);
          await carregarInfoJogadores(cachedData);
        }

        // Configura listener sem throttle
        unsubscribe = onSnapshot(peladaRef, (doc) => {
          if (!doc.exists()) {
            throw new Error('Pelada não encontrada');
          }

          const pelada = doc.data() as PeladaData;
          setPeladaData(pelada);
          
          // Atualiza o estado de confirmação
          if (user?.uid) {
            const isConfirmado = pelada.confirmados?.some(j => j.id === user.uid) || false;
            setConfirmado(isConfirmado);
          }

          carregarInfoJogadores(pelada);
        }, (error) => {
          console.error('Erro no listener:', error);
          setError('Erro ao monitorar atualizações da pelada');
        });

        if (!cachedData) {
          setLoading(false);
        }
      } catch (err) {
        console.error('Erro ao configurar listener:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar pelada');
        setLoading(false);
      }
    };

    if (user) {
      configurarListener();
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [params?.id, user, carregarInfoJogadores, getCachedData]);

  // Função otimizada para confirmar presença
  const handleConfirmar = useCallback(async () => {
    if (!user || !params?.id || typeof params.id !== 'string' || !peladaData) {
      toast.error('Dados inválidos. Tente novamente.');
      return;
    }

    try {
      setProcessando(true);
      const peladaRef = doc(db, 'peladas', params.id);
      
      // Busca os dados mais recentes da pelada
      const peladaDoc = await getDoc(peladaRef);
      if (!peladaDoc.exists()) {
        toast.error('Pelada não encontrada');
        return;
      }

      const peladaAtual = peladaDoc.data() as PeladaData;
      const userInfo = await getUserById(user.uid);
      const nomeJogador = userInfo?.nome || user.email?.split('@')[0] || 'Usuário';

      if (!confirmado) {
        // Verifica se ainda há vagas disponíveis
        const totalVagas = peladaAtual.quantidadeTimes * peladaAtual.jogadoresPorTime;
        if (peladaAtual.confirmados?.length >= totalVagas) {
          toast.error('Desculpe, todas as vagas já foram preenchidas!');
          return;
        }

        const novoConfirmado = {
          id: user.uid,
          nome: nomeJogador,
          dataConfirmacao: new Date().toISOString(),
          convidadoPor: convidadoPor || null
        };

        // Adiciona o usuário aos confirmados e ao ranking em uma única operação
        await updateDoc(peladaRef, {
          confirmados: arrayUnion(novoConfirmado),
          [`ranking.${user.uid}`]: peladaAtual.ranking?.[user.uid] || {
            jogos: 0,
            vitorias: 0,
            derrotas: 0,
            empates: 0,
            gols: 0,
            assistencias: 0,
            pontos: 0
          }
        });

        toast.success('Presença confirmada com sucesso!');
      } else {
        // Remove o usuário dos confirmados
        const confirmacaoAtual = peladaAtual.confirmados?.find(j => j.id === user.uid);
        if (confirmacaoAtual) {
          await updateDoc(peladaRef, {
            confirmados: arrayRemove(confirmacaoAtual)
          });
          toast.success('Presença removida com sucesso!');
        }
      }
    } catch (error) {
      console.error('Erro ao confirmar presença:', error);
      toast.error('Erro ao processar sua solicitação. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }, [user, params?.id, peladaData, confirmado, convidadoPor]);

  // Função otimizada para enviar notificações
  const enviarNotificacao = useCallback(async () => {
    try {
      if (!user) {
        throw new Error('Usuário não está logado');
      }

      const peladaId = params?.id;
      if (!peladaId || typeof peladaId !== 'string') {
        throw new Error('ID da pelada é inválido');
      }

      if (!peladaData) {
        throw new Error('Dados da pelada não encontrados');
      }

      // Obtém todos os jogadores únicos (players + ranking)
      const todosJogadores = new Set([
        ...peladaData.players,
        ...Object.keys(peladaData.ranking || {})
      ]);

      // Remove o usuário atual da lista
      todosJogadores.delete(user.uid);

      // Filtra jogadores que já confirmaram
      const jogadoresParaNotificar = Array.from(todosJogadores).filter(
        jogadorId => !peladaData.confirmados?.some(c => c.id === jogadorId)
      );

      if (jogadoresParaNotificar.length === 0) {
        toast.warning('Não há outros jogadores nesta pelada para notificar.');
        return;
      }

      console.log('Enviando notificações para:', {
        totalJogadores: jogadoresParaNotificar.length,
        jogadoresParaNotificar,
        peladaId,
        nomePelada: peladaData.nome
      });

      // Envia notificações em lotes para evitar sobrecarga
      const batchSize = 10;
      for (let i = 0; i < jogadoresParaNotificar.length; i += batchSize) {
        const batch = jogadoresParaNotificar.slice(i, i + batchSize);
        await sendConfirmationRequestToAllPlayers(
          peladaId,
          peladaData.nome,
          batch
        );
      }

      toast.success('Notificações enviadas com sucesso!');
    } catch (error) {
      console.error('Erro ao enviar notificações:', error);
      toast.error('Erro ao enviar notificações');
    }
  }, [user, params?.id, peladaData]);

  useEffect(() => {
    const processarConfirmacao = async () => {
      if (!user || !status || !params?.id) return;

      try {
        const peladaRef = doc(db, 'peladas', params.id as string);
        const peladaDoc = await getDoc(peladaRef);

        if (!peladaDoc.exists()) {
          toast.error('Pelada não encontrada');
          router.push('/dashboard');
          return;
        }

        const pelada = peladaDoc.data() as PeladaData;
        const userInfo = await getUserById(user.uid);
        const nomeJogador = userInfo?.nome || user.email?.split('@')[0] || 'Usuário';

        if (status === 'confirm') {
          // Adiciona o usuário aos confirmados com informação de quem convidou
          await updateDoc(peladaRef, {
            confirmados: arrayUnion({
              id: user.uid,
              nome: nomeJogador,
              dataConfirmacao: new Date().toISOString(),
              convidadoPor: convidadoPor || null
            }),
            [`ranking.${user.uid}`]: {
              jogos: 0,
              vitorias: 0,
              derrotas: 0,
              empates: 0,
              gols: 0,
              assistencias: 0,
              pontos: 0
            }
          });

          toast.success('Presença confirmada com sucesso!');
        } else if (status === 'reject') {
          // Remove o usuário dos confirmados se existir
          const confirmacaoExistente = pelada.confirmados?.find(j => j.id === user.uid);
          if (confirmacaoExistente) {
            await updateDoc(peladaRef, {
              confirmados: arrayRemove(confirmacaoExistente)
            });
          }

          toast.info('Presença recusada');
        }

        // Redireciona para o dashboard após processar
        router.push('/dashboard');
      } catch (error) {
        console.error('Erro ao processar confirmação:', error);
        toast.error('Erro ao processar sua resposta');
      }
    };

    processarConfirmacao();
  }, [user, status, router, params?.id, convidadoPor]);

  // Função para embaralhar array
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Função para gerar times aleatórios
  const gerarTimes = useCallback(() => {
    if (!peladaData?.confirmados) return;

    const jogadoresConfirmados = [...peladaData.confirmados];
    const jogadoresEmbaralhados = shuffleArray(jogadoresConfirmados);
    const novosTimes: Time[] = [];

    for (let i = 0; i < peladaData.quantidadeTimes; i++) {
      const timeJogadores = jogadoresEmbaralhados.slice(
        i * peladaData.jogadoresPorTime,
        (i + 1) * peladaData.jogadoresPorTime
      );

      novosTimes.push({
        id: i + 1,
        nome: `Time ${i + 1}`,
        cor: peladaData.coresTimes[i] || '#1d4ed8',
        jogadores: timeJogadores,
        selecionado: false
      });
    }

    // Salva os times gerados no localStorage
    localStorage.setItem('timesGerados', JSON.stringify(novosTimes));
    console.log('Times gerados salvos:', novosTimes);

    setTimes(novosTimes);
    setTimesParaJogar([]);
  }, [peladaData]);

  const handleGerarTimes = useCallback(() => {
    if (!peladaData?.confirmados || peladaData.confirmados.length === 0) {
      toast.error('Não há jogadores confirmados suficientes para gerar times!');
      return;
    }

    if (peladaData.confirmados.length < peladaData.jogadoresPorTime) {
      toast.error(`São necessários pelo menos ${peladaData.jogadoresPorTime} jogadores confirmados!`);
      return;
    }

    gerarTimes();
    setModalAberta(true);
  }, [peladaData, gerarTimes]);

  const handleSelecionarTime = useCallback((timeId: number) => {
    setTimes(times => times.map(time => ({
      ...time,
      selecionado: time.id === timeId ? !time.selecionado : time.selecionado
    })));

    setTimesParaJogar(atual => {
      if (atual.includes(timeId)) {
        return atual.filter(id => id !== timeId);
      }
      if (atual.length < 2) {
        return [...atual, timeId];
      }
      return [atual[1], timeId];
    });
  }, []);

  const handleFecharModal = () => {
    setModalAberta(false);
    setTimesParaJogar([]);
    setTimes([]);
  };

  const handleEmbaralharTimes = () => {
    gerarTimes();
  };

  const handleIniciarPartida = () => {
    if (timesParaJogar.length !== 2) {
      toast.error('Selecione exatamente 2 times para jogar!');
      return;
    }

    const timesSelecionados = times.filter(time => timesParaJogar.includes(time.id));
    
    // Prepara os times para a partida
    const timesPartida = timesSelecionados.map(time => ({
      ...time,
      jogadores: time.jogadores.map(j => ({
        ...j,
        gols: 0,
        assistencias: 0
      })),
      gols: 0
    }));

    // Salva os times no localStorage para recuperar na página da partida
    localStorage.setItem('timesPartida', JSON.stringify(timesPartida));
    
    // Redireciona para a página da partida
    router.push(`/pelada/${params.id}/partida`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Erro: {error}</div>
      </div>
    );
  }

  if (!peladaData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Pelada não encontrada</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <div className="max-w-lg mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-4">Confirmar Presença</h1>
        <h2 className="text-xl mb-6">{peladaData?.nome}</h2>

        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Informações</h3>
          <ul className="space-y-2">
            <li>• {peladaData?.quantidadeTimes} times</li>
            <li>• {peladaData?.jogadoresPorTime} jogadores por time</li>
            <li>• {peladaData?.quantidadeTimes * peladaData?.jogadoresPorTime} jogadores no total</li>
            <li>• {peladaData?.confirmados?.length || 0} confirmados até agora</li>
          </ul>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Jogadores</h3>
          <ul className="divide-y divide-gray-200">
            {jogadoresConfirmados.map((jogador) => (
              <li key={`${jogador.id}-${jogador.dataConfirmacao}`} className="py-2">
                <div className="flex flex-col">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span className="text-sm text-gray-900">
                        {jogador.nome}
                        {jogador.isOwner && (
                          <span className="ml-2 text-xs text-blue-600">(Dono)</span>
                        )}
                      </span>
                      {jogador.confirmado && (
                        <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          Confirmado
                        </span>
                      )}
                    </div>
                    {jogador.dataConfirmacao && (
                      <span className="text-xs text-gray-500">
                        {new Date(jogador.dataConfirmacao).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {jogador.convidadoPor && (
                    <div className="text-xs text-gray-500 mt-1">
                      Convidado por: {userCacheMap.get(jogador.convidadoPor)?.nome || 'Usuário'}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          {user?.uid && (
            <button
              onClick={handleConfirmar}
              disabled={processando}
              className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-colors ${
                processando ? 'bg-gray-400 cursor-not-allowed' :
                confirmado
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-[#1d4ed8] hover:bg-[#1d4ed8]/90'
              }`}
            >
              {processando ? 'Processando...' : confirmado ? 'Cancelar Presença' : 'Confirmar Presença'}
            </button>
          )}

          {user?.uid === peladaData.ownerId && peladaData?.players?.length > 0 && (
            <button
              onClick={enviarNotificacao}
              className="w-full py-3 px-4 rounded-lg text-white font-medium bg-green-600 hover:bg-green-700 transition-colors"
            >
              Enviar Solicitações de Confirmação
            </button>
          )}
        </div>
      </div>

      {/* Modal de Times */}
      <Dialog 
        open={modalAberta} 
        onClose={handleFecharModal}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <div className="flex justify-between items-center">
            <Typography variant="h6">Times Gerados</Typography>
            <Tooltip title="Embaralhar Times">
              <Button 
                onClick={handleEmbaralharTimes}
                startIcon={<ShuffleIcon />}
                color="primary"
              >
                Embaralhar
              </Button>
            </Tooltip>
          </div>
        </DialogTitle>
        <DialogContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {times.map((time) => (
              <div
                key={time.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  time.selecionado 
                    ? 'border-blue-600 bg-blue-50' 
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => handleSelecionarTime(time.id)}
                style={{ borderColor: time.selecionado ? time.cor : undefined }}
              >
                <div className="flex justify-between items-center mb-3">
                  <Typography variant="subtitle1" className="font-bold">
                    {time.nome}
                  </Typography>
                  <Chip
                    size="small"
                    label={time.selecionado ? 'Selecionado' : 'Selecionar'}
                    color={time.selecionado ? 'primary' : 'default'}
                  />
                </div>
                <ul className="space-y-2">
                  {time.jogadores.map((jogador) => (
                    <li key={jogador.id} className="text-sm">
                      {jogador.nome}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFecharModal} color="inherit">
            Cancelar
          </Button>
          <Button
            onClick={handleIniciarPartida}
            color="primary"
            variant="contained"
            startIcon={<SportsSoccerIcon />}
            disabled={timesParaJogar.length !== 2}
          >
            Iniciar Partida
          </Button>
        </DialogActions>
      </Dialog>

      {/* Botão flutuante para gerar times */}
      {user?.uid === peladaData?.ownerId && peladaData?.confirmados?.length > 0 && (
        <Tooltip title="Gerar Times" placement="left">
          <Fab
            color="primary"
            aria-label="gerar times"
            onClick={handleGerarTimes}
            sx={{
              position: 'fixed',
              bottom: 32,
              right: 32,
              backgroundColor: '#1d4ed8',
              '&:hover': {
                backgroundColor: '#1e40af',
              },
            }}
          >
            <GroupsIcon />
          </Fab>
        </Tooltip>
      )}
    </div>
  );
} 