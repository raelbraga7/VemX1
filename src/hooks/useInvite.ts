'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/firebase/config';
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { useUser } from '@/contexts/UserContext';
import { addPeladaToUser } from '@/firebase/userService';

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
        throw new Error('Usuário não autenticado');
      }

      // Verifica se a pelada existe
      const peladaRef = doc(db, 'peladas', peladaId);
      const peladaDoc = await getDoc(peladaRef);

      if (!peladaDoc.exists()) {
        throw new Error('Pelada não encontrada.');
      }

      const peladaData = peladaDoc.data();

      // Verifica se o usuário já é jogador
      if (peladaData.players?.includes(user.uid)) {
        router.push('/dashboard');
        return;
      }

      // Adiciona o usuário à pelada e inicializa seu ranking
      const rankingAtualizado = {
        ...peladaData.ranking,
        [user.uid]: {
          vitorias: 0,
          derrotas: 0,
          empates: 0,
          gols: 0,
          assistencias: 0,
          jogos: 0,
          ultimoJogo: null,
          dataEntrada: serverTimestamp()
        }
      };

      await updateDoc(peladaRef, {
        players: arrayUnion(user.uid),
        ranking: rankingAtualizado
      });

      // Adiciona a pelada ao usuário
      await addPeladaToUser(user.uid, peladaId);

      // Redireciona para o dashboard onde o usuário verá o ranking
      router.push('/dashboard');
    } catch (err) {
      console.error('Erro ao aceitar convite:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível aceitar o convite. Tente novamente.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const generateInviteLink = (peladaId: string): string => {
    // Gera o link de convite com o ID correto da pelada
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    return `${baseUrl}/entrar-na-pelada?id=${peladaId}`;
  };

  return {
    loading,
    error,
    acceptInvite,
    generateInviteLink
  };
} 