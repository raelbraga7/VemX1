import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/firebase/config';
import { doc, setDoc, collection } from 'firebase/firestore';

// Tipo da notificação do Mercado Pago
interface MercadoPagoNotification {
  action?: string;
  api_version?: string;
  data?: {
    id?: string;
    [key: string]: unknown;
  };
  date_created?: string;
  id?: string;
  live_mode?: boolean;
  type?: string;
  user_id?: number | string;
  [key: string]: unknown;
}

// Desabilitar o bodyParser padrão para obter o corpo bruto da requisição
export const config = {
  api: {
    bodyParser: true, // Mudando para true para simplificar o processamento inicial
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[Webhook] Requisição recebida:', {
    method: req.method,
    url: req.url,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
      host: req.headers.host,
    }
  });

  // Responder a solicitações GET (útil para testes)
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      message: 'Webhook do Mercado Pago está funcionando!',
      timestamp: new Date().toISOString()
    });
  }

  // Responder a solicitações OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Verificar se é uma solicitação POST
  if (req.method !== 'POST') {
    console.log(`[Webhook] Método não suportado: ${req.method}`);
    res.setHeader('Allow', ['POST', 'GET', 'OPTIONS']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Log do corpo da requisição
    console.log('[Webhook] Corpo da requisição:', JSON.stringify(req.body, null, 2));
    
    const notification = req.body as MercadoPagoNotification;
    
    // Identificar o tipo de notificação (Mercado Pago usa 'type' ou 'action')
    const eventType = notification.type || notification.action;
    const resourceId = notification.data?.id || notification.id;
    
    console.log(`[Webhook] Evento: ${eventType}, ID: ${resourceId}`);
    
    // Salvar a notificação no Firestore para auditoria
    try {
      const notificationsRef = collection(db, 'mercadopago_webhooks');
      await setDoc(doc(notificationsRef), {
        type: eventType,
        resourceId,
        data: notification,
        receivedAt: new Date(),
        status: 'received'
      });
      console.log('[Webhook] Notificação salva no Firestore');
    } catch (dbError) {
      console.error('[Webhook] Erro ao salvar no Firestore:', dbError);
      // Continuamos mesmo com erro no DB para não afetar a resposta ao Mercado Pago
    }
    
    // Processar com base no tipo de evento
    if (eventType?.includes('payment')) {
      console.log('[Webhook] Processando notificação de pagamento');
      
      // Implementar lógica específica para pagamentos aqui
      // Por exemplo: atualizar status de assinatura, liberar acesso, etc.
      
    } else if (eventType?.includes('subscription') || eventType?.includes('preapproval')) {
      console.log('[Webhook] Processando notificação de assinatura');
      
      // Implementar lógica específica para assinaturas aqui
      
    } else {
      console.log(`[Webhook] Tipo de evento não processado especificamente: ${eventType}`);
    }
    
    // Sempre retornar 200 para o Mercado Pago
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('[Webhook] Erro ao processar webhook:', error);
    
    // Importante: mesmo em caso de erro, retornamos 200
    // Isso evita que o Mercado Pago considere o webhook como falho
    return res.status(200).json({ 
      success: true, 
      message: 'Received with errors, but acknowledging receipt' 
    });
  }
} 