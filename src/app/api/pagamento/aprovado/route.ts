import { NextResponse } from 'next/server';
import { db } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { randomUUID } from 'crypto';

// Interfaces para tipos de dados
interface UserData {
  email: string;
  nome: string;
  dataCriacao: FieldValue;
  premium: boolean;
  assinaturaAtiva: boolean;
  statusAssinatura: string;
  plano: string;
  dataAssinatura: FieldValue;
  dataUltimaAtualizacao: FieldValue;
  origem: string;
  metodoPagamento: string;
  authId?: string; // Opcional pois nem sempre estará presente
}

// Alterando interface para ser compatível com o Firestore Admin SDK
interface UserUpdateData {
  premium: boolean;
  assinaturaAtiva: boolean;
  statusAssinatura: string;
  plano: string;
  dataAssinatura: FieldValue;
  dataUltimaAtualizacao: FieldValue;
  metodoPagamento: string;
  authId?: string; // Opcional
  [key: string]: any; // Adicionando índice genérico para compatibilidade com o Firestore
}

export async function POST(request: Request) {
  // Adicionar cabeçalhos CORS para permitir requisições de qualquer origem
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Tratar requisições OPTIONS (preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

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
    let transactionId = ''; // Código da transação
    
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

    // Verificar se existe usuário com este email no Auth
    let existingUserId = null;
    let needUserSync = false;

    try {
      // Tenta buscar pelo email no Firebase Auth
      await getAuth().getUserByEmail(email)
        .then(user => {
          existingUserId = user.uid;
          console.log(`✅ Usuário encontrado no Auth: ${existingUserId}`);
          return user;
        })
        .catch(error => {
          console.log(`⚠️ Usuário não encontrado no Auth: ${error.message}`);
          needUserSync = true;
          return null;
        });
    } catch (authError) {
      console.error('❌ Erro ao verificar usuário no Auth:', authError);
      needUserSync = true;
    }

    // Busca o usuário pelo email no Firestore
    const usuariosRef = db.collection('usuarios');
    const snapshot = await usuariosRef.where('email', '==', email).limit(1).get();

    if (snapshot.empty) {
      console.log(`⚠️ Usuário com email ${email} não encontrado no Firestore. Criando registro simplificado.`);
      
      // Criar um documento simples para o usuário
      try {
        let userRef;
        
        // Se temos o ID do usuário do Auth, usar como ID do documento
        if (existingUserId) {
          userRef = usuariosRef.doc(existingUserId);
        } else {
          userRef = usuariosRef.doc(); // Gerar novo ID se não temos o ID do Auth
        }

        const userData: UserData = {
          email: email,
          nome: email.split('@')[0],
          dataCriacao: FieldValue.serverTimestamp(),
          premium: true,
          assinaturaAtiva: true,
          statusAssinatura: 'ativa',
          plano: 'premium',
          dataAssinatura: FieldValue.serverTimestamp(),
          dataUltimaAtualizacao: FieldValue.serverTimestamp(),
          origem: 'webhook_hotmart',
          metodoPagamento: paymentType || 'desconhecido'
        };

        // Se tivermos um ID do Auth, incluir na criação do documento
        if (existingUserId) {
          userData['authId'] = existingUserId;
        }
        
        await userRef.set(userData);
        
        const userId = userRef.id;
        console.log(`✅ Novo usuário criado com ID: ${userId}`);

        // Se o usuário existe no Auth mas não no Firestore, ou se existe no Firestore mas não no Auth
        if (needUserSync && existingUserId) {
          // Tentar atualizar o documento para incluir o authId
          try {
            await userRef.update({
              authId: existingUserId
            });
            console.log(`✅ Documento atualizado com authId: ${existingUserId}`);
          } catch (updateError) {
            console.error('❌ Erro ao atualizar authId:', updateError);
          }
        }
        
        return NextResponse.json({ 
          success: true, 
          message: 'Novo usuário criado com sucesso.',
          userId: userId
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
    const userData = doc.data() as UserData;

    console.log(`✅ Usuário encontrado no Firestore: ${userId}`);
    console.log(`📊 Dados atuais:`, userData);

    // Verificar se este documento tem relação com Auth
    if (!userData.authId && existingUserId) {
      console.log(`⚠️ Documento não tem authId. Adicionando relação com Auth ID: ${existingUserId}`);
      needUserSync = true;
    } else if (userData.authId && userData.authId !== existingUserId && existingUserId) {
      console.log(`⚠️ authId diferente. Firestore: ${userData.authId}, Auth: ${existingUserId}`);
      needUserSync = true;
    }

    // Preparar dados de atualização
    const updateData: UserUpdateData = {
      premium: true,
      assinaturaAtiva: true,
      statusAssinatura: 'ativa',
      plano: 'premium',
      dataAssinatura: FieldValue.serverTimestamp(),
      dataUltimaAtualizacao: FieldValue.serverTimestamp(),
      metodoPagamento: paymentType || 'desconhecido'
    };

    // Adicionar authId se necessário
    if (needUserSync && existingUserId) {
      updateData['authId'] = existingUserId;
    }

    // Adicionar transactionId se estiver disponível
    if (transactionId) {
      updateData['transactionId'] = transactionId;
    }

    // Atualiza o usuário
    try {
      await usuariosRef.doc(userId).update(updateData as Record<string, any>);
      console.log(`✅ Acesso premium liberado para ${email} (${userId})`);
      
      // Atualizar o log para indicar sucesso
      try {
        await db.collection('webhook_logs').add({
          timestamp: FieldValue.serverTimestamp(),
          endpoint: 'pagamento/aprovado',
          status: 'sucesso',
          email,
          userId,
          message: 'Usuário atualizado com sucesso'
        });
      } catch (logError) {
        console.error('❌ Erro ao registrar log de sucesso:', logError);
      }
    } catch (updateError) {
      console.error(`❌ Erro ao atualizar usuário:`, updateError);
      
      // Atualizar o log para indicar erro
      try {
        await db.collection('webhook_logs').add({
          timestamp: FieldValue.serverTimestamp(),
          endpoint: 'pagamento/aprovado',
          status: 'erro',
          email,
          userId,
          error: String(updateError)
        });
      } catch (logError) {
        console.error('❌ Erro ao registrar log de erro:', logError);
      }
      
      throw updateError;
    }

    // Verificar se precisamos sincronizar com Auth
    if (needUserSync && !existingUserId) {
      console.log(`⚠️ Necessário verificar Auth mais tarde para este usuário`);
      // Não podemos criar Auth aqui porque precisamos de senha
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Usuário atualizado com sucesso.',
      userId: userId
    });

  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    // Retorna 200 mesmo com erro para o Hotmart não retentar
    return NextResponse.json({ error: 'Erro interno do servidor, mas foi processado.' }, { status: 200 });
  }
}

// Função para extrair email de várias estruturas possíveis
function extractEmail(payload: Record<string, unknown>): string {
  let email = '';
  console.log('🔍 Procurando email em:', JSON.stringify(payload, null, 2));
  
  // Verificar se temos o transaction ID
  try {
    if (payload?.purchase?.transaction) {
      transactionId = String(payload.purchase.transaction);
      console.log('💰 Transaction ID encontrado:', transactionId);
    } else if (payload?.data?.purchase?.transaction) {
      transactionId = String(payload.data.purchase.transaction);
      console.log('💰 Transaction ID encontrado em data.purchase:', transactionId);
    }
  } catch (e) {
    console.error('❌ Erro ao extrair transaction ID:', e);
  }
  
  // Verificar primeiro nos custom_parameters ou extra_data (prioridade mais alta)
  if (payload?.data && typeof payload.data === 'object' && payload.data !== null) {
    console.log('🔍 Procurando email em data');
    const data = payload.data as Record<string, unknown>;
    
    // Verificar email diretamente em data
    if (data.email && typeof data.email === 'string') {
      email = data.email;
      console.log('📧 Email encontrado diretamente em data:', email);
      return email;
    }
    
    // Verificar se existe purchase com extra_data
    if (data.purchase && typeof data.purchase === 'object' && data.purchase !== null) {
      console.log('🔍 Procurando email em data.purchase');
      const purchase = data.purchase as Record<string, unknown>;
      
      // Hotmart envia o email como um parâmetro personalizado
      if (purchase.extra_data && typeof purchase.extra_data === 'object' && purchase.extra_data !== null) {
        console.log('🔍 Procurando email em data.purchase.extra_data');
        const extraData = purchase.extra_data as Record<string, unknown>;
        if (extraData.email && typeof extraData.email === 'string') {
          email = extraData.email;
          console.log('📧 Email encontrado em extra_data:', email);
          return email; // Retorna imediatamente se encontrou aqui
        }
      }
      
      // Verificar em custom_parameters também
      if (purchase.custom_parameters && typeof purchase.custom_parameters === 'object' && purchase.custom_parameters !== null) {
        console.log('🔍 Procurando email em data.purchase.custom_parameters');
        const customParams = purchase.custom_parameters as Record<string, unknown>;
        if (customParams.email && typeof customParams.email === 'string') {
          email = customParams.email;
          console.log('📧 Email encontrado em custom_parameters:', email);
          return email; // Retorna imediatamente se encontrou aqui
        }
      }
    }
  }
  
  // Verificar em diversos campos possíveis (adicionados mais caminhos)
  try {
    // Verificar em campos comuns do Hotmart
    if (payload?.buyer?.email && typeof payload.buyer.email === 'string') {
      email = payload.buyer.email;
      console.log('📧 Email encontrado em buyer.email:', email);
      return email;
    }
    
    if (payload?.data?.buyer?.email && typeof payload.data.buyer.email === 'string') {
      email = payload.data.buyer.email;
      console.log('📧 Email encontrado em data.buyer.email:', email);
      return email;
    }
    
    if (payload?.customer?.email && typeof payload.customer.email === 'string') {
      email = payload.customer.email;
      console.log('📧 Email encontrado em customer.email:', email);
      return email;
    }
    
    if (payload?.data?.customer?.email && typeof payload.data.customer.email === 'string') {
      email = payload.data.customer.email;
      console.log('📧 Email encontrado em data.customer.email:', email);
      return email;
    }
    
    // Pesquisar email em toda a estrutura (última tentativa)
    const searchEmail = (obj: Record<string, any>, path = ''): string | null => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (key === 'email' && typeof value === 'string' && value.includes('@')) {
          console.log(`📧 Email encontrado em ${currentPath}:`, value);
          return value;
        }
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const result = searchEmail(value, currentPath);
          if (result) return result;
        }
      }
      return null;
    };
    
    if (!email && typeof payload === 'object' && payload !== null) {
      console.log('🔍 Buscando email em toda a estrutura...');
      const foundEmail = searchEmail(payload as Record<string, any>);
      if (foundEmail) {
        email = foundEmail;
        return email;
      }
    }
  } catch (error) {
    console.error('❌ Erro ao extrair email:', error);
  }
  
  console.log(`📧 Resultado final da extração de email: "${email}"`);
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