'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';

export default function PagamentoSucessoPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Confirmando pagamento...');

  // Ativar assinatura e redirecionar para o dashboard
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user?.uid) {
      setStatus('Aguardando autenticação...');
      return;
    }

    const ativarAssinatura = async () => {
      try {
        setStatus('Ativando sua assinatura...');
        
        // Chamar API para ativar assinatura
        const response = await fetch('/api/usuario/ativar-manual', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.uid
          }),
        });

        const data = await response.json();
        
        if (data.success) {
          setStatus(`Assinatura ${data.plano} ativada com sucesso!`);
          
          // Redirecionar para o dashboard após 3 segundos
          setTimeout(() => {
            router.push('/dashboard');
          }, 3000);
        } else {
          throw new Error(data.error || 'Falha ao ativar assinatura');
        }
      } catch (error) {
        console.error('Erro ao ativar assinatura:', error);
        setStatus('Erro ao confirmar assinatura. Contate o suporte.');
      }
    };

    ativarAssinatura();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-100 mx-auto rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-12 h-12 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M5 13l4 4L19 7"
            ></path>
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Pagamento realizado com sucesso!</h1>
        
        <p className="text-gray-600 mb-3">
          {status}
        </p>
        
        <p className="text-gray-500 text-sm mb-8">
          Você será redirecionado para o dashboard em alguns segundos.
        </p>
        
        <div className="flex justify-center space-x-4">
          <Link 
            href="/dashboard"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Ir para o Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
} 