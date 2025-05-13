import { NextResponse } from 'next/server';
import { db } from '@/firebase/admin';

export async function GET(request: Request) {
  // Extrair o userId da query string
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  if (!userId) {
    return NextResponse.json({ error: 'UserId não fornecido' }, { status: 400 });
  }
  
  try {
    // Buscar documento do usuário no Firestore
    const userRef = db.collection('usuarios').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }
    
    const userData = userDoc.data();
    
    // Retornar status da assinatura
    return NextResponse.json({
      userId,
      statusAssinatura: userData?.statusAssinatura || 'inativa',
      plano: userData?.plano || null,
      dataAssinatura: userData?.dataAssinatura ? userData.dataAssinatura.toDate() : null,
      dataUltimaAtualizacao: userData?.dataUltimaAtualizacao ? userData.dataUltimaAtualizacao.toDate() : null
    });
  } catch (error) {
    console.error('❌ Erro ao verificar status da assinatura:', error);
    return NextResponse.json({ error: 'Erro interno ao verificar status' }, { status: 500 });
  }
} 