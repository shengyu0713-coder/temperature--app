import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDOlKxiMw0C9ptO4WxTHMQQboshiYgdUBE",
  authDomain: "tenperature-user.firebaseapp.com",
  projectId: "tenperature-user",
  storageBucket: "tenperature-user.firebasestorage.app",
  messagingSenderId: "951867327424",
  appId: "1:951867327424:web:fb4a1b66b23ec9951c3e25",
  measurementId: "G-RMCFWWL093",
};

export const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
