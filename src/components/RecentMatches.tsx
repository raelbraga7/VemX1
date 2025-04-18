'use client';

import { useState, useEffect } from 'react';
import { getRecentMatches, Match } from '@/firebase/matchService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function RecentMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setLoading(true);
        const recentMatches = await getRecentMatches(5);
        setMatches(recentMatches);
        setError(null);
      } catch (err) {
        console.error('Erro ao carregar partidas:', err);
        setError('Não foi possível carregar as partidas. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, []);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Últimas Partidas</h2>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Últimas Partidas</h2>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Últimas Partidas</h2>
        <p className="text-gray-600">Nenhuma partida concluída ainda.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Últimas Partidas</h2>
      <div className="space-y-4">
        {matches.map((match) => (
          <div key={match.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
            <div className="text-sm text-gray-500 mb-2">
              {format(match.data.toDate(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </div>
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <div className="font-medium">{match.timeA.nome}</div>
                <div className="text-sm text-gray-500">{match.timeA.jogadores.length} jogadores</div>
              </div>
              <div className="px-4 py-1 bg-gray-100 rounded-md font-bold">
                {match.timeA.score} - {match.timeB.score}
              </div>
              <div className="flex-1 text-right">
                <div className="font-medium">{match.timeB.nome}</div>
                <div className="text-sm text-gray-500">{match.timeB.jogadores.length} jogadores</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 