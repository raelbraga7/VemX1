'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db } from '@/firebase/config';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { verificarAssinaturaAtiva } from '@/firebase/assinaturaService';

interface UserData {
  nome: string;
  email: string;
  createdAt: Date;
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
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data() as UserData);
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
    
    // Verificação inicial
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
    const unsubscribe = onSnapshot(userRef, (docSnapshot) => {
      try {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          const statusAssinatura = userData?.statusAssinatura;
          console.log(`[UserContext] Status da assinatura atualizado em tempo real: ${statusAssinatura}`);
          
          setTemAssinaturaAtiva(
            statusAssinatura === 'ativa' || statusAssinatura === 'teste'
          );
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
  }, [user]);

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