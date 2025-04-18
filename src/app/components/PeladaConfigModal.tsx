'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/firebase/config';
import { criarPelada } from '@/firebase/peladaService';
import { createPeladaNotification } from '@/firebase/notificationService';

interface Jogador {
  nome: string;
  dataConfirmacao: string;
}

interface PeladaConfig {
  quantidadeTimes: number;
  jogadoresPorTime: number;
  coresTimes: string[];
  confirmados: Jogador[];
  dataCriacao: string;
}

interface PeladaConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: PeladaConfig) => void;
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

export default function PeladaConfigModal({ isOpen, onClose, onSave }: PeladaConfigModalProps) {
  const router = useRouter();
  const [quantidadeTimes, setQuantidadeTimes] = useState(2);
  const [jogadoresPorTime, setJogadoresPorTime] = useState(5);
  const [coresTimes, setCoresTimes] = useState<string[]>(coresPadrao.slice(0, 2));
  const [linkGerado, setLinkGerado] = useState('');
  const [copiado, setCopiado] = useState(false);

  const handleQuantidadeTimesChange = (value: number) => {
    setQuantidadeTimes(value);
    if (value > coresTimes.length) {
      setCoresTimes([...coresTimes, ...coresPadrao.slice(coresTimes.length, value)]);
    } else {
      setCoresTimes(coresTimes.slice(0, value));
    }
  };

  const gerarLink = async () => {
    try {
      if (!auth.currentUser) {
        throw new Error('Usuário não autenticado');
      }

      // Primeiro criamos a pelada no Firebase
      const peladaData = {
        nome: `Pelada ${new Date().toLocaleDateString()}`,
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

      // Criamos a notificação
      if (auth.currentUser.uid) {
        await createPeladaNotification(
          auth.currentUser.uid,
          novoPeladaId,
          'Nova Pelada Criada',
          'Você criou uma nova pelada. Configure e compartilhe com seus amigos!'
        ).catch(err => console.error('Erro ao criar notificação:', err));
      }

      // Salvamos a configuração local
      const config = {
        quantidadeTimes,
        jogadoresPorTime,
        coresTimes,
        confirmados: [],
        dataCriacao: new Date().toISOString()
      };

      localStorage.setItem(`pelada_${novoPeladaId}`, JSON.stringify(config));
      onSave(config);
      
      const link = `${window.location.origin}/pelada/${novoPeladaId}`;
      setLinkGerado(link);
      
      // Redireciona para a página de confirmação
      await router.push(`/pelada/${novoPeladaId}?showModal=true`);
    } catch (error) {
      console.error('Erro ao gerar link:', error);
      alert('Erro ao criar pelada. Tente novamente.');
    }
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkGerado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  const compartilharWhatsApp = () => {
    const texto = `Confirme sua presença na pelada: ${linkGerado}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-6">
        <h2 className="text-xl font-bold text-[#0d1b2a]">Configuração da Pelada</h2>

        {!linkGerado ? (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#0d1b2a] mb-2">
                  Quantidade de Times
                </label>
                <select
                  value={quantidadeTimes}
                  onChange={(e) => handleQuantidadeTimesChange(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1d4ed8] focus:border-transparent"
                >
                  <option value={2}>2 Times</option>
                  <option value={3}>3 Times</option>
                  <option value={4}>4 Times</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0d1b2a] mb-2">
                  Jogadores por Time
                </label>
                <input
                  type="number"
                  min={3}
                  max={11}
                  value={jogadoresPorTime}
                  onChange={(e) => setJogadoresPorTime(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1d4ed8] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0d1b2a] mb-2">
                  Cores dos Times
                </label>
                <div className="flex flex-wrap gap-2">
                  {coresTimes.map((cor, index) => (
                    <div
                      key={index}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
                      style={{ backgroundColor: cor }}
                    >
                      {index + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={gerarLink}
                className="flex-1 px-4 py-2 bg-[#1d4ed8] text-white rounded-lg hover:bg-[#1d4ed8]/90 transition-colors"
              >
                Gerar Link
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="p-3 bg-gray-50 rounded-lg break-all">
              <p className="text-sm text-gray-600">{linkGerado}</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={copiarLink}
                className="w-full px-4 py-2 bg-[#1d4ed8] text-white rounded-lg hover:bg-[#1d4ed8]/90 transition-colors"
              >
                {copiado ? 'Link Copiado!' : 'Copiar Link'}
              </button>
              
              <button
                onClick={compartilharWhatsApp}
                className="w-full px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#25D366]/90 transition-colors"
              >
                Compartilhar no WhatsApp
              </button>

              <button
                onClick={onClose}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 