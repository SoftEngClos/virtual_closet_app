// firebaseConfig.ts
import { initializeApp } from "firebase/app";
import {
    getAuth,
    initializeAuth,
    browserLocalPersistence,
    getReactNativePersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
    apiKey: "AIzaSyBHyf7KuJk-Womt8_WJdL7NWrDlu9jgBcs",
    authDomain: "virtualclosetapp-56e13.firebaseapp.com",
    projectId: "virtualclosetapp-56e13",
    storageBucket: "virtualclosetapp-56e13.appspot.com",
    messagingSenderId: "583443720416",
    appId: "1:583443720416:web:7cb351c2d52e1dbf9b4885",
};

const app = initializeApp(firebaseConfig);

let auth;
if (Platform.OS === "web") {
    // ✅ Web uses browserLocalPersistence
    auth = getAuth(app);
    auth.setPersistence(browserLocalPersistence);
} else {
    // ✅ iOS / Android uses AsyncStorage persistence
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
    });
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
