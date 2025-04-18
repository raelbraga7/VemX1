'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/firebase/config';
import { User } from 'firebase/auth';
import { getUserById } from '@/firebase/userService';

export interface UserData {
  uid: string;
  nome: string;
  email: string;
  photoURL?: string | null;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
      
      if (user) {
        try {
          const userDoc = await getUserById(user.uid);
          if (userDoc) {
            setUserData(userDoc as UserData);
          }
        } catch (error) {
          console.error('Erro ao buscar dados do usuário:', error);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, userData, loading };
} 