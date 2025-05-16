import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Redireciona para a rota em português - aprovado
  console.log('🔄 Webhook received on /api/pagamento/approved - redirecting to /api/pagamento/aprovado');
  
  try {
    // Encaminhar a requisição para a rota correta
    const approvedUrl = new URL('/api/pagamento/aprovado', request.url);
    const response = await fetch(approvedUrl.toString(), {
      method: 'POST',
      headers: request.headers,
      body: request.body
    });
    
    // Retornar a mesma resposta
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ Erro ao redirecionar webhook:', error);
    return NextResponse.json({
      error: 'Erro ao processar webhook redirecionado',
      message: 'A requisição foi recebida em /api/pagamento/approved mas ocorreu um erro ao redirecioná-la'
    }, { status: 200 }); // Status 200 para o Hotmart não retentar
  }
} 