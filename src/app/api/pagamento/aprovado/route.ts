import { NextResponse } from 'next/server';
import { db } from '@/firebase/admin';

export async function POST(request: Request) {
  try {
    const data = await request.formData();

    const email = data.get('email')?.toString();
    const status = data.get('status')?.toString();

    console.log('🔔 Webhook recebido do Hotmart:', { email, status });

    if (!email || status !== 'approved') {
      return NextResponse.json({ message: 'Dados inválidos ou status não aprovado.' }, { status: 400 });
    }

    // Busca o usuário pelo email
    const usuariosRef = db.collection('usuarios');
    const snapshot = await usuariosRef.where('email', '==', email).limit(1).get();

    if (snapshot.empty) {
      console.log(`⚠️ Usuário com email ${email} não encontrado.`);
      return NextResponse.json({ message: 'Usuário não encontrado.' }, { status: 404 });
    }

    const doc = snapshot.docs[0];
    const userId = doc.id;

    // Atualiza o usuário
    await usuariosRef.doc(userId).update({
      premium: true,
      assinaturaAtiva: true,
      statusAssinatura: 'ativa',
      plano: 'premium',
      dataAssinatura: new Date(),
      dataUltimaAtualizacao: new Date()
    });

    console.log(`✅ Acesso premium liberado para ${email} (${userId})`);
    return NextResponse.json({ success: true, message: 'Usuário atualizado com sucesso.' });

  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
} 