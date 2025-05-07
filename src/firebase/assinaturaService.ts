import { db } from './config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// Interface para informações de assinatura
export interface InfoAssinatura {
  plano: string | null;
  statusAssinatura: 'ativa' | 'inadimplente' | 'cancelada' | 'pendente' | 'incompleta' | 'expirada' | 'teste' | 'indefinida';
  dataAssinatura: Date | null;
  dataUltimaAtualizacao: Date | null;
  mpPreferenceId: string | null;
  mpSubscriptionId: string | null;
  provider: 'mercadopago' | null;
}

// Verificar se o usuário possui assinatura ativa
export const verificarAssinaturaAtiva = async (userId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, 'usuarios', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return false;
    }
    
    const userData = userDoc.data();
    return userData?.statusAssinatura === 'ativa' || userData?.statusAssinatura === 'teste';
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error);
    return false;
  }
};

// Obter informações da assinatura do usuário
export const obterInfoAssinatura = async (userId: string): Promise<InfoAssinatura | null> => {
  try {
    const userRef = doc(db, 'usuarios', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    const userData = userDoc.data();
    
    return {
      plano: userData?.plano || null,
      statusAssinatura: userData?.statusAssinatura || 'indefinida',
      dataAssinatura: userData?.dataAssinatura ? new Date(userData.dataAssinatura.toDate()) : null,
      dataUltimaAtualizacao: userData?.dataUltimaAtualizacao ? new Date(userData.dataUltimaAtualizacao.toDate()) : null,
      mpPreferenceId: userData?.mpPreferenceId || null,
      mpSubscriptionId: userData?.mpSubscriptionId || null,
      provider: userData?.provider || null
    };
  } catch (error) {
    console.error('Erro ao obter informações de assinatura:', error);
    return null;
  }
};

// Cancelar assinatura
export const cancelarAssinatura = async (userId: string): Promise<boolean> => {
  try {
    // Chamar o backend para cancelar no Mercado Pago
    const response = await fetch('/api/subscription/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
    
    if (!response.ok) {
      throw new Error('Erro ao cancelar assinatura no Mercado Pago');
    }
    
    // Atualizar status no Firestore
    const userRef = doc(db, 'usuarios', userId);
    await updateDoc(userRef, {
      statusAssinatura: 'cancelada',
      dataUltimaAtualizacao: new Date()
    });
    
    return true;
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    return false;
  }
};

// Verificar recursos disponíveis com base no plano
export const verificarRecursoDisponivel = async (
  userId: string, 
  recurso: 'jogadoresMaximos' | 'peladasMaximas' | 'estatisticasAvancadas' | 'exportacaoRelatorios'
): Promise<boolean> => {
  try {
    const infoAssinatura = await obterInfoAssinatura(userId);
    
    if (!infoAssinatura || infoAssinatura.statusAssinatura !== 'ativa') {
      return false;
    }
    
    const plano = infoAssinatura.plano;
    
    // Regras de acesso por plano
    switch (recurso) {
      case 'jogadoresMaximos':
        return plano === 'premium' || false; // Premium: ilimitado, Básico: 20
      case 'peladasMaximas':
        return plano === 'premium' || false; // Premium: ilimitado, Básico: 5
      case 'estatisticasAvancadas':
        return plano === 'premium'; // Disponível apenas no Premium
      case 'exportacaoRelatorios':
        return plano === 'premium'; // Disponível apenas no Premium
      default:
        return false;
    }
  } catch (error) {
    console.error('Erro ao verificar recurso disponível:', error);
    return false;
  }
}; 