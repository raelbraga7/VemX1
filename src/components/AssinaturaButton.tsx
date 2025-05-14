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
  const { user, temAssinaturaAtiva, setTemAssinaturaAtiva } = useUser();
  const [loading, setLoading] = useState(true);
  const [isPlanosModalOpen, setIsPlanosModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  
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
  
  // Função para testar cancelamento manual (apenas ambiente de desenvolvimento)
  const handleCancelamentoManual = async () => {
    if (!user?.uid) {
      toast.error('Usuário não identificado');
      return;
    }
    
    setLoading(true);
    try {
      // Obter o host atual para garantir que a API seja chamada no mesmo domínio
      const host = window.location.origin;
      const apiUrl = `${host}/api/usuario/cancelar-manual`;
      
      console.log(`Tentando cancelamento manual via: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.uid }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Resposta de cancelamento:', data);
        toast.success('Assinatura cancelada manualmente com sucesso!');
        
        // Atualiza o estado no contexto do usuário
        if (setTemAssinaturaAtiva) {
          setTemAssinaturaAtiva(false);
        }
        
        setIsTestModalOpen(false);
      } else {
        const errorData = await response.json();
        console.error('Erro no cancelamento:', errorData);
        toast.error(`Falha no cancelamento: ${errorData.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao tentar cancelamento manual:', error);
      toast.error('Erro na comunicação com o servidor');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAssinatura = async () => {
    if (temAssinaturaAtiva) {
      // Em ambiente de desenvolvimento, mostrar opções de teste
      if (isLocalhost) {
        setIsTestModalOpen(true);
        return;
      }
      
      // Em produção, redirecionar para Hotmart
      const hotmartClientURL = 'https://app-vlc.hotmart.com/login';
      
      toast.success(
        'Para cancelar sua assinatura, você será redirecionado para a Hotmart. Faça login e acesse "Minhas Compras" para gerenciar sua assinatura.',
        { duration: 6000 }
      );
      
      setTimeout(() => {
        window.open(hotmartClientURL, '_blank');
      }, 2000);
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
        className={`px-4 py-2 rounded ${
          temAssinaturaAtiva
            ? 'bg-red-600 hover:bg-red-700' 
            : 'bg-blue-600 hover:bg-blue-700'
        } text-white`}
      >
        {temAssinaturaAtiva
          ? 'Cancelar Assinatura' 
          : 'Assinatura'}
      </button>
      
      {/* Modal de assinatura */}
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
      
      {/* Modal de teste de cancelamento (apenas em desenvolvimento) */}
      {isLocalhost && isTestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-gray-800 text-white rounded-xl shadow-xl overflow-hidden">
            <div className="p-6 text-center">
              <h2 className="text-xl font-bold mb-4">Ambiente de Testes - Cancelar Assinatura</h2>
              
              <div className="bg-black/30 p-4 rounded-lg mb-4 text-left">
                <p className="text-yellow-400 font-semibold">⚠️ Atenção:</p>
                <p className="mb-2">Esta função é apenas para testes em ambiente de desenvolvimento.</p>
                <p>Em produção, os usuários devem cancelar pela Hotmart.</p>
              </div>
              
              <div className="flex justify-between mt-6">
                <button 
                  onClick={() => setIsTestModalOpen(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                >
                  Voltar
                </button>
                
                <button 
                  onClick={handleCancelamentoManual}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
                  disabled={loading}
                >
                  {loading ? 'Processando...' : 'Confirmar Cancelamento (Teste)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 