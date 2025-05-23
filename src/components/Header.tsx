import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import NotificationBell from '@/components/NotificationBell';
import NotificationsPanel from '@/components/NotificationsPanel';
import { subscribeToNotifications, getUserNotifications } from '@/firebase/notificationService';
import { Notification } from '@/types/notification';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { toast } from 'react-toastify';

interface NotificationWithId extends Notification {
  id: string;
}

export default function Header() {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<NotificationWithId[]>([]);
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  // Carregar notificações do usuário ao montar o componente
  useEffect(() => {
    if (!user) return;

    // Primeiro, carrega notificações já existentes
    const loadNotifications = async () => {
      try {
        const userNotifications = await getUserNotifications(user.uid);
        setNotifications(userNotifications);
      } catch (error) {
        console.error('Erro ao carregar notificações:', error);
      }
    };
    
    loadNotifications();

    // Configurar assinatura em tempo real para novas notificações
    const unsubscribe = subscribeToNotifications(user.uid, {
      next: (newNotifications) => {
        setNotifications(newNotifications.filter((n): n is NotificationWithId => !!n.id));
      },
      error: (error) => {
        console.error('Erro ao receber notificações:', error);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Funções para lidar com notificações
  const handleMarkAllAsRead = async () => {
    try {
      // Atualizar todas as notificações não lidas
      await Promise.all(
        notifications
          .filter(n => !n.read)
          .map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }))
      );

      // Atualizar o estado local
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('Todas as notificações foram marcadas como lidas');
    } catch (error) {
      console.error('Erro ao marcar notificações como lidas:', error);
      toast.error('Erro ao processar notificações');
    }
  };

  const handleConfirm = async (_notification: NotificationWithId) => {
    // Implementação da função handleConfirm
    toast.success('Notificação confirmada');
  };

  const handleReject = async (_notification: NotificationWithId) => {
    // Implementação da função handleReject
    toast.info('Notificação rejeitada');
  };

  return (
    <header className="bg-black">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="text-xl font-bold text-white">
          VemX1
        </Link>
        <div className="flex items-center gap-4">
          {/* Botões de assinatura removidos a pedido do usuário */}
          
          {/* Adicionar o sininho de notificação */}
          {user && (
            <NotificationBell 
              count={unreadCount} 
              onClick={() => setIsNotificationsPanelOpen(true)} 
            />
          )}
          
          {/* Painel de notificações */}
          <NotificationsPanel
            isOpen={isNotificationsPanelOpen}
            notifications={notifications}
            onClose={() => setIsNotificationsPanelOpen(false)}
            onMarkAllAsRead={handleMarkAllAsRead}
            onConfirm={handleConfirm}
            onReject={handleReject}
          />
        </div>
      </div>
    </header>
  );
} 