import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // 👈 Giriş servisi eklendi
import { getFirestore } from "firebase/firestore"; // 👈 Veritabanı servisi eklendi

const firebaseConfig = {
  apiKey: "AIzaSyCILtbLmDourU4xKZu-zKntMABpemBLOXc",
  authDomain: "asaf-analiz.firebaseapp.com",
  projectId: "asaf-analiz",
  storageBucket: "asaf-analiz.firebasestorage.app",
  messagingSenderId: "43481419846",
  appId: "1:43481419846:web:b9dd2bbd986d2188e9fa47"
};

// Firebase'i başlat
const app = initializeApp(firebaseConfig);

// Servisleri dışarı aktar (Diğer dosyalar buradan okuyacak)
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;