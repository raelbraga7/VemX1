import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    console.log('[API] Iniciando ativação manual de assinatura');
    
    // Obter dados do corpo da requisição
    const { userId, plano = 'premium', provider = 'manual', modo = 'ativa', criarUsuario = true, email } = await req.json();
    console.log('[API] Dados recebidos:', { userId, plano, provider, modo, criarUsuario });
    
    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }

    // Atualizar o status da assinatura no Firestore usando Admin SDK
    try {
      const userRef = db.collection('usuarios').doc(userId);
      
      // Verificar se o usuário existe
      const userDoc = await userRef.get();
      
      // SEMPRE criar ou atualizar o documento, sem verificar se existe
      console.log(`[API] Criando/atualizando usuário para ${userId}`);
      
      // Se o documento não existe, criar
      if (!userDoc.exists) {
        console.log(`[API] Usuário não encontrado, criando novo documento`);
        
        // Criar documento de usuário
        await userRef.set({
          uid: userId,
          email: email || `usuario-${userId.substring(0, 6)}@teste.com`,
          nome: email ? email.split('@')[0] : `Usuário ${userId.substring(0, 6)}`,
          dataCadastro: FieldValue.serverTimestamp(),
          statusAssinatura: modo,
          plano: plano,
          premium: true,
          assinaturaAtiva: true,
          dataAssinatura: FieldValue.serverTimestamp(),
          dataUltimaAtualizacao: FieldValue.serverTimestamp(),
          provider: provider,
          dataExpiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
        });
        
        console.log(`[API] Usuário criado com sucesso!`);
        
        return NextResponse.json({
          success: true,
          message: 'Usuário criado e assinatura ativada com sucesso',
          plano: plano,
          statusAssinatura: modo,
          created: true
        });
      }
      
      // Atualizar documento existente
      console.log(`[API] Ativando assinatura do usuário ${userId} (${provider})`);
      
      // Registrar o log de ativação primeiro
      await db.collection('ativacoes_manuais').add({
        userId,
        plano,
        provider,
        modo,
        timestamp: FieldValue.serverTimestamp(),
        criadoPor: 'api_ativar_manual'
      });
      
      // Atualizar o documento do usuário
      await userRef.update({
        statusAssinatura: modo,
        plano: plano,
        premium: true,
        assinaturaAtiva: true,
        dataAssinatura: FieldValue.serverTimestamp(),
        dataUltimaAtualizacao: FieldValue.serverTimestamp(),
        provider: provider,
        dataExpiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
      });
      
      console.log(`[API] Status atualizado com sucesso!`);
      
      // Buscar dados atualizados para retornar na resposta
      const updatedUserDoc = await userRef.get();
      const userData = updatedUserDoc.data();
      
      return NextResponse.json({
        success: true,
        message: 'Assinatura ativada com sucesso',
        plano: plano,
        provider: provider,
        statusAssinatura: userData?.statusAssinatura,
        userData: {
          email: userData?.email,
          statusAssinatura: userData?.statusAssinatura,
          plano: userData?.plano,
          premium: userData?.premium,
          assinaturaAtiva: userData?.assinaturaAtiva,
          dataAssinatura: userData?.dataAssinatura,
          dataExpiracao: userData?.dataExpiracao
        }
      });
    } catch (dbError: unknown) {
      console.error('[API] Erro ao atualizar status no Firestore:', dbError);
      
      const errorMessage = dbError instanceof Error ? dbError.message : 'Erro desconhecido';
      
      return NextResponse.json(
        { error: 'Erro ao ativar assinatura no banco de dados', details: errorMessage },
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