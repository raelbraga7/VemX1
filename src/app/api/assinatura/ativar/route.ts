import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';

export async function POST(req: NextRequest) {
  try {
    console.log('[API] Iniciando ativação de assinatura');
    
    // Obter dados do corpo da requisição
    const { plano, userId, userEmail } = await req.json();
    console.log('[API] Dados recebidos:', { plano, userId, userEmail });
    
    if (!plano) {
      return NextResponse.json(
        { error: 'Plano é obrigatório' },
        { status: 400 }
      );
    }

    if (!userId || !userEmail) {
      return NextResponse.json(
        { error: 'Dados do usuário são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Atualizar o status da assinatura no Firestore
    try {
      console.log(`[API] Atualizando status da assinatura do usuário ${userId}`);
      const userRef = doc(db, 'usuarios', userId);
      
      // Verificar se o documento existe
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        // Criar documento se não existir
        console.log(`[API] Criando novo documento para usuário ${userId}`);
        await setDoc(userRef, {
          email: userEmail,
          nome: userEmail.split('@')[0],
          dataCriacao: new Date(),
          statusAssinatura: 'ativa',
          plano: plano,
          dataAssinatura: new Date(),
          dataUltimaAtualizacao: new Date(),
          provider: 'manual'
        });
        console.log(`[API] Documento do usuário criado com sucesso!`);
      } else {
        // Atualizar documento existente
        console.log(`[API] Atualizando documento existente do usuário ${userId}`);
        await updateDoc(userRef, {
          statusAssinatura: 'ativa',
          plano: plano,
          dataAssinatura: new Date(),
          dataUltimaAtualizacao: new Date(),
          provider: 'manual'
        });
        console.log(`[API] Status atualizado com sucesso!`);
      }
      
      return NextResponse.json({
        success: true,
        message: 'Assinatura ativada com sucesso'
      });
    } catch (dbError) {
      console.error('[API] Erro ao atualizar status no Firestore:', dbError);
      
      return NextResponse.json(
        { error: 'Erro ao ativar assinatura no banco de dados' },
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
      { error: `Erro ao processar ativação: ${errorMessage}` },
      { status: 500 }
    );
  }
} 