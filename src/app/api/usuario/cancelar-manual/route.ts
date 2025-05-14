import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    console.log('[API] Iniciando cancelamento manual de assinatura (teste)');
    
    // Obter dados do corpo da requisição
    const data = await req.json();
    const { userId } = data;
    console.log('[API] Dados recebidos:', { userId });
    
    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }
    
    // Verificar se o usuário existe
    const userRef = db.collection('usuarios').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log(`[API] Usuário não encontrado: ${userId}`);
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }
    
    // Atualizar o status da assinatura no Firestore
    try {
      console.log(`[API] Cancelando assinatura do usuário ${userId}`);
      
      // Atualizar documento
      await userRef.update({
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
  } catch (error) {
    console.error('[API] Erro no processamento da requisição:', error);
    
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
} 