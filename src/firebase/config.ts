// src/firebase/config.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, type Messaging } from 'firebase/messaging';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Chave pública VAPID para notificações push
export const VAPID_KEY = 'BABWxDnN3NxwPqGnIPofa92zU_JDBTjduRS-888v3B_fR5VTuxRxGQinUb5o4cmUMjsM10WwmtUX_4TolXYan1o';

// Inicializa o Firebase apenas uma vez
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Inicializa messaging apenas no cliente
let messaging: Messaging | null = null;
if (typeof window !== 'undefined') {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.error('Erro ao inicializar Firebase Messaging:', error);
  }
}

export { app, db, auth, storage, messaging };
