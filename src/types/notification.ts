export interface Notification {
  id?: string;
  userId: string;
  peladaId: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type?: 'CONVITE' | 'CONFIRMACAO' | 'GERAL';
  actions?: {
    confirm?: boolean;
    reject?: boolean;
  };
  respondido?: boolean;
  resposta?: 'confirmado' | 'recusado';
} 