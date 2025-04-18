'use client';

import { useUser } from '@/hooks/useUser';
import { createNotification } from '@/firebase/notificationService';
import type { Notification } from '@/types/notification';

export default function TesteNotificacao() {
  const { user } = useUser();

  const criarNotificacaoTeste = async () => {
    if (!user || !user.uid) {
      alert('Você precisa estar logado para enviar notificações');
      return;
    }

    try {
      const notification: Notification = {
        userId: user.uid,
        peladaId: 'teste-123',
        title: 'Confirmação de Presença',
        message: 'Você confirma presença na pelada Teste?',
        timestamp: new Date().toISOString(),
        read: false,
        type: 'CONFIRMACAO',
        actions: {
          confirm: true,
          reject: true
        }
      };

      await createNotification(notification);
      alert('Notificação de teste criada! Clique no sino para ver.');
    } catch (error) {
      console.error('Erro ao criar notificação:', error);
      alert('Erro ao criar notificação de teste');
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1b2a] flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h1 className="text-2xl font-bold text-[#0d1b2a] mb-6">
          Teste de Notificações
        </h1>
        
        <p className="text-gray-600 mb-6">
          Clique no botão abaixo para criar uma notificação de teste. 
          Depois, clique no sino para ver a notificação e testar as ações de confirmar/recusar.
        </p>

        <button
          onClick={criarNotificacaoTeste}
          className="w-full py-3 px-4 rounded-lg text-white font-medium bg-[#1d4ed8] hover:bg-[#1d4ed8]/90 transition-colors"
        >
          Criar Notificação de Teste
        </button>
      </div>
    </div>
  );
} 