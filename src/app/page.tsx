'use client';

import { Suspense, useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { PLANOS } from '@/lib/mercadopago';
import { toast } from 'react-hot-toast';

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

  // Função para rolar até a seção de planos
  const scrollToPlans = () => {
    const plansSection = document.getElementById('plans-section');
    if (plansSection) {
      plansSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCTA = async (planoTipo: 'basico' | 'premium' = 'basico') => {
    // Se o usuário não estiver logado, usamos um ID temporário e permitimos checkout anônimo
    const userId = user ? user.uid : 'guest-' + Math.random().toString(36).substring(2, 15);
    const userEmail = user ? user.email : 'visitante@temporario.com';

    setLoading(true);

    try {
      // Iniciar checkout do Mercado Pago
      const response = await fetch('/api/checkout/mercadopago', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plano: planoTipo,
          userId: userId,
          userEmail: userEmail,
        }),
      });

      const data = await response.json();

      if (response.ok && data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error(data.error || 'Erro ao criar checkout');
      }
    } catch (error) {
      console.error('Erro ao iniciar checkout:', error);
      toast.error('Falha ao iniciar o pagamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header Fixo */}
      <header className="fixed top-0 left-0 right-0 bg-[#0d1b2a]/80 backdrop-blur-sm border-b border-gray-800/50 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">VemX1</h1>
          <button
            onClick={scrollToPlans}
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
                  onClick={scrollToPlans}
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
            <h2 className="text-3xl font-bold mb-8">Escolha seu plano</h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Plano Básico */}
              <div className="bg-black/40 rounded-2xl p-8 border border-[#1d4ed8]/20">
                <div className="text-2xl font-bold mb-2">Plano Básico</div>
                <div className="text-4xl font-bold mb-6">
                  R${PLANOS.BASICO.preco}
                  <span className="text-lg text-gray-400">/mês</span>
                </div>
                <ul className="text-left space-y-4 mb-8">
                  <li className="flex items-center">
                    <span className="text-[#1d4ed8] mr-2">✓</span>
                    Inclui todas as funcionalidades
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#1d4ed8] mr-2">✓</span>
                    Até 20 jogadores por pelada
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#1d4ed8] mr-2">✓</span>
                    Até 5 peladas simultâneas
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#1d4ed8] mr-2">✓</span>
                    Cancele quando quiser
                  </li>
                </ul>
                <button 
                  onClick={() => handleCTA('basico')}
                  disabled={loading}
                  className="bg-[#1d4ed8] hover:bg-[#1d4ed8]/90 text-white px-8 py-4 w-full rounded-xl text-lg font-medium transition-all hover:scale-105 hover:shadow-lg hover:shadow-[#1d4ed8]/20"
                >
                  {loading ? 'Processando...' : 'Quero o Plano Básico'}
                </button>
              </div>

              {/* Plano Premium */}
              <div className="bg-black/40 rounded-2xl p-8 border-2 border-[#1d4ed8] relative">
                <div className="absolute top-0 right-0 left-0 bg-[#1d4ed8] text-white py-1 rounded-t-xl font-bold">
                  Mais Popular
                </div>
                <div className="text-2xl font-bold mb-2 mt-6">Plano Premium</div>
                <div className="text-4xl font-bold mb-6">
                  R${PLANOS.PREMIUM.preco}
                  <span className="text-lg text-gray-400">/mês</span>
                </div>
                <ul className="text-left space-y-4 mb-8">
                  <li className="flex items-center">
                    <span className="text-[#1d4ed8] mr-2">✓</span>
                    Todas as funcionalidades do plano básico
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#1d4ed8] mr-2">✓</span>
                    Jogadores ILIMITADOS
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#1d4ed8] mr-2">✓</span>
                    Peladas ILIMITADAS
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#1d4ed8] mr-2">✓</span>
                    Estatísticas avançadas
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#1d4ed8] mr-2">✓</span>
                    Suporte prioritário
                  </li>
                </ul>
                <button 
                  onClick={() => handleCTA('premium')}
                  disabled={loading}
                  className="bg-[#1d4ed8] hover:bg-[#1d4ed8]/90 text-white px-8 py-4 w-full rounded-xl text-lg font-medium transition-all hover:scale-105 hover:shadow-lg hover:shadow-[#1d4ed8]/20"
                >
                  {loading ? 'Processando...' : 'Quero o Plano Premium'}
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
