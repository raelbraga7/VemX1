'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PagamentoPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Simula o processo de pagamento
  const handlePayment = async () => {
    setIsLoading(true);
    
    try {
      // Simula uma chamada de API de pagamento
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Redireciona para a página de cadastro após o "pagamento"
      router.push('/cadastro');
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Cabeçalho */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-[#0d1b2a] mb-4">
            Finalize sua assinatura VemX1
          </h1>
          <p className="text-gray-600">
            Você está prestes a entrar para a melhor comunidade de organização de rachões
          </p>
        </div>

        {/* Card principal */}
        <div className="bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
          {/* Preço */}
          <div className="text-center mb-8">
            <p className="text-gray-600 mb-2">Assinatura Mensal</p>
            <div className="text-4xl font-bold text-[#0d1b2a]">
              R$149,99
              <span className="text-base font-normal text-gray-500">/mês</span>
            </div>
          </div>

          {/* Lista de benefícios */}
          <div className="space-y-4 mb-8">
            <h2 className="font-semibold text-[#0d1b2a] mb-4">O que está incluído:</h2>
            <div className="space-y-3">
              {[
                'Ranking semanal dos melhores jogadores',
                'Geração automática e equilibrada de times',
                'Comunidade exclusiva de jogadores',
                'Gestão simplificada de pagamentos',
                'Suporte prioritário',
              ].map((benefit, index) => (
                <div key={index} className="flex items-center">
                  <svg
                    className="h-5 w-5 text-[#1d4ed8] mr-2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-600">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Botão de pagamento */}
          <button
            onClick={handlePayment}
            disabled={isLoading}
            className="w-full bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processando...
              </div>
            ) : (
              'Pagar Agora'
            )}
          </button>

          {/* Informações de segurança */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <div className="flex items-center justify-center mb-2">
              <svg
                className="h-4 w-4 text-gray-400 mr-1"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7a4 4 0 00-8 0v4"></path>
              </svg>
              Pagamento 100% seguro
            </div>
            <p>Você pode cancelar quando quiser</p>
          </div>
        </div>
      </div>
    </div>
  );
} 