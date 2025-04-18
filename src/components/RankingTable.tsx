'use client';

import { useState, useEffect } from 'react';
import { PlayerStats } from '@/firebase/rankingService';
import { useUser } from '@/contexts/UserContext';
import { checkPeladaPermissions } from '@/firebase/permissionService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';

interface RankingTableProps {
  peladaId: string;
}

interface RankingData {
  nome: string;
  vitorias: number;
  gols: number;
  assistencias: number;
  pontos: number;
}

export default function RankingTable({ peladaId }: RankingTableProps) {
  const [ranking, setRanking] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();
  const [canView, setCanView] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user?.uid) {
        setError('Você precisa estar logado para ver o ranking.');
        setLoading(false);
        return;
      }

      try {
        const permissions = await checkPeladaPermissions(user.uid, peladaId);
        
        if (!permissions.canView) {
          setError('Você não tem permissão para ver este ranking.');
          setLoading(false);
          return;
        }

        setCanView(true);
        
        // Configura o listener para atualizações em tempo real
        const peladaRef = doc(db, 'peladas', peladaId);
        const unsubscribe = onSnapshot(peladaRef, (doc) => {
          if (doc.exists()) {
            const peladaData = doc.data();
            const rankingData = (peladaData?.ranking || {}) as { [key: string]: RankingData };

            // Converte o objeto de ranking em array e ordena
            const rankingArray = Object.entries(rankingData).map(([uid, data]) => ({
              uid,
              nome: data.nome || '',
              vitorias: data.vitorias || 0,
              gols: data.gols || 0,
              assistencias: data.assistencias || 0,
              pontos: data.pontos || 0
            })).sort((a, b) => b.pontos - a.pontos);

            console.log('Ranking atualizado:', rankingArray);
            setRanking(rankingArray);
          }
        }, (error) => {
          console.error('Erro ao observar atualizações do ranking:', error);
          setError('Erro ao atualizar ranking em tempo real');
        });

        return () => unsubscribe();
      } catch (err) {
        console.error('Erro ao carregar ranking:', err);
        setError('Não foi possível carregar o ranking. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [peladaId, user]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex justify-between items-center">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!canView) {
    return null;
  }

  if (ranking.length === 0) {
    return (
      <p className="text-gray-600 text-center py-4">
        Nenhum jogador encontrado nesta pelada.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-700 bg-black">
            <thead>
              <tr>
                <th scope="col" className="w-12 px-1 sm:px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  #
                </th>
                <th scope="col" className="px-1 sm:px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Jogador
                </th>
                <th scope="col" className="w-12 px-1 sm:px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  <span className="hidden sm:inline">Vitórias</span>
                  <span className="sm:hidden">V</span>
                </th>
                <th scope="col" className="w-12 px-1 sm:px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  <span className="hidden sm:inline">Gols</span>
                  <span className="sm:hidden">G</span>
                </th>
                <th scope="col" className="w-12 px-1 sm:px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  <span className="hidden sm:inline">Assist.</span>
                  <span className="sm:hidden">A</span>
                </th>
                <th scope="col" className="w-12 px-1 sm:px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  <span className="hidden sm:inline">Pontos</span>
                  <span className="sm:hidden">Pts</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {ranking.map((player, index) => (
                <tr 
                  key={player.uid} 
                  className={`${player.uid === user?.uid ? 'bg-blue-900 bg-opacity-50' : ''} hover:bg-gray-900 transition-colors`}
                >
                  <td className="w-12 px-1 sm:px-4 py-2 text-sm font-medium text-gray-300">
                    {index + 1}º
                  </td>
                  <td className="px-1 sm:px-4 py-2 text-sm text-gray-300">
                    <div className="flex items-center space-x-2">
                      <span className="truncate max-w-[80px] sm:max-w-none">{player.nome}</span>
                      {player.uid === user?.uid && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-900 text-blue-200">
                          Você
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="w-12 px-1 sm:px-4 py-2 text-sm text-center text-gray-300">
                    {player.vitorias}
                  </td>
                  <td className="w-12 px-1 sm:px-4 py-2 text-sm text-center text-gray-300">
                    {player.gols}
                  </td>
                  <td className="w-12 px-1 sm:px-4 py-2 text-sm text-center text-gray-300">
                    {player.assistencias}
                  </td>
                  <td className="w-12 px-1 sm:px-4 py-2 text-sm font-bold text-center text-gray-300">
                    {player.pontos}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 