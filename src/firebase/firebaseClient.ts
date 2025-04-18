import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging, type MessagePayload } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Chave pública VAPID
const VAPID_KEY = 'BABWxDnN3NxwPqGnIPofa92zU_JDBTjduRS-888v3B_fR5VTuxRxGQinUb5o4cmUMjsM10WwmtUX_4TolXYan1o';

// Inicializa o Firebase apenas uma vez
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Variável para armazenar a instância do messaging
let messaging: Messaging | null = null;

// Inicializa o messaging apenas no cliente (browser)
if (typeof window !== 'undefined') {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.error('Erro ao inicializar Firebase Messaging:', error);
  }
}

export const requestPermissionAndGetToken = async (): Promise<string | null> => {
  try {
    // Verifica se está no cliente
    if (typeof window === 'undefined') {
      throw new Error('Esta função só pode ser executada no navegador');
    }

    // Verifica se o navegador suporta notificações
    if (!('Notification' in window)) {
      throw new Error('Este navegador não suporta notificações push');
    }

    // Verifica se o messaging foi inicializado
    if (!messaging) {
      throw new Error('Firebase Messaging não foi inicializado');
    }

    // Registra o service worker primeiro
    await registerServiceWorker();

    // Solicita permissão
    const permission = await Notification.requestPermission();
    console.log('Status da permissão:', permission);
    
    if (permission !== 'granted') {
      throw new Error('Permissão para notificações negada');
    }

    // Gera o token FCM
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
    });

    if (!token) {
      throw new Error('Não foi possível gerar o token FCM');
    }

    // Exibe o token no console
    console.log('Token FCM gerado:', token);

    return token;
  } catch (error) {
    console.error('Erro ao solicitar permissão ou gerar token:', error);
    if (error instanceof Error) {
      console.error('Detalhes do erro:', error.message);
    }
    return null;
  }
};

// Função para registrar o service worker
export const registerServiceWorker = async () => {
  try {
    if (typeof window === 'undefined') {
      return;
    }

    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker não é suportado neste navegador');
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });

    console.log('Service Worker registrado com sucesso:', registration);
    return registration;
  } catch (error) {
    console.error('Erro ao registrar Service Worker:', error);
    throw error;
  }
};

// Função para escutar mensagens em foreground
export const onForegroundMessage = (callback: (payload: MessagePayload) => void) => {
  if (!messaging) {
    console.error('Messaging não inicializado');
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    console.log('Mensagem recebida em foreground:', payload);
    callback(payload);
  });
};

// Exporta a instância do messaging
export { messaging }; 