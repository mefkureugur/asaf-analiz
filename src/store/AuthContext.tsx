import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase'; 
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  updatePassword, 
  updateEmail 
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'manager' | 'unauthorized';
  branchId: string;
  displayName: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  logout: () => Promise<void>;
  updateMyPassword: (newPass: string) => Promise<void>;
  updateMyEmail: (newEmail: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, "users", firebaseUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          setUser({ uid: firebaseUser.uid, ...userDoc.data() } as UserProfile);
        } else {
          const newUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.email?.split('@')[0] || "Kullanıcı",
            role: 'unauthorized',
            branchId: ''
          };
          await setDoc(userRef, newUser);
          setUser(newUser as UserProfile);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, pass: string) => {
    return await signInWithEmailAndPassword(auth, email, pass);
  };

  const logout = async () => {
    await signOut(auth);
  };

  // Müdürlerin kendi şifrelerini güncelleyebilmesi için
  const updateMyPassword = async (newPass: string) => {
    if (auth.currentUser) await updatePassword(auth.currentUser, newPass);
  };

  // Email güncelleme ve veritabanıyla eşitleme
  const updateMyEmail = async (newEmail: string) => {
    if (auth.currentUser) {
      await updateEmail(auth.currentUser, newEmail);
      await updateDoc(doc(db, "users", auth.currentUser.uid), { email: newEmail });
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      updateMyPassword, 
      updateMyEmail 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};