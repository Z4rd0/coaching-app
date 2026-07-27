"use client";

import type { LoadSummary, LoadStatus } from "@/lib/load";
import { ACWR_MIN, ACWR_MAX } from "@/lib/load";

const STATUS_META: Record<LoadStatus, { label: string; color: string; hint: string }> = {
  unknown: {
    label: "Dati insufficienti",
    color: "#94A3B8",
    hint: "Servono circa 4 settimane di allenamenti per calcolare il rapporto acuto/cronico.",
  },
  detraining: {
    label: "In calo",
    color: "#60A5FA",
    hint: "Il carico recente è sotto la media del mese: condizione in calo (o scarico voluto).",
  },
  optimal: {
    label: "Ottimale",
    color: "#22C55E",
    hint: "Il carico recente è in linea con la media del mese.",
  },
  overreaching: {
    label: "In salita",
    color: "#F59E0B",
    hint: "Il carico recente è sopra la media del mese: aumento rapido, occhio al recupero.",
  },
};

/**
 * Training load from session-RPE (Foster): `RPE × minuti`.
 *
 * Shown as a card rather than a bare number because the ACWR only means
 * something with its band: 1.4 is not "good" or "bad" until you know the safe
 * window and that it compares this week against the last four.
 */
export default function LoadCard({ load }: { load: LoadSummary }) {
  const meta = STATUS_META[load.status];
  // Position of the ratio on a 0–2 scale, clamped, for the marker.
  const pos = load.acwr === null ? null : Math.max(0, Math.min(100, (load.acwr / 2) * 100));

  return (
    <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-white">Carico</h2>
        <span className="text-[11px] font-medium" style={{ color: meta.color }}>
          {meta.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-white tabular-nums">{load.weekLoad || "—"}</p>
          <p className="text-[10px] text-slate-400">settimana</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums" style={{ color: meta.color }}>
            {load.acwr ?? "—"}
          </p>
          <p className="text-[10px] text-slate-400">acuto/cronico</p>
        </div>
        <div>
          <p className="text-lg font-bold text-white tabular-nums">{load.monotony ?? "—"}</p>
          <p className="text-[10px] text-slate-400">monotonia</p>
        </div>
      </div>

      {pos !== null && (
        <div className="relative h-2 rounded-full overflow-hidden bg-slate-700">
          {/* Safe band, drawn on the same 0–2 scale as the marker. */}
          <div
            className="absolute inset-y-0 bg-green-500/30"
            style={{ left: `${(ACWR_MIN / 2) * 100}%`, right: `${100 - (ACWR_MAX / 2) * 100}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-1 h-3 rounded-full"
            style={{ left: `calc(${pos}% - 2px)`, background: meta.color }}
          />
        </div>
      )}

      <p className="text-[11px] text-slate-400">{meta.hint}</p>
    </div>
  );
}
