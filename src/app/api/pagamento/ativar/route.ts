import { NextResponse } from 'next/server';
import { db } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    // Extrair dados da requisição
    const data = await request.json();
    const { userId, plano = 'premium', modo = 'teste' } = data;
    
    if (!userId) {
      return NextResponse.json({ error: 'UserId não fornecido' }, { status: 400 });
    }
    
    // Buscar documento do usuário no Firestore
    const userRef = db.collection('usuarios').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }
    
    // Ativar a assinatura manualmente
    const compraId = `manual-${Date.now()}`;
    await userRef.update({
      statusAssinatura: modo === 'teste' ? 'teste' : 'ativa',
      plano: plano,
      dataAssinatura: FieldValue.serverTimestamp(),
      dataUltimaAtualizacao: FieldValue.serverTimestamp(),
      compraId,
      pagamentos: FieldValue.arrayUnion({
        id: compraId,
        data: FieldValue.serverTimestamp(),
        status: 'aprovado',
        plataforma: modo === 'teste' ? 'manual' : 'hotmart',
        plano: plano,
        valor: 0
      })
    });
    
    console.log(`✅ Assinatura ativada manualmente para ${userId} (Plano: ${plano}, Modo: ${modo})`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Assinatura ${modo} ativada com sucesso`,
      data: {
        userId,
        plano,
        statusAssinatura: modo === 'teste' ? 'teste' : 'ativa'
      }
    });
  } catch (error) {
    console.error('❌ Erro ao ativar assinatura:', error);
    return NextResponse.json({ error: 'Erro interno ao ativar assinatura' }, { status: 500 });
  }
} 