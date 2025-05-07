import { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { getUserById } from '@/firebase/userService';

interface JogadorStats {
  nome: string;
  vitorias: number;
  gols: number;
  assistencias: number;
  pontos: number;
  jogos: number;
  derrotas: number;
  empates: number;
}

export function useJogadorStats(jogadorId: string, peladaId: string | null) {
  const [stats, setStats] = useState<JogadorStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jogadorId || !peladaId) {
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
        
        // Buscar estatísticas do ranking na pelada
        const peladaRef = doc(db, 'peladas', peladaId);
        const peladaDoc = await getDoc(peladaRef);
        
        if (!peladaDoc.exists()) {
          setError('Pelada não encontrada');
          setLoading(false);
          return;
        }
        
        const peladaData = peladaDoc.data();
        const ranking = peladaData.ranking || {};
        const jogadorStats = ranking[jogadorId] || {};
        
        // Preencher as estatísticas
        setStats({
          nome: jogadorData.nome || 'Jogador',
          vitorias: jogadorStats.vitorias || 0,
          gols: jogadorStats.gols || 0,
          assistencias: jogadorStats.assistencias || 0,
          pontos: jogadorStats.pontos || 0,
          jogos: jogadorStats.jogos || 0,
          derrotas: jogadorStats.derrotas || 0,
          empates: jogadorStats.empates || 0
        });
        setLoading(false);
      } catch (err) {
        console.error('Erro ao buscar estatísticas do jogador:', err);
        setError('Erro ao buscar dados');
        setLoading(false);
      }
    };

    buscarEstatisticas();
  }, [jogadorId, peladaId]);

  return { stats, loading, error };
} 