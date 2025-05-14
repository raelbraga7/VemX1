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
import { Dialog } from '@headlessui/react';
import { PLANOS } from '@/lib/planos';
import { AssinaturaButton } from '@/components/AssinaturaButton';

const inter = Inter({ subsets: ['latin'] });

interface NotificationWithId extends Notification {
  id: string;
}

function Header() {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<NotificationWithId[]>([]);
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);
  const [isPlanosModalOpen, setIsPlanosModalOpen] = useState(false);
  const [loadingPlano, setLoadingPlano] = useState<string | null>(null);
  const unreadCount = notifications.filter(n => !n.read).length;
  const pathname = usePathname();
  
  // Verificar se estamos em uma página de pelada específica
  const isPeladaSpecificPage = pathname?.startsWith('/pelada/') && pathname.split('/').length > 2;
  
  // Por padrão, mostrar o botão (será controlado pelo componente com base no isOwner)
  const showAssinaturaButton = !isPeladaSpecificPage;

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
  
  // Links para checkout da Hotmart (substitua pelos seus links reais)
  const HOTMART_URLS = {
    premium: 'https://pay.hotmart.com/M99700196W?off=r5di19vt'
  };

  const handleCTA = async (planoTipo: 'premium' = 'premium') => {
    setLoadingPlano(planoTipo);

    try {
      // Redirecionar direto para o checkout da Hotmart
      window.location.href = HOTMART_URLS[planoTipo];
    } catch (error) {
      console.error('Erro ao iniciar checkout:', error);
      toast.error('Falha ao iniciar o pagamento. Tente novamente.');
    } finally {
      setLoadingPlano(null);
    }
  };

  return (
    <header className="bg-black shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-white">VemX1</h1>
        </div>
        
        {user && (
          <div className="flex items-center space-x-2">
            {showAssinaturaButton && <AssinaturaButton />}
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
          </div>
        )}
      </div>
      
      {/* Modal de Planos */}
      <Dialog open={isPlanosModalOpen} onClose={() => setIsPlanosModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Dialog.Panel className="w-full max-w-md mx-auto bg-black text-white rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 sm:p-6 text-center">
              <Dialog.Title className="text-xl sm:text-2xl font-bold mb-4">
                Assine o VemX1
              </Dialog.Title>
              
              <div className="mx-auto">
                {/* Plano Premium */}
                <div className="bg-black/40 rounded-xl p-4 sm:p-6 border-2 border-[#1d4ed8] relative">
                  <div className="absolute top-0 right-0 left-0 bg-[#1d4ed8] text-white py-1 text-sm rounded-t-xl font-bold">
                    Plano VemX1
                  </div>
                  <div className="text-xl font-bold mb-2 mt-6">Plano Premium</div>
                  <div className="text-2xl font-bold mb-2">
                    R${PLANOS.PREMIUM.preco}
                    <span className="text-sm text-gray-400">/mês</span>
                  </div>
                  <ul className="text-left text-sm space-y-2 mb-4">
                    <li className="flex items-center">
                      <span className="text-[#1d4ed8] mr-2 text-xl">✓</span>
                      Jogadores ILIMITADOS
                    </li>
                    <li className="flex items-center">
                      <span className="text-[#1d4ed8] mr-2 text-xl">✓</span>
                      Peladas ILIMITADAS
                    </li>
                    <li className="flex items-center">
                      <span className="text-[#1d4ed8] mr-2 text-xl">✓</span>
                      Estatísticas avançadas
                    </li>
                    <li className="flex items-center">
                      <span className="text-[#1d4ed8] mr-2 text-xl">✓</span>
                      Suporte prioritário
                    </li>
                    <li className="flex items-center">
                      <span className="text-[#1d4ed8] mr-2 text-xl">✓</span>
                      Cancele quando quiser
                    </li>
                  </ul>
                  <button 
                    onClick={() => handleCTA('premium')}
                    disabled={loadingPlano === 'premium'}
                    className="bg-[#1d4ed8] hover:bg-[#1d4ed8]/90 text-white px-4 py-3 w-full rounded-lg text-lg font-medium transition-all hover:scale-105 hover:shadow-lg hover:shadow-[#1d4ed8]/20 disabled:opacity-70"
                  >
                    {loadingPlano === 'premium' ? 'Processando...' : 'Assinar Agora'}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setIsPlanosModalOpen(false)}
                className="mt-6 px-4 py-1 text-sm text-gray-300 hover:text-white"
              >
                Fechar
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </header>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/pagamento' || pathname === '/cadastro' || pathname === '/login';

  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <UserProvider>
          {!isAuthPage && (
            <Header />
          )}
          {children}
          <Toaster position="top-right" />
        </UserProvider>
      </body>
    </html>
  );
}
