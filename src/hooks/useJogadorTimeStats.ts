import { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { getUserById } from '@/firebase/userService';

interface JogadorTimeStats {
  nome: string;
  vitorias: number;
  gols: number;
  assistencias: number;
  pontos: number;
  jogos: number;
  derrotas: number;
  empates: number;
  timeId: string;
  timeName: string;
}

export function useJogadorTimeStats(jogadorId: string, timeId: string | null) {
  const [stats, setStats] = useState<JogadorTimeStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jogadorId || !timeId) {
      setLoading(false);
      return;
    }

    const buscarEstatisticas = async () => {
      try {
        setLoading(true);
        
        // Buscar dados básicos do jogador
        const jogadorData = await getUserById(jogadorId);
        
        if (!jogadorData) {
          setError('Jogador não encontrado');
          setLoading(false);
          return;
        }
        
        // Buscar dados do time
        const timeRef = doc(db, 'times', timeId);
        const timeDoc = await getDoc(timeRef);
        
        if (!timeDoc.exists()) {
          setError('Time não encontrado');
          setLoading(false);
          return;
        }
        
        const timeData = timeDoc.data();
        
        // Buscar a pelada para obter estatísticas do jogador no time
        const peladaRef = doc(db, 'peladas', timeData.peladaId);
        const peladaDoc = await getDoc(peladaRef);
        
        if (!peladaDoc.exists()) {
          setError('Pelada não encontrada');
          setLoading(false);
          return;
        }
        
        const peladaData = peladaDoc.data();
        
        // Verificar se existem estatísticas de time para este jogador
        // Elas devem estar em estatisticasTime.timeId.jogadorId
        const estatisticasTime = peladaData.estatisticasTime || {};
        const estatisticasDoTime = estatisticasTime[timeId] || {};
        const jogadorStats = estatisticasDoTime[jogadorId] || {};
        
        // Preencher as estatísticas
        setStats({
          nome: jogadorData.nome || 'Jogador',
          vitorias: jogadorStats.vitorias || 0,
          gols: jogadorStats.gols || 0,
          assistencias: jogadorStats.assistencias || 0,
          pontos: jogadorStats.pontos || 0,
          jogos: jogadorStats.jogos || 0,
          derrotas: jogadorStats.derrotas || 0,
          empates: jogadorStats.empates || 0,
          timeId: timeId,
          timeName: timeData.name || 'Time'
        });
        setLoading(false);
      } catch (err) {
        console.error('Erro ao buscar estatísticas do jogador no time:', err);
        setError('Erro ao buscar dados');
        setLoading(false);
      }
    };

    buscarEstatisticas();
  }, [jogadorId, timeId]);

  return { stats, loading, error };
} 