import { db } from '@/firebase/config';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

/**
 * Ativa a assinatura de um usuário manualmente
 */
export async function ativarAssinatura(userId: string, plano: string) {
  try {
    console.log(`[AssinaturaService] Ativando assinatura para o usuário ${userId} no plano ${plano}`);
    const userRef = doc(db, 'usuarios', userId);
    
    await updateDoc(userRef, {
      statusAssinatura: 'ativa',
      plano: plano,
      dataAssinatura: new Date(),
      dataUltimaAtualizacao: new Date(),
      provider: 'manual'
    });
    
    return { success: true };
  } catch (error) {
    console.error('Erro ao ativar assinatura:', error);
    return { success: false, error };
  }
}

/**
 * Cancela a assinatura de um usuário
 */
export async function cancelarAssinatura(userId: string) {
  try {
    console.log(`[AssinaturaService] Cancelando assinatura para o usuário ${userId}`);
    const userRef = doc(db, 'usuarios', userId);
    
    await updateDoc(userRef, {
      statusAssinatura: 'cancelada',
      dataUltimaAtualizacao: new Date()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    return { success: false, error };
  }
}

/**
 * Verifica se um usuário tem assinatura ativa
 */
export async function verificarAssinaturaAtiva(userId: string) {
  try {
    const userRef = doc(db, 'usuarios', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return false;
    }
    
    const userData = userDoc.data();
    return userData.statusAssinatura === 'ativa' || userData.statusAssinatura === 'teste';
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error);
    return false;
  }
} 