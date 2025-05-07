import { NextRequest, NextResponse } from 'next/server';

// Endpoint GET apenas para testes
export async function GET() {
  console.log('[GET] Webhook Mercado Pago - Teste de conexão');
  return NextResponse.json({
    success: true,
    message: 'Webhook Mercado Pago está online!',
    timestamp: new Date().toISOString()
  });
}

// Endpoint POST para receber notificações
export async function POST(req: NextRequest) {
  console.log('[POST] Webhook Mercado Pago - Requisição recebida');
  
  try {
    // Obter o corpo da requisição como texto para log
    const body = await req.text();
    console.log('[POST] Corpo da requisição:', body);
    
    // Responder sucesso imediatamente
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST] Erro no webhook:', error);
    // Retornar sucesso mesmo em caso de erro para não bloquear notificações futuras
    return NextResponse.json({ success: true });
  }
}

// Endpoint OPTIONS para CORS
export async function OPTIONS() {
  console.log('[OPTIONS] Webhook Mercado Pago - Requisição OPTIONS recebida');
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-signature',
    },
  });
} 