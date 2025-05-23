'use client';

import { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc, getDoc, Timestamp, DocumentData } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { toast } from 'react-toastify';
import { createPeladaNotification } from '@/firebase/notificationService';
import { renderToString } from 'react-dom/server';
import MensagemCampeaoPelada from './MensagemCampeaoPelada';
import MensagemCampeao from './MensagemCampeao';

interface RankingData {
  pontos: number;
  vitorias: number;
  gols: number;
  assistencias: number;
  nome: string;
}

interface RankingTimeData {
  id: string;
  nome: string;
  vitorias: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  saldoGols: number;
  pontos: number;
}

interface SeasonTableProps {
  peladaId: string;
  temporada?: {
    inicio: Timestamp;
    fim: Timestamp;
    nome: string;
    status: 'ativa' | 'encerrada' | 'aguardando';
    tipo?: 'pelada' | 'time';
  };
  isOwner: boolean;
  tipoTela?: 'pelada' | 'time';
}

export default function SeasonTable({ peladaId, temporada, isOwner, tipoTela = 'pelada' }: SeasonTableProps) {
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
  const [showConfirmacao, setShowConfirmacao] = useState(false);
  
  // Verificar se há temporada ativa
  const temTemporadaAtivaNaTela = useMemo(() => {
    if (!temporada) return false;
    return (
      temporada.status === 'ativa' && 
      (tipoTela === 'pelada' ? !temporada.tipo || temporada.tipo === 'pelada' : temporada.tipo === 'time')
    );
  }, [temporada, tipoTela]);

  // Verificar se há uma temporada de pelada ativa
  const temporadaPeladaAtiva = useMemo(() => {
    if (!temporada) return false;
    return temporada.status === 'ativa' && (!temporada.tipo || temporada.tipo === 'pelada');
  }, [temporada]);

  // Verificar se há uma temporada de time ativa  
  const temporadaTimeAtiva = useMemo(() => {
    if (!temporada) return false;
    return temporada.status === 'ativa' && temporada.tipo === 'time';
  }, [temporada]);

  // Determinar se o botão deve estar desativado
  const buttonDisabled = useMemo(() => {
    if (!isOwner) return true; // Desativado se não for dono (o que já inclui verificação de assinatura)
    
    // Temporada de pelada não pode ser iniciada se já tiver temporada de time ativa
    if (tipoTela === 'pelada' && temporadaTimeAtiva) return true;
    
    // Temporada de time não pode ser iniciada se já tiver temporada de pelada ativa
    if (tipoTela === 'time' && temporadaPeladaAtiva) return true;
    
    // Não pode iniciar se já tiver temporada ativa do mesmo tipo
    return temTemporadaAtivaNaTela;
  }, [isOwner, tipoTela, temporadaTimeAtiva, temporadaPeladaAtiva, temTemporadaAtivaNaTela]);

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

  // Atualiza o tempo restante a cada 1 segundo
  useEffect(() => {
    // Se não houver temporada ou se o tipo da temporada não coincidir com o tipo da tela, não mostre o cronômetro
    if (!temporada?.fim || !temporada.fim.seconds) return;
    
    // Verifica se o tipo da temporada não coincide com o tipo da tela
    if (temporada.tipo && temporada.tipo !== tipoTela) {
      return;
    }
    
    // Se estamos na tela de pelada, só mostrar temporada de pelada
    // Se estamos na tela de time, só mostrar temporada de time
    if (tipoTela === 'pelada' && temporada.tipo === 'time') return;
    if (tipoTela === 'time' && temporada.tipo === 'pelada') return;
    
    // Verificar se a temporada já está encerrada e não enviar notificações novamente
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
            clearInterval(intervalo); // Para completamente se já foi encerrada
            return; 
          }

          // Se for uma temporada de time, zera o rankingTimes ao encerrar
          if (tipoTela === 'time' || temporada.tipo === 'time') {
            if (peladaData?.rankingTimes) {
              const rankingTimesAtualizado: Record<string, RankingTimeData> = {};
              
              // Preserva a estrutura dos times, mas zera todos os valores estatísticos
              Object.entries(peladaData.rankingTimes).forEach(([timeId, dados]) => {
                if (dados) {
                  const dadosTime = dados as DocumentData;
                  rankingTimesAtualizado[timeId] = {
                    id: timeId,
                    nome: dadosTime.nome || `Time ${timeId.substring(0, 4)}`,
                    vitorias: 0,
                    derrotas: 0,
                    golsPro: 0,
                    golsContra: 0,
                    saldoGols: 0,
                    pontos: 0
                  };
                }
              });
              
              // Prepara objeto para zerar estatísticas individuais dos jogadores por time
              // As estatísticas dos jogadores estão em estatisticasTime.timeId.jogadorId
              interface JogadorEstatistica {
                gols: number;
                assistencias: number;
                vitorias: number;
                derrotas: number;
                pontos: number;
                jogos: number;
                empates: number;
              }
              
              const estatisticasTimeZeradas: Record<string, Record<string, JogadorEstatistica>> = {};
              if (peladaData.estatisticasTime) {
                // Preservamos a estrutura, mas zeramos todos os valores
                Object.keys(peladaData.estatisticasTime).forEach(timeId => {
                  estatisticasTimeZeradas[timeId] = {};
                  
                  // Se existem estatísticas para o time, preservamos os jogadores mas zeramos os valores
                  if (peladaData.estatisticasTime[timeId]) {
                    Object.keys(peladaData.estatisticasTime[timeId]).forEach(jogadorId => {
                      estatisticasTimeZeradas[timeId][jogadorId] = {
                        gols: 0,
                        assistencias: 0,
                        vitorias: 0,
                        derrotas: 0,
                        pontos: 0,
                        jogos: 0,
                        empates: 0
                      };
                    });
                  }
                });
              }
              
              // Encontrar o time campeão (o com maior pontuação)
              interface TimeCampeao extends RankingTimeData {
                id: string;
              }
              
              const timeCampeao = Object.entries(peladaData.rankingTimes).reduce<TimeCampeao | null>(
                (melhor, [timeId, dados]) => {
                  const timeData = dados as DocumentData;
                  if (!melhor || timeData.pontos > melhor.pontos) {
                    return { 
                      id: timeId, 
                      nome: timeData.nome || '',
                      vitorias: timeData.vitorias || 0,
                      derrotas: timeData.derrotas || 0,
                      golsPro: timeData.golsPro || 0,
                      golsContra: timeData.golsContra || 0,
                      saldoGols: timeData.saldoGols || 0,
                      pontos: timeData.pontos || 0
                    };
                  }
                  return melhor;
                },
                null
              );
              
              // Buscar informações do time campeão para saber quem é o capitão
              if (timeCampeao) {
                const timeRef = doc(db, 'times', timeCampeao.id);
                const timeDoc = await getDoc(timeRef);
                
                if (timeDoc.exists()) {
                  const timeData = timeDoc.data();
                  const capitaoId = timeData.capitaoId;
                  const jogadores = timeData.jogadores || [];
                  
                  // Enviar notificação para cada jogador do time campeão
                  for (const jogador of jogadores) {
                    const jogadorId = jogador.id;
                    const isCapitao = jogadorId === capitaoId;
                    
                    // Buscar estatísticas específicas deste jogador no time
                    let jogadorStats = {
                      vitorias: 0,
                      gols: 0,
                      assistencias: 0,
                      pontos: 0,
                      jogos: 0
                    };
                    
                    // Buscar estatísticas do jogador se existirem
                    if (peladaData.estatisticasTime && 
                        peladaData.estatisticasTime[timeCampeao.id] && 
                        peladaData.estatisticasTime[timeCampeao.id][jogadorId]) {
                      const stats = peladaData.estatisticasTime[timeCampeao.id][jogadorId];
                      jogadorStats = {
                        vitorias: stats.vitorias || 0,
                        gols: stats.gols || 0,
                        assistencias: stats.assistencias || 0,
                        pontos: stats.pontos || 0,
                        jogos: stats.jogos || 0
                      };
                    }
                    
                    // Renderizar a mensagem personalizada para este jogador
                    const mensagemHTML = renderToString(
                      <MensagemCampeao 
                        nomeTime={timeCampeao.nome} 
                        jogadorStats={jogadorStats}
                        isCapitao={isCapitao}
                      />
                    );
                    
                    // Enviar notificação
                    try {
                      await createPeladaNotification(
                        jogadorId,
                        peladaId,
                        `🏆 VemX1: Parabéns Campeão de Time!`,
                        mensagemHTML
                      );
                    } catch (notificationError) {
                      console.error('Erro ao enviar notificação para jogador:', notificationError);
                      // Continua com os outros jogadores mesmo se falhar
                    }
                  }
                }
              }
              
              // Atualiza o status da temporada, zera o ranking de times e as estatísticas dos jogadores
              await updateDoc(peladaRef, {
                'temporada.status': 'encerrada',
                rankingTimes: rankingTimesAtualizado,
                estatisticasTime: estatisticasTimeZeradas
              });
              
              toast.success('Temporada de Time encerrada! O ranking de times e as estatísticas dos jogadores foram zerados.');
              clearInterval(intervalo);
              return;
            }
          }

          // Código original para temporadas de pelada
          if (peladaData?.ranking) {
            // Verifica se há algum jogador no ranking
            const jogadores = Object.entries(peladaData.ranking);
            
            if (jogadores.length === 0) {
              // Se não há jogadores no ranking, apenas encerra a temporada sem enviar notificação
              await updateDoc(peladaRef, {
                'temporada.status': 'encerrada',
                ranking: {},
              });
              
              toast.success('Temporada encerrada! Não houve jogadores classificados.');
              clearInterval(intervalo);
              return;
            }
            
            // Encontra o jogador com mais pontos
            const melhorJogador = jogadores.reduce<{ id: string } & RankingData | null>((melhor, [jogadorId, dados]) => {
              const jogadorDados = dados as RankingData;
              return (!melhor || jogadorDados.pontos > melhor.pontos) 
                ? { id: jogadorId, ...jogadorDados }
                : melhor;
            }, null);

            // Primeiro atualiza o status da temporada para evitar processamento duplicado
            await updateDoc(peladaRef, {
              'temporada.status': 'encerrada',
              ranking: {},
            });
            
            // Só depois envia a notificação, se houver um campeão
            if (melhorJogador) {
              try {
                // Renderizar o componente MensagemCampeaoPelada para HTML
                const mensagemHTML = renderToString(
                  <MensagemCampeaoPelada
                    nomeJogador={melhorJogador.nome}
                    pontos={melhorJogador.pontos}
                    vitorias={melhorJogador.vitorias}
                    gols={melhorJogador.gols}
                    assistencias={melhorJogador.assistencias}
                    temporadaNome={temporada.nome}
                  />
                );
                
                await createPeladaNotification(
                  melhorJogador.id,
                  peladaId,
                  `🏆 VemX1: Parabéns Campeão de ${tipoTela === 'pelada' ? 'Pelada' : 'Time'}!`,
                  mensagemHTML
                );
              } catch (notificationError) {
                console.error('Erro ao enviar notificação:', notificationError);
                // Mesmo que falhe o envio de notificação, continuamos o processo
              }
            }

            toast.success('Temporada de Pelada encerrada! O ranking foi zerado.');
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
    
    // Define um intervalo de 1 segundo para atualização em tempo real
    const intervalo = setInterval(atualizarTempo, 1000);

    return () => clearInterval(intervalo);
  }, [temporada?.fim, temporada?.status, peladaId, temporada?.nome, tipoTela]);

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

      // Atualiza o estado local com os novos dados
      const peladaDoc = await getDoc(peladaRef);
      const peladaData = peladaDoc.data();
      
      if (peladaData?.temporada) {
        // Força uma atualização da página para refletir as mudanças
        window.location.reload();
      }

      setEditando(false);
      toast.success('Temporada atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar temporada:', error);
      toast.error('Erro ao atualizar temporada');
    }
  };

  const handleIniciarTemporadaAutomatica = async () => {
    try {
      // Criar nova temporada com duração de 1 minuto
      const agora = new Date();
      const fimTemporada = new Date(agora.getTime() + 60000); // +60000ms = 1 minuto
      
      const novaTemporadaData = {
        nome: `Temporada de ${tipoTela === 'pelada' ? 'Pelada' : 'Time'}`,
        inicio: Timestamp.fromDate(agora),
        fim: Timestamp.fromDate(fimTemporada),
        status: 'ativa' as const,
        tipo: tipoTela // Garantir que a temporada tenha o tipo correto
      };
      
      const peladaRef = doc(db, 'peladas', peladaId);
      
      // Buscar dados atuais da pelada para preservar nomes de usuários no ranking
      const peladaDoc = await getDoc(peladaRef);
      const rankingAtualizado: Record<string, {
        nome: string;
        vitorias: number;
        gols: number;
        assistencias: number;
        pontos: number;
        jogos: number;
        derrotas: number;
        empates: number;
      }> = {};
      
      if (peladaDoc.exists()) {
        const peladaData = peladaDoc.data();
        const rankingAtual = peladaData.ranking || {};
        
        // Preservar apenas os nomes dos usuários no novo ranking
        Object.entries(rankingAtual).forEach(([userId, dados]) => {
          const dadosJogador = dados as RankingData;
          rankingAtualizado[userId] = {
            nome: dadosJogador.nome || 'Jogador',
            vitorias: 0,
            gols: 0,
            assistencias: 0,
            pontos: 0,
            jogos: 0,
            derrotas: 0,
            empates: 0
          };
        });
      }
      
      await updateDoc(peladaRef, {
        temporada: novaTemporadaData,
        ranking: rankingAtualizado // Usar o ranking com nomes preservados
      });
      
      toast.success(`Temporada de ${tipoTela === 'pelada' ? 'Pelada' : 'Time'} iniciada! Duração: 1 minuto`);
      
      // Atualiza a página para mostrar a contagem regressiva
      window.location.reload();
    } catch (error) {
      console.error('Erro ao iniciar temporada:', error);
      toast.error('Erro ao iniciar temporada automática');
    }
  };

  // Função para abrir o diálogo de confirmação
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

  const botaoCss = buttonDisabled
    ? "px-4 py-2 text-sm bg-gray-400 text-white rounded-lg cursor-not-allowed"
    : "px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors";
  
  const botaoTooltip = 
    tipoTela === 'pelada' && temporadaTimeAtiva 
      ? "Aguarde a temporada de time terminar para iniciar uma temporada de pelada" 
      : tipoTela === 'time' && temporadaPeladaAtiva
        ? "Aguarde a temporada de pelada terminar para iniciar uma temporada de time"
        : temTemporadaAtivaNaTela 
          ? "Já existe uma temporada em andamento" 
          : "";

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 text-center">
      {/* Diálogo de confirmação */}
      {showConfirmacao && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-xl font-bold mb-4">Confirmar início de temporada</h3>
            <p className="mb-6">Tem certeza de que quer começar a temporada de {tipoTela === 'pelada' ? 'pelada' : 'time'}? Essa ação não poderá ser desfeita.</p>
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

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">
          {/* Sempre mostra o tipo de temporada conforme a tela atual, independente dos dados da temporada */}
          {temporada?.status === 'ativa'
            ? (temporada.nome || `Temporada de ${tipoTela === 'pelada' ? 'Pelada' : 'Time'}`)
            : `Temporada de ${tipoTela === 'pelada' ? 'Pelada' : 'Time'}`}
        </h2>
        {isOwner && (
          <div title={botaoTooltip}>
            <button
              onClick={handleConfirmarIniciarTemporada}
              className={botaoCss}
              disabled={buttonDisabled}
            >
              Iniciar Temporada
            </button>
          </div>
        )}
      </div>

      {/* Mostra zeros quando não há temporada ativa para o tipo de tela atual */}
      {!temTemporadaAtivaNaTela ? (
        <div className="flex justify-center items-center space-x-8">
          <div className="text-center">
            <div className="text-4xl font-bold text-red-600 mb-1">000</div>
            <div className="text-gray-600 uppercase text-sm">Dias</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-red-600 mb-1">00</div>
            <div className="text-gray-600 uppercase text-sm">Horas</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-red-600 mb-1">00</div>
            <div className="text-gray-600 uppercase text-sm">Min</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-red-600 mb-1">00</div>
            <div className="text-gray-600 uppercase text-sm">Seg</div>
          </div>
        </div>
      ) : (
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
      )}

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
  );
} 