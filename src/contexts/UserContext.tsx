'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db } from '@/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';

interface UserData {
  nome: string;
  email: string;
  createdAt: Date;
}

interface UserContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  existsInFirestore: boolean;
}

const UserContext = createContext<UserContextType>({
  user: null,
  userData: null,
  loading: true,
  existsInFirestore: false,
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [existsInFirestore, setExistsInFirestore] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
      
      if (user) {
        try {
          // Verificar se o usuário existe no Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          
          if (userDoc.exists()) {
            setUserData(userDoc.data() as UserData);
            setExistsInFirestore(true);
          } else {
            console.log(`[UserContext] Usuário autenticado (${user.uid}), mas não encontrado no Firestore.`);
            setExistsInFirestore(false);
            
            // Se o usuário está autenticado mas não existe no Firestore,
            // redirecionar para a página de cadastro para completar o perfil
            router.push('/cadastro?autenticado=true');
          }
        } catch (error) {
          console.error('[UserContext] Erro ao buscar dados do usuário:', error);
          setExistsInFirestore(false);
        }
      } else {
        setUserData(null);
        setExistsInFirestore(false);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <UserContext.Provider value={{ user, userData, loading, existsInFirestore }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
} 