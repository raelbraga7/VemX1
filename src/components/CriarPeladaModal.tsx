import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { auth } from '@/firebase/config';
import { criarPelada } from '@/firebase/peladaService';
import { createUser } from '@/firebase/userService';

interface CriarPeladaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (peladaId: string) => void;
}

export default function CriarPeladaModal({ isOpen, onClose, onSuccess }: CriarPeladaModalProps) {
  const [nomePelada, setNomePelada] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Refresh de autenticação quando o modal abrir
  useEffect(() => {
    if (isOpen && auth.currentUser) {
      const refreshToken = async () => {
        try {
          await auth.currentUser?.getIdToken(true);
          console.log('Token de autenticação renovado');
        } catch (error) {
          console.warn('Erro ao renovar token:', error);
        }
      };
      
      refreshToken();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!auth.currentUser) {
        throw new Error('Usuário não autenticado. Por favor, faça login novamente.');
      }

      if (!nomePelada.trim()) {
        throw new Error('Nome da pelada é obrigatório');
      }
      
      // Tentar atualizar o token mais uma vez
      try {
        await auth.currentUser.getIdToken(true);
      } catch (tokenError) {
        console.warn('Alerta: Erro ao renovar token antes de criar pelada:', tokenError);
        // Continua mesmo com erro no token
      }
      
      // Garantir que o usuário tenha um registro no Firestore
      try {
        // Criar ou atualizar documento do usuário
        const { uid, displayName, email } = auth.currentUser;
        const userName = displayName || email?.split('@')[0] || 'Usuário';
        await createUser(
          uid,
          userName,
          email || '',
          undefined
        );
        console.log('Perfil do usuário verificado/atualizado no Firestore');
      } catch (userError) {
        console.error('Erro ao verificar/atualizar perfil do usuário:', userError);
        // Continua mesmo com erro no perfil
      }

      // Cria a pelada com configurações padrão
      const peladaData = {
        nome: nomePelada.trim(),
        descricao: '',
        ownerId: auth.currentUser.uid,
        players: [auth.currentUser.uid],
        ranking: {
          [auth.currentUser.uid]: {
            jogos: 0,
            vitorias: 0,
            derrotas: 0,
            empates: 0,
            gols: 0,
            assistencias: 0,
            pontos: 0,
            nome: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Usuário'
          }
        },
        createdAt: new Date(),
        quantidadeTimes: 2,
        jogadoresPorTime: 5,
        coresTimes: ['#1d4ed8', '#dc2626'], // Azul e Vermelho como padrão
        confirmados: []
      };

      const novoPeladaId = await criarPelada(peladaData);
      
      // Limpa o campo e fecha a modal
      setNomePelada('');
      onClose();
      
      // Chama o callback de sucesso se existir
      if (onSuccess) {
        onSuccess(novoPeladaId);
      }
    } catch (err) {
      console.error('Erro ao criar pelada:', err);
      if (err instanceof Error && err.message.includes('não autenticado')) {
        setError('Sessão expirada. Por favor, faça logout e login novamente.');
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao criar pelada. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black bg-opacity-50" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
          <Dialog.Title
            as="h3"
            className="text-lg font-medium leading-6 text-gray-900"
          >
            Criar Nova Pelada
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="mt-4">
            <div className="space-y-4">
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

              {error && (
                <div className="text-sm text-red-600">
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
                {loading ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
} 