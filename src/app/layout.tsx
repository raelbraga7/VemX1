'use client';

import './globals.css';
import { UserProvider } from '@/contexts/UserContext';
import { useUser } from '@/contexts/UserContext';
import { useState, useEffect } from 'react';
import NotificationBell from '@/components/NotificationBell';
import NotificationsPanel from '@/components/NotificationsPanel';
import { subscribeToNotifications } from '@/firebase/notificationService';
import { Notification } from '@/types/notification';
import { Inter } from 'next/font/google';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { collection, doc, updateDoc, arrayUnion, arrayRemove, query, getDocs, deleteDoc, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { toast } from 'react-toastify';
import { usePathname } from 'next/navigation';

const inter = Inter({ subsets: ['latin'] });

interface NotificationWithId extends Notification {
  id: string;
}

function Header() {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<NotificationWithId[]>([]);
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToNotifications(user.uid, {
      next: (newNotifications) => {
        // Filtra apenas notificações que têm id
        setNotifications(newNotifications.filter((n): n is NotificationWithId => !!n.id));
      },
      error: (error) => {
        console.error('Erro ao receber notificações:', error);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleConfirm = async (notification: NotificationWithId) => {
    if (!user || !notification.peladaId) return;

    try {
      const peladasRef = collection(db, 'peladas');
      const peladaRef = doc(peladasRef, notification.peladaId);
      const jogador = {
        id: user.uid,
        nome: user.displayName || user.email?.split('@')[0] || 'Usuário',
        photoURL: user.photoURL || null,
        dataConfirmacao: new Date().toISOString()
      };

      await updateDoc(peladaRef, {
        confirmados: arrayUnion(jogador)
      });

      // Marca a notificação como lida
      const notificationsRef = collection(db, 'notifications');
      await updateDoc(doc(notificationsRef, notification.id), {
        read: true,
        respondido: true,
        resposta: 'confirmado'
      });

      toast.success('Presença confirmada com sucesso!');
    } catch (error) {
      console.error('Erro ao confirmar presença:', error);
      toast.error('Erro ao confirmar presença. Tente novamente.');
    }
  };

  const handleReject = async (notification: NotificationWithId) => {
    if (!user || !notification.peladaId) return;

    try {
      const peladasRef = collection(db, 'peladas');
      const peladaRef = doc(peladasRef, notification.peladaId);
      const jogador = {
        id: user.uid,
        nome: user.displayName || user.email?.split('@')[0] || 'Usuário',
        photoURL: user.photoURL || null
      };

      await updateDoc(peladaRef, {
        confirmados: arrayRemove(jogador)
      });

      // Marca a notificação como lida
      const notificationsRef = collection(db, 'notifications');
      await updateDoc(doc(notificationsRef, notification.id), {
        read: true,
        respondido: true,
        resposta: 'recusado'
      });

      toast.info('Presença recusada');
    } catch (error) {
      console.error('Erro ao recusar presença:', error);
      toast.error('Erro ao recusar presença. Tente novamente.');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const notificationsRef = collection(db, 'notifications');
      const q = query(notificationsRef, where('userId', '==', user?.uid));
      const snapshot = await getDocs(q);
      
      // Deleta todas as notificações do usuário
      await Promise.all(
        snapshot.docs.map(doc => deleteDoc(doc.ref))
      );

      setNotifications([]);
      toast.success('Todas as notificações foram removidas');
    } catch (error) {
      console.error('Erro ao limpar notificações:', error);
      toast.error('Erro ao limpar notificações');
    }
  };

  return (
    <header className="shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-white">VemX1</h1>
        {user && (
          <>
            <NotificationBell 
              count={unreadCount} 
              onClick={() => setIsNotificationsPanelOpen(true)} 
            />
            <NotificationsPanel
              isOpen={isNotificationsPanelOpen}
              notifications={notifications}
              onClose={() => setIsNotificationsPanelOpen(false)}
              onMarkAllAsRead={handleMarkAllAsRead}
              onConfirm={handleConfirm}
              onReject={handleReject}
            />
          </>
        )}
      </div>
    </header>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/pagamento' || pathname === '/cadastro';

  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <UserProvider>
          {!isAuthPage && <Header />}
          {children}
          <ToastContainer />
        </UserProvider>
      </body>
    </html>
  );
}
