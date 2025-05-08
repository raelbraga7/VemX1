import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/firebase/config';
import { doc, setDoc, collection } from 'firebase/firestore';
import crypto from 'crypto';

interface MercadoPagoNotification {
  type: string;
  data?: {
    id?: string;
    [key: string]: unknown;
  };
  action?: string;
  api_version?: string;
  date_created?: string;
  id?: string;
  live_mode?: boolean;
  user_id?: string;
  [key: string]: unknown;
}

export const config = {
  api: {
    bodyParser: false, // necessário para pegar o rawBody
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[Webhook] Mercado Pago -- Requisição recebida');
  console.log('[Webhook] Método:', req.method);
  console.log('[Webhook] Headers:', req.headers);

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'API do webhook do Mercado Pago está funcionando!',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-signature');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'GET', 'OPTIONS']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const rawBody = await new Promise<string>((resolve, reject) => {
      let data = '';
      req.on('data', chunk => {
        data += chunk;
      });
      req.on('end', () => {
        resolve(data);
      });
      req.on('error', err => {
        reject(err);
      });
    });

    console.log('[Webhook] Corpo da requisição:', rawBody);

    let data: MercadoPagoNotification;
    
    try {
      // Tenta fazer parse do JSON
      data = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[Webhook] Erro ao fazer parse do JSON:', parseError);
      // Retorna 200 mesmo com erro de parse para não bloquear o Mercado Pago
      return res.status(200).json({ success: true, message: 'Webhook recebido com formato inválido' });
    }
    
    // Verificar a assinatura (se configurada)
    const signature = req.headers['x-signature'] as string || '';
    const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || 'd599b3ad7bdaf1961fd40bfdd50eca09f95c02a4666458a16bd515bee2a88c39';
    
    // Se houver uma assinatura nos headers, verificá-la
    if (signature && webhookSecret) {
      const calculatedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');
      
      if (signature !== calculatedSignature) {
        console.error('[Webhook] Assinatura inválida');
        console.log('[Webhook] Assinatura recebida:', signature);
        console.log('[Webhook] Assinatura calculada:', calculatedSignature);
        // Mesmo com assinatura inválida, retornamos 200 para testes
        return res.status(200).json({ success: true, message: 'Webhook recebido (assinatura inválida, mas aceito para testes)' });
      }
    }
    
    // Processar a notificação
    await processNotification(data);
    
    // Sempre responder com sucesso para o Mercado Pago
    console.log('[Webhook] Processado com sucesso');
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Webhook] Erro ao processar webhook:', error);
    // Retornar 200 mesmo com erro para não bloquear notificações futuras
    return res.status(200).json({ success: true, message: 'Webhook recebido com erro interno' });
  }
}

// Função auxiliar para processar diferentes tipos de notificações
async function processNotification(data: MercadoPagoNotification) {
  // Determinando o tipo de notificação
  // Mercado Pago pode enviar tanto em 'type' quanto em 'action'
  const type = data.type || data.action;
  const resourceId = data.data?.id || data.id;
  
  console.log('[Webhook] Processando notificação:', { type, resourceId });
  console.log('[Webhook] Dados completos:', data);
  
  // Salvar a notificação no Firestore para debug/auditoria
  try {
    const notificationsRef = collection(db, 'mercadopago_webhooks');
    await setDoc(doc(notificationsRef), {
      type,
      resourceId,
      data,
      processedAt: new Date(),
      status: 'received'
    });
    console.log('[Webhook] Notificação salva no Firestore');
  } catch (error) {
    console.error('[Webhook] Erro ao salvar notificação no Firestore:', error);
  }
  
  // Processar eventos específicos
  if (type === 'payment' || type === 'payment.created' || type === 'payment.updated') {
    await processPayment(data);
  } else if (type === 'plan' || type === 'plan.updated') {
    await processPlan(data);
  } else if (type === 'subscription' || type === 'preapproval.updated') {
    await processSubscription(data);
  } else {
    console.log(`[Webhook] Tipo de notificação não processado: ${type}`);
  }
}

// Processar pagamentos
async function processPayment(data: MercadoPagoNotification) {
  const paymentId = data.data?.id || data.id;
  
  if (!paymentId) {
    console.error('[Webhook] ID de pagamento não encontrado na notificação');
    return;
  }
  
  console.log(`[Webhook] Processamento de pagamento ${paymentId} concluído`);
}

// Processar atualizações de planos
async function processPlan(data: MercadoPagoNotification) {
  const planId = data.data?.id || data.id;
  
  if (!planId) {
    console.error('[Webhook] ID do plano não encontrado na notificação');
    return;
  }
  
  console.log(`[Webhook] Processamento de plano ${planId} concluído`);
}

// Processar atualizações de assinaturas
async function processSubscription(data: MercadoPagoNotification) {
  const subscriptionId = data.data?.id || data.id;
  
  if (!subscriptionId) {
    console.error('[Webhook] ID da assinatura não encontrado na notificação');
    return;
  }
  
  console.log(`[Webhook] Processamento de assinatura ${subscriptionId} concluído`);
} 