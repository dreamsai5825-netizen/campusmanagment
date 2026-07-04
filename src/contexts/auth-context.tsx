'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

type AuthContextValue = {
  firebaseUser: User | null;
  isLoading: boolean;
  isSignedIn: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<User>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  superAdmin: any | null;
  selectedCollegeId: string | null;
  setSelectedCollegeId: (id: string | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [superAdmin, setSuperAdmin] = useState<any | null>(null);
  const [selectedCollegeId, setSelectedCollegeIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setSelectedCollegeId = (id: string | null) => {
    setSelectedCollegeIdState(id);
    if (id) {
      localStorage.setItem('super_admin_college_id', id);
    } else {
      localStorage.removeItem('super_admin_college_id');
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        setIsLoading(true);
        try {
          const superAdminSnap = await getDoc(doc(db, 'super_admins', user.uid));
          if (superAdminSnap.exists()) {
            setSuperAdmin({ id: superAdminSnap.id, ...superAdminSnap.data() });
            const savedCollegeId = localStorage.getItem('super_admin_college_id');
            if (savedCollegeId) {
              setSelectedCollegeIdState(savedCollegeId);
            } else {
              const collegesSnap = await getDocs(collection(db, 'colleges'));
              if (!collegesSnap.empty) {
                const firstId = collegesSnap.docs[0].id;
                setSelectedCollegeIdState(firstId);
                localStorage.setItem('super_admin_college_id', firstId);
              }
            }
          } else {
            setSuperAdmin(null);
            setSelectedCollegeIdState(null);
          }
        } catch (err) {
          console.error('Error loading super admin:', err);
          setSuperAdmin(null);
          setSelectedCollegeIdState(null);
        } finally {
          setIsLoading(false);
        }
      } else {
        setFirebaseUser(null);
        setSuperAdmin(null);
        setSelectedCollegeIdState(null);
        setIsLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async (): Promise<User> => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  };

  const signUp = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const value: AuthContextValue = {
    firebaseUser,
    isLoading,
    isSignedIn: !!firebaseUser,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    superAdmin,
    selectedCollegeId,
    setSelectedCollegeId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
