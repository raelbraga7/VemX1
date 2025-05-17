'use client';

import React, { useMemo, useState } from 'react';
import { Close as CloseIcon } from '@mui/icons-material';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Notification } from '@/types/notification';
import { useRouter } from 'next/navigation';
import { CircularProgress } from '@mui/material';
import { Alert, Snackbar } from '@mui/material';

interface NotificationActions {
  confirm?: boolean;
  reject?: boolean;
}

interface NotificationWithId extends Notification {
  id: string;
  actions?: NotificationActions;
}

interface NotificationsPanelProps {
  isOpen: boolean;
  notifications: NotificationWithId[];
  onClose: () => void;
  onMarkAllAsRead: () => void;
  onConfirm: (notification: NotificationWithId) => Promise<void>;
  onReject: (notification: NotificationWithId) => Promise<void>;
}

interface NotificationActionButtonsProps {
  notification: NotificationWithId;
  isProcessing: boolean;
  onConfirm: () => Promise<void>;
  onReject: () => Promise<void>;
  onVerConfirmados: (peladaId: string) => void;
}

const NotificationActionButtons: React.FC<NotificationActionButtonsProps> = React.memo(({
  notification,
  isProcessing,
  onConfirm,
  onReject,
  onVerConfirmados
}) => {
  if (!notification.actions || notification.respondido) {
    return null;
  }

  if (notification.type === 'CONFIRMACAO') {
    return (
      <div className="mt-2">
        <button
          onClick={() => onVerConfirmados(notification.peladaId)}
          className="w-full text-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          aria-label="Ver lista de confirmados"
        >
          Ver Lista de Confirmados
        </button>
      </div>
    );
  }

  return (
    <div className="flex space-x-2" role="group" aria-label="Ações da notificação">
      {notification.actions.confirm && (
        <button
          onClick={onConfirm}
          disabled={isProcessing}
          aria-label="Confirmar notificação"
          aria-busy={isProcessing}
          className={`
            flex-1 px-4 py-2 rounded-md transition-colors
            ${isProcessing 
              ? 'bg-blue-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'
            }
            text-white flex items-center justify-center
          `}
        >
          {isProcessing ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            'Confirmar'
          )}
        </button>
      )}
      {notification.actions.reject && (
        <button
          onClick={onReject}
          disabled={isProcessing}
          aria-label="Recusar notificação"
          aria-busy={isProcessing}
          className={`
            flex-1 px-4 py-2 rounded-md transition-colors
            ${isProcessing 
              ? 'bg-red-400 cursor-not-allowed' 
              : 'bg-red-600 hover:bg-red-700'
            }
            text-white flex items-center justify-center
          `}
        >
          {isProcessing ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            'Recusar'
          )}
        </button>
      )}
    </div>
  );
});

NotificationActionButtons.displayName = 'NotificationActionButtons';

// Adicionar uma função para renderizar HTML de forma segura
const renderHTML = (html: string) => {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  isOpen,
  notifications,
  onClose,
  onMarkAllAsRead,
  onConfirm,
  onReject
}) => {
  const router = useRouter();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      const dateA = parseISO(a.timestamp);
      const dateB = parseISO(b.timestamp);
      
      if (!isValid(dateA) || !isValid(dateB)) {
        return 0;
      }
      
      return dateB.getTime() - dateA.getTime();
    });
  }, [notifications]);

  if (!isOpen) return null;

  const handleVerConfirmados = (peladaId: string) => {
    router.push(`/pelada/${peladaId}/confirmar`);
    onClose();
  };

  const formatNotificationDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      if (!isValid(date)) {
        throw new Error('Data inválida');
      }
      return format(date, "d 'de' MMMM 'às' HH:mm", { locale: ptBR });
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return 'Data inválida';
    }
  };

  const handleConfirm = async (notification: NotificationWithId) => {
    try {
      setActionInProgress(notification.id);
      setError(null);
      await onConfirm(notification);
    } catch (error) {
      console.error('Erro ao confirmar:', error);
      setError('Erro ao confirmar a notificação. Tente novamente.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (notification: NotificationWithId) => {
    try {
      setActionInProgress(notification.id);
      setError(null);
      await onReject(notification);
    } catch (error) {
      console.error('Erro ao recusar:', error);
      setError('Erro ao recusar a notificação. Tente novamente.');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div 
      className="fixed inset-0 overflow-hidden z-50" 
      role="dialog" 
      aria-modal="true"
      aria-labelledby="notifications-title"
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div className="pointer-events-auto w-screen max-w-md">
            <div className="flex h-full flex-col bg-white shadow-xl">
              <div className="flex items-center justify-between px-4 py-6 border-b border-gray-200">
                <h2 id="notifications-title" className="text-lg font-medium text-gray-900">
                  Notificações
                </h2>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={onMarkAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800"
                    aria-label="Marcar todas as notificações como lidas"
                  >
                    Marcar todas como lidas
                  </button>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                    aria-label="Fechar painel de notificações"
                  >
                    <CloseIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div 
                className="flex-1 overflow-y-auto"
                role="region"
                aria-label="Lista de notificações"
              >
                <div className="divide-y divide-gray-200">
                  {sortedNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 ${!notification.read ? 'bg-blue-50' : ''}`}
                      role="article"
                      aria-label={`Notificação: ${notification.title}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-gray-900">
                          {notification.title}
                        </span>
                        <time 
                          dateTime={notification.timestamp}
                          className="text-xs text-gray-500"
                        >
                          {formatNotificationDate(notification.timestamp)}
                        </time>
                      </div>
                      {/* Renderizar o HTML em vez de texto plano */}
                      <div className="text-sm text-gray-600 mb-3">
                        {renderHTML(notification.message)}
                      </div>
                      
                      <NotificationActionButtons
                        notification={notification}
                        isProcessing={actionInProgress === notification.id}
                        onConfirm={() => handleConfirm(notification)}
                        onReject={() => handleReject(notification)}
                        onVerConfirmados={handleVerConfirmados}
                      />
                    </div>
                  ))}

                  {sortedNotifications.length === 0 && (
                    <div 
                      className="p-4 text-center text-gray-500" 
                      role="status"
                      aria-live="polite"
                    >
                      Nenhuma notificação
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setError(null)} 
          severity="error"
          sx={{ width: '100%' }}
        >
          {error}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default NotificationsPanel; 