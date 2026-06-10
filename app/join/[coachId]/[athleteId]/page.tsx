"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, updateDoc, setDoc } from "firebase/firestore";
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
  const [alreadyActive, setAlreadyActive] = useState(false);
  const [coachName, setCoachName] = useState("");
  const [athleteName, setAthleteName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!coachId || !athleteId) { setStep("error"); return; }

    // Load join info via API route (uses Admin SDK — no client auth needed)
    fetch(`/api/join?coachId=${coachId}&athleteId=${athleteId}`)
      .then(async (res) => {
        if (!res.ok) { setStep("error"); return; }
        const data = await res.json();
        setCoachName(data.coachName ?? "");
        setAthleteName(data.athleteName ?? "");
        setEmail(data.athleteEmail ?? "");
        setName(data.athleteName ?? "");
        if (data.alreadyActive) {
          setAlreadyActive(true);
          setMode("login");
        }
        setStep("form");
      })
      .catch(() => setStep("error"));
  }, [coachId, athleteId]);

  /** Shared tail of the join flow: link the auth user to the athlete profile */
  const completeJoin = async (uid: string, displayName: string, joinEmail: string) => {
    const db = getFirebaseDb();

    // 1. Self-activate the athlete profile (skip if already active)
    if (!alreadyActive) {
      await updateDoc(doc(db, "coaches", coachId, "athletes", athleteId), {
        athleteUid: uid,
        status: "active",
      });
    }

    // 2. Create/update athleteAccess lookup document
    await setDoc(doc(db, "athleteAccess", uid), {
      coachId,
      athleteId,
      name: displayName,
      email: joinEmail,
    });

    document.cookie = "coach-auth=1; path=/; max-age=2592000";
    setStep("done");
    setTimeout(() => router.replace("/athlete/dashboard"), 2000);
  };

  const handleJoinError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : "Errore";
    if (msg.includes("email-already-in-use")) {
      setError("Email già registrata — usa 'Ho già un account'.");
    } else if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
      setError("Password errata");
    } else if (msg.includes("permission-denied")) {
      setError("Link non valido o già utilizzato");
    } else if (msg.includes("popup-closed-by-user") || msg.includes("cancelled-popup-request")) {
      // User dismissed the Google popup — no error to show
    } else {
      setError(msg);
    }
    setStep("form");
  };

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

      await completeJoin(uid, displayName, email);
    } catch (err: unknown) {
      handleJoinError(err);
    }
  };

  const handleGoogleJoin = async () => {
    if (!coachId || !athleteId) return;
    setError("");
    setStep("joining");
    try {
      const cred = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
      const displayName = cred.user.displayName ?? name ?? cred.user.email ?? "Atleta";
      await completeJoin(cred.user.uid, displayName, cred.user.email ?? email);
    } catch (err: unknown) {
      handleJoinError(err);
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

        {alreadyActive ? (
          <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 mb-6 text-sm text-slate-300">
            Hai già un account attivo. Accedi con le tue credenziali per entrare nell&apos;app.
          </div>
        ) : (
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
        )}

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

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="text-xs text-slate-500">oppure</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        {/* Google sign-in */}
        <button
          type="button"
          onClick={handleGoogleJoin}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-800 font-semibold py-3 rounded-xl transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" />
            <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 015.49 12c0-.73.13-1.43.35-2.1V7.06H2.18a11 11 0 000 9.88l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16A11 11 0 0012 1 11 11 0 002.18 7.06L5.84 9.9c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          {mode === "register" ? "Unisciti con Google" : "Accedi con Google"}
        </button>
      </div>
    </div>
  );
}
