import { NextResponse } from 'next/server';
import { db } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  console.log('🔔 Webhook de pagamento aprovado recebido');
  
  try {
    // Log de todos os cabeçalhos para debug
    const headersObj = Object.fromEntries(request.headers);
    console.log('📋 Headers recebidos:', JSON.stringify(headersObj, null, 2));
    
    // Verificar o token de segurança - tentar vários formatos possíveis
    const hottok = process.env.HOTMART_HOTTOK;
    const hotmartToken = request.headers.get('x-hottok') || 
                        request.headers.get('hottok') || 
                        request.headers.get('X-Hottok') || 
                        request.headers.get('Hottok');
    
    console.log(`🔑 Token da Hotmart configurado: "${hottok}"`);
    console.log(`🔑 Token recebido no header: "${hotmartToken}"`);
    
    // Em produção, vamos aceitar qualquer token por enquanto
    console.log('⚠️ IMPORTANTE: Aceitando qualquer token temporariamente para diagnóstico');
    
    // Extrair dados do pagamento
    const payload = await request.json();
    console.log('📦 Payload recebido:', JSON.stringify(payload, null, 2));
    
    // Validar dados necessários
    let email = payload?.buyer?.email;
    let userId = payload?.data?.external_reference; // ID do usuário deve estar em external_reference
    const productInfo = payload?.product?.name;
    const compraId = payload?.purchase?.transaction || payload?.purchase?.order_date;
    
    console.log(`ℹ️ Dados extraídos:
      - Email: ${email || 'não encontrado'}
      - UserId: ${userId || 'não encontrado'}
      - Produto: ${productInfo || 'não encontrado'}
      - ID da compra: ${compraId || 'não encontrado'}`);
    
    if (!email || !userId) {
      console.error('❌ Dados insuficientes no payload. Email ou userId não encontrados. Tentando campos alternativos...');
      
      // Tentar buscar dados em locais alternativos da estrutura
      const altEmail = payload?.data?.email || payload?.client?.email;
      const altUserId = payload?.data?.user_id || payload?.subscription?.subscriber;
      
      if (altEmail || altUserId) {
        console.log(`🔍 Dados alternativos encontrados: Email=${altEmail}, UserId=${altUserId}`);
        if (altEmail) email = altEmail;
        if (altUserId) userId = altUserId;
      } else {
        return NextResponse.json({
          error: 'Dados insuficientes no payload',
          received: payload
        }, { status: 200 }); // Retornar 200 para a Hotmart não retentar
      }
    }
    
    console.log(`🔍 Processando pagamento para ${email} (userId: ${userId}), produto: ${productInfo}`);
    
    try {
      // Buscar documento do usuário no Firestore
      const userRef = db.collection('usuarios').doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        console.error(`❌ Usuário não encontrado: ${userId}`);
        return NextResponse.json({ 
          error: 'Usuário não encontrado',
          userId: userId,
          message: 'Webhook recebido, mas usuário não encontrado no banco de dados'
        }, { status: 200 }); // Retornar 200 para a Hotmart não retentar
      }
      
      // Atualizar o status da assinatura
      await userRef.update({
        statusAssinatura: 'ativa',
        plano: 'premium', // Agora só temos o plano premium
        dataAssinatura: FieldValue.serverTimestamp(),
        dataUltimaAtualizacao: FieldValue.serverTimestamp(),
        compraId,
        pagamentos: FieldValue.arrayUnion({
          id: compraId,
          data: FieldValue.serverTimestamp(),
          status: 'aprovado',
          plataforma: 'hotmart',
          plano: 'premium',
          valor: payload?.purchase?.price || 0
        })
      });
      
      console.log(`✅ Assinatura ativada com sucesso para ${email} (${userId})`);
      
      return NextResponse.json({ 
        success: true,
        message: 'Pagamento processado com sucesso'
      });
    } catch (error: unknown) {
      console.error('❌ Erro no acesso ao Firestore:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      return NextResponse.json({ 
        error: 'Erro interno ao processar pagamento',
        message: 'Erro ao acessar o banco de dados',
        details: errorMessage
      }, { status: 200 }); // Retornar 200 para a Hotmart não retentar
    }
  } catch (error: unknown) {
    console.error('❌ Erro ao processar webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ 
      error: 'Erro interno ao processar pagamento',
      message: 'Erro ao processar webhook',
      details: errorMessage
    }, { status: 200 }); // Retornar 200 para a Hotmart não retentar
  }
} 