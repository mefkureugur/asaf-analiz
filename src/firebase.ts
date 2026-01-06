import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC0GVKvu_iChih-Dmt0pMbTgSdaUSwP0ZI",
  authDomain: "edu-analytics-47769.firebaseapp.com",
  projectId: "edu-analytics-47769",
  storageBucket: "edu-analytics-47769.firebasestorage.app",
  messagingSenderId: "642369041252",
  appId: "1:642369041252:web:cc7c27c1f22800ef6b8071",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
