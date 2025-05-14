import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';

interface AssinaturaButtonProps {
  isOwner?: boolean;
}

export function AssinaturaButton({ isOwner = true }: AssinaturaButtonProps) {
  const { user } = useUser();
  const [statusAssinatura, setStatusAssinatura] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlanosModalOpen, setIsPlanosModalOpen] = useState(false);
  
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
      // Redirecionar para o painel da Hotmart para cancelamento
      window.open("https://app.hotmart.com", "_blank");
    } else {
      // Abrir modal de assinatura 
      setIsPlanosModalOpen(true);
    }
  };
  
  // Se não for o dono da pelada, não exibe o botão
  if (!isOwner) {
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
    </>
  );
} 