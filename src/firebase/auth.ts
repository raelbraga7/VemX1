import { auth } from './config';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, AuthError } from 'firebase/auth';

// Função melhorada para login com Google em qualquer dispositivo
export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    
    // Adicionar escopos (opcional)
    provider.addScope('profile');
    provider.addScope('email');
    
    // Definir parâmetros de login personalizados
    provider.setCustomParameters({
      prompt: 'select_account', // Força seleção de conta mesmo se houver apenas uma
      login_hint: '', // Limpar qualquer hint para evitar problemas
    });
    
    // Verificar se estamos em ambiente com suporte a popup
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    console.log('Ambiente detectado:', isMobile ? 'Mobile' : 'Desktop');
    
    // Registrar informações importantes para debug
    console.log('Auth Domain:', auth.config.authDomain);
    console.log('URL atual:', window.location.href);
    console.log('Hostname:', window.location.hostname);
    
    if (isMobile) {
      try {
        // Em dispositivos móveis, sempre use redirecionamento
        console.log('Iniciando login com Google por redirecionamento (mobile)...');
        
        // Salvar o estado atual da navegação para recuperar após o redirecionamento
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('auth_redirect_initiated', 'true');
          localStorage.setItem('auth_redirect_timestamp', Date.now().toString());
          
          // Salvar a URL atual para retornar após o login
          const currentPath = window.location.pathname + window.location.search;
          localStorage.setItem('auth_redirect_path', currentPath);
        }
        
        // Iniciar o redirecionamento
        await signInWithRedirect(auth, provider);
        console.log('Redirecionamento iniciado');
        return null; // O resultado será obtido via getRedirectResult()
      } catch (redirectError) {
        console.error('Erro no redirecionamento para Google:', redirectError);
        
        const authError = redirectError as AuthError;
        if (authError.code === 'auth/unauthorized-domain') {
          console.error('Domínio não autorizado no Firebase Console. Verifique as configurações do projeto.');
          console.error('Domínio atual:', window.location.origin);
        }
        
        throw redirectError;
      }
    } else {
      try {
        // Em desktop, tentar popup primeiro
        console.log('Iniciando login com Google via popup (desktop)...');
        const result = await signInWithPopup(auth, provider);
        console.log('Login com popup bem-sucedido');
        return result.user;
      } catch (popupError) {
        console.error('Erro no popup do Google:', popupError);
        
        const authError = popupError as AuthError;
        if (authError.code === 'auth/popup-blocked' || 
            authError.code === 'auth/popup-closed-by-user') {
          // Se o popup for bloqueado ou fechado, tente redirecionamento
          console.log('Popup bloqueado ou fechado. Tentando redirecionamento como alternativa...');
          
          // Salvar estado para recuperação pós-redirecionamento
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('auth_redirect_initiated', 'true');
            localStorage.setItem('auth_redirect_timestamp', Date.now().toString());
            localStorage.setItem('auth_redirect_path', window.location.pathname + window.location.search);
          }
          
          await signInWithRedirect(auth, provider);
          return null;
        }
        
        throw popupError;
      }
    }
  } catch (error) {
    console.error('Erro ao fazer login com Google:', error);
    throw error;
  }
};

// Função melhorada para obter o resultado do redirecionamento
export const getGoogleRedirectResult = async () => {
  try {
    console.log('Verificando resultado do redirecionamento do Google...');
    
    // Verificar se viemos de um redirecionamento para auth
    const wasRedirected = localStorage.getItem('auth_redirect_initiated') === 'true';
    
    if (wasRedirected) {
      console.log('Detectado retorno de redirecionamento de autenticação');
      // Limpar flag para evitar verificações repetidas
      localStorage.removeItem('auth_redirect_initiated');
      
      const redirectTimestamp = parseInt(localStorage.getItem('auth_redirect_timestamp') || '0');
      const timeElapsed = Date.now() - redirectTimestamp;
      console.log(`Tempo desde o redirecionamento: ${timeElapsed}ms`);
      
      // Se passaram mais de 5 minutos, provavelmente é uma sessão antiga
      if (timeElapsed > 300000) {
        console.log('Redirecionamento antigo, ignorando');
        localStorage.removeItem('auth_redirect_timestamp');
        localStorage.removeItem('auth_redirect_path');
        return null;
      }
    }
    
    const result = await getRedirectResult(auth);
    
    if (result) {
      console.log('Resultado do redirecionamento obtido com sucesso:', result.user.uid);
      
      // Limpar dados de redirecionamento
      localStorage.removeItem('auth_redirect_timestamp');
      localStorage.removeItem('auth_redirect_path');
      
      return result.user;
    } else {
      console.log('Nenhum resultado de redirecionamento encontrado');
      return null;
    }
  } catch (error) {
    console.error('Erro ao processar resultado do redirecionamento:', error);
    
    const authError = error as AuthError;
    if (authError.code === 'auth/unauthorized-domain') {
      console.error('ERRO: O domínio atual não está autorizado no Firebase Console.');
      console.error('Por favor, adicione este domínio nas configurações do Firebase Auth:');
      console.error('Domínio atual:', window.location.origin);
    }
    
    throw error;
  }
}; 