'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { useUser } from '@/contexts/UserContext';
import { auth } from '@/firebase/config';
import { adicionarJogadorPelada } from '@/firebase/peladaService';
import { FirebaseError } from 'firebase/app';

interface UseInviteReturn {
  loading: boolean;
  error: string | null;
  acceptInvite: (peladaId: string) => Promise<void>;
  generateInviteLink: (peladaId: string) => string;
}

export function useInvite(): UseInviteReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useUser();

  const acceptInvite = async (peladaId: string) => {
    setLoading(true);
    setError(null);

    try {
      if (!user?.uid) {
        throw new Error('Por favor, faça login para aceitar o convite');
      }

      // Força a atualização do token de autenticação
      try {
        const currentToken = await auth.currentUser?.getIdToken(true);
        if (!currentToken) {
          throw new Error('Erro de autenticação. Por favor, tente novamente.');
        }
      } catch (authError: unknown) {
        // Tratamento específico para erro de quota excedida
        if (authError instanceof FirebaseError && authError.code === 'auth/quota-exceeded') {
          console.warn('Limite de requisições do Firebase atingido. Utilizando token existente.');
          // Continua com o token existente em vez de forçar uma atualização
        } else {
          throw authError;
        }
      }

      // Verifica se a pelada existe
      const peladaRef = doc(db, 'peladas', peladaId);
      const peladaDoc = await getDoc(peladaRef);

      if (!peladaDoc.exists()) {
        throw new Error('Pelada não encontrada');
      }

      const peladaData = peladaDoc.data();

      // Verifica se o usuário já é jogador
      if (peladaData.players?.includes(user.uid)) {
        console.log('Usuário já está na pelada, redirecionando para a página da pelada');
        router.push(`/pelada/${peladaId}`);
        return;
      }

      console.log('Adicionando usuário à pelada:', {
        userId: user.uid,
        peladaId,
        userName: user.displayName || user.email?.split('@')[0]
      });

      // Usa a função adicionarJogadorPelada que já tem toda a lógica necessária
      await adicionarJogadorPelada(peladaId, user.uid);

      console.log('Usuário adicionado com sucesso à pelada');

      // Redireciona para a página da pelada
      router.push(`/pelada/${peladaId}`);
    } catch (err) {
      console.error('Erro ao aceitar convite:', err);
      
      // Tratamento específico para erros conhecidos
      let errorMessage = 'Não foi possível aceitar o convite';
      
      if (err instanceof Error) {
        // Verifica se é um erro de Firebase
        if (err instanceof FirebaseError && err.code === 'auth/quota-exceeded') {
          errorMessage = 'Limite de requisições atingido. Tente novamente mais tarde.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const generateInviteLink = (peladaId: string): string => {
    // Gera o link de convite com o ID correto da pelada e o ID de quem está convidando
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    
    // Inclui o ID do usuário atual como convidadoPor no link
    if (user?.uid) {
      return `${baseUrl}/cadastro?peladaId=${peladaId}&convidadoPor=${user.uid}`;
    }
    
    return `${baseUrl}/cadastro?peladaId=${peladaId}`;
  };

  return {
    loading,
    error,
    acceptInvite,
    generateInviteLink
  };
} 