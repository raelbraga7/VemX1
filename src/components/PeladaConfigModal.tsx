'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';

interface PeladaConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (peladaId: string) => void;
  peladaId?: string;
}

const coresPadrao = [
  '#1d4ed8', // Azul
  '#dc2626', // Vermelho
  '#16a34a', // Verde
  '#ca8a04', // Amarelo
  '#9333ea', // Roxo
  '#ff7600', // Laranja
  '#be123c', // Rosa
  '#78350f'  // Marrom
];

export default function PeladaConfigModal({ isOpen, onClose, onSave, peladaId }: PeladaConfigModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('pelada');
  const [quantidadeTimes, setQuantidadeTimes] = useState(6);
  const [jogadoresPorTime, setJogadoresPorTime] = useState(15);
  const [coresTimes, setCoresTimes] = useState<string[]>(coresPadrao.slice(0, 6));
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [peladaOriginal, setPeladaOriginal] = useState<{
    quantidadeTimes?: number;
    jogadoresPorTime?: number;
    coresTimes?: string[];
    players?: string[];
    ranking?: Record<string, any>;
    confirmados?: Array<any>;
  } | null>(null);

  // Carrega os dados iniciais da pelada
  useEffect(() => {
    if (!peladaId || !isOpen) return;

    const carregarPelada = async () => {
      try {
        setLoadingData(true);
        const peladaRef = doc(db, 'peladas', peladaId);
        const peladaDoc = await getDoc(peladaRef);
        
        if (!peladaDoc.exists()) {
          throw new Error('Pelada não encontrada');
        }
        
        const peladaData = peladaDoc.data();
        setPeladaOriginal(peladaData);
        
        // Configura os campos do formulário com os valores atuais
        setQuantidadeTimes(peladaData.quantidadeTimes || 6);
        setJogadoresPorTime(peladaData.jogadoresPorTime || 15);
        setCoresTimes(peladaData.coresTimes || coresPadrao.slice(0, 6));
        
        console.log('Dados da pelada carregados com sucesso:', {
          quantidadeTimes: peladaData.quantidadeTimes,
          jogadoresPorTime: peladaData.jogadoresPorTime,
          totalPlayers: peladaData.players?.length,
          totalRanking: Object.keys(peladaData.ranking || {}).length,
          totalConfirmados: peladaData.confirmados?.length
        });
      } catch (err) {
        console.error('Erro ao carregar dados da pelada:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados da pelada');
      } finally {
        setLoadingData(false);
      }
    };
    
    carregarPelada();
  }, [peladaId, isOpen]);

  const handleQuantidadeTimesChange = (value: number) => {
    setQuantidadeTimes(value);
    if (value > coresTimes.length) {
      setCoresTimes([...coresTimes, ...coresPadrao.slice(coresTimes.length, value)]);
    } else {
      setCoresTimes(coresTimes.slice(0, value));
    }
  };

  const handleCorChange = (index: number, cor: string) => {
    const novasCores = [...coresTimes];
    novasCores[index] = cor;
    setCoresTimes(novasCores);
  };

  const handleSalvar = async () => {
    if (!peladaId || !peladaOriginal) {
      setError('Dados da pelada não encontrados');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Salvando configurações da pelada:', peladaId);
      
      // Obter referência direta ao documento
      const peladaRef = doc(db, 'peladas', peladaId);
      
      // IMPORTANTE: Atualizar apenas os campos específicos de configuração
      // Não tocar nos arrays de players, confirmados ou no objeto ranking
      await updateDoc(peladaRef, {
        quantidadeTimes,
        jogadoresPorTime,
        coresTimes: coresTimes.slice(0, quantidadeTimes),
        updatedAt: new Date().toISOString()
      });
      
      console.log('Configurações salvas com sucesso');
      
      // Fecha o modal e notifica o componente pai
      toast.success('Configurações salvas com sucesso!');
      onClose();
      onSave(peladaId);
      
      // Redireciona para a página de confirmação em vez do dashboard
      router.push(`/pelada/${peladaId}/confirmar`);
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar configurações');
      toast.error('Erro ao salvar configurações. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-70 transition-opacity"></div>
      
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="relative bg-white rounded-lg w-full max-w-md mx-auto shadow-xl overflow-hidden">
          {/* Cabeçalho com abas */}
          <div className="flex w-full">
            <button
              className={`flex-1 py-3 text-center transition-colors ${
                activeTab === 'pelada' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setActiveTab('pelada')}
            >
              PELADA
            </button>
            <button
              className={`flex-1 py-3 text-center transition-colors ${
                activeTab === 'time' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setActiveTab('time')}
            >
              TIME
            </button>
          </div>

          <div className="p-6">
            {loadingData ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Campo: Quantidade de Times */}
                <div>
                  <label htmlFor="quantidadeTimes" className="block text-sm text-gray-700 mb-2">
                    Quantidade de Times
                  </label>
                  <select
                    id="quantidadeTimes"
                    value={quantidadeTimes}
                    onChange={(e) => handleQuantidadeTimesChange(Number(e.target.value))}
                    className="block w-full border border-gray-300 rounded-md py-2 px-3 bg-white text-gray-900"
                  >
                    {[2, 3, 4, 5, 6, 7, 8].map(num => (
                      <option key={num} value={num}>{num} times</option>
                    ))}
                  </select>
                </div>

                {/* Campo: Jogadores por Time */}
                <div>
                  <label htmlFor="jogadoresPorTime" className="block text-sm text-gray-700 mb-2">
                    Jogadores por Time
                  </label>
                  <select
                    id="jogadoresPorTime"
                    value={jogadoresPorTime}
                    onChange={(e) => setJogadoresPorTime(Number(e.target.value))}
                    className="block w-full border border-gray-300 rounded-md py-2 px-3 bg-white text-gray-900"
                  >
                    {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(num => (
                      <option key={num} value={num}>{num} jogadores</option>
                    ))}
                  </select>
                </div>

                {/* Cores dos Times */}
                <div>
                  <label className="block text-sm text-gray-700 mb-3">
                    Cores dos Times
                  </label>
                  <div className="flex justify-center space-x-4">
                    {coresTimes.slice(0, quantidadeTimes).map((cor, index) => (
                      <div 
                        key={index} 
                        className="w-10 h-10 rounded-full cursor-pointer" 
                        style={{ backgroundColor: cor }}
                        onClick={() => {
                          // Abre o seletor de cores nativo do navegador
                          const input = document.createElement('input');
                          input.type = 'color';
                          input.value = cor;
                          input.addEventListener('input', (e) => {
                            // @ts-expect-error - Evento de input pode não ter o tipo adequado
                            handleCorChange(index, e.target.value);
                          });
                          input.click();
                        }}
                      />
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="text-red-600 text-sm">
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* Botões de ação */}
            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvar}
                disabled={loading || loadingData}
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 