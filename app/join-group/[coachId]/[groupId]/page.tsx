"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";

type Step = "loading" | "form" | "joining" | "done" | "error";

export default function JoinGroupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <JoinGroupContent />
    </Suspense>
  );
}

function JoinGroupContent() {
  const { coachId, groupId } = useParams<{ coachId: string; groupId: string }>();
  const { user, role, athleteAccess, loading: authLoading } = useAuth();

  const [step, setStep] = useState<Step>("loading");
  const [mode, setMode] = useState<"register" | "login">("register");
  const [coachName, setCoachName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [sport, setSport] = useState("");
  const [memberCount, setMemberCount] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!coachId || !groupId) { setStep("error"); return; }
    fetch(`/api/join-group?coachId=${coachId}&groupId=${groupId}`)
      .then(async (res) => {
        if (!res.ok) { setStep("error"); return; }
        const data = await res.json();
        setCoachName(data.coachName ?? "");
        setGroupName(data.groupName ?? "");
        setSport(data.sport ?? "");
        setMemberCount(data.memberCount ?? 0);
        setStep("form");
      })
      .catch(() => setStep("error"));
  }, [coachId, groupId]);

  /** Shared tail: server-side join via Admin SDK, then full reload so
   *  AuthContext re-detects the (possibly brand-new) athlete role. */
  const joinAs = async (joinName: string, joinEmail: string) => {
    const idToken = await getFirebaseAuth().currentUser?.getIdToken();
    const res = await fetch("/api/join-group", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ coachId, groupId, name: joinName, email: joinEmail }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === "OTHER_COACH") {
        throw new Error("Questo account è già collegato a un altro coach: non può unirsi a questo gruppo.");
      }
      if (data.error === "IS_COACH" || data.error === "OWN_GROUP") {
        throw new Error("Questo è un account coach: non può entrare in un gruppo come atleta.");
      }
      throw new Error("Impossibile entrare nel gruppo. Riprova.");
    }
    document.cookie = "coach-auth=1; path=/; max-age=2592000";
    setStep("done");
    setTimeout(() => { window.location.href = "/athlete/group"; }, 1500);
  };

  const handleJoinError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : "Errore";
    if (msg.includes("email-already-in-use")) {
      setError("Email già registrata — usa 'Ho già un account'.");
    } else if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
      setError("Email o password errati");
    } else if (msg.includes("weak-password")) {
      setError("Password troppo debole (min. 6 caratteri)");
    } else if (msg.includes("popup-closed-by-user") || msg.includes("cancelled-popup-request")) {
      // User dismissed the Google popup — nothing to report
    } else {
      setError(msg);
    }
    setStep("form");
  };

  // Logged-in user: one-click join
  const handleJoinLoggedIn = async () => {
    if (!user) return;
    setError("");
    setStep("joining");
    try {
      await joinAs(
        athleteAccess?.name ?? user.displayName ?? user.email ?? "Atleta",
        athleteAccess?.email ?? user.email ?? ""
      );
    } catch (err) {
      handleJoinError(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStep("joining");
    try {
      if (mode === "register") {
        if (!name.trim()) { setError("Inserisci il tuo nome"); setStep("form"); return; }
        await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
        await joinAs(name.trim(), email);
      } else {
        const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
        await joinAs(cred.user.displayName ?? email, email);
      }
    } catch (err) {
      handleJoinError(err);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setStep("joining");
    try {
      const cred = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
      await joinAs(
        cred.user.displayName ?? cred.user.email ?? "Atleta",
        cred.user.email ?? ""
      );
    } catch (err) {
      handleJoinError(err);
    }
  };

  if (step === "loading" || step === "joining" || authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
        <LoadingSpinner />
        <p className="text-slate-400 text-sm">
          {step === "joining" ? "Ingresso nel gruppo…" : "Caricamento…"}
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
        <h1 className="text-xl font-bold text-white">Sei nel gruppo! 🎉</h1>
        <p className="text-slate-400 text-sm text-center">
          Benvenuto in <span className="text-primary font-semibold">{groupName}</span>.<br />
          Reindirizzamento…
        </p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 gap-4">
        <p className="text-red-400 text-center">Link non valido o gruppo non trovato.</p>
        <p className="text-slate-500 text-sm text-center">Chiedi al tuo coach un nuovo link.</p>
      </div>
    );
  }

  const isOwnGroup = role === "coach" && user?.uid === coachId;
  const isCoachAccount = role === "coach";

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">{groupName}</h1>
          <p className="text-slate-400 text-sm mt-1">
            <span className="text-primary font-semibold">{coachName}</span> ti ha invitato nel gruppo
          </p>
          <p className="text-slate-500 text-xs mt-1">
            {memberCount} {memberCount === 1 ? "atleta" : "atleti"}
            {sport ? ` · ${sport}` : ""}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Already logged in */}
        {user ? (
          isOwnGroup ? (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 text-center space-y-2">
              <p className="text-slate-300 text-sm">Questo è il tuo gruppo 😄</p>
              <a href={`/groups/${groupId}`} className="text-primary text-sm font-medium inline-block">
                Vai alla gestione del gruppo →
              </a>
            </div>
          ) : isCoachAccount ? (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 text-center">
              <p className="text-slate-300 text-sm">
                Sei connesso con un account coach: non può entrare in un gruppo come atleta.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-center">
                <p className="text-slate-400 text-xs">Connesso come</p>
                <p className="text-white text-sm font-semibold">
                  {athleteAccess?.name ?? user.displayName ?? user.email}
                </p>
              </div>
              <button
                type="button"
                onClick={handleJoinLoggedIn}
                className="w-full bg-primary text-white font-semibold py-3 rounded-xl"
              >
                Unisciti al gruppo
              </button>
            </div>
          )
        ) : (
          <>
            {/* Mode switcher */}
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

              <button type="submit"
                className="w-full bg-primary text-white font-semibold py-3 rounded-xl">
                {mode === "register" ? "Crea account ed entra nel gruppo" : "Accedi ed entra nel gruppo"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="h-px flex-1 bg-slate-700" />
              <span className="text-xs text-slate-500">oppure</span>
              <div className="h-px flex-1 bg-slate-700" />
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-800 font-semibold py-3 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" />
                <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 015.49 12c0-.73.13-1.43.35-2.1V7.06H2.18a11 11 0 000 9.88l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16A11 11 0 0012 1 11 11 0 002.18 7.06L5.84 9.9c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Entra con Google
            </button>
          </>
        )}
      </div>
    </div>
  );
}
