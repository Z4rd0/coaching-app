"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { updateCoachSettings } from "@/lib/firestore";
import {
  resolveThresholds, DEFAULT_THRESHOLDS, ALERT_LABELS,
  type AlertThresholds, type AlertKind,
} from "@/lib/alerts";
import LoadingSpinner from "@/components/LoadingSpinner";

const inputCls =
  "w-20 bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-primary";

/** Explains what each alert watches, so the numbers below aren't guesswork. */
const ALERT_HELP: Record<AlertKind, string> = {
  inactivity: "Segnala un atleta che non registra allenamenti da troppi giorni.",
  load: "Confronta il carico dell'ultima settimana con la media delle ultime quattro (rapporto acuto/cronico). Fuori dalla banda = crescita troppo rapida o perdita di condizione.",
  adherence: "Confronta le sessioni svolte con quelle programmate negli ultimi 7 giorni.",
  silence: "Segnala quando l'atleta non lascia note sui propri allenamenti da troppo tempo.",
};

export default function SettingsPage() {
  const { user, coach } = useAuth();
  const router = useRouter();
  const [t, setT] = useState<AlertThresholds>(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!coach) return;
    setT(resolveThresholds((coach.settings as { alerts?: unknown } | undefined)?.alerts));
    setLoading(false);
  }, [coach]);

  const num = (k: keyof AlertThresholds) => (v: string) =>
    setT((prev) => ({ ...prev, [k]: v === "" ? 0 : +v }));

  const toggle = (k: AlertKind) =>
    setT((prev) => ({ ...prev, enabled: { ...prev.enabled, [k]: !prev.enabled[k] } }));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setError("");
    try {
      await updateCoachSettings(user.uid, { alerts: t });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  const row = (kind: AlertKind, children: React.ReactNode) => (
    <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-2">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={t.enabled[kind]}
          onChange={() => toggle(kind)}
          className="w-4 h-4 accent-primary"
        />
        <span className="text-sm font-semibold text-white">{ALERT_LABELS[kind]}</span>
      </label>
      <p className="text-xs text-slate-400">{ALERT_HELP[kind]}</p>
      {t.enabled[kind] && <div className="pt-1 space-y-2">{children}</div>}
    </div>
  );

  const field = (label: string, value: number, onChange: (v: string) => void, suffix?: string) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-300">{label}</span>
      <div className="flex items-center gap-1.5">
        <input type="number" min={0} step="any" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
        {suffix && <span className="text-xs text-slate-500 w-8">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-slate-400" aria-label="Indietro">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-white">Impostazioni</h1>
      </div>

      <h2 className="text-sm font-semibold text-white mb-1">Avvisi sugli atleti</h2>
      <p className="text-xs text-slate-400 mb-4">
        Determinano chi compare in &ldquo;Da monitorare&rdquo; nella dashboard.
      </p>

      <div className="space-y-3">
        {row("inactivity", field("Giorni senza allenamenti", t.inactivityDays, num("inactivityDays"), "gg"))}
        {row("load", (
          <>
            {field("Soglia minima (calo)", t.acwrMin, num("acwrMin"))}
            {field("Soglia massima (picco)", t.acwrMax, num("acwrMax"))}
          </>
        ))}
        {row("adherence", field("Aderenza minima", t.adherenceMinPct, num("adherenceMinPct"), "%"))}
        {row("silence", field("Giorni senza note", t.silenceDays, num("silenceDays"), "gg"))}
      </div>

      {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

      <div className="flex gap-2 mt-6">
        <button
          type="button"
          onClick={() => setT(DEFAULT_THRESHOLDS)}
          className="px-4 py-3 border border-slate-600 text-slate-300 rounded-xl text-sm"
        >
          Default
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 bg-primary disabled:opacity-60 text-white font-semibold py-3 rounded-xl"
        >
          {saving ? "Salvataggio…" : saved ? "Salvato ✓" : "Salva"}
        </button>
      </div>
    </div>
  );
}
