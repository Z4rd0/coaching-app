"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";
import LoadingSpinner from "@/components/LoadingSpinner";

type Step = "loading" | "form" | "joining" | "done" | "error";

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <JoinContent />
    </Suspense>
  );
}

function JoinContent() {
  const router = useRouter();
  const { coachId, athleteId } = useParams<{ coachId: string; athleteId: string }>();

  const [step, setStep] = useState<Step>("loading");
  const [mode, setMode] = useState<"register" | "login">("register");
  const [coachName, setCoachName] = useState("");
  const [athleteName, setAthleteName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!coachId || !athleteId) { setStep("error"); return; }

    // Load coach name and athlete name from Firestore (public-ish read via rules)
    const db = getFirebaseDb();
    Promise.all([
      getDoc(doc(db, "coaches", coachId)),
      getDoc(doc(db, "coaches", coachId, "athletes", athleteId)),
    ]).then(([coachSnap, athleteSnap]) => {
      if (!coachSnap.exists() || !athleteSnap.exists()) { setStep("error"); return; }
      const athlete = athleteSnap.data();
      if (athlete.status !== "pending") { setStep("error"); return; }
      setCoachName(coachSnap.data().name ?? "");
      setAthleteName(athlete.name ?? "");
      setEmail(athlete.email ?? "");
      setName(athlete.name ?? "");
      setStep("form");
    }).catch(() => setStep("error"));
  }, [coachId, athleteId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachId || !athleteId) return;
    setError("");
    setStep("joining");

    try {
      let uid: string;
      let displayName = name;

      if (mode === "register") {
        if (!name.trim()) { setError("Inserisci il tuo nome"); setStep("form"); return; }
        const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
        uid = cred.user.uid;
      } else {
        const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
        uid = cred.user.uid;
        displayName = cred.user.displayName ?? email;
      }

      const db = getFirebaseDb();

      // 1. Self-activate the athlete profile (allowed by security rules)
      await updateDoc(doc(db, "coaches", coachId, "athletes", athleteId), {
        athleteUid: uid,
        status: "active",
      });

      // 2. Create athleteAccess lookup document
      await setDoc(doc(db, "athleteAccess", uid), {
        coachId,
        athleteId,
        name: displayName,
        email,
      });

      document.cookie = "coach-auth=1; path=/; max-age=2592000";
      setStep("done");
      setTimeout(() => router.replace("/athlete/dashboard"), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore";
      if (msg.includes("email-already-in-use")) {
        setError("Email già registrata — usa 'Ho già un account'.");
      } else if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        setError("Password errata");
      } else if (msg.includes("permission-denied")) {
        setError("Link non valido o già utilizzato");
      } else {
        setError(msg);
      }
      setStep("form");
    }
  };

  if (step === "loading" || step === "joining") {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
        <LoadingSpinner />
        <p className="text-slate-400 text-sm">
          {step === "joining" ? "Collegamento in corso…" : "Caricamento…"}
        </p>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white">Sei dentro!</h1>
        <p className="text-slate-400 text-sm text-center">
          Sei stato collegato a <span className="text-primary font-semibold">{coachName}</span>.<br />
          Reindirizzamento alla dashboard…
        </p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 gap-4">
        <p className="text-red-400 text-center">Link non valido, già utilizzato o scaduto.</p>
        <p className="text-slate-500 text-sm text-center">Chiedi al tuo coach un nuovo link.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Coach App</h1>
          {coachName && (
            <p className="text-slate-400 text-sm mt-1">
              <span className="text-primary font-semibold">{coachName}</span> ti ha invitato
            </p>
          )}
          {athleteName && (
            <p className="text-white text-sm mt-0.5 font-medium">Ciao, {athleteName} 👋</p>
          )}
        </div>

        <div className="flex bg-slate-800 rounded-xl p-1 mb-6">
          {(["register", "login"] as const).map((m) => (
            <button key={m} type="button"
              onClick={() => { setMode(m); setError(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === m ? "bg-primary text-white" : "text-slate-400"
              }`}
            >
              {m === "register" ? "Crea account" : "Ho già un account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Nome</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Il tuo nome" required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="email@esempio.com" required autoComplete="email"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" required minLength={6}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button type="submit"
            className="w-full bg-primary text-white font-semibold py-3 rounded-xl">
            {mode === "register" ? "Crea account e unisciti" : "Accedi e unisciti"}
          </button>
        </form>
      </div>
    </div>
  );
}
