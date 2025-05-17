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
    const verificarAssinatura = async (userId: string) => {
      try {
        setVerificandoAssinatura(true);
        console.log('[UserContext] Verificando assinatura para usuário:', userId);
        
        // Primeiro, verificar se a informação já está no localStorage para mostrar imediatamente
        const assinaturaLocalStorage = localStorage.getItem('temAssinaturaAtiva');
        if (assinaturaLocalStorage === 'true' || assinaturaLocalStorage === 'false') {
          setTemAssinaturaAtiva(assinaturaLocalStorage === 'true');
        }
        
        // Em paralelo, verificar com o servidor
        const assinaturaAtiva = await verificarAssinaturaAtiva(userId);
        console.log('[UserContext] Status da assinatura:', assinaturaAtiva);
        
        // Atualizar o estado e também o localStorage
        setTemAssinaturaAtiva(assinaturaAtiva);
        localStorage.setItem('temAssinaturaAtiva', assinaturaAtiva.toString());
      } catch (error) {
        console.error('[UserContext] Erro ao verificar assinatura:', error);
        setTemAssinaturaAtiva(false);
        localStorage.setItem('temAssinaturaAtiva', 'false');
      } finally {
        setVerificandoAssinatura(false);
      }
    };

    if (user?.uid) {
      verificarAssinatura(user.uid);
    } else {
      // Se não houver usuário, garantir que a assinatura seja marcada como inativa
      setTemAssinaturaAtiva(false);
      localStorage.setItem('temAssinaturaAtiva', 'false');
    }
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