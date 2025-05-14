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
    console.log('Ambiente detectado:', isMobile ? 'Mobile' : 'Desktop');
    
    if (isMobile) {
      // Em dispositivos móveis, use redirecionamento
      console.log('Tentando login com Google por redirecionamento (mobile)...');
      try {
        console.log('Auth Domain:', auth.config.authDomain);
        
        // Verificar se estamos em localhost
        const isLocalhost = window.location.hostname === 'localhost';
        console.log('É localhost:', isLocalhost);
        
        // Se estiver em localhost, certifique-se de que a URL completa atual está autorizada no Firebase Console
        if (isLocalhost) {
          console.log('URL atual:', window.location.href);
          console.log('Origem:', window.location.origin);
        }
        
        await signInWithRedirect(auth, provider);
        console.log('Redirecionamento iniciado. Aguardando retorno...');
        // A função continuará quando o usuário retornar após o redirecionamento
        return null; // O resultado será obtido em outro lugar via getRedirectResult()
      } catch (redirectError) {
        console.error('Erro no redirecionamento para autenticação Google:', redirectError);
        throw redirectError;
      }
    } else {
      // Em desktop, use popup para melhor experiência
      try {
        console.log('Tentando login com Google via popup (desktop)...');
        const result = await signInWithPopup(auth, provider);
        console.log('Login com popup bem-sucedido');
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
    console.log('Verificando resultado do redirecionamento do Google...');
    const result = await getRedirectResult(auth);
    if (result) {
      console.log('Resultado do redirecionamento obtido com sucesso:', result.user.uid);
      return result.user;
    } else {
      console.log('Nenhum resultado de redirecionamento encontrado');
      return null;
    }
  } catch (error) {
    console.error('Erro ao processar resultado do redirecionamento:', error);
    throw error;
  }
}; 