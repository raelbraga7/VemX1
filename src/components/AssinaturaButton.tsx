import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';

export function AssinaturaButton() {
  const { user } = useUser();
  const [statusAssinatura, setStatusAssinatura] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlanosModalOpen, setIsPlanosModalOpen] = useState(false);
  const [isCancelarModalOpen, setIsCancelarModalOpen] = useState(false);
  
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    // Observer em tempo real para o documento do usuário
    const unsubscribe = onSnapshot(doc(db, 'usuarios', user.uid), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const userData = docSnapshot.data();
        setStatusAssinatura(userData.statusAssinatura);
      }
      setLoading(false);
    }, (error) => {
      console.error('Erro ao observar documento do usuário:', error);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [user]);
  
  const handleAssinatura = () => {
    if (statusAssinatura === 'ativa' || statusAssinatura === 'teste') {
      // Abrir modal com instruções para cancelamento
      setIsCancelarModalOpen(true);
    } else {
      // Abrir modal de assinatura 
      setIsPlanosModalOpen(true);
    }
  };
  
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
          statusAssinatura === 'ativa' || statusAssinatura === 'teste' 
            ? 'bg-red-600' 
            : 'bg-blue-600'
        } text-white`}
      >
        {statusAssinatura === 'ativa' || statusAssinatura === 'teste' 
          ? 'Cancelar Assinatura' 
          : 'Assinatura'}
      </button>
      
      {/* Modal de Planos */}
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

      {/* Modal de Cancelamento */}
      {isCancelarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-black text-white rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 text-center">
              <h2 className="text-2xl font-bold mb-4">Cancelar Assinatura</h2>
              
              <div className="text-left mb-6">
                <p className="mb-4">Para cancelar sua assinatura do VemX1, siga estes passos na Hotmart:</p>
                
                <ol className="list-decimal pl-5 mb-6 space-y-2">
                  <li>Acesse a Hotmart em <strong>app.hotmart.com</strong></li>
                  <li>Clique em <strong>Menu</strong> no canto superior esquerdo</li>
                  <li>Selecione <strong>Minhas Compras</strong></li>
                  <li>Encontre sua assinatura do VemX1</li>
                  <li>Clique em <strong>Gerenciar assinatura</strong></li>
                  <li>Selecione <strong>Cancelar assinatura</strong></li>
                  <li>Siga as instruções para finalizar o cancelamento</li>
                </ol>
                
                <p className="text-sm mb-4">
                  Após o cancelamento, você continuará com acesso até o final do período já pago.
                </p>
              </div>
              
              <div className="flex justify-center space-x-4">
                <button 
                  onClick={() => window.open('https://app.hotmart.com/buyer/assinaturas', '_blank')}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Ir para Hotmart
                </button>
                
                <button 
                  onClick={() => setIsCancelarModalOpen(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 