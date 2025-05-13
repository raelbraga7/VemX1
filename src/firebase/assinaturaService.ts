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
    console.log(`[AssinaturaService] Verificando assinatura do usuário: ${userId}`);
    const userRef = doc(db, 'usuarios', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log(`[AssinaturaService] Usuário ${userId} não encontrado no Firestore`);
      return false;
    }
    
    const userData = userDoc.data();
    console.log(`[AssinaturaService] Dados do usuário:`, JSON.stringify({
      userId,
      statusAssinatura: userData?.statusAssinatura || 'não definido',
      plano: userData?.plano || 'não definido',
      dataAssinatura: userData?.dataAssinatura ? userData.dataAssinatura.toDate().toISOString() : 'não definida'
    }, null, 2));
    
    const isAtiva = userData?.statusAssinatura === 'ativa' || userData?.statusAssinatura === 'teste';
    console.log(`[AssinaturaService] Assinatura ativa? ${isAtiva ? 'SIM' : 'NÃO'}`);
    return isAtiva;
  } catch (error) {
    console.error('[AssinaturaService] Erro ao verificar assinatura:', error);
    return false;
  }
};

// Atualizar status da assinatura manualmente (para testes ou correções)
export const atualizarStatusAssinatura = async (userId: string, status: 'ativa' | 'cancelada' | 'teste' | 'pendente', plano: string = 'basico'): Promise<boolean> => {
  try {
    console.log(`[AssinaturaService] Atualizando status da assinatura do usuário ${userId} para ${status}`);
    const userRef = doc(db, 'usuarios', userId);
    
    await updateDoc(userRef, {
      statusAssinatura: status,
      plano: plano,
      dataUltimaAtualizacao: new Date()
    });
    
    console.log(`[AssinaturaService] Status da assinatura atualizado com sucesso`);
    return true;
  } catch (error) {
    console.error('[AssinaturaService] Erro ao atualizar status da assinatura:', error);
    return false;
  }
};

// Obter informações da assinatura do usuário
export const obterInfoAssinatura = async (userId: string): Promise<InfoAssinatura | null> => {
  try {
    console.log(`[AssinaturaService] Obtendo informações da assinatura do usuário: ${userId}`);
    const userRef = doc(db, 'usuarios', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log(`[AssinaturaService] Usuário ${userId} não encontrado no Firestore`);
      return null;
    }
    
    const userData = userDoc.data();
    
    const infoAssinatura = {
      plano: userData?.plano || null,
      statusAssinatura: userData?.statusAssinatura || 'indefinida',
      dataAssinatura: userData?.dataAssinatura ? new Date(userData.dataAssinatura.toDate()) : null,
      dataUltimaAtualizacao: userData?.dataUltimaAtualizacao ? new Date(userData.dataUltimaAtualizacao.toDate()) : null,
      mpPreferenceId: userData?.mpPreferenceId || null,
      mpSubscriptionId: userData?.mpSubscriptionId || null,
      provider: userData?.provider || null
    };
    
    console.log(`[AssinaturaService] Informações da assinatura recuperadas:`, JSON.stringify(infoAssinatura, (key, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    }, 2));
    
    return infoAssinatura;
  } catch (error) {
    console.error('[AssinaturaService] Erro ao obter informações de assinatura:', error);
    return null;
  }
};

// Cancelar assinatura
export const cancelarAssinatura = async (userId: string): Promise<boolean> => {
  try {
    console.log(`[AssinaturaService] Iniciando cancelamento de assinatura para o usuário: ${userId}`);
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
    
    console.log(`[AssinaturaService] Assinatura cancelada com sucesso`);
    return true;
  } catch (error) {
    console.error('[AssinaturaService] Erro ao cancelar assinatura:', error);
    return false;
  }
};

// Verificar recursos disponíveis com base no plano
export const verificarRecursoDisponivel = async (
  userId: string, 
  recurso: 'jogadoresMaximos' | 'peladasMaximas' | 'estatisticasAvancadas' | 'exportacaoRelatorios'
): Promise<boolean> => {
  try {
    console.log(`[AssinaturaService] Verificando disponibilidade do recurso '${recurso}' para o usuário: ${userId}`);
    const infoAssinatura = await obterInfoAssinatura(userId);
    
    if (!infoAssinatura || infoAssinatura.statusAssinatura !== 'ativa') {
      console.log(`[AssinaturaService] Recurso indisponível - status da assinatura não é 'ativa'`);
      return false;
    }
    
    const plano = infoAssinatura.plano;
    let disponivel = false;
    
    // Regras de acesso por plano
    switch (recurso) {
      case 'jogadoresMaximos':
        disponivel = plano === 'premium' || false; // Premium: ilimitado, Básico: 20
        break;
      case 'peladasMaximas':
        disponivel = plano === 'premium' || false; // Premium: ilimitado, Básico: 5
        break;
      case 'estatisticasAvancadas':
        disponivel = plano === 'premium'; // Disponível apenas no Premium
        break;
      case 'exportacaoRelatorios':
        disponivel = plano === 'premium'; // Disponível apenas no Premium
        break;
      default:
        disponivel = false;
    }
    
    console.log(`[AssinaturaService] Recurso '${recurso}' ${disponivel ? 'disponível' : 'indisponível'} para o plano '${plano}'`);
    return disponivel;
  } catch (error) {
    console.error(`[AssinaturaService] Erro ao verificar recurso disponível:`, error);
    return false;
  }
}; 