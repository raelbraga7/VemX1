// src/firebase/config.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: 'AIzaSyDmbwrhiyU1sxl5BQy6qHeNd9_LUV5MTJQ',
  authDomain: 'vemx1-app.firebaseapp.com',
  projectId: 'vemx1-app',
  storageBucket: 'vemx1-app.firebasestorage.app',
  messagingSenderId: '479038972951',
  appId: '1:479038972951:web:e436b71775539c1109a852',
  measurementId: 'G-TCM9QM37BT'
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Auth e Firestore
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
