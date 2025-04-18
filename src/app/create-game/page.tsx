'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addGame } from '@/firebase/gameService';

export default function CreateGame() {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleCreateGame = async () => {
    // Validação dos campos
    if (!title.trim() || !date || !location.trim()) {
      setError('Por favor, preencha todos os campos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const gameData = {
        title: title.trim(),
        date,
        location: location.trim(),
      };

      const gameId = await addGame(gameData);
      console.log('Partida criada com sucesso:', gameId);
      
      // Mostrar mensagem de sucesso e redirecionar
      router.push('/dashboard');
    } catch (error) {
      console.error('Erro ao criar partida:', error);
      setError('Erro ao criar partida. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Criar Nova Partida</h2>
          <p className="mt-2 text-sm text-gray-600">
            Preencha os detalhes da partida abaixo
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow rounded-lg">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Título da Partida
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#4339CA] focus:border-[#4339CA] sm:text-sm"
                placeholder="Ex: Pelada de Sábado"
              />
            </div>

            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                Data
              </label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#4339CA] focus:border-[#4339CA] sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                Local
              </label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#4339CA] focus:border-[#4339CA] sm:text-sm"
                placeholder="Ex: Quadra Principal"
              />
            </div>

            <div className="flex items-center justify-between space-x-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4339CA]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateGame}
                disabled={loading}
                className="flex-1 bg-[#4339CA] py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4339CA] disabled:opacity-50"
              >
                {loading ? 'Criando...' : 'Criar Partida'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 