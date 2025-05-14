import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'react-hot-toast';

interface AssinaturaButtonProps {
  isOwner?: boolean;
}

/**
 * Componente que exibe um botão de assinatura ou cancelamento de assinatura
 * dependendo do status atual do usuário. 
 * Utiliza o contexto do usuário para verificar o status da assinatura.
 */
export function AssinaturaButton({ isOwner = true }: AssinaturaButtonProps) {
  const { user, temAssinaturaAtiva } = useUser();
  const [loading, setLoading] = useState(true);
  const [cancelando, setCancelando] = useState(false);
  const [isPlanosModalOpen, setIsPlanosModalOpen] = useState(false);
  
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    const timer = setTimeout(() => {
      setLoading(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [user]);
  
  const handleAssinatura = async () => {
    if (temAssinaturaAtiva) {
      try {
        setCancelando(true);
        console.log(`Iniciando cancelamento para usuário: ${user?.uid}`);
        
        // Usar o caminho correto para a API
        const apiUrl = '/api/usuario/cancelar-manual';
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user?.uid }),
        });

        const data = await response.json();
        console.log('Resposta do servidor:', data);

        if (response.ok) {
          toast.success('Assinatura cancelada com sucesso!');
        } else {
          console.error('Erro na resposta:', data);
          toast.error(`Erro ao cancelar assinatura: ${data.error || 'Tente novamente'}`);
        }
      } catch (error) {
        console.error('Erro ao cancelar assinatura:', error);
        toast.error('Falha na comunicação com o servidor. Verifique sua conexão.');
      } finally {
        setCancelando(false);
      }
    } else {
      setIsPlanosModalOpen(true);
    }
  };
  
  if (!isOwner || !user) {
    return null;
  }
  
  if (loading) {
    return (
      <button 
        className="bg-gray-400 text-white px-4 py-2 rounded"
        disabled
      >
        Carregando...
      </button>
    );
  }
  
  return (
    <>
      <button 
        onClick={handleAssinatura}
        disabled={cancelando}
        className={`px-4 py-2 rounded ${
          temAssinaturaAtiva
            ? 'bg-red-600 hover:bg-red-700' 
            : 'bg-blue-600 hover:bg-blue-700'
        } text-white disabled:opacity-70 transition-all`}
      >
        {cancelando 
          ? 'Cancelando...' 
          : temAssinaturaAtiva 
            ? 'Cancelar Assinatura' 
            : 'Assinatura'}
      </button>
      
      {isPlanosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-black text-white rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 text-center">
              <h2 className="text-2xl font-bold mb-4">Assine o VemX1</h2>
              
              <div className="bg-black/40 rounded-xl p-6 border-2 border-[#1d4ed8] relative mb-4">
                <div className="absolute top-0 right-0 left-0 bg-[#1d4ed8] text-white py-1 text-sm rounded-t-xl font-bold">
                  Plano VemX1
                </div>
                <div className="text-xl font-bold mb-2 mt-6">Plano Premium</div>
                <div className="text-2xl font-bold mb-2">
                  R$259,99
                  <span className="text-sm text-gray-400">/mês</span>
                </div>
                <ul className="text-left text-sm space-y-2 mb-4">
                  <li className="flex items-center">
                    <span className="text-[#1d4ed8] mr-2 text-xl">✓</span>
                    Jogadores ILIMITADOS
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#1d4ed8] mr-2 text-xl">✓</span>
                    Peladas ILIMITADAS
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#1d4ed8] mr-2 text-xl">✓</span>
                    Estatísticas avançadas
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#1d4ed8] mr-2 text-xl">✓</span>
                    Suporte prioritário
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#1d4ed8] mr-2 text-xl">✓</span>
                    Cancele quando quiser
                  </li>
                </ul>
                <button 
                  onClick={() => window.open('https://pay.hotmart.com/M99700196W?off=r5di19vt', '_blank')}
                  className="bg-[#1d4ed8] hover:bg-[#1d4ed8]/90 text-white px-4 py-3 w-full rounded-lg text-lg font-medium transition-all hover:scale-105"
                >
                  Assinar Agora
                </button>
              </div>
              
              <button 
                onClick={() => setIsPlanosModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 