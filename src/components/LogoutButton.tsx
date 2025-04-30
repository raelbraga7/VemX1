'use client';

import { signOut } from 'firebase/auth';
import { auth } from '@/firebase/config';
import { toast } from 'react-hot-toast';

// Adicionar declaração global para _firebaseListeners
declare global {
  interface Window {
    _firebaseListeners: { [key: string]: () => void };
  }
}

// Inicializar a propriedade global se ainda não existir
if (typeof window !== 'undefined' && !window._firebaseListeners) {
  window._firebaseListeners = {};
}

// Adicionar propriedade opcional onLogout
interface LogoutButtonProps {
  onLogout?: () => Promise<void>;
}

export function LogoutButton({ onLogout }: LogoutButtonProps) {
  const handleLogout = async () => {
    try {
      console.log('Iniciando processo de logout');
      
      // Primeiro limpar o localStorage para evitar tentativas de acesso ao Firestore após logout
      try {
        console.log('Limpando localStorage');
        
        // Limpa itens específicos do Firebase primeiro
        localStorage.removeItem('firebase:authUser:' + process.env.NEXT_PUBLIC_FIREBASE_API_KEY + ':[DEFAULT]');
        localStorage.removeItem('firebase:previousUser:' + process.env.NEXT_PUBLIC_FIREBASE_API_KEY + ':[DEFAULT]');
        
        // Remover todas as chaves relacionadas a peladas e Firebase
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('pelada_') || 
              key.startsWith('firebase:') || 
              key.includes('Pelada') || 
              key.includes('time') || 
              key.includes('Time')) {
            localStorage.removeItem(key);
            console.log(`Removida chave do localStorage: ${key}`);
          }
        });
      } catch (lsError) {
        console.error('Erro ao limpar localStorage:', lsError);
      }
      
      // Desativar todas as conexões com o Firestore para evitar erros de permissão
      try {
        // Verifica se há uma função de logout personalizada
        if (onLogout) {
          console.log('Usando função de logout personalizada');
          await onLogout();
          // Não retornar aqui para garantir que todas as etapas sejam executadas
        }
        
        // Desconecta todos os listeners do Firestore
        const unsubscribes = Object.values(window._firebaseListeners || {});
        console.log(`Limpando ${unsubscribes.length} listeners registrados no objeto global`);
        
        for (const unsubscribe of unsubscribes) {
          if (typeof unsubscribe === 'function') {
            try {
              unsubscribe();
              console.log('Listener cancelado com sucesso');
            } catch (err) {
              console.error('Erro ao cancelar listener:', err);
            }
          }
        }

        // Limpa o objeto de listeners
        window._firebaseListeners = {};
      } catch (err) {
        console.error('Erro ao limpar listeners:', err);
        // Continua com o logout mesmo se falhar na limpeza dos listeners
      }

      // Adicionar um pequeno delay para garantir que todas as operações assíncronas pendentes sejam concluídas
      await new Promise(resolve => setTimeout(resolve, 300));

      // Faz o logout
      try {
        console.log('Executando signOut no Firebase Auth');
        await signOut(auth);
        console.log('Signout concluído com sucesso');
      } catch (authError) {
        console.error('Erro no signOut do Firebase:', authError);
        
        // Forçar reload da página pode ajudar em casos extremos
        if (authError instanceof Error && 
            (authError.message.includes('auth/invalid-credential') || 
             authError.message.includes('auth/invalid-user-token'))) {
          console.log('Erro crítico de autenticação, recarregando a página');
          window.location.href = '/login';
          return;
        }
      }
      
      // Mensagem de sucesso
      toast('Logout realizado com sucesso!', {
        icon: '👋'
      });
      
      // Usar window.location para garantir uma navegação completa e limpa
      console.log('Redirecionando para login');
      window.location.href = '/login';
    } catch (error) {
      console.error('Erro fatal ao fazer logout:', error);
      toast('Erro ao fazer logout. A página será recarregada.', {
        icon: '❌'
      });
      
      // Em último caso, força recarregar para página de login
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
    >
      Sair da conta
    </button>
  );
} 