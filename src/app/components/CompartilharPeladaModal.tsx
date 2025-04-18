'use client';

import { useState } from 'react';

interface CompartilharPeladaModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: {
    quantidadeTimes: number;
    jogadoresPorTime: number;
    coresTimes: string[];
  };
}

export default function CompartilharPeladaModal({ isOpen, onClose, config }: CompartilharPeladaModalProps) {
  const [linkGerado, setLinkGerado] = useState('');
  const [copiado, setCopiado] = useState(false);

  const gerarLink = () => {
    // Gera um ID único para a pelada (simulado por enquanto)
    const id = Math.random().toString(36).substring(2, 8);
    const link = `https://vemx1.app/pelada/${id}`;
    
    // Salva a configuração no localStorage
    localStorage.setItem(`pelada_${id}`, JSON.stringify({
      ...config,
      confirmados: [],
      dataCriacao: new Date().toISOString()
    }));
    
    setLinkGerado(link);
  };

  const compartilharWhatsApp = () => {
    const texto = `Confirma tua presença na pelada! 👉 ${linkGerado}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#0d1b2a]">Compartilhar Pelada</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Informações da Pelada */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-[#0d1b2a] mb-2">Configuração</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• {config.quantidadeTimes} times</li>
              <li>• {config.jogadoresPorTime} jogadores por time</li>
              <li>• {config.quantidadeTimes * config.jogadoresPorTime} jogadores no total</li>
            </ul>
          </div>

          {!linkGerado ? (
            <button
              onClick={gerarLink}
              className="w-full px-4 py-3 bg-[#1d4ed8] text-white rounded-lg hover:bg-[#1d4ed8]/90 transition-colors font-medium"
            >
              Gerar Link da Pelada
            </button>
          ) : (
            <div className="space-y-4">
              {/* Link Gerado */}
              <div className="relative">
                <input
                  type="text"
                  value={linkGerado}
                  readOnly
                  className="w-full p-3 pr-24 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-sm"
                />
                <button
                  onClick={copiarLink}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-sm text-[#1d4ed8] hover:bg-gray-100 rounded"
                >
                  {copiado ? 'Copiado!' : 'Copiar'}
                </button>
              </div>

              {/* Botão WhatsApp */}
              <button
                onClick={compartilharWhatsApp}
                className="w-full px-4 py-3 bg-[#25D366] text-white rounded-lg hover:bg-[#25D366]/90 transition-colors font-medium flex items-center justify-center space-x-2"
              >
                <span>Compartilhar no WhatsApp</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 