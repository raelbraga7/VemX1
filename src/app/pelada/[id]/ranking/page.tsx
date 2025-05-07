'use client';

import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useParams } from 'next/navigation';

interface RankingPlayer {
  id?: string;
  nome: string;
  pontos: number;
  vitorias: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  saldoGols: number;
}

const RankingPage: React.FC = () => {
  const params = useParams();
  const [ranking, setRanking] = useState<RankingPlayer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPeladaData = async () => {
      if (!params.id) {
        setError('ID da pelada não encontrado');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const peladaRef = doc(db, 'peladas', params.id as string);
        
        // Usar onSnapshot para obter dados em tempo real
        const unsubscribe = onSnapshot(peladaRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            console.log('DEBUG: Ranking carregado:', {
              peladaId: params.id,
              rankingSize: Object.keys(data.ranking || {}).length,
              timestamp: new Date().toISOString()
            });
            
            // Processa o ranking
            if (data.ranking) {
              const sortedRanking = Object.entries(data.ranking)
                .map(([id, rankingData]) => ({
                  id,
                  ...(rankingData as RankingPlayer)
                }))
                .sort((a, b) => (b.pontos || 0) - (a.pontos || 0));
                
              console.log('DEBUG: Ranking ordenado:', {
                total: sortedRanking.length,
                primeiroColocado: sortedRanking.length > 0 ? 
                  { nome: sortedRanking[0].nome, pontos: sortedRanking[0].pontos } : 'Nenhum'
              });
              
              setRanking(sortedRanking);
            } else {
              console.log('DEBUG: Nenhum ranking encontrado');
              setRanking([]);
            }
            
            setLoading(false);
          } else {
            console.error('DEBUG: Documento da pelada não existe');
            setError('Pelada não encontrada');
            setLoading(false);
          }
        }, (err) => {
          console.error('DEBUG: Erro ao observar documento:', err);
          setError(`Erro ao carregar dados: ${err.message}`);
          setLoading(false);
        });
        
        // Limpeza ao desmontar
        return () => unsubscribe();
      } catch (err) {
        console.error('DEBUG: Erro ao acessar Firestore:', err);
        setError('Erro ao buscar dados da pelada');
        setLoading(false);
      }
    };

    loadPeladaData();
  }, [params.id]);

  return (
    <div className="container mx-auto p-4">
      {loading && (
        <div className="flex justify-center my-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      
      {!loading && !error && (
        <>
          <h1 className="text-2xl font-bold mb-6">Ranking da Pelada</h1>
          
          {ranking.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Nenhum jogador no ranking ainda. Jogue algumas partidas para começar a pontuar!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-3 px-4 text-left">Pos.</th>
                    <th className="py-3 px-4 text-left">Nome</th>
                    <th className="py-3 px-4 text-center">Pts</th>
                    <th className="py-3 px-4 text-center">V</th>
                    <th className="py-3 px-4 text-center">D</th>
                    <th className="py-3 px-4 text-center">GP</th>
                    <th className="py-3 px-4 text-center">GC</th>
                    <th className="py-3 px-4 text-center">SG</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((player, index) => (
                    <tr key={player.id} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="py-3 px-4">{index + 1}</td>
                      <td className="py-3 px-4 font-medium">{player.nome}</td>
                      <td className="py-3 px-4 text-center font-bold">{player.pontos}</td>
                      <td className="py-3 px-4 text-center">{player.vitorias}</td>
                      <td className="py-3 px-4 text-center">{player.derrotas}</td>
                      <td className="py-3 px-4 text-center">{player.golsPro}</td>
                      <td className="py-3 px-4 text-center">{player.golsContra}</td>
                      <td className="py-3 px-4 text-center">{player.saldoGols}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RankingPage; 