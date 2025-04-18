'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import {
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '@/firebase/notificationService';
import type { Notification } from '@/types/notification';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useUser();

  useEffect(() => {
    console.log('useNotifications - User:', user?.uid);
    
    if (!user?.uid) {
      console.log('useNotifications - No user, clearing notifications');
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    console.log('useNotifications - Subscribing to notifications for user:', user.uid);
    
    const unsubscribe = subscribeToNotifications(user.uid, {
      next: (newNotifications) => {
        console.log('useNotifications - Received notifications:', newNotifications);
        setNotifications(newNotifications);
        setUnreadCount(newNotifications.filter(n => !n.read).length);
      },
      error: (error) => {
        console.error('Erro ao carregar notificações:', error);
        // Em caso de erro de permissão, apenas limpa as notificações
        setNotifications([]);
        setUnreadCount(0);
      }
    });

    return () => {
      console.log('useNotifications - Unsubscribing');
      unsubscribe();
    };
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      if (!user?.uid) return;
      console.log('useNotifications - Marking as read:', notificationId);
      await markNotificationAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      if (!user?.uid) return;
      console.log('useNotifications - Marking all as read');
      await markAllNotificationsAsRead(user.uid);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Erro ao marcar todas notificações como lidas:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead
  };
} 