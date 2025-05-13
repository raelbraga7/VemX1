'use client';

import Link from 'next/link';

export default function PagamentoPendentePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-yellow-100 mx-auto rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-12 h-12 text-yellow-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Pagamento pendente</h1>
        
        <p className="text-gray-600 mb-8">
          Seu pagamento está sendo processado. Assim que for concluído, sua assinatura será ativada.
          Você pode verificar o status a qualquer momento na sua área de usuário.
        </p>
        
        <div className="flex justify-center gap-4">
          <Link 
            href="/dashboard"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
} 