import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config) => {
    // Resolver o problema do @firebase/app
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    };
    
    return config;
  },
  
  // Configuração do ESLint para ignorar algumas regras durante o build
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  
  // Adicionar redirecionamentos para o webhook do Mercado Pago
  async redirects() {
    return [
      // Redirecionamento do padrão do Mercado Pago para nosso endpoint App Router
      {
        source: '/webhook/mercadopago',
        destination: '/api/webhook/mercadopago',
        permanent: true,
      },
      // Versão alternativa com api no caminho
      {
        source: '/api/webhook/mercadopago',
        destination: '/api/webhook/mercadopago',
        permanent: true,
      },
      // Caminhos adicionais que o Mercado Pago pode tentar usar
      {
        source: '/webhooks/mercadopago',
        destination: '/api/webhook/mercadopago',
        permanent: true,
      },
      {
        source: '/notifications/mercadopago',
        destination: '/api/webhook/mercadopago',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
