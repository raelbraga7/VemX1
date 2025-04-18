// Versão do service worker - atualize quando fizer mudanças
const SW_VERSION = '1.0.0';

// Importa os scripts do Firebase
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// IMPORTANTE: Substitua estes valores pelos seus do Firebase Console
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Inicializa o Firebase
firebase.initializeApp({
  apiKey: self.FIREBASE_CONFIG.apiKey,
  authDomain: self.FIREBASE_CONFIG.authDomain,
  projectId: self.FIREBASE_CONFIG.projectId,
  storageBucket: self.FIREBASE_CONFIG.storageBucket,
  messagingSenderId: self.FIREBASE_CONFIG.messagingSenderId,
  appId: self.FIREBASE_CONFIG.appId
});

// Obtém uma instância do Firebase Messaging
const messaging = firebase.messaging();

// Cache name para PWA
const CACHE_NAME = `fcm-cache-${SW_VERSION}`;

// Arquivos para cache
const CACHE_URLS = [
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Evento de instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Evento de ativação - limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('fcm-cache-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Manipula mensagens em background
messaging.onBackgroundMessage((payload) => {
  console.log('[Service Worker] Mensagem recebida em background:', payload);

  const notificationTitle = payload.notification?.title || 'Nova Notificação';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: payload.data?.tag || 'default',
    data: payload.data || {},
    // Adiciona ações personalizadas se necessário
    actions: [
      {
        action: 'open',
        title: 'Abrir'
      }
    ],
    // Vibração personalizada (opcional)
    vibrate: [100, 50, 100],
    // Permite que o usuário feche a notificação
    requireInteraction: false
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manipula cliques nas notificações
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const peladaId = event.notification.data.peladaId;
  const action = event.action;

  if (action === 'confirm') {
    // Redireciona para a página de confirmação com status=confirm
    const confirmUrl = `/pelada/${peladaId}/confirmar?status=confirm`;
    event.waitUntil(
      clients.openWindow(confirmUrl)
    );
  } else if (action === 'reject') {
    // Redireciona para a página de confirmação com status=reject
    const rejectUrl = `/pelada/${peladaId}/confirmar?status=reject`;
    event.waitUntil(
      clients.openWindow(rejectUrl)
    );
  } else {
    // Clique na notificação sem ação específica
    const defaultUrl = `/pelada/${peladaId}/confirmar`;
    event.waitUntil(
      clients.openWindow(defaultUrl)
    );
  }
}); 