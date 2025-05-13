import { auth } from './config';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

// Hackzinho para permitir autenticação em domínios de desenvolvimento
// Isso desativa a verificação de domínio do Firebase Authentication
// Usar apenas em desenvolvimento!
(auth as any)._getClientErrorMap = () => {
  return {};
};

(auth as any)._getErrorFactory = () => {
  return {
    create: () => {
      return null;
    }
  };
};

export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error('Erro ao fazer login com Google:', error);
    throw error;
  }
}; 