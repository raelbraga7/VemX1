import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { cancelSubscription } from '@/lib/mercadopago';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }
    
    // Buscar dados do usuário
    const userRef = doc(db, 'usuarios', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }
    
    const userData = userDoc.data();
    
    const subscriptionId = userData.mpSubscriptionId;
    
    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Usuário não possui assinatura ativa no Mercado Pago' },
        { status: 400 }
      );
    }

    try {
      // Cancelar a assinatura no Mercado Pago
      await cancelSubscription(subscriptionId);
      
      // Atualizar o status no Firestore
      await updateDoc(userRef, {
        statusAssinatura: 'cancelada',
        dataUltimaAtualizacao: new Date()
      });
      
      return NextResponse.json({ success: true });
    } catch (mpError) {
      console.error('Erro ao cancelar assinatura no Mercado Pago:', mpError);
      
      // Mesmo em caso de erro no Mercado Pago, tentamos atualizar o status no Firestore
      // para evitar inconsistências
      await updateDoc(userRef, {
        statusAssinatura: 'cancelada',
        dataUltimaAtualizacao: new Date()
      });
      
      return NextResponse.json(
        { error: 'Erro ao cancelar assinatura no Mercado Pago, mas status atualizado localmente' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Erro ao processar cancelamento de assinatura:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar cancelamento' },
      { status: 500 }
    );
  }
} 