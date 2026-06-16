"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";

const SPECIALIZATIONS = ["Forza", "Endurance", "Crossfit / Funzionale", "Multisport", "Altro"];

export default function OnboardingPage() {
  const { user, role, loading, completeCoachOnboarding, signOut } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Route users who shouldn't be here.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth");
    } else if (role === "coach") {
      router.replace("/");
    } else if (role === "athlete") {
      router.replace("/athlete/dashboard");
    }
  }, [user, role, loading, router]);

  // Prefill the name from the auth profile once available.
  useEffect(() => {
    if (user && !name) {
      setName(user.displayName ?? user.email?.split("@")[0] ?? "");
    }
  }, [user, name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Inserisci il tuo nome");
      return;
    }
    setSubmitting(true);
    try {
      await completeCoachOnboarding(name, specialization || undefined);
      document.cookie = "coach-auth=1; path=/; max-age=2592000";
      router.replace("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Errore durante la creazione del profilo");
      setSubmitting(false);
    }
  };

  // While auth resolves, or a redirect for an existing role is in flight.
  if (loading || !user || role === "coach" || role === "athlete") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-7"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="w-full max-w-sm">
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
            Crea il tuo profilo coach
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
            Ancora un passaggio e sei pronto a gestire i tuoi atleti
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
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

          <div>
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Specializzazione <span style={{ color: "var(--text-faint)" }}>(opzionale)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {SPECIALIZATIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpecialization((cur) => (cur === s ? "" : s))}
                  className="px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
                  style={
                    specialization === s
                      ? { background: "var(--green-subtle)", border: "1px solid var(--green-border)", color: "var(--green-primary)" }
                      : { background: "var(--bg-surface-2)", border: "1px solid var(--border-default)", color: "var(--text-muted)" }
                  }
                >
                  {s}
                </button>
              ))}
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

          <button type="submit" disabled={submitting} className="btn-primary mt-1 disabled:opacity-60">
            {submitting ? "..." : "Inizia"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => signOut().then(() => router.replace("/auth"))}
          className="w-full mt-4 text-[12px]"
          style={{ color: "var(--text-faint)" }}
        >
          Esci
        </button>
      </div>
    </div>
  );
}
