'use client';

import { Suspense, useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { PLANOS } from '@/lib/planos';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

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
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Função para redirecionar para página de login
  const navigateToLogin = () => {
    router.push('/login');
  };

  // Função para redirecionar para o dashboard ou login
  const handleCTA = () => {
    if (user) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header Fixo */}
      <header className="fixed top-0 left-0 right-0 bg-[#0d1b2a]/80 backdrop-blur-sm border-b border-gray-800/50 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">VemX1</h1>
          <button
            onClick={navigateToLogin}
            className="px-4 py-2 bg-[#1d4ed8] text-white rounded-lg hover:bg-[#1d4ed8]/90 transition-colors"
          >
            Entrar
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
                VemX1
              </h2>

              {/* Subtitle */}
              <h3 className="text-xl md:text-2xl font-medium text-gray-300">
                O app definitivo para organizar e valorizar o futebol amador
              </h3>

              {/* Description */}
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                Crie temporadas de pelada ou de time, envie convites com link para os jogadores, 
                configure sua pelada com regras personalizadas e monte os times de forma aleatória ou fixa. 
                Cada jogador tem seu perfil com carta e estatísticas detalhadas, além de participar de 
                rankings individuais e por time. E no fim da temporada, o grande destaque ainda recebe 
                um troféu físico personalizado como reconhecimento pela performance. 
                Com o VemX1, cada jogo vira competição, e cada craque, uma lenda!
              </p>

              {/* CTA Button */}
              <div>
                <button
                  onClick={handleCTA}
                  className="bg-[#1d4ed8] hover:bg-[#1d4ed8]/90 text-white px-8 py-4 rounded-xl text-lg font-medium transition-all hover:scale-105 hover:shadow-lg hover:shadow-[#1d4ed8]/20"
                >
                  Começar agora
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
        <section id="plans-section" className="py-16 px-4 bg-black/50">
          <div className="container mx-auto text-center">
            <h2 className="text-3xl font-bold mb-8">Nosso plano</h2>
            <div className="max-w-md mx-auto">
              {/* Plano Premium */}
              <div className="bg-black/40 rounded-2xl p-8 border-2 border-[#1d4ed8] relative">
                <div className="absolute top-0 right-0 left-0 bg-[#1d4ed8] text-white py-1 rounded-t-xl font-bold">
                  Plano VemX1
                </div>
                <div className="text-2xl font-bold mb-2 mt-6">Plano Premium</div>
                <div className="text-4xl font-bold mb-6">
                  R${PLANOS.PREMIUM.preco}
                  <span className="text-lg text-gray-400">/mês</span>
                </div>
                <ul className="text-left space-y-4 mb-8">
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
                  onClick={navigateToLogin}
                  disabled={loading}
                  className="bg-[#1d4ed8] hover:bg-[#1d4ed8]/90 text-white px-8 py-4 w-full rounded-xl text-lg font-medium transition-all hover:scale-105 hover:shadow-lg hover:shadow-[#1d4ed8]/20"
                >
                  {loading ? 'Processando...' : 'Visita VemX1'}
                </button>
              </div>
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
