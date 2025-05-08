'use strict';

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // Configuração do Next.js
  reactStrictMode: true,
  swcMinify: true,
  
  // Configuração do compilador
  compiler: {
    // Remover console.logs na build de produção
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn', 'info'],
    } : false,
  },
  
  // Suporte a páginas e API Routes (Pages Router)
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  
  // Configuração experimental
  experimental: {
    appDir: true, // Habilita o App Router (mantido para compatibilidade)
  },
  
  // Se precisar usar variáveis de ambiente no cliente que não comecem com NEXT_PUBLIC_
  env: {},
  
  // Headers seguros
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
