import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/admin';
import { auth } from '@/firebase/admin';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  // Configurar headers CORS para permitir solicitações de qualquer origem
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  
  // Responder a solicitações OPTIONS (preflight requests)
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers });
  }
  
  try {
    console.log('[API] Iniciando cancelamento manual de assinatura (teste)');
    
    // Obter dados do corpo da requisição
    const data = await req.json();
    const { userId } = data;
    console.log('[API] Dados recebidos:', { userId });
    
    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400, headers }
      );
    }
    
    // Verificar se o usuário existe
    const userRef = db.collection('usuarios').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log(`[API] Usuário não encontrado: ${userId}`);
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404, headers }
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
      }, { headers });
    } catch (dbError) {
      console.error('[API] Erro ao atualizar status no Firestore:', dbError);
      
      return NextResponse.json(
        { error: 'Erro ao cancelar assinatura no banco de dados' },
        { status: 500, headers }
      );
    }
  } catch (error) {
    console.error('[API] Erro no processamento da requisição:', error);
    
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500, headers }
    );
  }
}

export async function OPTIONS() {
  // Manipulador específico para requisições OPTIONS
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET() {
  try {
    // Obter o token da sessão dos cookies
    const sessionCookie = cookies().get('session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.redirect('/login');
    }
    
    // Verificar o token com o Firebase
    const decodedClaims = await auth.verifySessionCookie(sessionCookie);
    const userId = decodedClaims.uid;
    
    if (!userId) {
      return NextResponse.redirect('/login');
    }
    
    // Atualizar o status da assinatura no Firestore
    await db.collection('usuarios').doc(userId).update({
      assinaturaAtiva: false,
      premium: false,
      statusAssinatura: 'cancelada',
      plano: null
    });
    
    // Redirecionar para o dashboard com mensagem de sucesso
    return NextResponse.redirect('/dashboard?message=Assinatura+cancelada+com+sucesso');
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    return NextResponse.redirect('/dashboard?error=Erro+ao+cancelar+assinatura');
  }
} 