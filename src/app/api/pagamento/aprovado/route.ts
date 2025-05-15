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
    let paymentType = ''; // Novo campo para armazenar o tipo de pagamento
    
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
        paymentType = extractPaymentType(payload); // Extrair tipo de pagamento
        
        console.log('💳 Tipo de pagamento detectado:', paymentType);
      } catch (error) {
        console.error('❌ Erro ao processar JSON:', error);
        
        // Tentar converter o rawData para JSON
        try {
          if (rawData) {
            const payload = JSON.parse(rawData);
            email = extractEmail(payload);
            status = extractStatus(payload);
            paymentType = extractPaymentType(payload);
            console.log('💳 Tipo de pagamento detectado (fallback):', paymentType);
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
                 
        paymentType = formData.get('payment[type]')?.toString() || 
                     formData.get('data[purchase][payment][type]')?.toString() || '';
                     
        console.log('💳 Tipo de pagamento detectado (formData):', paymentType);
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
                     
            paymentType = params.get('payment[type]') || 
                         params.get('data[purchase][payment][type]') || '';
                         
            console.log('💳 Tipo de pagamento detectado (params):', paymentType);
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
          paymentType = extractPaymentType(payload);
          console.log('💳 Tipo de pagamento detectado (contentType fallback):', paymentType);
        } catch {
          // Tentar como form data
          try {
            const params = new URLSearchParams(rawData);
            email = params.get('email') || 
                    params.get('data[email]') || 
                    params.get('buyer[email]') || '';
                    
            status = params.get('status') || 
                     params.get('purchase[status]') || '';
                     
            paymentType = params.get('payment[type]') || 
                         params.get('data[purchase][payment][type]') || '';
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
    
    // Verificar se é PIX pelo rawData (último recurso)
    if (!paymentType && rawData) {
      if (rawData.includes('"type":"PIX"') || 
          rawData.includes('"type": "PIX"') || 
          rawData.includes('payment[type]=PIX')) {
        paymentType = 'PIX';
        console.log('💳 PIX detectado via análise de texto');
      }
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
        extractedStatus: status,
        paymentType
      });
      console.log('✅ Log do webhook salvo no Firestore');
    } catch (error) {
      console.error('❌ Erro ao salvar log do webhook:', error);
    }
    
    console.log('🔍 Dados extraídos:', { email, status, paymentType });

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
                       
    // Verificações específicas para PIX
    const isPix = paymentType === 'PIX' || 
                 paymentType === 'pix' || 
                 rawData.includes('"type":"PIX"') || 
                 rawData.includes('payment[type]=PIX');
                 
    if (isPix) {
      console.log('🔄 Pagamento via PIX detectado, forçando aprovação');
      // Se é PIX e o status está presente mas não é um dos aprovados, forçamos aprovação
      // porque o PIX é instantâneo e só notifica quando confirmado
    }

    if (!isApproved && status !== '' && !isPix) {
      console.log(`⚠️ Status não é de aprovação: ${status}`);
      return NextResponse.json({ 
        message: 'Webhook recebido, mas status não é de aprovação.', 
        received: { email, status, paymentType } 
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
          origem: 'webhook_hotmart',
          metodoPagamento: paymentType || 'desconhecido'
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
      dataUltimaAtualizacao: new Date(),
      metodoPagamento: paymentType || 'desconhecido'
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
function extractEmail(payload: Record<string, unknown>): string {
  let email = '';
  
  // Extração direta
  if (payload?.buyer && typeof payload.buyer === 'object' && payload.buyer !== null && 'email' in payload.buyer) 
    email = String(payload.buyer.email);
  else if (payload?.data && typeof payload.data === 'object' && payload.data !== null && 'email' in payload.data) 
    email = String(payload.data.email);
  else if (payload?.client && typeof payload.client === 'object' && payload.client !== null && 'email' in payload.client) 
    email = String(payload.client.email);
  else if (payload?.email && typeof payload.email === 'string') 
    email = payload.email;
  else if (payload?.customer && typeof payload.customer === 'object' && payload.customer !== null && 'email' in payload.customer) 
    email = String(payload.customer.email);
  
  // Extração de subestrutura data 
  if (!email && payload?.data && typeof payload.data === 'object' && payload.data !== null) {
    const data = payload.data as Record<string, unknown>;
    if (data.buyer && typeof data.buyer === 'object' && data.buyer !== null && 'email' in data.buyer)
      email = String(data.buyer.email);
    else if (data.client && typeof data.client === 'object' && data.client !== null && 'email' in data.client)
      email = String(data.client.email);
    else if (data.customer && typeof data.customer === 'object' && data.customer !== null && 'email' in data.customer)
      email = String(data.customer.email);
  }
  
  // Extração de subestrutura purchase
  if (!email && payload?.purchase && typeof payload.purchase === 'object' && payload.purchase !== null) {
    const purchase = payload.purchase as Record<string, unknown>;
    if (purchase.buyer && typeof purchase.buyer === 'object' && purchase.buyer !== null && 'email' in purchase.buyer)
      email = String(purchase.buyer.email);
    else if (purchase.customer && typeof purchase.customer === 'object' && purchase.customer !== null && 'email' in purchase.customer)
      email = String(purchase.customer.email);
  }
  
  return email || '';
}

// Função para extrair status de várias estruturas possíveis
function extractStatus(payload: Record<string, unknown>): string {
  let status = '';
  
  // Extração direta
  if (payload?.status && typeof payload.status === 'string') 
    status = payload.status;
  else if (payload?.purchase && typeof payload.purchase === 'object' && payload.purchase !== null) {
    const purchase = payload.purchase as Record<string, unknown>;
    if (purchase.status && typeof purchase.status === 'string')
      status = purchase.status;
  }
  else if (payload?.data && typeof payload.data === 'object' && payload.data !== null) {
    const data = payload.data as Record<string, unknown>;
    if (data.status && typeof data.status === 'string')
      status = data.status;
  }
  
  // Verificar estruturas de eventos
  if (payload?.event === 'PURCHASE_APPROVED' || 
      payload?.event === 'purchase.approved' || 
      payload?.event === 'purchase_approved') {
    status = 'approved';
  }
  
  // Extração de subestrutura data 
  if (!status && payload?.data && typeof payload.data === 'object' && payload.data !== null) {
    const data = payload.data as Record<string, unknown>;
    if (data.status && typeof data.status === 'string')
      status = data.status;
    else if (data.purchase && typeof data.purchase === 'object' && data.purchase !== null) {
      const purchase = data.purchase as Record<string, unknown>;
      if (purchase.status && typeof purchase.status === 'string')
        status = purchase.status;
    }
  }
  
  return status || '';
}

// Função para extrair o tipo de pagamento
function extractPaymentType(payload: Record<string, unknown>): string {
  let paymentType = '';
  
  // Extração direta
  if (payload?.payment && typeof payload.payment === 'object' && payload.payment !== null) {
    const payment = payload.payment as Record<string, unknown>;
    if (payment.type && typeof payment.type === 'string')
      paymentType = payment.type;
  }
  else if (payload?.purchase && typeof payload.purchase === 'object' && payload.purchase !== null) {
    const purchase = payload.purchase as Record<string, unknown>;
    if (purchase.payment && typeof purchase.payment === 'object' && purchase.payment !== null) {
      const payment = purchase.payment as Record<string, unknown>;
      if (payment.type && typeof payment.type === 'string')
        paymentType = payment.type;
    }
  }
  
  // Extração de subestrutura data 
  if (!paymentType && payload?.data && typeof payload.data === 'object' && payload.data !== null) {
    const data = payload.data as Record<string, unknown>;
    if (data.payment && typeof data.payment === 'object' && data.payment !== null) {
      const payment = data.payment as Record<string, unknown>;
      if (payment.type && typeof payment.type === 'string')
        paymentType = payment.type;
    }
    else if (data.purchase && typeof data.purchase === 'object' && data.purchase !== null) {
      const purchase = data.purchase as Record<string, unknown>;
      if (purchase.payment && typeof purchase.payment === 'object' && purchase.payment !== null) {
        const payment = purchase.payment as Record<string, unknown>;
        if (payment.type && typeof payment.type === 'string')
          paymentType = payment.type;
      }
    }
    
    // Verificar estrutura específica do Hotmart
    if (!paymentType && data.subscription && typeof data.subscription === 'object' && data.subscription !== null) {
      const subscription = data.subscription as Record<string, unknown>;
      if (subscription.plan)
        paymentType = 'SUBSCRIPTION';
    }
  }
  
  return paymentType || '';
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