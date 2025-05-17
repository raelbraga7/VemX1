'use client';

import { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { toast } from 'react-toastify';
import { createPeladaNotification } from '@/firebase/notificationService';
import { renderToString } from 'react-dom/server';
import MensagemCampeao from './MensagemCampeao';

interface RankingTimeData {
  id: string;
  nome: string;
  vitorias: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  saldoGols: number;
  pontos: number;
  userId?: string | null;
}

interface SeasonTableTimesProps {
  peladaId: string;
  temporada?: {
    inicio: Timestamp;
    fim: Timestamp;
    nome: string;
    status: 'ativa' | 'encerrada' | 'aguardando';
  };
  isOwner: boolean;
}

export default function SeasonTableTimes({ peladaId, temporada, isOwner }: SeasonTableTimesProps) {
  const [editando, setEditando] = useState(false);
  const [novaTemporada, setNovaTemporada] = useState({
    nome: temporada?.nome || '',
    inicio: temporada?.inicio ? new Date(temporada.inicio.seconds * 1000).toISOString().split('T')[0] : '',
    fim: temporada?.fim ? new Date(temporada.fim.seconds * 1000).toISOString().split('T')[0] : ''
  });
  const [tempoRestante, setTempoRestante] = useState({
    dias: 0,
    horas: 0,
    minutos: 0,
    segundos: 0
  });
  const [temporadaPeladaAtiva, setTemporadaPeladaAtiva] = useState(false);
  const [loading, setLoading] = useState(false);
  const [temporadaCriada, setTemporadaCriada] = useState(false);
  const [times, setTimes] = useState<RankingTimeData[]>([]);
  const [showConfirmacao, setShowConfirmacao] = useState(false);

  // Verificar se há uma temporada de pelada ativa
  useEffect(() => {
    const verificarTemporadaPelada = async () => {
      if (peladaId) {
        try {
          const peladaRef = doc(db, 'peladas', peladaId);
          const peladaDoc = await getDoc(peladaRef);
          
          if (peladaDoc.exists()) {
            const peladaData = peladaDoc.data();
            const temTemporadaPeladaAtiva = 
              peladaData.temporada && 
              peladaData.temporada.status === 'ativa' && 
              (peladaData.temporada.tipo === 'pelada' || !peladaData.temporada.tipo);
            
            setTemporadaPeladaAtiva(temTemporadaPeladaAtiva);
          }
        } catch (error) {
          console.error('Erro ao verificar temporada de pelada:', error);
        }
      }
    };

    verificarTemporadaPelada();
  }, [peladaId]);

  // Buscar os times da pelada
  useEffect(() => {
    const buscarTimes = async () => {
      if (peladaId) {
        try {
          const peladaRef = doc(db, 'peladas', peladaId);
          const peladaDoc = await getDoc(peladaRef);
          
          if (peladaDoc.exists()) {
            const peladaData = peladaDoc.data();
            if (peladaData.times && peladaData.times.lista) {
              const timesList = Object.entries(peladaData.times.lista).map(([id, data]: [string, any]) => ({
                id,
                nome: data.nome,
                vitorias: data.vitorias || 0,
                derrotas: data.derrotas || 0,
                golsPro: data.golsPro || 0,
                golsContra: data.golsContra || 0,
                saldoGols: data.saldoGols || 0,
                pontos: data.pontos || 0,
                userId: data.userId || null
              }));
              setTimes(timesList);
            }
          }
        } catch (error) {
          console.error('Erro ao buscar times:', error);
        }
      }
    };
    
    buscarTimes();
  }, [peladaId]);

  // Função para calcular o tempo restante
  const calcularTempoRestante = (dataFim: Timestamp) => {
    try {
      const agora = new Date();
      const fim = new Date(dataFim.seconds * 1000);
      const diferenca = fim.getTime() - agora.getTime();

      if (diferenca <= 0) {
        return {
          dias: 0,
          horas: 0,
          minutos: 0,
          segundos: 0
        };
      }

      const dias = Math.floor(diferenca / (1000 * 60 * 60 * 24));
      const horas = Math.floor((diferenca % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutos = Math.floor((diferenca % (1000 * 60 * 60)) / (1000 * 60));
      const segundos = Math.floor((diferenca % (1000 * 60)) / 1000);

      return { dias, horas, minutos, segundos };
    } catch (error) {
      console.error('Erro ao calcular tempo restante:', error);
      return {
        dias: 0,
        horas: 0,
        minutos: 0,
        segundos: 0
      };
    }
  };

  // Atualiza o tempo restante a cada segundo
  useEffect(() => {
    if (!temporada?.fim || !temporada.fim.seconds) return;
    
    // Verificar se a temporada já está encerrada
    if (temporada.status === 'encerrada') return;

    let foiProcessado = false; // Flag para evitar processamento duplicado

    const atualizarTempo = async () => {
      // Cálculo local sem consultar o Firebase
      const tempoAtual = calcularTempoRestante(temporada.fim);
      setTempoRestante(tempoAtual);

      // Verifica se a temporada acabou (todos os valores são 0)
      if (!foiProcessado && 
          tempoAtual.dias === 0 && 
          tempoAtual.horas === 0 && 
          tempoAtual.minutos === 0 && 
          tempoAtual.segundos === 0) {
        
        // Marca imediatamente como processado para evitar chamadas duplicadas
        foiProcessado = true;
        
        try {
          // Busca o ranking atual
          const peladaRef = doc(db, 'peladas', peladaId);
          const peladaDoc = await getDoc(peladaRef);
          const peladaData = peladaDoc.data();
          
          // Verifica se a temporada já foi encerrada para evitar duplicação
          if (peladaData?.temporada?.status === 'encerrada') {
            clearInterval(intervalo);
            return; 
          }

          // Verifica o ranking de times e encontra o time campeão
          if (peladaData?.rankingTimes) {
            const times = Object.entries(peladaData.rankingTimes);
            
            if (times.length === 0) {
              // Se não há times no ranking, apenas encerrar a temporada
              await updateDoc(peladaRef, {
                'temporada.status': 'encerrada'
              });
              
              toast.success('Temporada encerrada! Não houve times classificados.');
              clearInterval(intervalo);
              return;
            }
            
            // Encontra o time com mais pontos
            const timeCampeao = times.reduce<RankingTimeData & { id: string }>((melhor, [timeId, dados]) => {
              const timeData = dados as RankingTimeData;
              return (!melhor || timeData.pontos > melhor.pontos) 
                ? { ...timeData, id: timeId }
                : melhor;
            }, { id: '', nome: '', vitorias: 0, derrotas: 0, golsPro: 0, golsContra: 0, saldoGols: 0, pontos: 0 });

            // Atualiza o status da temporada
            await updateDoc(peladaRef, {
              'temporada.status': 'encerrada'
            });
            
            // Notifica os jogadores do time campeão
            if (timeCampeao) {
              // Buscar todos os jogadores do time campeão
              const timeRef = doc(db, 'times', timeCampeao.id);
              const timeDoc = await getDoc(timeRef);
              
              if (timeDoc.exists()) {
                const timeData = timeDoc.data();
                const jogadores = timeData.jogadores || [];
                
                // Enviar notificação para cada jogador do time
                for (const jogador of jogadores) {
                  try {
                    const mensagemHTML = renderToString(
                      <MensagemCampeao nomeTime={timeCampeao.nome} />
                    );
                      
                    await createPeladaNotification(
                      jogador.id,
                      peladaId,
                      "Campeão da Temporada de Time",
                      mensagemHTML
                    );
                  } catch (notificationError) {
                    console.error('Erro ao enviar notificação para jogador:', notificationError);
                    // Continua enviando para os outros jogadores mesmo se falhar para um
                  }
                }
                
                toast.success(`Temporada encerrada! ${timeCampeao.nome} é o campeão!`);
              }
            }
          }
          
          // Limpa o intervalo para parar completamente as verificações
          clearInterval(intervalo);
          
        } catch (error) {
          console.error('Erro ao finalizar temporada:', error);
          toast.error('Erro ao finalizar a temporada');
        }
      }
    };

    // Executa uma vez imediatamente
    atualizarTempo();
    
    // Define um intervalo de 1 segundo para atualização
    const intervalo = setInterval(atualizarTempo, 1000);

    return () => clearInterval(intervalo);
  }, [temporada?.fim, temporada?.status, peladaId, temporada?.nome]);

  const handleSalvar = async () => {
    try {
      // Validações básicas
      if (!novaTemporada.nome || !novaTemporada.inicio || !novaTemporada.fim) {
        toast.error('Preencha todos os campos');
        return;
      }

      const inicioDate = new Date(novaTemporada.inicio);
      const fimDate = new Date(novaTemporada.fim);

      // Valida se as datas são válidas
      if (isNaN(inicioDate.getTime()) || isNaN(fimDate.getTime())) {
        toast.error('Datas inválidas');
        return;
      }

      // Valida se a data de término é posterior à data de início
      if (fimDate <= inicioDate) {
        toast.error('A data de término deve ser posterior à data de início');
        return;
      }

      const peladaRef = doc(db, 'peladas', peladaId);
      
      const novaTemporadaData = {
        nome: novaTemporada.nome,
        inicio: Timestamp.fromDate(inicioDate),
        fim: Timestamp.fromDate(fimDate),
        status: 'ativa' as const
      };
      
      await updateDoc(peladaRef, {
        temporada: novaTemporadaData
      });

      setEditando(false);
      toast.success('Temporada atualizada com sucesso!');
      
      // Atualiza a página para refletir as mudanças
      window.location.reload();
    } catch (error) {
      console.error('Erro ao atualizar temporada:', error);
      toast.error('Erro ao atualizar temporada');
    }
  };

  const handleIniciarTemporadaAutomatica = async () => {
    setLoading(true);

    try {
      // Criar nova temporada com duração de 1 minuto
      const agora = Timestamp.now();
      const umMinutoDepois = new Date(agora.toDate().getTime() + 60000); // 1 minuto em milissegundos

      const novaTemporadaData = {
        nome: "Temporada de Time",
        inicio: agora,
        fim: Timestamp.fromDate(umMinutoDepois),
        status: 'ativa',
        tipo: 'time'
      };

      // Atualizar documento da pelada
      const peladaRef = doc(db, 'peladas', peladaId);
      await updateDoc(peladaRef, {
        'times.temporada': novaTemporadaData
      });

      // Atualizar documento do time vencedor após 1 minuto
      setTimeout(async () => {
        try {
          // Encontrar time com mais pontos
          const timesOrdenados = [...times].sort((a, b) => b.pontos - a.pontos);
          const timeCampeao = timesOrdenados[0];

          if (timeCampeao) {
            // Atualizar pontuação do time
            const timeRef = doc(db, 'times', timeCampeao.id);
            await updateDoc(timeRef, {
              vitorias: timeCampeao.vitorias + 1
            });

            // Enviar notificação
            if (timeCampeao.userId) {
              const mensagemHTML = renderToString(
                <MensagemCampeao nomeTime={timeCampeao.nome} />
              );
              
              createPeladaNotification(
                timeCampeao.userId,
                peladaId,
                "Campeão da Temporada de Time",
                mensagemHTML
              );
            }

            // Atualizar documento da pelada com o vencedor
            const peladaSnapshot = await getDoc(peladaRef);
            if (peladaSnapshot.exists()) {
              const peladaData = peladaSnapshot.data();
              const temporadaAtualizada = {
                ...peladaData.times.temporada,
                status: 'encerrada',
                vencedor: {
                  id: timeCampeao.id,
                  nome: timeCampeao.nome,
                  pontos: timeCampeao.pontos
                }
              };

              await updateDoc(peladaRef, {
                'times.temporada': temporadaAtualizada
              });
            }
          }

          setTemporadaCriada(true);
        } catch (error) {
          console.error("Erro ao finalizar temporada:", error);
        }
      }, 60000); // 1 minuto em milissegundos

      toast.success('Temporada iniciada com sucesso!');
    } catch (error) {
      console.error("Erro ao iniciar temporada:", error);
      toast.error('Erro ao iniciar temporada');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarIniciarTemporada = () => {
    setShowConfirmacao(true);
  };

  if (editando) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Editar Temporada</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome da Temporada
            </label>
            <input
              type="text"
              value={novaTemporada.nome}
              onChange={(e) => setNovaTemporada(prev => ({ ...prev, nome: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Temporada 2024/1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data de Início
            </label>
            <input
              type="date"
              value={novaTemporada.inicio}
              onChange={(e) => setNovaTemporada(prev => ({ ...prev, inicio: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data de Término
            </label>
            <input
              type="date"
              value={novaTemporada.fim}
              onChange={(e) => setNovaTemporada(prev => ({ ...prev, fim: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => setEditando(false)}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Botão desabilitado se há temporada ativa de pelada
  const buttonDisabled = temporadaPeladaAtiva || temporada && temporada.status === 'ativa';
  
  const botaoCss = buttonDisabled
    ? "px-4 py-2 text-sm bg-gray-400 text-white rounded-lg cursor-not-allowed"
    : "px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors";
    
  const botaoTooltip = temporadaPeladaAtiva
    ? "Aguarde a temporada de pelada terminar para iniciar uma temporada de time"
    : (temporada && temporada.status === 'ativa' ? "Já existe uma temporada em andamento" : "");

  return (
    <>
      {showConfirmacao && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-xl font-bold mb-4">Confirmar início de temporada</h3>
            <p className="mb-6">Tem certeza de que quer começar a temporada de time? Essa ação não poderá ser desfeita.</p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowConfirmacao(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  setShowConfirmacao(false);
                  handleIniciarTemporadaAutomatica();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6 text-center">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{temporada?.nome || "Temporada de Time"}</h2>
          {isOwner && (
            <button
              onClick={handleConfirmarIniciarTemporada}
              className={`px-4 py-2 text-sm ${buttonDisabled ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"} text-white rounded-lg transition-colors`}
              disabled={buttonDisabled}
              title={botaoTooltip}
            >
              {tempoRestante.dias === 0 && tempoRestante.horas === 0 && tempoRestante.minutos === 0 && tempoRestante.segundos === 0 ? "Temporada em Andamento" : "Iniciar Temporada"}
            </button>
          )}
        </div>

        <div className="flex justify-center items-center space-x-8">
          <div className="text-center">
            <div className="text-4xl font-bold text-red-600 mb-1">{String(tempoRestante.dias).padStart(3, '0')}</div>
            <div className="text-gray-600 uppercase text-sm">Dias</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-red-600 mb-1">{String(tempoRestante.horas).padStart(2, '0')}</div>
            <div className="text-gray-600 uppercase text-sm">Horas</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-red-600 mb-1">{String(tempoRestante.minutos).padStart(2, '0')}</div>
            <div className="text-gray-600 uppercase text-sm">Min</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-red-600 mb-1">{String(tempoRestante.segundos).padStart(2, '0')}</div>
            <div className="text-gray-600 uppercase text-sm">Seg</div>
          </div>
        </div>

        <div className="mt-6 text-sm text-gray-600">
          <div className="flex justify-between items-center py-2">
            <span>Início:</span>
            <span>{temporada?.inicio ? new Date(temporada.inicio.seconds * 1000).toLocaleDateString() : 'Não definido'}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span>Término:</span>
            <span>{temporada?.fim ? new Date(temporada.fim.seconds * 1000).toLocaleDateString() : 'Não definido'}</span>
          </div>
        </div>
      </div>
    </>
  );
} 