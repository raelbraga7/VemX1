'use client';

import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { auth } from '@/firebase/config';
import { criarPelada } from '@/firebase/peladaService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useRouter } from 'next/navigation';

interface PeladaConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (peladaId: string) => void;
  mode?: 'create' | 'configure';
  peladaId?: string;
}

const coresPadrao = [
  '#1d4ed8', // Azul
  '#dc2626', // Vermelho
  '#16a34a', // Verde
  '#ca8a04', // Amarelo
  '#9333ea', // Roxo
  '#0891b2', // Ciano
  '#be123c', // Rosa
  '#78350f'  // Marrom
];

export default function PeladaConfigModal({ isOpen, onClose, onSave, mode = 'create', peladaId }: PeladaConfigModalProps) {
  const router = useRouter();
  const [nomePelada, setNomePelada] = useState('');
  const [quantidadeTimes, setQuantidadeTimes] = useState(2);
  const [jogadoresPorTime, setJogadoresPorTime] = useState(5);
  const [coresTimes, setCoresTimes] = useState<string[]>(coresPadrao.slice(0, 2));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleQuantidadeTimesChange = (value: number) => {
    setQuantidadeTimes(value);
    if (value > coresTimes.length) {
      setCoresTimes([...coresTimes, ...coresPadrao.slice(coresTimes.length, value)]);
    } else {
      setCoresTimes(coresTimes.slice(0, value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!auth.currentUser) {
        throw new Error('Usuário não autenticado');
      }

      if (mode === 'create') {
        if (!nomePelada.trim()) {
          throw new Error('Nome da pelada é obrigatório');
        }

        // Criação de nova pelada
        const peladaData = {
          nome: nomePelada,
          descricao: '',
          ownerId: auth.currentUser.uid,
          players: [auth.currentUser.uid],
          ranking: {},
          createdAt: new Date(),
          quantidadeTimes,
          jogadoresPorTime,
          coresTimes: coresTimes.slice(0, quantidadeTimes),
          confirmados: []
        };

        const novoPeladaId = await criarPelada(peladaData);
        
        // Limpamos os campos
        setNomePelada('');
        setQuantidadeTimes(2);
        setJogadoresPorTime(5);
        setCoresTimes(coresPadrao.slice(0, 2));
        
        onClose();
        onSave(novoPeladaId);
      } else {
        // Atualização de pelada existente
        if (!peladaId) {
          throw new Error('ID da pelada não fornecido');
        }

        const peladaRef = doc(db, 'peladas', peladaId);
        
        // Atualiza apenas os campos de configuração
        const updates = {
          quantidadeTimes,
          jogadoresPorTime,
          coresTimes: coresTimes.slice(0, quantidadeTimes)
        };

        await updateDoc(peladaRef, updates);
        onClose();
        onSave(peladaId);
        
        // Redireciona para a página de confirmação
        router.push(`/pelada/${peladaId}/confirmar`);
      }
    } catch (err) {
      console.error('Erro ao salvar pelada:', err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar pelada');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black bg-opacity-50" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
          <Dialog.Title
            as="h3"
            className="text-lg font-medium leading-6 text-gray-900"
          >
            {mode === 'create' ? 'Criar Nova Pelada' : 'Configurar Pelada'}
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="mt-4">
            <div className="space-y-4">
              {mode === 'create' && (
                <div>
                  <label htmlFor="nomePelada" className="block text-sm font-medium text-gray-700">
                    Nome da Pelada
                  </label>
                  <input
                    type="text"
                    id="nomePelada"
                    value={nomePelada}
                    onChange={(e) => setNomePelada(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Ex: Pelada do Sábado"
                    required
                  />
                </div>
              )}

              <div>
                <label htmlFor="quantidadeTimes" className="block text-sm font-medium text-gray-900 mb-1">
                  Quantidade de Times
                </label>
                <select
                  id="quantidadeTimes"
                  value={quantidadeTimes}
                  onChange={(e) => handleQuantidadeTimesChange(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white"
                >
                  {[2, 3, 4, 5, 6, 7, 8].map(num => (
                    <option key={num} value={num}>{num} times</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="jogadoresPorTime" className="block text-sm font-medium text-gray-900 mb-1">
                  Jogadores por Time
                </label>
                <select
                  id="jogadoresPorTime"
                  value={jogadoresPorTime}
                  onChange={(e) => setJogadoresPorTime(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white"
                >
                  {[3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <option key={num} value={num}>{num} jogadores</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Cores dos Times
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {coresTimes.map((cor, index) => (
                    <div key={index} className="relative">
                      <input
                        type="color"
                        value={cor}
                        onChange={(e) => {
                          const novasCores = [...coresTimes];
                          novasCores[index] = e.target.value;
                          setCoresTimes(novasCores);
                        }}
                        className="w-full h-8 rounded cursor-pointer"
                      />
                      <span className="block text-xs text-center mt-1 text-gray-900">Time {index + 1}</span>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 mt-2">
                  {error}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
} 