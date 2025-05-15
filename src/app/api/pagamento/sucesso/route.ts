import { NextResponse } from 'next/server';
import { db } from '@/firebase/admin';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const email = url.searchParams.get('email');
  const transactionId = url.searchParams.get('transaction') || url.searchParams.get('transactionId');
  
  console.log('🎉 Página de sucesso de pagamento acessada:', {
    userId,
    email,
    transactionId
  });
  
  if (!userId) {
    console.log('❌ Redirecionamento sem userId. Redirecionando para o dashboard.');
    return NextResponse.redirect(new URL('/dashboard?pagamento=incompleto', url.origin));
  }
  
  try {
    // Buscar o documento do usuário no Firestore
    const userRef = db.collection('usuarios').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log(`❌ Usuário ${userId} não encontrado. Criando novo usuário.`);
      
      if (!email) {
        console.error('❌ Email não fornecido para criar usuário.');
        return NextResponse.redirect(new URL('/dashboard?pagamento=erro&motivo=email_ausente', url.origin));
      }
      
      // Criar um novo documento de usuário
      await userRef.set({
        uid: userId,
        email: email,
        nome: email.split('@')[0],
        dataCadastro: new Date(),
        statusAssinatura: 'ativa',
        plano: 'premium',
        premium: true,
        assinaturaAtiva: true,
        dataAssinatura: new Date(),
        dataUltimaAtualizacao: new Date(),
        compraId: transactionId || `hotmart-${Date.now()}`,
        provider: 'hotmart'
      });
      
      console.log(`✅ Novo usuário criado com sucesso: ${userId}`);
    } else {
      // Atualizar documento existente
      await userRef.update({
        statusAssinatura: 'ativa',
        plano: 'premium',
        premium: true,
        assinaturaAtiva: true,
        dataAssinatura: new Date(),
        dataUltimaAtualizacao: new Date(),
        compraId: transactionId || `hotmart-${Date.now()}`,
        provider: 'hotmart'
      });
      
      console.log(`✅ Usuário ${userId} atualizado com acesso premium!`);
    }
    
    // Redirecionar para o dashboard com parâmetros de sucesso
    return NextResponse.redirect(new URL('/dashboard?pagamento=sucesso&plano=premium', url.origin));
  } catch (error) {
    console.error('❌ Erro ao processar página de sucesso:', error);
    return NextResponse.redirect(new URL('/dashboard?pagamento=erro', url.origin));
  }
} 