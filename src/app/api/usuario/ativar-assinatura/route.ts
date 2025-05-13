import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    console.log('[API] Iniciando ativação de assinatura');
    
    const { userId, plano, criarUsuario = false, email } = await req.json();
    
    console.log('[API] Dados recebidos:', { userId, plano, criarUsuario, email });
    
    if (!userId || !plano) {
      return NextResponse.json(
        { error: 'Parâmetros faltando' },
        { status: 400 }
      );
    }
    
    // Registrar log de ativação
    try {
      await db.collection('ativacoes_manuais').add({
        userId,
        plano,
        provider: 'api',
        dataAtivacao: FieldValue.serverTimestamp(),
        ativadoPor: 'api',
        motivo: 'Ativação via API'
      });
    } catch (logError) {
      console.error('[API] Erro ao registrar ativação:', logError);
      // Continuar mesmo se o registro falhar
    }
    
    // Atualizar o status da assinatura no Firestore
    try {
      // Verificar se o usuário existe
      const userRef = db.collection('usuarios').doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        console.log(`[API] Usuário ${userId} não encontrado`);
        
        // Se criarUsuario = true, cria o usuário
        if (criarUsuario && email) {
          console.log(`[API] Criando novo usuário para ${userId}`);
          
          // Definir data de expiração (30 dias)
          const dataExpiracao = new Date();
          dataExpiracao.setDate(dataExpiracao.getDate() + 30);
          
          // Criar documento de usuário
          await userRef.set({
            uid: userId,
            email: email,
            nome: email.split('@')[0],
            dataCadastro: FieldValue.serverTimestamp(),
            statusAssinatura: 'ativa',
            plano: plano,
            dataAssinatura: FieldValue.serverTimestamp(),
            dataUltimaAtualizacao: FieldValue.serverTimestamp(),
            dataExpiracao: dataExpiracao,
            provider: 'api'
          });
          
          console.log(`[API] Usuário criado com sucesso e assinatura ativada!`);
          
          return NextResponse.json({
            success: true,
            message: 'Usuário criado e assinatura ativada com sucesso',
            statusAssinatura: 'ativa',
            plano: plano
          });
        } else {
          return NextResponse.json(
            { error: 'Usuário não encontrado' },
            { status: 404 }
          );
        }
      }
      
      // Definir data de expiração (30 dias)
      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + 30);
      
      // Atualizar documento existente
      console.log(`[API] Atualizando assinatura do usuário ${userId}`);
      await userRef.update({
        statusAssinatura: 'ativa',
        plano: plano,
        dataAssinatura: FieldValue.serverTimestamp(),
        dataUltimaAtualizacao: FieldValue.serverTimestamp(),
        dataExpiracao: dataExpiracao,
        provider: 'api'
      });
      
      console.log(`[API] Assinatura ativada com sucesso!`);
      
      // Verificar se a atualização funcionou
      const userDocAtualizado = await userRef.get();
      const userData = userDocAtualizado.data();
      
      return NextResponse.json({ 
        success: true, 
        message: 'Assinatura ativada com sucesso',
        statusAssinatura: userData?.statusAssinatura,
        plano: userData?.plano,
        provider: userData?.provider
      });
    } catch (dbError) {
      console.error('[API] Erro ao atualizar status no Firestore:', dbError);
      
      const errorMessage = dbError instanceof Error ? dbError.message : 'Erro desconhecido';
      
      return NextResponse.json(
        { error: 'Erro ao ativar assinatura no banco de dados', details: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[API] Erro geral:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return NextResponse.json(
      { error: `Erro ao processar ativação: ${errorMessage}` },
      { status: 500 }
    );
  }
} 