import { NextResponse } from 'next/server';
import { db } from '@/firebase/admin';

export async function POST(request: Request) {
  try {
    console.log('🔔 Webhook do Hotmart recebido');
    
    // Clonar a request para poder ler o corpo várias vezes se necessário
    const clonedRequest = request.clone();
    
    // Verificar o content-type para determinar como processar os dados
    const contentType = request.headers.get('content-type') || '';
    console.log(`📋 Content-Type: ${contentType}`);
    
    // Log completo de todos os headers para debug
    const headersObj = Object.fromEntries(request.headers);
    console.log('📋 Headers completos:', JSON.stringify(headersObj, null, 2));
    
    let email = '';
    let status = '';
    let rawData = '';
    
    // Tentar extrair dados brutos para debug 
    try {
      rawData = await clonedRequest.text();
      console.log('📄 Dados brutos recebidos:', rawData);
    } catch (error) {
      console.log('❌ Não foi possível obter dados brutos:', error);
    }
    
    // Processar os dados conforme o formato recebido
    if (contentType.includes('application/json')) {
      try {
        const payload = await request.json();
        console.log('📦 Payload JSON recebido:', JSON.stringify(payload, null, 2));
        
        // Extrair email de várias estruturas possíveis
        email = extractEmail(payload);
        status = extractStatus(payload);
      } catch (error) {
        console.error('❌ Erro ao processar JSON:', error);
        
        // Tentar converter o rawData para JSON
        try {
          if (rawData) {
            const payload = JSON.parse(rawData);
            email = extractEmail(payload);
            status = extractStatus(payload);
          }
        } catch (innerError) {
          console.error('❌ Erro ao converter rawData para JSON:', innerError);
        }
      }
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      try {
        const formData = await request.formData();
        const formEntries = Object.fromEntries(formData.entries());
        console.log('📋 FormData recebido:', formEntries);
        
        email = formData.get('email')?.toString() || 
                formData.get('data[email]')?.toString() || 
                formData.get('buyer[email]')?.toString() || '';
                
        status = formData.get('status')?.toString() || 
                 formData.get('purchase[status]')?.toString() || '';
      } catch (error) {
        console.error('❌ Erro ao processar FormData:', error);
        
        // Tentar processar rawData como form data
        if (rawData) {
          try {
            const params = new URLSearchParams(rawData);
            email = params.get('email') || 
                    params.get('data[email]') || 
                    params.get('buyer[email]') || '';
                    
            status = params.get('status') || 
                     params.get('purchase[status]') || '';
          } catch (innerError) {
            console.error('❌ Erro ao processar rawData como form:', innerError);
          }
        }
      }
    } else {
      // Se o contentType não for reconhecido, tentar processar rawData
      if (rawData) {
        // Tentar como JSON
        try {
          const payload = JSON.parse(rawData);
          email = extractEmail(payload);
          status = extractStatus(payload);
        } catch {
          // Tentar como form data
          try {
            const params = new URLSearchParams(rawData);
            email = params.get('email') || 
                    params.get('data[email]') || 
                    params.get('buyer[email]') || '';
                    
            status = params.get('status') || 
                     params.get('purchase[status]') || '';
          } catch (innerError) {
            console.error('❌ Erro ao processar rawData:', innerError);
          }
        }
      }
    }
    
    // Fallback para extração de email específica da Hotmart em last resort
    if (!email && rawData) {
      email = extractEmailFromRawData(rawData);
    }
    
    // Salvar o payload bruto no Firestore para análise posterior
    try {
      await db.collection('webhook_logs').add({
        timestamp: new Date(),
        endpoint: 'pagamento/aprovado',
        contentType,
        headers: headersObj,
        rawData,
        extractedEmail: email,
        extractedStatus: status
      });
      console.log('✅ Log do webhook salvo no Firestore');
    } catch (error) {
      console.error('❌ Erro ao salvar log do webhook:', error);
    }
    
    console.log('🔍 Dados extraídos:', { email, status });

    // Verificar se temos informações suficientes
    if (!email) {
      console.error('❌ Email não encontrado na requisição');
      return NextResponse.json({ 
        message: 'Email não encontrado na requisição.',
        headers: headersObj,
        dataSnippet: rawData.substring(0, 200) + (rawData.length > 200 ? '...' : '')
      }, { status: 200 }); // Mudado para 200 para não retentar
    }

    // Normalizar status para approved (Hotmart pode usar APPROVED, approved, etc)
    const isApproved = status === 'approved' || 
                       status === 'APPROVED' || 
                       status === 'true' || 
                       status === 'active' ||
                       status === 'ACTIVE' ||
                       status?.toUpperCase() === 'APPROVED' ||
                       rawData.includes('APPROVED') ||
                       rawData.includes('approved');

    if (!isApproved && status !== '') {
      console.log(`⚠️ Status não é de aprovação: ${status}`);
      return NextResponse.json({ 
        message: 'Webhook recebido, mas status não é de aprovação.', 
        received: { email, status } 
      }, { status: 200 }); // 200 para não retentar
    }

    // Busca o usuário pelo email
    const usuariosRef = db.collection('usuarios');
    const snapshot = await usuariosRef.where('email', '==', email).limit(1).get();

    if (snapshot.empty) {
      console.log(`⚠️ Usuário com email ${email} não encontrado. Criando registro simplificado.`);
      
      // Criar um documento simples para o usuário
      try {
        const newUserRef = usuariosRef.doc();
        await newUserRef.set({
          email: email,
          nome: email.split('@')[0],
          dataCriacao: new Date(),
          premium: true,
          assinaturaAtiva: true,
          statusAssinatura: 'ativa',
          plano: 'premium',
          dataAssinatura: new Date(),
          dataUltimaAtualizacao: new Date(),
          origem: 'webhook_hotmart'
        });
        
        console.log(`✅ Novo usuário criado com ID: ${newUserRef.id}`);
        return NextResponse.json({ 
          success: true, 
          message: 'Novo usuário criado com sucesso.',
          userId: newUserRef.id
        });
      } catch (error) {
        console.error('❌ Erro ao criar novo usuário:', error);
        return NextResponse.json({ 
          message: 'Erro ao criar usuário.', 
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        }, { status: 200 });
      }
    }

    const doc = snapshot.docs[0];
    const userId = doc.id;

    // Atualiza o usuário
    await usuariosRef.doc(userId).update({
      premium: true,
      assinaturaAtiva: true,
      statusAssinatura: 'ativa',
      plano: 'premium',
      dataAssinatura: new Date(),
      dataUltimaAtualizacao: new Date()
    });

    console.log(`✅ Acesso premium liberado para ${email} (${userId})`);
    return NextResponse.json({ success: true, message: 'Usuário atualizado com sucesso.' });

  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    // Retorna 200 mesmo com erro para o Hotmart não retentar
    return NextResponse.json({ error: 'Erro interno do servidor, mas foi processado.' }, { status: 200 });
  }
}

// Função para extrair email de várias estruturas possíveis
function extractEmail(payload: Record<string, any>): string {
  let email = '';
  
  // Extração direta
  if (payload?.buyer?.email) email = payload.buyer.email;
  else if (payload?.data?.email) email = payload.data.email;
  else if (payload?.client?.email) email = payload.client.email;
  else if (payload?.email) email = payload.email;
  else if (payload?.customer?.email) email = payload.customer.email;
  
  // Extração de subestrutura data 
  if (!email && payload?.data) {
    if (typeof payload.data === 'object') {
      if (payload.data.buyer?.email) email = payload.data.buyer.email;
      else if (payload.data.client?.email) email = payload.data.client.email;
      else if (payload.data.customer?.email) email = payload.data.customer.email;
    }
  }
  
  // Extração de subestrutura purchase
  if (!email && payload?.purchase) {
    if (typeof payload.purchase === 'object') {
      if (payload.purchase.buyer?.email) email = payload.purchase.buyer.email;
      else if (payload.purchase.customer?.email) email = payload.purchase.customer.email;
    }
  }
  
  return email || '';
}

// Função para extrair status de várias estruturas possíveis
function extractStatus(payload: Record<string, any>): string {
  let status = '';
  
  // Extração direta
  if (payload?.status) status = payload.status;
  else if (payload?.purchase?.status) status = payload.purchase.status;
  else if (payload?.data?.status) status = payload.data.status;
  
  // Verificar estruturas de eventos
  if (payload?.event === 'PURCHASE_APPROVED' || 
      payload?.event === 'purchase.approved' || 
      payload?.event === 'purchase_approved') {
    status = 'approved';
  }
  
  // Extração de subestrutura data 
  if (!status && payload?.data) {
    if (typeof payload.data === 'object') {
      if (payload.data.status) status = payload.data.status;
      else if (payload.data.purchase?.status) status = payload.data.purchase.status;
    }
  }
  
  return status || '';
}

// Função para tentar extrair email de dados brutos usando regex
function extractEmailFromRawData(rawData: string): string {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = rawData.match(emailRegex);
  
  if (matches && matches.length > 0) {
    console.log('📧 Emails encontrados via regex:', matches);
    // Pegar o primeiro email encontrado
    return matches[0];
  }
  
  return '';
} 