import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

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
const auth = getAuth(app);
const functions = getFunctions(app);

setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Failed to set auth persistence:", err);
});

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

export default app;
export { auth, db, functions, googleProvider };