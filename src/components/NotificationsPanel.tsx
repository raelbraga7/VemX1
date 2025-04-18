import { Close as CloseIcon } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Notification } from '@/types/notification';

interface NotificationWithId extends Notification {
  id: string;
}

interface NotificationsPanelProps {
  isOpen: boolean;
  notifications: NotificationWithId[];
  onClose: () => void;
  onMarkAllAsRead: () => void;
  onConfirm: (notification: NotificationWithId) => Promise<void>;
  onReject: (notification: NotificationWithId) => Promise<void>;
}

export default function NotificationsPanel({
  isOpen,
  notifications,
  onClose,
  onMarkAllAsRead,
  onConfirm,
  onReject
}: NotificationsPanelProps) {
  if (!isOpen) return null;

  // Remove duplicatas baseado no peladaId e mantém apenas a notificação mais recente
  const uniqueNotifications = notifications.reduce((acc: NotificationWithId[], curr) => {
    const existingIndex = acc.findIndex(n => n.peladaId === curr.peladaId);
    if (existingIndex >= 0) {
      // Se já existe uma notificação para esta pelada, atualiza apenas se for mais recente
      if (new Date(curr.timestamp) > new Date(acc[existingIndex].timestamp)) {
        acc[existingIndex] = curr;
      }
    } else {
      acc.push(curr);
    }
    return acc;
  }, []);

  // Ordena por data, mais recentes primeiro
  const sortedNotifications = uniqueNotifications.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const formatNotificationDate = (dateString: string) => {
    try {
      if (!dateString) return 'Data não disponível';
      
      const date = parseISO(dateString);
      if (isNaN(date.getTime())) return 'Data inválida';
      
      return format(date, "d 'de' MMMM 'às' HH:mm", { locale: ptBR });
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return 'Data inválida';
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden z-50">
      <div className="absolute inset-0 overflow-hidden">
        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div className="pointer-events-auto w-screen max-w-md">
            <div className="flex h-full flex-col bg-white shadow-xl">
              <div className="flex items-center justify-between px-4 py-6 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Notificações</h2>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={onMarkAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Marcar todas como lidas
                  </button>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <CloseIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="divide-y divide-gray-200">
                  {sortedNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 ${!notification.read ? 'bg-blue-50' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-gray-900">
                          {notification.title}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatNotificationDate(notification.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        {notification.message}
                      </p>
                      
                      {notification.type === 'CONFIRMACAO' && !notification.read && (
                        <div className="flex space-x-2 mt-2">
                          <button
                            onClick={() => onConfirm(notification)}
                            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                          >
                            ✓ Confirmar
                          </button>
                          <button
                            onClick={() => onReject(notification)}
                            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                          >
                            ✕ Recusar
                          </button>
                        </div>
                      )}
                      
                      {notification.type === 'CONFIRMACAO' && notification.read && notification.resposta === 'confirmado' && (
                        <div className="mt-2">
                          <a
                            href={`/pelada/${notification.peladaId}/confirmar`}
                            className="inline-block w-full text-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                          >
                            Ver Lista de Confirmados
                          </a>
                        </div>
                      )}
                    </div>
                  ))}

                  {sortedNotifications.length === 0 && (
                    <div className="p-4 text-center text-gray-500">
                      Nenhuma notificação
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 