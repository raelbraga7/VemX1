import { NextRequest, NextResponse } from 'next/server';

// Aceita qualquer método - apenas para teste
export async function POST(req: NextRequest) {
  console.log('[Webhook] Mercado Pago - POST recebido');
  
  try {
    // Log dos headers para debug
    const headers = Object.fromEntries(req.headers.entries());
    console.log('[Webhook] Headers:', headers);
    
    // Tenta obter o corpo
    const body = await req.text();
    console.log('[Webhook] Body:', body);
    
    // Retorna sucesso em qualquer caso
    return new NextResponse(JSON.stringify({ 
      success: true, 
      message: 'Webhook received successfully'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      }
    });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    
    // Mesmo com erro, retorna 200
    return new NextResponse(JSON.stringify({ 
      success: true, 
      message: 'Webhook received with error' 
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      }
    });
  }
}

// Permitir OPTIONS para CORS
export async function OPTIONS() {
  console.log('[Webhook] OPTIONS request received');
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}

// Adicionar GET para testes
export async function GET() {
  console.log('[Webhook] GET request received');
  
  return new NextResponse(JSON.stringify({
    success: true,
    message: 'Webhook endpoint is working!',
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
} 