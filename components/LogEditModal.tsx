"use client";

import { useState } from "react";
import type { WorkoutLog } from "@/types";
import { MOOD_LABELS, ENERGY_LABELS } from "@/types";

/**
 * Snappy in-place editor for a workout log's metadata: date, duration,
 * perceived RPE, mood/energy, notes. Exercise-level edits are intentionally
 * out of scope — they would be a "re-log", not an edit.
 *
 * The save call is delegated upward via onSave, so the parent decides which
 * API to hit (coach vs athlete contexts both use /api/update-log).
 */
export default function LogEditModal({
  log,
  onClose,
  onSave,
}: {
  log: WorkoutLog;
  onClose: () => void;
  onSave: (patch: {
    dateISO: string;
    actualDurationMin: number;
    perceivedRPE: number;
    mood: number;
    energyLevel: number;
    notes: string;
  }) => Promise<void>;
}) {
  const initialDate = log.date.toDate().toISOString().slice(0, 10);

  const [dateISO, setDateISO] = useState(initialDate);
  const [duration, setDuration] = useState(log.actualDurationMin);
  const [rpe, setRpe] = useState(log.perceivedRPE);
  const [mood, setMood] = useState(log.mood);
  const [energy, setEnergy] = useState(log.energyLevel);
  const [notes, setNotes] = useState(log.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave({ dateISO, actualDurationMin: duration, perceivedRPE: rpe, mood, energyLevel: energy, notes });
      onClose();
    } catch {
      setError("Errore nel salvataggio. Riprova.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Modifica log</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Data</label>
            <input
              type="date"
              value={dateISO}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDateISO(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-white">Durata</label>
              <span className="text-xl font-bold text-primary">{duration} min</span>
            </div>
            <input type="range" min={5} max={180} step={5} value={duration} onChange={(e) => setDuration(+e.target.value)} className="w-full accent-primary" />
          </div>

          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-white">RPE percepito</label>
              <span className="text-xl font-bold text-primary">{rpe}/10</span>
            </div>
            <input type="range" min={1} max={10} step={1} value={rpe} onChange={(e) => setRpe(+e.target.value)} className="w-full accent-primary" />
          </div>

          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <label className="text-sm font-semibold text-white block mb-3">Umore</label>
            <div className="flex justify-between">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMood(n)}
                  className={`text-2xl p-2 rounded-xl transition-all ${mood === n ? "bg-primary/20 scale-110" : "opacity-50"}`}
                >
                  {MOOD_LABELS[n]}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <label className="text-sm font-semibold text-white block mb-3">Energia</label>
            <div className="flex justify-between">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setEnergy(n)}
                  className={`text-2xl p-2 rounded-xl transition-all ${energy === n ? "bg-primary/20 scale-110" : "opacity-50"}`}
                >
                  {ENERGY_LABELS[n]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Note</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</p>}

          <p className="text-slate-500 text-xs">
            Per modificare gli esercizi (serie, carichi, ecc.) elimina il log e ricaricane uno nuovo.
          </p>
        </div>

        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-4 py-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-600 text-slate-300 rounded-xl text-sm font-medium"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Salvo…" : "Salva modifiche"}
          </button>
        </div>
      </div>
    </div>
  );
}
