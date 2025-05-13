import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc, collection, addDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';

export async function POST(req: NextRequest) {
  try {
    console.log('[API] Iniciando ativação manual de assinatura');
    
    // Obter dados do corpo da requisição
    const { userId, plano = 'basico', provider = 'admin', modo = 'ativa', criarUsuario = false, email } = await req.json();
    console.log('[API] Dados recebidos:', { userId, plano, provider, modo, criarUsuario });
    
    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }

    // Registrar ativação manual para auditoria
    try {
      const webhooksRef = collection(db, 'ativacoes_manuais');
      await addDoc(webhooksRef, {
        userId,
        plano,
        provider,
        dataAtivacao: new Date(),
        ativadoPor: 'admin',
        motivo: 'Ativação manual para teste'
      });
      console.log('[API] Registro de ativação manual salvo');
    } catch (logError) {
      console.error('[API] Erro ao registrar ativação manual:', logError);
      // Continuamos mesmo se o registro falhar
    }
    
    // Atualizar o status da assinatura no Firestore
    try {
      const userRef = doc(db, 'usuarios', userId);
      
      // Verificar se o usuário existe
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        console.log(`[API] Usuário ${userId} não encontrado`);
        
        // Se criarUsuario = true, cria o usuário primeiro
        if (criarUsuario) {
          console.log(`[API] Criando novo usuário para ${userId}`);
          
          // Criar documento de usuário
          await setDoc(userRef, {
            uid: userId,
            email: email || `usuario-${userId}@teste.com`,
            nome: `Usuário ${userId.substring(0, 6)}`,
            dataCadastro: new Date(),
            statusAssinatura: modo === 'teste' ? 'teste' : 'ativa',
            plano: plano,
            dataAssinatura: new Date(),
            dataUltimaAtualizacao: new Date(),
            provider: provider,
            dataExpiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
          });
          
          console.log(`[API] Usuário criado com sucesso!`);
          
          return NextResponse.json({
            success: true,
            message: 'Usuário criado e assinatura ativada com sucesso',
            plano: plano,
            statusAssinatura: modo === 'teste' ? 'teste' : 'ativa',
            created: true
          });
        } else {
          return NextResponse.json(
            { error: 'Usuário não encontrado' },
            { status: 404 }
          );
        }
      }
      
      // Atualizar documento existente
      console.log(`[API] Ativando assinatura do usuário ${userId} (${provider})`);
      await updateDoc(userRef, {
        statusAssinatura: modo === 'teste' ? 'teste' : 'ativa',
        plano: plano,
        dataAssinatura: new Date(),
        dataUltimaAtualizacao: new Date(),
        provider: provider,
        dataExpiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
      });
      console.log(`[API] Status atualizado com sucesso!`);
      
      // Buscar dados atualizados para retornar na resposta
      const updatedUserDoc = await getDoc(userRef);
      const userData = updatedUserDoc.data();
      
      return NextResponse.json({
        success: true,
        message: 'Assinatura ativada com sucesso',
        plano: plano,
        provider: provider,
        statusAssinatura: userData?.statusAssinatura,
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