import { NextRequest, NextResponse } from 'next/server';
import { PLANOS } from '@/lib/mercadopago';

export async function POST(req: NextRequest) {
  try {
    console.log('[API] Iniciando checkout do Mercado Pago');
    
    // Obter dados do corpo da requisição
    const { plano, userId, userEmail } = await req.json();
    console.log('[API] Dados recebidos:', { plano, userId, userEmail });
    
    if (!plano) {
      return NextResponse.json(
        { error: 'Plano é obrigatório' },
        { status: 400 }
      );
    }

    if (!userId || !userEmail) {
      return NextResponse.json(
        { error: 'Dados do usuário são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Obter dados do plano
    const planoData = plano === 'basico' ? PLANOS.BASICO : PLANOS.PREMIUM;
    console.log('[API] Dados do plano:', planoData);
    
    // Verificar token do Mercado Pago
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('[API] Token do Mercado Pago não configurado');
      return NextResponse.json(
        { error: 'Configuração do Mercado Pago ausente' },
        { status: 500 }
      );
    }
    
    console.log('[API] Token configurado:', accessToken.substring(0, 10) + '...');
    console.log('[API] URL da aplicação:', process.env.NEXT_PUBLIC_APP_URL);
    
    // Importar o SDK do Mercado Pago
    console.log('[API] Importando SDK do Mercado Pago');
    const { MercadoPagoConfig, Preference } = await import('mercadopago');
    
    // Configurar o cliente do Mercado Pago
    console.log('[API] Configurando cliente do Mercado Pago');
    const client = new MercadoPagoConfig({ accessToken });
    
    // Criar preferência de pagamento
    console.log('[API] Criando preferência de pagamento');
    const preference = new Preference(client);
    
    // Simplificar o objeto de preferência ao máximo para evitar problemas
    // Mercado Pago é sensível a campos inválidos
    const preferenceData = {
      items: [
        {
          id: planoData.id,
          title: `Plano ${planoData.nome} - VEMX1`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: Number(planoData.preco), // Converter para número para garantir
        },
      ],
      payer: {
        email: userEmail,
      },
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL}/assinatura/sucesso`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL}/assinatura/falha`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL}/assinatura/pendente`,
      },
      metadata: {
        user_id: userId,
        plan: plano,
      },
    };
    
    console.log('[API] Dados da preferência:', JSON.stringify(preferenceData, null, 2));
    
    try {
      console.log('[API] Enviando requisição para o Mercado Pago...');
      const result = await preference.create({ body: preferenceData });
      console.log('[API] Preferência criada com sucesso!');
      console.log('[API] ID da preferência:', result.id);
      console.log('[API] URL de checkout:', result.init_point);
      
      return NextResponse.json({
        checkout_url: result.init_point,
        preference_id: result.id,
      });
    } catch (preferenceError: any) {
      console.error('[API] Erro ao criar preferência:', preferenceError);
      if (preferenceError.cause) {
        console.error('[API] Causa do erro:', preferenceError.cause);
      }
      console.error('[API] Detalhes do erro:', JSON.stringify(preferenceError, null, 2));
      
      // Tentar extrair a mensagem de erro real do Mercado Pago
      const errorMessage = 
        preferenceError.message || 
        (preferenceError.cause ? JSON.stringify(preferenceError.cause) : 'Erro desconhecido');
      
      return NextResponse.json(
        { error: `Erro ao criar preferência: ${errorMessage}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[API] Erro geral:', error);
    console.error('[API] Erro detalhado:', JSON.stringify(error, null, 2));
    return NextResponse.json(
      { error: `Erro ao processar checkout: ${error.message || 'Erro desconhecido'}` },
      { status: 500 }
    );
  }
} 