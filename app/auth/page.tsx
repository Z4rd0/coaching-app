"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type Mode = "login" | "signup";

export default function AuthPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [regRole, setRegRole] = useState<"coach" | "athlete">("coach");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const role = await signInWithGoogle();
      document.cookie = "coach-auth=1; path=/; max-age=2592000";
      router.replace(
        role === "athlete" ? "/athlete/dashboard" : role === "coach" ? "/" : "/onboarding"
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore di autenticazione";
      if (!msg.includes("popup-closed-by-user") && !msg.includes("cancelled-popup-request")) {
        setError("Accesso con Google non riuscito. Riprova.");
      }
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        const role = await signIn(email, password);
        document.cookie = "coach-auth=1; path=/; max-age=2592000";
        if (role === "athlete") { router.replace("/athlete/dashboard"); return; }
      } else {
        if (!name.trim()) { setError("Inserisci il tuo nome"); setLoading(false); return; }
        await signUp(name.trim(), email, password);
      }
      document.cookie = "coach-auth=1; path=/; max-age=2592000";
      router.replace("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore di autenticazione";
      if (msg.includes("user-not-found") || msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        setError("Email o password errati");
      } else if (msg.includes("email-already-in-use")) {
        setError("Email già registrata");
      } else if (msg.includes("weak-password")) {
        setError("Password troppo debole (min. 6 caratteri)");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-7"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 mb-4"
            style={{
              borderRadius: 20,
              background: "linear-gradient(135deg, rgba(29,158,117,0.20) 0%, rgba(29,158,117,0.08) 100%)",
              border: "1px solid var(--green-border)",
            }}
          >
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="var(--green-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-[24px] font-extrabold" style={{ color: "var(--text-primary)" }}>
            Coaching App
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
            Il tuo diario di allenamento
          </p>
        </div>

        {/* Toggle */}
        <div
          className="flex p-1 mb-6 rounded-xl"
          style={{ background: "var(--bg-surface-1)" }}
        >
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              className="flex-1 py-2.5 rounded-lg text-[14px] font-semibold transition-all duration-200"
              style={
                mode === m
                  ? { background: "var(--green-primary)", color: "#fff" }
                  : { background: "transparent", color: "var(--text-muted)" }
              }
            >
              {m === "login" ? "Accedi" : "Registrati"}
            </button>
          ))}
        </div>

        {/* Role selector (signup only) */}
        {mode === "signup" && (
          <div className="mb-5">
            <p className="text-[13px] font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Chi sei?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([["coach", "🏋️", "Sono un coach"], ["athlete", "💪", "Sono un atleta"]] as const).map(([r, emoji, label]) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setRegRole(r); setError(""); }}
                  className="py-3.5 rounded-xl text-[13px] font-semibold transition-all"
                  style={
                    regRole === r
                      ? { background: "var(--green-subtle)", border: "1px solid var(--green-border)", color: "var(--green-primary)" }
                      : { background: "var(--bg-surface-2)", border: "1px solid var(--border-default)", color: "var(--text-muted)" }
                  }
                >
                  {emoji} {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Athlete info banner */}
        {mode === "signup" && regRole === "athlete" ? (
          <div
            className="rounded-xl px-4 py-4 space-y-2"
            style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.15)" }}
          >
            <div className="flex items-start gap-2">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#60A5FA" strokeWidth={2} className="mt-0.5 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[13px] font-semibold" style={{ color: "#60A5FA" }}>
                Ti serve il link del tuo coach
              </p>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Gli account atleta si creano tramite il link d&apos;invito personale o di gruppo
              che ti manda il tuo coach. Aprilo per registrarti, anche con Google.
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              Hai già un account? Usa la tab &quot;Accedi&quot; qui sopra.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Nome
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Il tuo nome"
                  required
                  className="input-base"
                />
              </div>
            )}

            <div>
              <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="coach@email.com"
                required
                autoComplete="email"
                className="input-base"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={6}
                  className="input-base pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-faint)" }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="rounded-xl px-4 py-3 text-[13px]"
                style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)", color: "#EF4444" }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary mt-1 disabled:opacity-60"
            >
              {loading ? "..." : mode === "login" ? "Accedi" : "Crea account coach"}
            </button>
          </form>
        )}

        {/* Google sign-in */}
        {!(mode === "signup" && regRole === "athlete") && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1" style={{ background: "var(--border-default)" }} />
              <span className="text-[12px]" style={{ color: "var(--text-faintest)" }}>oppure</span>
              <div className="h-px flex-1" style={{ background: "var(--border-default)" }} />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-[14px] text-[15px] font-semibold transition-opacity disabled:opacity-60 active:scale-[0.98]"
              style={{
                background: "var(--bg-surface-2)",
                border: "1px solid var(--border-hover)",
                color: "var(--text-primary)",
              }}
            >
              <GoogleIcon />
              {googleLoading ? "Accesso in corso…" : "Continua con Google"}
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
