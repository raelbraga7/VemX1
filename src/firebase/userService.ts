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
}

export const createUser = async (uid: string, nome: string, email: string): Promise<void> => {
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

    await setDoc(doc(db, 'users', uid), userData);
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    throw error;
  }
};

export const getUser = async (uid: string): Promise<UserData | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserData;
    }
    return null;
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    throw error;
  }
};

export const getUserById = async (uid: string): Promise<UserData | null> => {
  return getUser(uid);
};

export const addPeladaToUser = async (uid: string, peladaId: string): Promise<void> => {
  try {
    console.log('Adicionando pelada ao usuário:', { uid, peladaId });
    
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data() as UserData;
      console.log('Usuário encontrado:', userData);
      
      if (!userData.peladas) {
        userData.peladas = [];
      }
      
      if (!userData.peladas.includes(peladaId)) {
        console.log('Atualizando lista de peladas do usuário');
        await setDoc(userRef, {
          ...userData,
          peladas: [...userData.peladas, peladaId]
        });
      } else {
        console.log('Pelada já existe na lista do usuário');
      }
    } else {
      console.log('Criando novo usuário com a pelada');
      // Se o usuário não existir, cria um novo documento
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