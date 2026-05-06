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
          const [coachData, accessData] = await Promise.all([
            getCoach(firebaseUser.uid),
            getAthleteAccessByUid(firebaseUser.uid),
          ]);
          setCoach(coachData);
          setAthleteAccess(accessData);
          if (coachData) setRole("coach");
          else if (accessData) setRole("athlete");
          else setRole(null);
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
    const [coachData, accessData] = await Promise.all([
      getCoach(cred.user.uid),
      getAthleteAccessByUid(cred.user.uid),
    ]);
    setCoach(coachData);
    setAthleteAccess(accessData);
    let detectedRole: UserRole = null;
    if (coachData) detectedRole = "coach";
    else if (accessData) detectedRole = "athlete";
    setRole(detectedRole);
    return detectedRole;
  };

  const signUp = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    await createCoach(cred.user.uid, name, email);
    const coachData = await getCoach(cred.user.uid);
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
