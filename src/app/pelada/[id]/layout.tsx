'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { getPelada } from '@/firebase/peladaService';
import { AssinaturaButton } from '@/components/AssinaturaButton';

export default function PeladaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useUser();
  const params = useParams();
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verificarProprietario = async () => {
      if (!user || !params?.id) {
        setLoading(false);
        return;
      }

      try {
        const peladaId = params.id as string;
        const pelada = await getPelada(peladaId);
        
        if (pelada && pelada.ownerId === user.uid) {
          setIsOwner(true);
        }
      } catch (error) {
        console.error('Erro ao verificar proprietário da pelada:', error);
      } finally {
        setLoading(false);
      }
    };

    verificarProprietario();
  }, [user, params?.id]);

  // Componente para o cabeçalho customizado
  const CustomHeader = () => {
    if (loading) return null;

    return (
      <div className="absolute top-4 right-16 z-10">
        {isOwner && <AssinaturaButton isOwner={true} />}
      </div>
    );
  };

  return (
    <>
      <CustomHeader />
      {children}
    </>
  );
} 