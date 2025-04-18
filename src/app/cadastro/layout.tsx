'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CadastroLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulação de verificação de acesso à página de cadastro
    const checkAccess = async () => {
      try {
        // Simular uma verificação de acesso
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Aqui você pode adicionar a lógica real de verificação de acesso
        // Por exemplo, verificar se o usuário já fez o pagamento
        
        setIsLoading(false);
      } catch (error) {
        console.error('Erro na verificação de acesso:', error);
        // Redirecionar para a página de pagamento em caso de erro
        router.push('/pagamento');
      }
    };

    checkAccess();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">VemX1</h1>
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#1d4ed8] mx-auto"></div>
          <p className="mt-4 text-gray-400 text-sm">Preparando sua experiência...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {children}
    </div>
  );
} 