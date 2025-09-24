// firebaseConfig.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyBHyf7KuJk-Womt8_WJdL7NWrDlu9jgBcs",
  authDomain: "virtualclosetapp-56e13.firebaseapp.com",
  projectId: "virtualclosetapp-56e13",
  storageBucket: "virtualclosetapp-56e13.appspot.com",
  messagingSenderId: "583443720416",
  appId: "1:583443720416:web:7cb351c2d52e1dbf9b4885",
};

export const app = initializeApp(firebaseConfig);

let auth: Auth;

if (Platform.OS === "web") {
  auth = getAuth(app);
  // persist on web only
  void setPersistence(auth, browserLocalPersistence);
} else {
  // native: in-memory (no persistence lib / RN subpath)
  auth = initializeAuth(app);
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
