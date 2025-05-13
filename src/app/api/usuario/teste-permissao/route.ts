import { NextResponse } from 'next/server';
import { db } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET() {
  try {
    console.log('[API] Iniciando teste de permissão do Firebase Admin');
    
    const testId = `test-${Date.now()}`;
    const resultados = [];
    
    // Teste 1: Escrever em ativacoes_manuais
    try {
      const docRef = await db.collection('ativacoes_manuais').doc(testId);
      await docRef.set({
        teste: true,
        timestamp: FieldValue.serverTimestamp()
      });
      resultados.push({ coleção: 'ativacoes_manuais', sucesso: true });
    } catch (error) {
      console.error('[API] Erro ao testar escrita em ativacoes_manuais:', error);
      resultados.push({ 
        coleção: 'ativacoes_manuais', 
        sucesso: false, 
        erro: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
    
    // Teste 2: Escrever em usuarios
    try {
      const docRef = await db.collection('usuarios').doc(testId);
      await docRef.set({
        teste: true,
        timestamp: FieldValue.serverTimestamp()
      });
      resultados.push({ coleção: 'usuarios', sucesso: true });
    } catch (error) {
      console.error('[API] Erro ao testar escrita em usuarios:', error);
      resultados.push({ 
        coleção: 'usuarios', 
        sucesso: false, 
        erro: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
    
    // Teste 3: Escrever em hotmart_webhooks
    try {
      const docRef = await db.collection('hotmart_webhooks').doc(testId);
      await docRef.set({
        teste: true,
        timestamp: FieldValue.serverTimestamp()
      });
      resultados.push({ coleção: 'hotmart_webhooks', sucesso: true });
    } catch (error) {
      console.error('[API] Erro ao testar escrita em hotmart_webhooks:', error);
      resultados.push({ 
        coleção: 'hotmart_webhooks', 
        sucesso: false, 
        erro: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
    
    // Limpar os documentos de teste após o teste
    for (const resultado of resultados) {
      if (resultado.sucesso) {
        try {
          await db.collection(resultado.coleção).doc(testId).delete();
        } catch (error) {
          console.warn(`[API] Aviso: Não foi possível excluir o documento de teste em ${resultado.coleção}:`, error);
        }
      }
    }
    
    return NextResponse.json({
      sucesso: true,
      resultados,
      mensagem: 'Teste de permissão concluído'
    });
  } catch (error) {
    console.error('[API] Erro ao testar permissões:', error);
    
    return NextResponse.json({
      sucesso: false,
      erro: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
} 