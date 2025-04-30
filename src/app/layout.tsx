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
import { Toaster } from 'react-hot-toast';
import { collection, doc, updateDoc, arrayUnion, arrayRemove, query, getDocs, deleteDoc, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { toast } from 'react-hot-toast';
import { usePathname } from 'next/navigation';
import { getUserById } from '@/firebase/userService';
import Link from 'next/link';

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
      const userInfo = await getUserById(user.uid);
      const nomeJogador = userInfo?.nome || user.email?.split('@')[0] || 'Usuário';

      const jogador = {
        id: user.uid,
        nome: nomeJogador,
        dataConfirmacao: new Date().toISOString(),
        convidadoPor: notification.senderId || null
      };

      await updateDoc(peladaRef, {
        confirmados: arrayUnion(jogador),
        players: arrayUnion(user.uid)
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

      toast('Presença recusada');
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
    <header className="bg-black shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-white">VemX1</h1>
        </div>
        
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

// Componente para a navegação secundária (abas)
function NavTabs() {
  const { user } = useUser();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<'pelada' | 'time'>('pelada');

  useEffect(() => {
    // Define a aba ativa com base na URL atual
    if (pathname.includes('/pelada/')) {
      setActiveTab('pelada');
    } else if (pathname.includes('/time/')) {
      setActiveTab('time');
    }
  }, [pathname]);

  if (!user) return null;

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-8">
          <Link href="/dashboard">
            <button 
              className={`relative py-4 px-6 font-medium text-sm ${
                activeTab === 'pelada' 
                  ? 'text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('pelada')}
            >
              PELADA
              {activeTab === 'pelada' && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500"></div>
              )}
            </button>
          </Link>
          <Link href="/time">
            <button 
              className={`relative py-4 px-6 font-medium text-sm ${
                activeTab === 'time' 
                  ? 'text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('time')}
            >
              TIME
              {activeTab === 'time' && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500"></div>
              )}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/pagamento' || pathname === '/cadastro' || pathname === '/login';
  const isTimePage = pathname === '/time' || pathname.startsWith('/time/');
  const isPartidaPage = pathname.includes('/partida-time') || pathname.includes('/partida');

  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <UserProvider>
          {!isAuthPage && (
            <Header />
          )}
          {!isAuthPage && !isTimePage && !isPartidaPage && (
            <NavTabs />
          )}
          {children}
          <Toaster position="top-right" />
        </UserProvider>
      </body>
    </html>
  );
}
