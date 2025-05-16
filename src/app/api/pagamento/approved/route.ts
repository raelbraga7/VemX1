import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Redireciona para a rota em português - aprovado
  console.log('🔄 Webhook received on /api/pagamento/approved - redirecting to /api/pagamento/aprovado');
  
  try {
    // Clonar o corpo da requisição para não consumi-lo
    const clonedRequest = request.clone();
    
    // Extrair o corpo como texto para debug
    try {
      const bodyText = await clonedRequest.text();
      console.log('📄 Corpo da requisição:', bodyText);
    } catch (error) {
      console.log('⚠️ Não foi possível extrair o corpo da requisição:', error);
    }
    
    // Encaminhar a requisição para a rota correta
    const approvedUrl = new URL('/api/pagamento/aprovado', request.url);
    
    // Reconstruir a requisição
    const newRequest = new Request(approvedUrl.toString(), {
      method: 'POST',
      headers: request.headers,
      body: await request.clone().text() // Usa clone para não consumir o corpo original
    } as RequestInit);
    
    console.log('🔄 Redirecionando para:', approvedUrl.toString());
    
    // Enviar para a rota correta
    const response = await fetch(newRequest);
    const responseData = await response.json();
    
    console.log('✅ Resposta da rota aprovado:', responseData);
    
    // Retornar a mesma resposta
    return NextResponse.json(responseData, { status: response.status });
  } catch (error) {
    console.error('❌ Erro ao redirecionar webhook:', error);
    return NextResponse.json({
      error: 'Erro ao processar webhook redirecionado',
      message: 'A requisição foi recebida em /api/pagamento/approved mas ocorreu um erro ao redirecioná-la',
      errorDetails: error instanceof Error ? error.message : String(error)
    }, { status: 200 }); // Status 200 para o Hotmart não retentar
  }
} 