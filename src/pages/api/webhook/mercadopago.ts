import type { NextApiRequest, NextApiResponse } from 'next';

// Este é um arquivo de compatibilidade que redireciona para o endpoint do App Router
// O Mercado Pago espera um endpoint no formato Pages Router em /api/webhook/mercadopago
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Log para debug
  console.log('[Webhook Legacy] Recebendo requisição para webhook do Mercado Pago');
  console.log('[Webhook Legacy] Método:', req.method);
  console.log('[Webhook Legacy] Headers:', req.headers);

  if (req.method === 'POST') {
    try {
      // Encaminhar para o endpoint do App Router
      const body = JSON.stringify(req.body);
      console.log('[Webhook Legacy] Body:', body);

      // Criar uma nova requisição para o endpoint do App Router
      const appRouterUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://vemx1-eight.vercel.app'}/api/webhook/mercadopago`;
      console.log('[Webhook Legacy] Encaminhando para:', appRouterUrl);

      // Encaminhar a requisição
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Adicionar a assinatura, se presente
      if (req.headers['x-signature']) {
        headers['x-signature'] = req.headers['x-signature'] as string;
      }

      // Fazer a requisição para o endpoint do App Router
      const appRouterResponse = await fetch(appRouterUrl, {
        method: 'POST',
        headers,
        body,
      });

      // Obter a resposta
      const appRouterResponseData = await appRouterResponse.json();
      console.log('[Webhook Legacy] Resposta do App Router:', appRouterResponseData);

      // Responder com sucesso
      return res.status(200).json({ success: true, message: 'Webhook recebido e processado' });
    } catch (error) {
      console.error('[Webhook Legacy] Erro ao processar webhook:', error);
      // Responder com sucesso mesmo com erro para não bloquear o Mercado Pago
      return res.status(200).json({ success: true, message: 'Webhook recebido com erro, mas aceito' });
    }
  } else if (req.method === 'GET') {
    // Para testes
    return res.status(200).json({ 
      success: true, 
      message: 'API Legacy do webhook do Mercado Pago está funcionando!',
      timestamp: new Date().toISOString()
    });
  } else if (req.method === 'OPTIONS') {
    // Responder a requisições OPTIONS para CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-signature');
    return res.status(200).end();
  } else {
    // Método não permitido
    res.setHeader('Allow', ['POST', 'GET', 'OPTIONS']);
    return res.status(405).json({ message: `Método ${req.method} não permitido` });
  }
} 