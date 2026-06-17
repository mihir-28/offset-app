"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db, isConfigValid } from "../lib/firebase";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  photoURL: string;
  createdAt?: Timestamp;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isConfigValid);

  useEffect(() => {
    if (!isConfigValid) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const userProfile: UserProfile = {
          id: firebaseUser.uid,
          email: firebaseUser.email || "",
          name: firebaseUser.displayName || "User",
          photoURL: firebaseUser.photoURL || "",
        };

        setProfile(userProfile);
        setLoading(false);

        // Sync user profile to Firestore after auth is ready so the app shell does not block on rules/network.
        const userDocRef = doc(db, "users", firebaseUser.uid);
        try {
          // Attempt to get user first. If offline, this might get from cache or fail.
          const docSnap = await getDoc(userDocRef);
          if (!docSnap.exists()) {
            await setDoc(userDocRef, {
              ...userProfile,
              createdAt: serverTimestamp(),
            }, { merge: true });
          } else {
            // Update photo/name if changed
            await setDoc(userDocRef, userProfile, { merge: true });
          }
          setProfile(userProfile);
        } catch (error) {
          console.error("Firestore user profile sync error (may be offline):", error);
          // Fallback to local profile info so offline works
          setProfile(userProfile);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google:", error);
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
      setLoading(false);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
