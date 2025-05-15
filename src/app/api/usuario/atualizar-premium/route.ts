import { NextResponse } from 'next/server';
import { db } from '@/firebase/admin';

export async function GET() {
  console.log('🔄 Iniciando atualização de usuários premium...');
  
  try {
    // Buscar todos os usuários com statusAssinatura ativa
    const usuariosRef = db.collection('usuarios');
    const snapshot = await usuariosRef.where('statusAssinatura', '==', 'ativa').get();
    
    if (snapshot.empty) {
      console.log('ℹ️ Nenhum usuário com assinatura ativa encontrado.');
      return NextResponse.json({ 
        message: 'Nenhum usuário com assinatura ativa encontrado'
      });
    }
    
    console.log(`🔍 Encontrados ${snapshot.size} usuários com assinatura ativa.`);
    
    const atualizados = [];
    const erros = [];
    
    // Para cada usuário, verificar se ele tem os campos premium e assinaturaAtiva
    for (const doc of snapshot.docs) {
      const usuario = doc.data();
      const userId = doc.id;
      
      // Verifica se já tem os campos necessários
      if (usuario.premium === true && usuario.assinaturaAtiva === true) {
        console.log(`✅ Usuário ${userId} já tem acesso premium.`);
        continue;
      }
      
      // Atualiza o documento do usuário
      try {
        await db.collection('usuarios').doc(userId).update({
          premium: true,
          assinaturaAtiva: true,
          dataUltimaAtualizacao: new Date()
        });
        
        console.log(`✅ Acesso premium liberado para ${userId} (${usuario.email || 'sem email'}).`);
        atualizados.push({
          id: userId,
          email: usuario.email || 'não disponível'
        });
      } catch (error) {
        console.error(`❌ Erro ao atualizar usuário ${userId}:`, error);
        erros.push({
          id: userId,
          erro: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }
    
    console.log(`🏁 Processo finalizado. ${atualizados.length} usuários atualizados, ${erros.length} erros.`);
    
    return NextResponse.json({ 
      success: true,
      message: `${atualizados.length} usuários atualizados com sucesso.`,
      atualizados,
      erros
    });
  } catch (error) {
    console.error('❌ Erro ao processar atualização de usuários premium:', error);
    return NextResponse.json({ 
      error: 'Erro ao processar atualização',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
} 