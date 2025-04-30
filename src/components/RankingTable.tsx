'use client';

import { useState, useEffect } from 'react';
import { PlayerStats, getUserById } from '@/firebase/rankingService';
import { useUser } from '@/contexts/UserContext';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Dialog, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// Estendendo a interface PlayerStats para nosso componente
interface PlayerStatsExtended extends PlayerStats {
  jogos?: number;
  derrotas?: number;
  empates?: number;
}

interface RankingData {
  nome: string;
  vitorias: number;
  gols: number;
  assistencias: number;
  pontos: number;
  jogos: number;
  derrotas: number;
  empates: number;
}

interface PeladaDoc {
  ownerId: string;
  players: string[];
  ranking: {
    [key: string]: RankingData;
  };
  rankingTimes?: {
    [key: string]: {
      id: string;
      nome: string;
      vitorias: number;
      derrotas: number;
      golsPro: number;
      golsContra: number;
      saldoGols: number;
      pontos: number;
    }
  };
}

interface RankingTableProps {
  peladaId: string;
}

interface TimeRanking {
  id: string;
  nome: string;
  vitorias: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  saldoGols: number;
  pontos: number;
}

export default function RankingTable({ peladaId }: RankingTableProps) {
  const [ranking, setRanking] = useState<PlayerStatsExtended[]>([]);
  const [rankingTimes, setRankingTimes] = useState<TimeRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useUser();
  const [modalAberta, setModalAberta] = useState(false);
  const [jogadorDetalhes, setJogadorDetalhes] = useState<RankingData | null>(null);
  const [tipoRanking, setTipoRanking] = useState<'pelada' | 'times'>('pelada');

  useEffect(() => {
    if (!peladaId || !user) return;

    console.log('Iniciando busca do ranking para pelada:', peladaId);
    const peladaRef = doc(db, 'peladas', peladaId);
    
    const unsubscribe = onSnapshot(peladaRef, async (docSnapshot) => {
      try {
        if (docSnapshot.exists()) {
          const peladaData = docSnapshot.data() as PeladaDoc;
          console.log('Dados da pelada:', peladaData);

          // Garante que o ranking existe
          const rankingAtualizado = peladaData.ranking || {};
          let precisaAtualizar = false;

          // Garante que todos os jogadores estão no ranking
          // Usamos um Set para combinar jogadores da lista de players e do ranking
          const jogadoresUnicos = new Set<string>();
          
          // Adiciona jogadores da lista de players
          if (peladaData.players) {
            peladaData.players.forEach(playerId => jogadoresUnicos.add(playerId));
          }
          
          // Adiciona jogadores do ranking
          if (peladaData.ranking) {
            Object.keys(peladaData.ranking).forEach(playerId => jogadoresUnicos.add(playerId));
          }
          
          console.log('Jogadores únicos:', Array.from(jogadoresUnicos));

          for (const playerId of jogadoresUnicos) {
            if (!rankingAtualizado[playerId]) {
              const playerData = await getUserById(playerId);
              console.log('Dados do jogador:', playerId, playerData);
              
              if (playerData) {
                rankingAtualizado[playerId] = {
                  nome: playerData.nome,
                  jogos: 0,
                  vitorias: 0,
                  derrotas: 0,
                  empates: 0,
                  gols: 0,
                  assistencias: 0,
                  pontos: 0
                };
                precisaAtualizar = true;
              }
            }
          }

          // Atualiza o Firestore se necessário
          if (precisaAtualizar) {
            console.log('Atualizando ranking no Firestore:', rankingAtualizado);
            await updateDoc(peladaRef, {
              ranking: rankingAtualizado
            });
          }

          // Converte o ranking para array e ordena
          const rankingArray = Object.entries(rankingAtualizado).map(([uid, data]) => ({
            uid,
            nome: data.nome || 'Jogador',
            vitorias: data.vitorias || 0,
            gols: data.gols || 0,
            assistencias: data.assistencias || 0,
            pontos: data.pontos || 0,
            jogos: data.jogos || 0,
            derrotas: data.derrotas || 0,
            empates: data.empates || 0
          })).sort((a, b) => b.pontos - a.pontos);

          console.log('Ranking processado:', rankingArray);
          setRanking(rankingArray);

          // Processa o ranking de times
          if (peladaData.rankingTimes) {
            const rankingTimesArray = Object.entries(peladaData.rankingTimes)
              .filter(([, data]) => data !== null) // Filtra times removidos
              .map(([timeId, data]) => ({
                id: timeId,
                nome: data.nome || `Time ${timeId.substring(0, 4)}`,
                vitorias: data.vitorias || 0,
                derrotas: data.derrotas || 0,
                golsPro: data.golsPro || 0,
                golsContra: data.golsContra || 0,
                saldoGols: data.saldoGols || 0,
                pontos: data.pontos || 0
              }))
              .sort((a, b) => b.pontos - a.pontos || b.saldoGols - a.saldoGols);
            
            console.log('Ranking de times processado:', rankingTimesArray);
            setRankingTimes(rankingTimesArray);
          } else {
            setRankingTimes([]);
          }

          setLoading(false);
        } else {
          console.log('Documento da pelada não existe');
          setError('Pelada não encontrada');
          setLoading(false);
        }
      } catch (err) {
        console.error('Erro ao atualizar ranking:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar ranking');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [peladaId, user]);

  const handleAbrirCartaJogador = (player: PlayerStatsExtended) => {
    // Criar um objeto com todos os detalhes para a carta
    setJogadorDetalhes({
      nome: player.nome,
      vitorias: player.vitorias,
      gols: player.gols,
      assistencias: player.assistencias,
      pontos: player.pontos,
      jogos: player.jogos || 0,
      derrotas: player.derrotas || 0,
      empates: player.empates || 0
    });
    setModalAberta(true);
  };

  const handleFecharModal = () => {
    setModalAberta(false);
    setJogadorDetalhes(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 p-4 text-center">
        Erro ao carregar ranking: {error}
      </div>
    );
  }

  if (!ranking || ranking.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Nenhum jogador encontrado no ranking</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-black rounded-lg overflow-hidden shadow-lg">
        {/* Botões de alternância entre rankings */}
        <div className="flex border-b border-[#2c3a4f] bg-[#141e33]">
          <button
            onClick={() => setTipoRanking('pelada')}
            className={`py-4 px-6 font-semibold text-sm relative transition-colors ${
              tipoRanking === 'pelada' 
                ? 'text-blue-400' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            RANKING PELADA
            {tipoRanking === 'pelada' && (
              <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500"></div>
            )}
          </button>
          <button
            onClick={() => setTipoRanking('times')}
            className={`py-4 px-6 font-semibold text-sm relative transition-colors ${
              tipoRanking === 'times' 
                ? 'text-blue-400' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            RANKING TIMES
            {tipoRanking === 'times' && (
              <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500"></div>
            )}
          </button>
        </div>

        {/* Conteúdo do Ranking baseado no tipo selecionado */}
        {tipoRanking === 'pelada' ? (
          // Tabela de Ranking de Pelada
          <div className="w-full overflow-hidden bg-[#141e33] text-white">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[#2c3a4f]">
                    <th scope="col" className="sticky left-0 bg-[#141e33] px-3 py-3.5 text-left text-xs font-semibold text-gray-400 sm:pl-6 w-16">
                      #
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-400">
                      JOGADOR
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold text-gray-400">
                      V
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold text-gray-400">
                      G
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold text-gray-400">
                      A
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold text-gray-400">
                      PTS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2c3a4f] bg-[#141e33]">
                  {ranking.map((player, index) => (
                    <tr 
                      key={player.uid} 
                      className="hover:bg-[#1a2747] cursor-pointer"
                      onClick={() => handleAbrirCartaJogador(player)}
                    >
                      <td className="sticky left-0 bg-[#141e33] whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-6">
                        <div className="flex items-center">
                          <span className="text-gray-400 font-semibold">{index + 1}º</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-white">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center mr-3 text-white font-bold">
                            {player.nome.charAt(0).toUpperCase()}
                          </div>
                          {player.nome}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-white">
                        {player.vitorias}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-white">
                        {player.gols}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-white">
                        {player.assistencias}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-center font-semibold text-white">
                        {player.pontos?.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          // Tabela de Ranking de Times
          <div className="w-full overflow-hidden bg-[#141e33] text-white">
            {rankingTimes.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                Nenhum time foi adicionado ainda
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-[#2c3a4f]">
                      <th scope="col" className="sticky left-0 bg-[#141e33] px-3 py-3.5 text-left text-xs font-semibold text-gray-400 sm:pl-6 w-16">
                        #
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-400">
                        TIME
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold text-gray-400">
                        V
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold text-gray-400">
                        D
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold text-gray-400">
                        GP
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold text-gray-400">
                        GC
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold text-gray-400">
                        SG
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold text-gray-400">
                        PTS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2c3a4f] bg-[#141e33]">
                    {rankingTimes.map((time, index) => (
                      <tr key={time.id} className="hover:bg-[#1a2747]">
                        <td className="sticky left-0 bg-[#141e33] whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-6">
                          <div className="flex items-center">
                            <span className="text-gray-400 font-semibold">{index + 1}º</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-white">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center mr-3 text-white font-bold">
                              T
                            </div>
                            {time.nome}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-white">
                          {time.vitorias}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-white">
                          {time.derrotas}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-white">
                          {time.golsPro}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-white">
                          {time.golsContra}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-white">
                          {time.saldoGols}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center font-semibold text-white">
                          {time.pontos}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal da Carta do Jogador */}
      <Dialog
        open={modalAberta}
        onClose={handleFecharModal}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          style: { 
            borderRadius: '8px', 
            backgroundColor: 'transparent',
            boxShadow: 'none',
            overflow: 'hidden',
            maxWidth: '340px',
            margin: '0 auto'
          }
        }}
      >
        <div className="bg-[#141e33] text-white overflow-hidden rounded-lg shadow-xl">
          {/* Barra superior */}
          <div className="bg-[#4285f4] py-4 px-4 relative">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="text-5xl font-bold tracking-tight">
                  {jogadorDetalhes ? (jogadorDetalhes.pontos || 0).toFixed(1) : '0.0'}
                </div>
                <div className="bg-[#f8a200] text-white px-3 py-1 rounded-md relative ml-1">
                  <span className="font-bold text-base">MEI</span>
                  <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs px-1 rounded-md transform rotate-12 font-bold">
                    PRO
                  </div>
                </div>
              </div>
              <IconButton 
                edge="end" 
                size="small"
                onClick={handleFecharModal} 
                aria-label="fechar"
                sx={{ color: 'white' }}
              >
                <CloseIcon />
              </IconButton>
            </div>
          </div>
          
          {jogadorDetalhes && (
            <div className="p-5 pb-6">
              {/* Avatar e Nome */}
              <div className="flex flex-col items-center mb-8 mt-5">
                <div className="w-20 h-20 bg-[#4285f4] rounded-full flex items-center justify-center text-white text-4xl font-bold border-2 border-yellow-400 mb-4">
                  {jogadorDetalhes.nome.charAt(0).toUpperCase()}
                </div>
                <h2 className="text-2xl font-bold text-white uppercase tracking-wide">
                  {jogadorDetalhes.nome}
                </h2>
              </div>

              {/* Estatísticas principais - primeira linha */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-[#1a2747] rounded-lg py-3 px-2 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-yellow-400">{jogadorDetalhes.vitorias}</span>
                  <span className="text-xs text-gray-400 mt-1">VIT</span>
                </div>
                
                <div className="bg-[#1a2747] rounded-lg py-3 px-2 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-yellow-400">{jogadorDetalhes.gols}</span>
                  <span className="text-xs text-gray-400 mt-1">GOL</span>
                </div>

                <div className="bg-[#1a2747] rounded-lg py-3 px-2 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-yellow-400">{jogadorDetalhes.assistencias}</span>
                  <span className="text-xs text-gray-400 mt-1">ASS</span>
                </div>
              </div>

              {/* Estatísticas principais - segunda linha */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-[#1a2747] rounded-lg py-3 px-2 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-yellow-400">{jogadorDetalhes.jogos}</span>
                  <span className="text-xs text-gray-400 mt-1">JGS</span>
                </div>
                
                <div className="bg-[#1a2747] rounded-lg py-3 px-2 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-yellow-400">
                    {jogadorDetalhes.jogos > 0 
                      ? Math.round((jogadorDetalhes.vitorias / jogadorDetalhes.jogos) * 100)
                      : 0}
                  </span>
                  <span className="text-xs text-gray-400 mt-1">VIT%</span>
                </div>

                <div className="bg-[#1a2747] rounded-lg py-3 px-2 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-yellow-400">{(jogadorDetalhes.pontos || 0).toFixed(1)}</span>
                  <span className="text-xs text-gray-400 mt-1">PTS</span>
                </div>
              </div>

              {/* Rodapé */}
              <div className="flex justify-between items-center">
                <div className="text-yellow-400">
                  {/* Lógica para exibir número de estrelas baseado na pontuação */}
                  {jogadorDetalhes.pontos < 20 ? (
                    <span className="text-3xl">★</span>
                  ) : jogadorDetalhes.pontos < 40 ? (
                    <span className="text-3xl">★★</span>
                  ) : jogadorDetalhes.pontos < 60 ? (
                    <span className="text-3xl">★★★</span>
                  ) : jogadorDetalhes.pontos < 80 ? (
                    <span className="text-3xl">★★★★</span>
                  ) : (
                    <span className="text-3xl">★★★★★</span>
                  )}
                </div>
                <div className="text-gray-400 text-sm font-light">
                  VEMX1
                </div>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
} 