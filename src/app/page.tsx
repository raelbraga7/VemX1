'use client';

import { useRouter } from 'next/navigation';
import { Suspense } from 'react';

const MockupSection = () => (
  <section className="py-16 px-4" aria-label="Visualização do aplicativo">
    <div className="container mx-auto text-center">
      <div className="relative w-full max-w-md mx-auto h-[600px]">
        <div className="absolute inset-0 bg-[#1d4ed8]/20 rounded-2xl"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-[500px] bg-black rounded-3xl shadow-xl" role="img" aria-label="Mockup do aplicativo VemX1">
            <div className="p-4 text-center text-gray-400">
              Mockup do App
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default function Home() {
  const router = useRouter();

  const handleCTA = () => {
    router.push('/pagamento');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header Fixo */}
      <header className="fixed top-0 left-0 right-0 bg-[#0d1b2a]/80 backdrop-blur-sm border-b border-gray-800/50 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">VemX1</h1>
          <button
            onClick={handleCTA}
            className="px-4 py-2 bg-[#1d4ed8] text-white rounded-lg hover:bg-[#1d4ed8]/90 transition-colors"
          >
            Começar Agora
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <section className="py-12">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="space-y-8 text-center">
              {/* Hero Title */}
              <h2 className="text-4xl md:text-6xl font-bold">
                Chega de rachão bagunçado.
              </h2>

              {/* Subtitle */}
              <h3 className="text-xl md:text-2xl font-medium text-gray-300">
                Organize. Gere os times. Crie o ranking.
              </h3>

              {/* Description */}
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                Com o VemX1, você entra para um sistema exclusivo de ranqueamento entre jogadores, 
                monta times para desafiar outros e garante sua vaga nos melhores jogos de futebol 
                amador da sua cidade.
              </p>

              {/* CTA Button */}
              <div>
                <button
                  onClick={handleCTA}
                  className="bg-[#1d4ed8] hover:bg-[#1d4ed8]/90 text-white px-8 py-4 rounded-xl text-lg font-medium transition-all hover:scale-105 hover:shadow-lg hover:shadow-[#1d4ed8]/20"
                >
                  Comece agora por R$149,99
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-16 px-4 bg-black/50">
          <div className="container mx-auto max-w-6xl">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                'Ranking com os melhores da semana',
                'Geração automática de times',
                'Organização sem precisar de grupo no zap',
                'Custo dividido entre os jogadores',
                'Sem limite de participantes'
              ].map((benefit, index) => (
                <div key={index} className="flex items-center space-x-3 p-4 rounded-lg bg-black/40 border border-[#1d4ed8]/20">
                  <span className="text-[#1d4ed8]" aria-hidden="true">✓</span>
                  <p className="text-gray-200">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mockup Section */}
        <Suspense fallback={<div className="py-16 px-4 text-center">Carregando...</div>}>
          <MockupSection />
        </Suspense>

        {/* Pricing Section */}
        <section className="py-16 px-4 bg-black/50">
          <div className="container mx-auto text-center">
            <h2 className="text-3xl font-bold mb-8">Plano Único</h2>
            <div className="max-w-md mx-auto bg-black/40 rounded-2xl p-8 border border-[#1d4ed8]/20">
              <div className="text-4xl font-bold mb-6">
                R$149,99
                <span className="text-lg text-gray-400">/mês</span>
              </div>
              <ul className="text-left space-y-4 mb-8">
                <li className="flex items-center">
                  <span className="text-[#1d4ed8] mr-2">✓</span>
                  Inclui todas as funcionalidades
                </li>
                <li className="flex items-center">
                  <span className="text-[#1d4ed8] mr-2">✓</span>
                  Sem limite de jogadores
                </li>
                <li className="flex items-center">
                  <span className="text-[#1d4ed8] mr-2">✓</span>
                  Cancele quando quiser
                </li>
              </ul>
              <button 
                onClick={handleCTA}
                className="bg-[#1d4ed8] hover:bg-[#1d4ed8]/90 text-white px-8 py-4 w-full rounded-xl text-lg font-medium transition-all hover:scale-105 hover:shadow-lg hover:shadow-[#1d4ed8]/20"
              >
                Quero jogar com organização ⚡
              </button>
            </div>
          </div>
        </section>

        {/* Testimonial Section */}
        <section className="py-16 px-4">
          <div className="container mx-auto text-center">
            <blockquote className="max-w-2xl mx-auto">
              <p className="text-2xl font-medium mb-4">
                &ldquo;Depois do VemX1, jogar ficou sério e muito mais justo.&rdquo;
              </p>
              <footer className="text-gray-400">
                <cite>— Rafael, organizador do rachão de terça</cite>
              </footer>
            </blockquote>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-gray-500">
        © 2025 VemX1. Todos os direitos reservados.
      </footer>
    </div>
  );
}
