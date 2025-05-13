import { NextResponse } from 'next/server';
import { db } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    // Extrair dados da requisição
    const data = await request.json();
    const { userId, plano, email } = data;
    
    if (!userId || !plano) {
      return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 });
    }
    
    // Buscar documento do usuário no Firestore
    const userRef = db.collection('usuarios').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }
    
    // Registrar a tentativa de pagamento
    await userRef.update({
      tentativasPagamento: FieldValue.arrayUnion({
        data: FieldValue.serverTimestamp(),
        plano,
        plataforma: 'hotmart',
        status: 'iniciado'
      })
    });
    
    console.log(`✅ Tentativa de pagamento registrada para ${userId} (${email}), plano: ${plano}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao registrar tentativa de pagamento:', error);
    return NextResponse.json({ error: 'Erro interno ao registrar tentativa de pagamento' }, { status: 500 });
  }
} 