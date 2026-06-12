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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <LoadingSpinner />
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

  const joinAs = async (joinName: string, joinEmail: string) => {
    const idToken = await getFirebaseAuth().currentUser?.getIdToken();
    const res = await fetch("/api/join-group", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ coachId, groupId, name: joinName, email: joinEmail }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === "OTHER_COACH") throw new Error("Questo account è già collegato a un altro coach.");
      if (data.error === "IS_COACH" || data.error === "OWN_GROUP") throw new Error("Questo è un account coach: non può entrare nel gruppo come atleta.");
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
      // dismissed
    } else {
      setError(msg);
    }
    setStep("form");
  };

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
      await joinAs(cred.user.displayName ?? cred.user.email ?? "Atleta", cred.user.email ?? "");
    } catch (err) {
      handleJoinError(err);
    }
  };

  const baseStyle: React.CSSProperties = { background: "var(--bg-base)", minHeight: "100dvh" };

  if (step === "loading" || step === "joining" || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={baseStyle}>
        <LoadingSpinner />
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          {step === "joining" ? "Ingresso nel gruppo…" : "Caricamento…"}
        </p>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="flex flex-col items-center justify-center px-4 gap-4" style={baseStyle}>
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "var(--green-subtle)" }}
        >
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="var(--green-primary)" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-[22px] font-bold" style={{ color: "var(--text-primary)" }}>
          Sei nel gruppo! 🎉
        </h1>
        <p className="text-[13px] text-center" style={{ color: "var(--text-muted)" }}>
          Benvenuto in <span className="font-semibold" style={{ color: "var(--green-primary)" }}>{groupName}</span>.<br />
          Reindirizzamento…
        </p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex flex-col items-center justify-center px-4 gap-3" style={baseStyle}>
        <p className="text-[14px] text-center" style={{ color: "#EF4444" }}>
          Link non valido o gruppo non trovato.
        </p>
        <p className="text-[12px] text-center" style={{ color: "var(--text-faint)" }}>
          Chiedi al tuo coach un nuovo link.
        </p>
      </div>
    );
  }

  const isOwnGroup = role === "coach" && user?.uid === coachId;
  const isCoachAccount = role === "coach";

  return (
    <div className="flex flex-col items-center justify-center px-7 py-10" style={baseStyle}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 mb-4"
            style={{
              borderRadius: 18,
              background: "linear-gradient(135deg, rgba(29,158,117,0.20) 0%, rgba(29,158,117,0.08) 100%)",
              border: "1px solid var(--green-border)",
            }}
          >
            <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="var(--green-primary)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>

          {/* Invite card */}
          <div
            className="rounded-[20px] px-5 py-4 mb-4"
            style={{ background: "var(--green-subtle)", border: "1px solid var(--green-border)" }}
          >
            <h1 className="text-[22px] font-extrabold" style={{ color: "var(--text-primary)" }}>
              {groupName}
            </h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
              <span className="font-semibold" style={{ color: "var(--green-primary)" }}>{coachName}</span> ti ha invitato
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-faint)" }}>
              {memberCount} {memberCount === 1 ? "atleta" : "atleti"}
              {sport ? ` · ${sport}` : ""}
            </p>
          </div>
        </div>

        {error && (
          <div
            className="rounded-xl px-4 py-3 text-[13px] mb-4"
            style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)", color: "#EF4444" }}
          >
            {error}
          </div>
        )}

        {/* Already logged in */}
        {user ? (
          isOwnGroup ? (
            <div
              className="rounded-xl px-4 py-4 text-center space-y-2"
              style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-default)" }}
            >
              <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>Questo è il tuo gruppo 😄</p>
              <a href={`/groups/${groupId}`} className="text-[13px] font-semibold" style={{ color: "var(--green-primary)" }}>
                Vai alla gestione del gruppo →
              </a>
            </div>
          ) : isCoachAccount ? (
            <div
              className="rounded-xl px-4 py-4 text-center"
              style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-default)" }}
            >
              <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                Sei connesso con un account coach: non può entrare in un gruppo come atleta.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className="rounded-xl px-4 py-3 text-center"
                style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-default)" }}
              >
                <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>Connesso come</p>
                <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {athleteAccess?.name ?? user.displayName ?? user.email}
                </p>
              </div>
              <button type="button" onClick={handleJoinLoggedIn} className="btn-primary">
                Unisciti al gruppo
              </button>
            </div>
          )
        ) : (
          <>
            {/* Mode toggle */}
            <div className="flex p-1 mb-5 rounded-xl" style={{ background: "var(--bg-surface-1)" }}>
              {(["register", "login"] as const).map((m) => (
                <button key={m} type="button"
                  onClick={() => { setMode(m); setError(""); }}
                  className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition-all"
                  style={mode === m
                    ? { background: "var(--green-primary)", color: "#fff" }
                    : { background: "transparent", color: "var(--text-muted)" }
                  }
                >
                  {m === "register" ? "Crea account" : "Ho già un account"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "register" && (
                <div>
                  <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Nome</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Il tuo nome" required className="input-base" />
                </div>
              )}
              <div>
                <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@esempio.com" required autoComplete="email" className="input-base" />
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required minLength={6}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  className="input-base" />
              </div>
              <button type="submit" className="btn-primary mt-1">
                {mode === "register" ? "Crea account ed entra nel gruppo" : "Accedi ed entra nel gruppo"}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1" style={{ background: "var(--border-default)" }} />
              <span className="text-[12px]" style={{ color: "var(--text-faintest)" }}>oppure</span>
              <div className="h-px flex-1" style={{ background: "var(--border-default)" }} />
            </div>

            <button type="button" onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-[14px] text-[15px] font-semibold transition-opacity active:opacity-80"
              style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}
            >
              <GoogleIcon />
              Entra con Google
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 015.49 12c0-.73.13-1.43.35-2.1V7.06H2.18a11 11 0 000 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16A11 11 0 0012 1 11 11 0 002.18 7.06L5.84 9.9c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}
