'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db } from '@/firebase/config';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { verificarAssinaturaAtiva } from '@/firebase/assinaturaService';

interface UserData {
  nome: string;
  email: string;
  createdAt?: Date;
  // Campos adicionais que podem estar presentes na coleção 'usuarios'
  premium?: boolean;
  assinaturaAtiva?: boolean;
  statusAssinatura?: string;
  plano?: string;
}

interface UserContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  temAssinaturaAtiva: boolean;
  verificandoAssinatura: boolean;
  setTemAssinaturaAtiva: (value: boolean) => void;
  setVerificandoAssinatura: (value: boolean) => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  userData: null,
  loading: true,
  temAssinaturaAtiva: false,
  verificandoAssinatura: true,
  setTemAssinaturaAtiva: () => {},
  setVerificandoAssinatura: () => {}
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [temAssinaturaAtiva, setTemAssinaturaAtiva] = useState(false);
  const [verificandoAssinatura, setVerificandoAssinatura] = useState(true);

  // Efeito para autenticação e carregamento de dados básicos do usuário
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
      
      if (user) {
        try {
          // ⚠️ CORRIGIDO: Buscar na coleção 'usuarios' em vez de 'users'
          const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data() as UserData);
            
            // ⚠️ OTIMIZAÇÃO: Já verifica status de assinatura aqui para evitar chamada adicional
            const status = userDoc.data()?.statusAssinatura;
            if (status === 'ativa' || status === 'teste') {
              setTemAssinaturaAtiva(true);
              setVerificandoAssinatura(false);
            }
          } else {
            console.log(`Usuário ${user.uid} não encontrado na coleção 'usuarios'. Criando documento...`);
            // Opcionalmente, pode-se criar um documento básico na coleção 'usuarios' aqui
          }
        } catch (error) {
          console.error('Erro ao buscar dados do usuário:', error);
        }
      } else {
        setUserData(null);
        setTemAssinaturaAtiva(false); // Resetar status de assinatura quando não há usuário
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Efeito separado para monitorar o status da assinatura
  useEffect(() => {
    if (!user) return;
    
    console.log(`[UserContext] Configurando verificação de assinatura para usuário: ${user.uid}`);
    setVerificandoAssinatura(true);
    
    // Verificação inicial já é feita no primeiro useEffect, mas mantemos esta como fallback
    verificarAssinaturaAtiva(user.uid)
      .then(assinaturaAtiva => {
        console.log(`[UserContext] Verificação inicial da assinatura: ${assinaturaAtiva ? 'Ativa' : 'Inativa'}`);
        setTemAssinaturaAtiva(assinaturaAtiva);
      })
      .catch(error => {
        console.error('[UserContext] Erro na verificação inicial da assinatura:', error);
        setTemAssinaturaAtiva(false);
      })
      .finally(() => {
        setVerificandoAssinatura(false);
      });
    
    // Configurar listener para atualizações em tempo real do status da assinatura
    const userRef = doc(db, 'usuarios', user.uid);
    console.log(`[UserContext] Configurando listener em tempo real para assinatura do usuário ${user.uid}`);
    
    const unsubscribe = onSnapshot(userRef, (docSnapshot) => {
      try {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          const statusAnterior = temAssinaturaAtiva ? 'ativa' : 'inativa';
          const statusAssinatura = userData?.statusAssinatura;
          const plano = userData?.plano || 'não definido';
          
          console.log(`[UserContext] Dados do usuário atualizados em tempo real:`, {
            uid: user.uid,
            statusAssinatura,
            premium: userData?.premium,
            assinaturaAtiva: userData?.assinaturaAtiva,
            plano,
            dataAssinatura: userData?.dataAssinatura ? new Date(userData.dataAssinatura.toDate()).toISOString() : 'não definida',
            dataUltimaAtualizacao: userData?.dataUltimaAtualizacao ? new Date(userData.dataUltimaAtualizacao.toDate()).toISOString() : 'não definida',
          });
          
          const novoStatus = statusAssinatura === 'ativa' || statusAssinatura === 'teste';
          console.log(`[UserContext] Status da assinatura atualizado em tempo real: ${statusAssinatura} (${novoStatus ? 'ativa' : 'inativa'})`);
          
          // Se houve mudança no status, força uma atualização do contexto
          if (novoStatus !== temAssinaturaAtiva) {
            console.log(`[UserContext] Mudança detectada: de ${statusAnterior} para ${novoStatus ? 'ativa' : 'inativa'}`);
            setTemAssinaturaAtiva(novoStatus);
            
            // Forçar recarga da página se o usuário ganhou acesso premium
            if (novoStatus && !temAssinaturaAtiva) {
              console.log('[UserContext] Assinatura ativada! Recarregando a página para aplicar mudanças...');
              // Usar setTimeout para garantir que o estado seja atualizado antes do reload
              setTimeout(() => {
                window.location.reload();
              }, 1500);
            }
          }
        } else {
          console.log(`[UserContext] Documento do usuário não encontrado no Firestore`);
          setTemAssinaturaAtiva(false);
        }
      } catch (error) {
        console.error('[UserContext] Erro ao processar atualização da assinatura:', error);
        setTemAssinaturaAtiva(false);
      } finally {
        setVerificandoAssinatura(false);
      }
    }, (error) => {
      console.error('[UserContext] Erro no listener da assinatura:', error);
      setVerificandoAssinatura(false);
    });
    
    return () => unsubscribe();
  }, [user, temAssinaturaAtiva]);

  return (
    <UserContext.Provider value={{ 
      user, 
      userData, 
      loading,
      temAssinaturaAtiva,
      verificandoAssinatura,
      setTemAssinaturaAtiva,
      setVerificandoAssinatura
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
} 