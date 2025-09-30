// app/firebase/firebaseConfig.ts
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { Platform } from 'react-native';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// --- Firebase configuration ---
const firebaseConfig = {
  apiKey: 'AIzaSyBHyf7KuJk-Womt8_WJdL7NWrDlu9jgBcs',
  authDomain: 'virtualclosetapp-56e13.firebaseapp.com',
  projectId: 'virtualclosetapp-56e13',
  storageBucket: 'virtualclosetapp-56e13.appspot.com',
  messagingSenderId: '583443720416',
  appId: '1:583443720416:web:7cb351c2d52e1dbf9b4885',
};

// --- Initialize Firebase ---
export const app = initializeApp(firebaseConfig);

// --- Firestore & Storage ---
export const db = getFirestore(app);
export const storage = getStorage(app);

// --- Auth setup ---
export let auth: Auth;

if (Platform.OS === 'web') {
  auth = getAuth(app);
  void setPersistence(auth, browserLocalPersistence);
} else {
  // iOS/Android (Expo) uses default persistence
  auth = getAuth(app);
}
