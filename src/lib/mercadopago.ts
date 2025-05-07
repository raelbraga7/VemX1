import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

// Interfaces para tipar os parâmetros
interface PaymentPreferenceItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
  description?: string;
  category_id?: string;
}

interface PaymentPreferencePayer {
  email: string;
  name?: string;
  identification?: {
    type: string;
    number: string;
  };
}

interface BackUrls {
  success: string;
  failure: string;
  pending: string;
}

// Configuração do cliente do Mercado Pago
const mercadoPagoClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
});

// Configuração dos planos
export const PLANOS = {
  BASICO: {
    id: 'basico',
    nome: 'Básico',
    preco: 149.99,
    descricao: 'Acesso a todas as funcionalidades básicas',
  },
  PREMIUM: {
    id: 'premium',
    nome: 'Premium',
    preco: 259.99,
    descricao: 'Acesso a todas as funcionalidades avançadas',
  }
};

// Funções para interagir com a API do Mercado Pago

/**
 * Cria uma preferência de pagamento para checkout
 */
export async function createPaymentPreference(
  items: PaymentPreferenceItem[], 
  payer: PaymentPreferencePayer, 
  backUrls?: BackUrls
) {
  try {
    const preference = new Preference(mercadoPagoClient);
    
    const preferenceData = {
      items,
      payer,
      back_urls: backUrls || {
        success: `${process.env.NEXT_PUBLIC_APP_URL}/pagamento/sucesso`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL}/pagamento/falha`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL}/pagamento/pendente`
      },
      auto_return: 'approved',
    };

    const result = await preference.create({ body: preferenceData });
    return result;
  } catch (error) {
    console.error('Erro ao criar preferência de pagamento:', error);
    throw error;
  }
}

/**
 * Obtém informações de um pagamento pelo ID
 */
export async function getPaymentInfo(paymentId: string) {
  try {
    const payment = new Payment(mercadoPagoClient);
    const result = await payment.get({ id: paymentId });
    return result;
  } catch (error) {
    console.error('Erro ao obter informações do pagamento:', error);
    throw error;
  }
}

/**
 * Cria uma assinatura (plano recorrente)
 */
export async function createSubscription(preapprovalData: Record<string, unknown>) {
  try {
    // O Mercado Pago usa o endpoint /preapproval para assinaturas
    // Como não temos uma classe específica no SDK, vamos fazer uma chamada fetch direta
    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preapprovalData)
    });

    if (!response.ok) {
      throw new Error(`Erro na API do Mercado Pago: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Erro ao criar assinatura:', error);
    throw error;
  }
}

/**
 * Cancela uma assinatura pelo ID
 */
export async function cancelSubscription(subscriptionId: string) {
  try {
    // O Mercado Pago usa o endpoint /preapproval/{id} para atualizar assinaturas
    const response = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'cancelled'
      })
    });

    if (!response.ok) {
      throw new Error(`Erro na API do Mercado Pago: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    throw error;
  }
}

/**
 * Obtém informações de uma assinatura pelo ID
 */
export async function getSubscriptionInfo(subscriptionId: string) {
  try {
    // O Mercado Pago usa o endpoint /preapproval/{id} para obter detalhes de assinaturas
    const response = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Erro na API do Mercado Pago: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Erro ao obter informações da assinatura:', error);
    throw error;
  }
} 