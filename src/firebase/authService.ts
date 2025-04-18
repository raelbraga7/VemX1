import { createUserWithEmailAndPassword, signInWithEmailAndPassword, AuthError } from 'firebase/auth';
import { auth } from './config';
import { getUser } from './userService';

// Função para cadastro
export const signUp = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    const firebaseError = error as AuthError;
    console.log('Firebase Error Code:', firebaseError.code); // Log para debug
    
    // Tratamento de erros específicos do Firebase
    switch (firebaseError.code) {
      case 'auth/email-already-in-use':
        throw new Error('Este e-mail já está em uso');
      case 'auth/invalid-email':
        throw new Error('E-mail inválido');
      case 'auth/operation-not-allowed':
        throw new Error('Operação não permitida');
      case 'auth/weak-password':
        throw new Error('A senha deve ter pelo menos 6 caracteres');
      default:
        // Incluir o código do erro para debug
        throw new Error(`Erro no cadastro: ${firebaseError.code}`);
    }
  }
};

// Função para login
export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userData = await getUser(userCredential.user.uid);
    return {
      ...userCredential.user,
      nome: userData?.nome || ''
    };
  } catch (error) {
    const firebaseError = error as AuthError;
    console.log('Firebase Error Code:', firebaseError.code); // Log para debug
    
    // Tratamento de erros específicos do Firebase
    switch (firebaseError.code) {
      case 'auth/invalid-email':
        throw new Error('E-mail inválido');
      case 'auth/user-disabled':
        throw new Error('Usuário desabilitado');
      case 'auth/user-not-found':
        throw new Error('Usuário não encontrado');
      case 'auth/wrong-password':
        throw new Error('Senha incorreta');
      default:
        // Incluir o código do erro para debug
        throw new Error(`Erro no login: ${firebaseError.code}`);
    }
  }
}; 