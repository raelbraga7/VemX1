import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  console.log('[WEBHOOK_ROOT] Mercado Pago - Requisição POST recebida');
  
  try {
    // Log dos headers para debug
    const headers = Object.fromEntries(req.headers.entries());
    console.log('[WEBHOOK_ROOT] Headers recebidos:', headers);
    
    // Obtém o corpo da requisição como texto
    const rawBody = await req.text();
    console.log('[WEBHOOK_ROOT] Corpo da requisição:', rawBody);
    
    // Sempre responder com sucesso para o Mercado Pago
    return NextResponse.json({ success: true, message: 'Webhook recebido com sucesso (root)' });
  } catch (error) {
    console.error('[WEBHOOK_ROOT] Erro:', error);
    // Retornar 200 mesmo com erro
    return NextResponse.json({ success: true, message: 'Webhook recebido (com erro interno)' });
  }
}

// Método GET para testar se o endpoint está acessível
export async function GET() {
  console.log('[WEBHOOK_ROOT] Requisição GET recebida');
  return NextResponse.json({
    success: true,
    message: 'API de webhook está funcionando (endpoint raiz)!',
    timestamp: new Date().toISOString()
  });
}

// Método OPTIONS para CORS
export async function OPTIONS() {
  console.log('[WEBHOOK_ROOT] Requisição OPTIONS recebida');
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-signature',
    },
  });
} 