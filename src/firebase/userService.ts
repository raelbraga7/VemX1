import { db } from './config';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export interface UserData {
  uid: string;
  nome: string;
  email: string;
  dataCriacao: Date;
  peladas: string[]; // IDs das peladas que o usuário participa
  vitorias: number;
  gols: number;
  assistencias: number;
  photoURL?: string; // URL opcional da foto do perfil
  convidadoPor?: string; // Novo campo: quem convidou o usuário
  // Campos de assinatura
  premium?: boolean;
  assinaturaAtiva?: boolean;
  statusAssinatura?: string;
  plano?: string;
}

export const createUser = async (uid: string, nome: string, email: string, convidadoPor?: string): Promise<void> => {
  try {
    const userData: UserData = {
      uid,
      nome,
      email,
      dataCriacao: new Date(),
      peladas: [],
      vitorias: 0,
      gols: 0,
      assistencias: 0
    };
    
    // Adiciona a informação de quem convidou, se disponível
    if (convidadoPor) {
      userData.convidadoPor = convidadoPor;
    }

    await setDoc(doc(db, 'usuarios', uid), userData);
    
    console.log(`Usuário ${uid} criado na coleção 'usuarios'`);
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    throw error;
  }
};

export const getUser = async (uid: string): Promise<UserData | null> => {
  try {
    if (!uid) {
      console.error('UID não fornecido para getUser');
      return null;
    }

    console.log('Buscando usuário:', uid);
    
    const userDoc = await getDoc(doc(db, 'usuarios', uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log(`Usuário ${uid} encontrado na coleção 'usuarios'`);
      
      // Garante que todos os campos obrigatórios existam
      return {
        uid: userData.uid || uid,
        nome: userData.nome || 'Usuário',
        email: userData.email || '',
        dataCriacao: userData.dataCriacao?.toDate() || new Date(),
        peladas: Array.isArray(userData.peladas) ? userData.peladas : [],
        vitorias: userData.vitorias || 0,
        gols: userData.gols || 0,
        assistencias: userData.assistencias || 0,
        photoURL: userData.photoURL,
        // Campos de assinatura
        premium: userData.premium,
        assinaturaAtiva: userData.assinaturaAtiva,
        statusAssinatura: userData.statusAssinatura,
        plano: userData.plano
      };
    }
    
    console.log(`Usuário ${uid} não encontrado na coleção 'usuarios', tentando na coleção 'users'...`);
    const legacyUserDoc = await getDoc(doc(db, 'users', uid));
    
    if (legacyUserDoc.exists()) {
      const userData = legacyUserDoc.data();
      console.log(`Usuário ${uid} encontrado na coleção 'users'. Migração recomendada.`);
      
      // Retorna os dados da coleção 'users'
      return {
        uid: userData.uid || uid,
        nome: userData.nome || 'Usuário',
        email: userData.email || '',
        dataCriacao: userData.dataCriacao?.toDate() || new Date(),
        peladas: Array.isArray(userData.peladas) ? userData.peladas : [],
        vitorias: userData.vitorias || 0,
        gols: userData.gols || 0,
        assistencias: userData.assistencias || 0,
        photoURL: userData.photoURL
      };
    }
    
    console.log('Usuário não encontrado em nenhuma coleção:', uid);
    return null;
  } catch (error) {
    console.error('Erro detalhado ao buscar usuário:', {
      error,
      uid,
      errorMessage: error instanceof Error ? error.message : 'Erro desconhecido'
    });
    return null; // Retorna null em vez de lançar erro
  }
};

export const getUserById = async (uid: string): Promise<UserData | null> => {
  return getUser(uid);
};

export const addPeladaToUser = async (uid: string, peladaId: string): Promise<void> => {
  try {
    if (!uid || !peladaId) {
      throw new Error('UID e peladaId são obrigatórios');
    }

    console.log('Adicionando pelada ao usuário:', { uid, peladaId });
    
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log('Usuário encontrado:', userData);
      
      // Garante que peladas seja um array
      const peladas = Array.isArray(userData.peladas) ? userData.peladas : [];
      
      if (!peladas.includes(peladaId)) {
        console.log('Atualizando lista de peladas do usuário');
        const dadosAtualizados = {
          ...userData,
          peladas: [...peladas, peladaId],
          // Garante que campos obrigatórios existam
          nome: userData.nome || 'Usuário',
          email: userData.email || '',
          dataCriacao: userData.dataCriacao || new Date(),
          vitorias: userData.vitorias || 0,
          gols: userData.gols || 0,
          assistencias: userData.assistencias || 0
        };
        await setDoc(userRef, dadosAtualizados);
        console.log('Pelada adicionada com sucesso ao usuário');
      } else {
        console.log('Pelada já existe na lista do usuário');
      }
    } else {
      console.log('Criando novo usuário com a pelada');
      const newUserData: UserData = {
        uid,
        nome: 'Usuário',
        email: '',
        dataCriacao: new Date(),
        peladas: [peladaId],
        vitorias: 0,
        gols: 0,
        assistencias: 0
      };
      await setDoc(userRef, newUserData);
      console.log('Novo usuário criado com a pelada');
    }
  } catch (error) {
    console.error('Erro detalhado ao adicionar pelada ao usuário:', {
      error,
      uid,
      peladaId,
      errorMessage: error instanceof Error ? error.message : 'Erro desconhecido'
    });
    throw error;
  }
}; 