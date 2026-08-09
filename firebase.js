import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 請把下面換成你自己 Firebase 專案的設定值
// Firebase Console → 齒輪圖示「專案設定」→ 一般 → 往下滑「你的應用程式」→ SDK 設定與設定
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
export const db = getFirestore(app);
