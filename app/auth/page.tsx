"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type Mode = "login" | "register";

export default function AuthPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  // New signups here are coaches; athletes join via their coach's link
  const [regRole, setRegRole] = useState<"coach" | "athlete">("coach");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const role = await signInWithGoogle();
      document.cookie = "coach-auth=1; path=/; max-age=2592000";
      router.replace(role === "athlete" ? "/athlete/dashboard" : "/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore di autenticazione";
      // User closed the popup — not an error worth showing
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
        if (role === "athlete") {
          router.replace("/athlete/dashboard");
          return;
        }
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
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Coach App</h1>
          <p className="text-slate-400 text-sm mt-1">Il tuo diario di allenamento</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-800 rounded-xl p-1 mb-6">
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === m ? "bg-primary text-white" : "text-slate-400"
              }`}
            >
              {m === "login" ? "Accedi" : "Registrati"}
            </button>
          ))}
        </div>

        {/* Role selector — athlete accounts are created via the coach's link */}
        {mode === "register" && (
          <div className="mb-4">
            <p className="text-sm font-medium text-slate-300 mb-2">Chi sei?</p>
            <div className="grid grid-cols-2 gap-2">
              {([["coach", "🏋️ Sono un coach"], ["athlete", "🏃 Sono un atleta"]] as const).map(([r, label]) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setRegRole(r); setError(""); }}
                  className={`py-3 rounded-xl text-sm font-medium border transition-colors ${
                    regRole === r
                      ? "bg-primary/15 border-primary text-primary"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "register" && regRole === "athlete" ? (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-5 space-y-2">
            <p className="text-white text-sm font-semibold">Ti serve il link del tuo coach 🔗</p>
            <p className="text-slate-400 text-sm leading-relaxed">
              Gli account atleta si creano tramite il link d&apos;invito personale o di gruppo
              che ti manda il tuo coach. Aprilo e potrai registrarti lì, anche con Google.
            </p>
            <p className="text-slate-500 text-xs">
              Hai già un account? Usa la tab &quot;Accedi&quot; qui sopra.
            </p>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Il tuo nome"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@email.com"
              required
              autoComplete="email"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? "..." : mode === "login" ? "Accedi" : "Crea account coach"}
          </button>
        </form>
        )}

        {/* Google sign-in — hidden for athlete signups (they use the coach's link) */}
        {!(mode === "register" && regRole === "athlete") && (
          <>
            <div className="flex items-center gap-3 my-6">
              <div className="h-px flex-1 bg-slate-700" />
              <span className="text-xs text-slate-500">oppure</span>
              <div className="h-px flex-1 bg-slate-700" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-800 font-semibold py-3 rounded-xl transition-colors"
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
