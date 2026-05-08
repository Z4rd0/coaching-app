"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { createCoach, getCoach, getAthleteAccessByUid } from "@/lib/firestore";
import type { Coach, AthleteAccess } from "@/types";

export type UserRole = "coach" | "athlete" | null;

interface AuthContextValue {
  user: User | null;
  coach: Coach | null;
  athleteAccess: AthleteAccess | null;
  role: UserRole;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<UserRole>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Retry a Firestore read up to `attempts` times if the client reports offline. */
async function firestoreRead<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isOffline = msg.includes("offline") || msg.includes("unavailable");
      if (isOffline && i < attempts - 1) {
        await new Promise((res) => setTimeout(res, 800 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("firestoreRead: max attempts exceeded");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [athleteAccess, setAthleteAccess] = useState<AthleteAccess | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      try {
        setUser(firebaseUser);
        if (firebaseUser) {
          // Try coach first — saves a read for coach users
          let coachData = await firestoreRead(() => getCoach(firebaseUser.uid));
          if (coachData) {
            setCoach(coachData);
            setRole("coach");
          } else {
            // Not a coach by doc — check if they're an athlete
            const accessData = await firestoreRead(() => getAthleteAccessByUid(firebaseUser.uid));
            if (accessData) {
              setAthleteAccess(accessData);
              setRole("athlete");
            } else {
              // Neither coach nor athlete — self-heal: this user authenticated
              // but has no coach doc (likely created during an earlier offline
              // signup or had it deleted). Recreate it so the app works.
              const fallbackName = firebaseUser.displayName ?? firebaseUser.email?.split("@")[0] ?? "Coach";
              await createCoach(firebaseUser.uid, fallbackName, firebaseUser.email ?? "");
              coachData = await firestoreRead(() => getCoach(firebaseUser.uid));
              setCoach(coachData);
              setRole("coach");
            }
          }
        } else {
          setCoach(null);
          setAthleteAccess(null);
          setRole(null);
        }
      } catch (err) {
        console.error("Auth state error:", err);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  /** Returns detected role after sign-in */
  const signIn = async (email: string, password: string): Promise<UserRole> => {
    const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    const coachData = await firestoreRead(() => getCoach(cred.user.uid));
    setCoach(coachData);
    if (coachData) {
      setRole("coach");
      return "coach";
    }
    const accessData = await firestoreRead(() => getAthleteAccessByUid(cred.user.uid));
    setAthleteAccess(accessData);
    const detectedRole: UserRole = accessData ? "athlete" : null;
    setRole(detectedRole);
    return detectedRole;
  };

  const signUp = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    await createCoach(cred.user.uid, name, email);
    const coachData = await firestoreRead(() => getCoach(cred.user.uid));
    setCoach(coachData);
    setRole("coach");
  };

  const signOut = async () => {
    await firebaseSignOut(getFirebaseAuth());
    setCoach(null);
    setAthleteAccess(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, coach, athleteAccess, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
