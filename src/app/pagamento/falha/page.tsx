'use client';

import Link from 'next/link';

export default function PagamentoFalhaPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-100 mx-auto rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-12 h-12 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Pagamento não concluído</h1>
        
        <p className="text-gray-600 mb-8">
          Houve um problema ao processar seu pagamento. Por favor, tente novamente 
          ou entre em contato com nosso suporte se o problema persistir.
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link 
            href="/assinatura"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Tentar novamente
          </Link>
          <Link 
            href="/dashboard"
            className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
} 