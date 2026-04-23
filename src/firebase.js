import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDYwTrSHjv7V2jU5j0QSnIISRmhC_8UQa4",
  authDomain: "meva-clean.firebaseapp.com",
  projectId: "meva-clean",
  storageBucket: "meva-clean.firebasestorage.app",
  messagingSenderId: "928540716811",
  appId: "1:928540716811:web:e1fa4aa010687a6ab2bc0e",
  measurementId: "G-VEXFCSEVZK",
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

export default app;
export { db };