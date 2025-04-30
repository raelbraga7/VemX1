import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { useParams } from 'next/navigation';

const RankingPage: React.FC = () => {
  const params = useParams();
  const [ranking, setRanking] = useState<RankingPlayer[]>([]);
  const [peladaData, setPeladaData] = useState<PeladaData | null>(null);
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
            
            setPeladaData({
              ...data,
              id: params.id as string
            });
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
    <div>
      {/* Renderização do componente com base nos estados */}
    </div>
  );
};

export default RankingPage; 