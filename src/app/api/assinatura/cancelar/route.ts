import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/admin';
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
    
    // Atualizar o status da assinatura no Firestore
    try {
      console.log(`[API] Cancelando assinatura do usuário ${userId || email}`);
      
      let userRef;
      
      // Se temos um ID, usamos ele. Caso contrário, buscamos por email
      if (userId) {
        userRef = db.collection('usuarios').doc(userId);
      } else if (email) {
        // Buscar usuário pelo email
        const snapshot = await db.collection('usuarios')
          .where('email', '==', email)
          .limit(1)
          .get();
          
        if (snapshot.empty) {
          console.log(`[API] Usuário com email ${email} não encontrado`);
          return NextResponse.json(
            { error: 'Usuário não encontrado' },
            { status: 404 }
          );
        }
        
        userRef = snapshot.docs[0].ref;
        console.log(`[API] Usuário encontrado pelo email: ${snapshot.docs[0].id}`);
      } else {
        // Caso de segurança, não deveria chegar aqui devido à verificação anterior
        return NextResponse.json(
          { error: 'ID do usuário ou email é obrigatório' },
          { status: 400 }
        );
      }
      
      // Verificar se o documento existe
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        return NextResponse.json(
          { error: 'Usuário não encontrado' },
          { status: 404 }
        );
      }
      
      const userData = userDoc.data() || {};
      console.log(`[API] Dados atuais do usuário:`, userData);
      
      // Preparar os dados para atualização
      const updateData = {
        statusAssinatura: 'cancelada',
        premium: false,
        assinaturaAtiva: false,
        dataCancelamento: FieldValue.serverTimestamp(),
        dataUltimaAtualizacao: FieldValue.serverTimestamp()
      };
      
      console.log(`[API] Atualizando com os dados:`, updateData);
      
      // Atualizar documento
      await userRef.update(updateData);
      
      console.log(`[API] Assinatura cancelada com sucesso!`);
      
      // Registrar cancelamento no histórico
      try {
        await userRef.collection('historico').add({
          tipo: 'cancelamento',
          data: FieldValue.serverTimestamp(),
          detalhes: {
            statusAnterior: userData.statusAssinatura || 'desconhecido',
            plano: userData.plano || 'desconhecido'
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