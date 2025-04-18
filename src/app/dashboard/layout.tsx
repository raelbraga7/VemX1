'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  // Simulação de verificação de autenticação
  useEffect(() => {
    // Simular verificação de autenticação
    const checkAuth = async () => {
      try {
        // Simular uma verificação de autenticação
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Aqui você pode adicionar a lógica real de verificação de autenticação
        // Por enquanto, vamos apenas permitir o acesso
        
        setIsLoading(false);
      } catch (error) {
        console.error('Erro na verificação de autenticação:', error);
        // Redirecionar para a página de login em caso de erro
        router.push('/cadastro');
      }
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1d4ed8] mx-auto"></div>
          <p className="mt-4 text-[#0d1b2a]">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  );
} 