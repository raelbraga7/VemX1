import { NextResponse } from 'next/server';
import { db } from '@/firebase/admin';

export async function POST(request: Request) {
  try {
    console.log('🔔 Webhook do Hotmart recebido');
    
    // Verificar o content-type para determinar como processar os dados
    const contentType = request.headers.get('content-type') || '';
    console.log(`📋 Content-Type: ${contentType}`);
    
    let email = '';
    let status = '';
    
    // Processar os dados conforme o formato recebido
    if (contentType.includes('application/json')) {
      // Se recebeu JSON
      const payload = await request.json();
      console.log('📦 Payload JSON recebido:', JSON.stringify(payload, null, 2));
      
      // Tentar extrair dados de diferentes estruturas possíveis do Hotmart
      email = payload?.buyer?.email || 
              payload?.data?.email || 
              payload?.client?.email || 
              payload?.email;
              
      status = payload?.status || 
               payload?.purchase?.status || 
               payload?.data?.status;
               
      // Se tiver na estrutura de aprovação específica
      if (payload?.purchase?.status === 'APPROVED' || 
          payload?.purchase?.status === 'approved' || 
          payload?.event === 'PURCHASE_APPROVED') {
        status = 'approved';
      }
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      // Se recebeu formData
      const formData = await request.formData();
      console.log('📋 FormData recebido:', Object.fromEntries(formData.entries()));
      
      email = formData.get('email')?.toString() || '';
      status = formData.get('status')?.toString() || '';
    } else {
      // Se recebeu em outro formato, tenta processar como texto e depois como JSON
      try {
        const text = await request.text();
        console.log('📄 Dados recebidos como texto:', text);
        
        // Tenta converter para JSON caso seja um string JSON
        try {
          const payload = JSON.parse(text);
          email = payload?.buyer?.email || 
                  payload?.data?.email || 
                  payload?.client?.email || 
                  payload?.email;
                  
          status = payload?.status || 
                   payload?.purchase?.status || 
                   payload?.data?.status;
          
          if (payload?.purchase?.status === 'APPROVED' || 
              payload?.purchase?.status === 'approved' || 
              payload?.event === 'PURCHASE_APPROVED') {
            status = 'approved';
          }
        } catch {
          // Se não for JSON, tenta parsear como query string
          const params = new URLSearchParams(text);
          email = params.get('email') || '';
          status = params.get('status') || '';
        }
      } catch (error) {
        console.error('❌ Erro ao processar dados do webhook:', error);
      }
    }
    
    console.log('🔍 Dados extraídos:', { email, status });

    // Verificar se temos informações suficientes
    if (!email) {
      console.error('❌ Email não encontrado na requisição');
      return NextResponse.json({ message: 'Email não encontrado na requisição.' }, { status: 400 });
    }

    // Normalizar status para approved (Hotmart pode usar APPROVED, approved, etc)
    const isApproved = status === 'approved' || 
                       status === 'APPROVED' || 
                       status === 'true' || 
                       status === 'active' ||
                       status === 'ACTIVE';

    if (!isApproved) {
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
      console.log(`⚠️ Usuário com email ${email} não encontrado.`);
      return NextResponse.json({ message: 'Usuário não encontrado.' }, { status: 200 }); // 200 para não retentar
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