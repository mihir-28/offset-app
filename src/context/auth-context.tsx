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
import { CardData, createCard, getCards, migrateCardsAndCycles, migrateLegacyPlaintextData, migrateUserDataToCard, updateCard } from "../lib/db-helpers";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  photoURL: string;
  createdAt?: Timestamp;
  buckets?: string[];
  cycleStartDay?: number;
  activeCardId?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateBuckets: (newBuckets: string[]) => Promise<void>;
  updateCycleStartDay: (day: number) => Promise<void>;
  cards: CardData[];
  activeCard: CardData | null;
  selectCard: (cardId: string) => Promise<void>;
  completeCardSetup: (name: string) => Promise<void>;
  createAndSelectCard: (name: string) => Promise<void>;
  refreshCards: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isConfigValid);
  const [cards, setCards] = useState<CardData[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const refreshCards = async () => {
    if (!user) return;
    const nextCards = (await getCards(user.uid)).filter((card) => !card.archived);
    setCards(nextCards);
  };

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

        // Sync user profile to Firestore after auth is ready so the app shell does not block on rules/network.
        const userDocRef = doc(db, "users", firebaseUser.uid);
        try {
          // Attempt to get user first. If offline, this might get from cache or fail.
          const docSnap = await getDoc(userDocRef);
          const existingProfile = docSnap.exists() ? docSnap.data() : {};
          let dbBuckets = ["HOME", "MINE"];
          let dbCycleStartDay = 17;

          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.buckets && Array.isArray(data.buckets)) {
              dbBuckets = data.buckets;
            }
            if (typeof data.cycleStartDay === "number") {
              dbCycleStartDay = data.cycleStartDay;
            }
            // Update photo/name if changed
            await setDoc(userDocRef, userProfile, { merge: true });
          } else {
            await setDoc(userDocRef, {
              ...userProfile,
              buckets: dbBuckets,
              cycleStartDay: dbCycleStartDay,
              createdAt: serverTimestamp(),
            }, { merge: true });
          }

          const savedCards = (await getCards(firebaseUser.uid)).filter((card) => !card.archived);
          const savedActiveCardId = typeof existingProfile.activeCardId === "string" ? existingProfile.activeCardId : undefined;
          const selectedCardId = savedCards.some((card) => card.id === savedActiveCardId) ? savedActiveCardId : savedCards[0]?.id;
          if (selectedCardId && selectedCardId !== savedActiveCardId) {
            await setDoc(userDocRef, { activeCardId: selectedCardId }, { merge: true });
          }
          await migrateCardsAndCycles(firebaseUser.uid, dbBuckets);
          setCards((await getCards(firebaseUser.uid)).filter((card) => !card.archived));
          setActiveCardId(selectedCardId || null);
          setProfile({
            ...userProfile,
            buckets: dbBuckets,
            cycleStartDay: dbCycleStartDay,
            activeCardId: selectedCardId,
          });
          setLoading(false);

          migrateLegacyPlaintextData(firebaseUser.uid).catch((migrationError) => {
            console.error("Legacy encryption migration failed:", migrationError);
          });
        } catch (error) {
          console.error("Firestore user profile sync error (may be offline):", error);
          // Fallback to local profile info so offline works
          setProfile({
            ...userProfile,
            buckets: ["HOME", "MINE"],
            cycleStartDay: 17,
          });
          setLoading(false);
        }
      } else {
        setProfile(null);
        setCards([]);
        setActiveCardId(null);
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

  const updateBuckets = async (newBuckets: string[]) => {
    if (!user || !activeCard) return;
    await updateCard(user.uid, activeCard.id, activeCard.name, activeCard.cycleStartDay, newBuckets);
    setCards((current) => current.map((card) => card.id === activeCard.id ? { ...card, buckets: newBuckets } : card));
  };

  const updateCycleStartDay = async (day: number) => {
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    await setDoc(userDocRef, { cycleStartDay: day }, { merge: true });
    setProfile((prev) => prev ? { ...prev, cycleStartDay: day } : null);
  };

  const selectCard = async (cardId: string) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { activeCardId: cardId }, { merge: true });
    setActiveCardId(cardId);
    setProfile((prev) => prev ? { ...prev, activeCardId: cardId } : null);
  };

  const completeCardSetup = async (name: string) => {
    if (!user || !profile) return;
    const card = await createCard(user.uid, name, profile.cycleStartDay || 17, profile.buckets || ["HOME", "MINE"]);
    await migrateUserDataToCard(user.uid, card.id);
    await selectCard(card.id);
    setCards([card]);
  };

  const createAndSelectCard = async (name: string) => {
    if (!user) return;
    const card = await createCard(user.uid, name);
    setCards((current) => [...current, card].sort((a, b) => a.name.localeCompare(b.name)));
    await selectCard(card.id);
  };

  const activeCard = cards.find((card) => card.id === activeCardId) || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        loginWithGoogle,
        logout,
        updateBuckets,
        updateCycleStartDay,
        cards,
        activeCard,
        selectCard,
        completeCardSetup,
        createAndSelectCard,
        refreshCards,
      }}
    >
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
