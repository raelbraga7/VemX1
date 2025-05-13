import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';

export async function POST(req: NextRequest) {
  try {
    console.log('[API] Iniciando cancelamento de assinatura');
    
    // Obter dados do corpo da requisição
    const { userId } = await req.json();
    console.log('[API] Dados recebidos:', { userId });
    
    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }
    
    // Atualizar o status da assinatura no Firestore
    try {
      console.log(`[API] Cancelando assinatura do usuário ${userId}`);
      const userRef = doc(db, 'usuarios', userId);
      
      // Verificar se o documento existe
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        return NextResponse.json(
          { error: 'Usuário não encontrado' },
          { status: 404 }
        );
      }
      
      // Atualizar documento
      await updateDoc(userRef, {
        statusAssinatura: 'cancelada',
        dataUltimaAtualizacao: new Date()
      });
      
      console.log(`[API] Assinatura cancelada com sucesso!`);
      
      return NextResponse.json({
        success: true,
        message: 'Assinatura cancelada com sucesso'
      });
    } catch (dbError) {
      console.error('[API] Erro ao atualizar status no Firestore:', dbError);
      
      return NextResponse.json(
        { error: 'Erro ao cancelar assinatura no banco de dados' },
        { status: 500 }
      );
    }
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