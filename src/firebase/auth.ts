import { auth } from './config';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';

// Remover os hacks e usar a abordagem recomendada pelo Firebase
export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    
    // Adicionar escopos (opcional)
    provider.addScope('profile');
    provider.addScope('email');
    
    // Definir parâmetros de login personalizados
    provider.setCustomParameters({
      prompt: 'select_account' // Força seleção de conta mesmo se houver apenas uma
    });
    
    // Verificar se estamos em ambiente com suporte a popup
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Em dispositivos móveis, use redirecionamento
      await signInWithRedirect(auth, provider);
      // A função continuará quando o usuário retornar após o redirecionamento
      return null; // O resultado será obtido em outro lugar via getRedirectResult()
    } else {
      // Em desktop, use popup para melhor experiência
      try {
        const result = await signInWithPopup(auth, provider);
        return result.user;
      } catch (popupError) {
        console.error('Erro no popup do Google:', popupError);
        
        // Se o popup falhar, tente redirecionamento como fallback
        console.log('Tentando método alternativo (redirecionamento)...');
        await signInWithRedirect(auth, provider);
        return null;
      }
    }
  } catch (error) {
    console.error('Erro ao fazer login com Google:', error);
    throw error;
  }
};

// Função auxiliar para obter o resultado do redirecionamento
export const getGoogleRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (error) {
    console.error('Erro ao processar resultado do redirecionamento:', error);
    throw error;
  }
}; 