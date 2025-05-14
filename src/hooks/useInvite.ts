'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { useUser } from '@/contexts/UserContext';
import { adicionarJogadorPelada } from '@/firebase/peladaService';
import { FirebaseError } from 'firebase/app';

interface UseInviteReturn {
  loading: boolean;
  error: string | null;
  acceptInvite: (peladaId: string) => Promise<void>;
  generateInviteLink: (peladaId: string) => string;
}

// Cache de verificação de membros para evitar consultas repetidas
const membroCache: Record<string, boolean> = {};

export function useInvite(): UseInviteReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useUser();
  
  // Referência para controlar processamentos em andamento
  const processingRef = useRef<Record<string, boolean>>({});

  const acceptInvite = async (peladaId: string) => {
    // Identificação única do convite (combinação de usuário e pelada)
    const conviteId = `${user?.uid || ''}_${peladaId}`;
    
    // Verifica se este convite já está sendo processado em outra chamada
    if (processingRef.current[conviteId]) {
      console.log('Esta combinação de usuário e pelada já está sendo processada, ignorando');
      return;
    }
    
    // Marca convite como em processamento
    processingRef.current[conviteId] = true;
    
    setLoading(true);
    setError(null);

    try {
      if (!user?.uid) {
        throw new Error('Por favor, faça login para aceitar o convite');
      }
      
      // Verificar o cache para saber se o usuário já é membro
      const cacheKey = `${user.uid}_${peladaId}`;
      if (membroCache[cacheKey]) {
        console.log('Cache: Usuário já está na pelada, redirecionando');
        router.push(`/pelada/${peladaId}`);
        return;
      }

      // Verificar se a pelada existe
      const peladaRef = doc(db, 'peladas', peladaId);
      let peladaDoc;
      
      try {
        peladaDoc = await getDoc(peladaRef);
      } catch (firebaseError) {
        // Tratar erro de leitura do Firestore
        console.error('Erro ao ler documento da pelada:', firebaseError);
        if (firebaseError instanceof FirebaseError && 
            (firebaseError.code === 'resource-exhausted' || firebaseError.code === 'quota-exceeded')) {
          console.warn('Limite de requisições do Firebase atingido. Tente novamente mais tarde.');
          throw new Error('Limite de acesso ao banco de dados atingido. Tente novamente mais tarde.');
        }
        throw firebaseError;
      }

      if (!peladaDoc.exists()) {
        throw new Error('Pelada não encontrada');
      }

      const peladaData = peladaDoc.data();

      // Verifica se o usuário já é jogador
      if (peladaData.players?.includes(user.uid)) {
        console.log('Usuário já está na pelada, redirecionando para a página da pelada');
        // Atualiza o cache
        membroCache[cacheKey] = true;
        router.push(`/pelada/${peladaId}`);
        return;
      }

      console.log('Adicionando usuário à pelada:', {
        userId: user.uid,
        peladaId,
        userName: user.displayName || user.email?.split('@')[0]
      });

      try {
        // Usa a função adicionarJogadorPelada que já tem toda a lógica necessária
        await adicionarJogadorPelada(peladaId, user.uid);
        console.log('Usuário adicionado com sucesso à pelada');
        
        // Atualiza o cache após adicionar o usuário com sucesso
        membroCache[cacheKey] = true;
      } catch (addError) {
        console.error('Erro ao adicionar jogador:', addError);
        if (addError instanceof FirebaseError && 
            (addError.code === 'resource-exhausted' || addError.code === 'quota-exceeded')) {
          throw new Error('Limite de acesso ao banco de dados atingido. Aguarde um pouco e tente novamente.');
        }
        throw addError;
      }

      // Pequeno atraso para garantir que o Firestore propagou as alterações
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Redireciona para a página da pelada
      router.push(`/pelada/${peladaId}`);
    } catch (err) {
      console.error('Erro ao aceitar convite:', err);
      
      // Tratamento específico para erros conhecidos
      let errorMessage = 'Não foi possível aceitar o convite';
      
      if (err instanceof Error) {
        // Verifica se é um erro de Firebase
        if (err instanceof FirebaseError) {
          if (err.code === 'auth/quota-exceeded' || err.code === 'resource-exhausted') {
            errorMessage = 'Limite de requisições atingido. Tente novamente mais tarde.';
          } else {
            errorMessage = `Erro: ${err.code}`;
          }
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
      // Remove marca de processamento
      delete processingRef.current[conviteId];
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