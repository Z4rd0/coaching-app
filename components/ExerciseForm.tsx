"use client";

import { useState } from "react";
import type { Exercise } from "@/types";

interface Props {
  exercise: Exercise;
  index: number;
  canRemove: boolean;
  onChange: (ex: Exercise) => void;
  onRemove: () => void;
}

const inputCls = "w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary";
const labelCls = "text-[10px] text-slate-500 block mb-0.5 uppercase tracking-wide font-medium";

const REST_PRESETS = [
  { label: "30s", value: 30 },
  { label: "60s", value: 60 },
  { label: "90s", value: 90 },
  { label: "2m", value: 120 },
  { label: "3m", value: 180 },
  { label: "5m", value: 300 },
];

export default function ExerciseForm({ exercise, index, canRemove, onChange, onRemove }: Props) {
  const [expanded, setExpanded] = useState(false);

  const hasExtras = !!(exercise.variants || exercise.notes);

  return (
    <div className="rounded-xl border border-slate-600 bg-slate-800/50 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="text-xs text-slate-400 font-medium shrink-0">#{index + 1}</span>
        <input
          value={exercise.name}
          onChange={(e) => onChange({ ...exercise, name: e.target.value })}
          placeholder="Nome esercizio"
          className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-red-400 text-xs px-2 py-1.5 rounded-lg hover:bg-red-400/10 shrink-0"
          >
            ✕
          </button>
        )}
      </div>

      <div className="px-3 pb-3 space-y-2">
        {/* Sets / Reps / Load */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelCls}>Serie</label>
            <input
              type="number" min={1}
              value={exercise.sets}
              onChange={(e) => onChange({ ...exercise, sets: +e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Reps</label>
            <input
              value={exercise.reps}
              onChange={(e) => onChange({ ...exercise, reps: e.target.value })}
              placeholder="8-10"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Carico</label>
            <input
              value={exercise.load}
              onChange={(e) => onChange({ ...exercise, load: e.target.value })}
              placeholder="70% / 80kg"
              className={inputCls}
            />
          </div>
        </div>

        {/* Rest time */}
        <div>
          <label className={labelCls}>Recupero</label>
          <div className="flex gap-1.5 flex-wrap">
            {REST_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() =>
                  onChange({ ...exercise, restSeconds: exercise.restSeconds === p.value ? undefined : p.value })
                }
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  exercise.restSeconds === p.value
                    ? "bg-primary border-primary text-white"
                    : "border-slate-600 text-slate-400 hover:border-slate-400"
                }`}
              >
                {p.label}
              </button>
            ))}
            <input
              type="number"
              min={0}
              value={exercise.restSeconds ?? ""}
              onChange={(e) =>
                onChange({ ...exercise, restSeconds: e.target.value ? +e.target.value : undefined })
              }
              placeholder="sec"
              className="w-16 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Toggle extra fields */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors mt-1"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {expanded ? "Nascondi dettagli" : `Varianti & note${hasExtras ? " ✎" : ""}`}
        </button>

        {/* Expanded: variants + notes */}
        {expanded && (
          <div className="space-y-2 pt-1 border-t border-slate-700">
            <div>
              <label className={labelCls}>Varianti / sostituzioni</label>
              <textarea
                rows={2}
                value={exercise.variants ?? ""}
                onChange={(e) => onChange({ ...exercise, variants: e.target.value || undefined })}
                placeholder="Es. Se non hai bilanciere usa manubri · versione più facile / difficile…"
                className={`${inputCls} resize-none`}
              />
            </div>
            <div>
              <label className={labelCls}>Note tecniche</label>
              <textarea
                rows={3}
                value={exercise.notes}
                onChange={(e) => onChange({ ...exercise, notes: e.target.value })}
                placeholder="Indicazioni tecniche, focus, avvertenze, progressione…"
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
