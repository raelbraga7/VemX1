'use client';

import { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { toast } from 'react-toastify';
import { createPeladaNotification } from '@/firebase/notificationService';

interface RankingData {
  pontos: number;
  vitorias: number;
  gols: number;
  assistencias: number;
  nome: string;
}

interface SeasonTableProps {
  peladaId: string;
  temporada?: {
    inicio: Timestamp;
    fim: Timestamp;
    nome: string;
    status: 'ativa' | 'encerrada' | 'aguardando';
  };
  isOwner: boolean;
}

export default function SeasonTable({ peladaId, temporada, isOwner }: SeasonTableProps) {
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

  // Atualiza o tempo restante a cada 10 segundos em vez de cada segundo
  useEffect(() => {
    if (!temporada?.fim || !temporada.fim.seconds) return;
    
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
                await createPeladaNotification(
                  melhorJogador.id,
                  peladaId,
                  '🏆 VemX1: Parabéns Campeão!',
                  `Parabéns ${melhorJogador.nome}! Você foi o grande campeão da temporada "${temporada.nome}" com ${melhorJogador.pontos} pontos! 🎉\n\nSeus números impressionantes:\n• ${melhorJogador.vitorias} vitórias\n• ${melhorJogador.gols} gols\n• ${melhorJogador.assistencias} assistências\n\nContinue assim, você é uma lenda do VemX1! 🌟`
                );
              } catch (notificationError) {
                console.error('Erro ao enviar notificação:', notificationError);
                // Mesmo que falhe o envio de notificação, continuamos o processo
              }
            }

            toast.success('Temporada encerrada! O ranking foi zerado.');
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
    
    // Define um intervalo de 10 segundos para reduzir o número de chamadas ao Firestore
    const intervalo = setInterval(atualizarTempo, 10000);

    return () => clearInterval(intervalo);
  }, [temporada?.fim, temporada?.status, peladaId, calcularTempoRestante]);

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
        nome: `Temporada Rápida`,
        inicio: Timestamp.fromDate(agora),
        fim: Timestamp.fromDate(fimTemporada),
        status: 'ativa' as const
      };
      
      const peladaRef = doc(db, 'peladas', peladaId);
      
      await updateDoc(peladaRef, {
        temporada: novaTemporadaData,
        ranking: {} // Resetar o ranking para nova temporada
      });
      
      toast.success('Temporada iniciada! Duração: 1 minuto');
      
      // Atualiza a página para mostrar a contagem regressiva
      window.location.reload();
    } catch (error) {
      console.error('Erro ao iniciar temporada:', error);
      toast.error('Erro ao iniciar temporada automática');
    }
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

  const temTemporadaAtiva = temporada && temporada.status === 'ativa';

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 text-center">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{temporada?.nome || 'Temporada Atual'}</h2>
        {isOwner && (
          <button
            onClick={temTemporadaAtiva ? () => setEditando(true) : handleIniciarTemporadaAutomatica}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {temTemporadaAtiva ? 'Editar' : 'Iniciar Temporada'}
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
  );
} 