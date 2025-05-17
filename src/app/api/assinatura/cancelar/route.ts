import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    console.log('[API] Iniciando cancelamento de assinatura');
    
    // Obter dados do corpo da requisição
    const { userId, email } = await req.json();
    console.log('[API] Dados recebidos:', { userId, email });
    
    if (!userId && !email) {
      return NextResponse.json(
        { error: 'ID do usuário ou email é obrigatório' },
        { status: 400 }
      );
    }
    
    // Verificar se o usuário existe
    const userRef = doc(db, 'usuarios', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }
    
    // Atualizar os dados do usuário para cancelar a assinatura
    await updateDoc(userRef, {
      statusAssinatura: 'cancelada',
      assinaturaAtiva: false,
      premium: false,
      dataCancelamento: new Date().toISOString()
    });
    
    console.log(`[API] Assinatura cancelada com sucesso!`);
    
    // Registrar cancelamento no histórico
    try {
      await userRef.collection('historico').add({
        tipo: 'cancelamento',
        data: FieldValue.serverTimestamp(),
        detalhes: {
          statusAnterior: userDoc.data()?.statusAssinatura || 'desconhecido',
          plano: userDoc.data()?.plano || 'desconhecido'
        }
      });
      console.log(`[API] Histórico de cancelamento registrado`);
    } catch (historyError) {
      console.error('[API] Erro ao registrar histórico:', historyError);
      // Continua mesmo com erro no histórico
    }
    
    return NextResponse.json({
      success: true,
      message: 'Assinatura cancelada com sucesso'
    });
  } catch (error: unknown) {
    console.error('[API] Erro geral:', error);
    
    let errorMessage = 'Erro desconhecido';
    if (error && typeof error === 'object' && 'message' in error && 
        typeof (error as { message: unknown }).message === 'string') {
      errorMessage = (error as { message: string }).message;
    }
    
    return NextResponse.json(
      { error: `Erro ao processar cancelamento: ${errorMessage}` },
      { status: 500 }
    );
  }
} 