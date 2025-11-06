// app/firebase/firebaseConfig.ts
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  setPersistence,
  getReactNativePersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Firebase configuration ---
const firebaseConfig = {
  apiKey: 'AIzaSyBHyf7KuJk-Womt8_WJdL7NWrDlu9jgBcs',
  authDomain: 'virtualclosetapp-56e13.firebaseapp.com',
  projectId: 'virtualclosetapp-56e13',
  storageBucket: 'virtualclosetapp-56e13.firebasestorage.app', // CHANGED THIS LINE
  messagingSenderId: '583443720416',
  appId: '1:583443720416:web:7cb351c2d52e1dbf9b4885',
};

// --- Initialize Firebase ---
export const app = initializeApp(firebaseConfig);

// --- Firestore & Storage ---
export const db = getFirestore(app);
export const storage = getStorage(app);

// Log to verify configuration
console.log("Firebase initialized");
console.log("Storage bucket:", storage.app.options.storageBucket);

// --- Auth setup ---
export let auth;

if (Platform.OS === 'web') {
  auth = getAuth(app);
  void setPersistence(auth, browserLocalPersistence);
} else {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

export default auth;
