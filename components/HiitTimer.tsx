"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HiitBlock } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimerPhase {
  label: string;
  durationSeconds: number;
  isRest: boolean;
  roundDisplay: string;
  nextLabel?: string;
  nextDuration?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPhases(blocks: HiitBlock[]): TimerPhase[] {
  const phases: TimerPhase[] = [];
  blocks.forEach((block, bi) => {
    const prefix = blocks.length > 1 ? `B${bi + 1} · ` : "";
    for (let r = 0; r < block.rounds; r++) {
      block.intervals.forEach((iv, ii) => {
        const nextIv = block.intervals[ii + 1];
        let nextLabel: string | undefined;
        let nextDuration: number | undefined;
        if (nextIv) {
          nextLabel = nextIv.label;
          nextDuration = nextIv.durationSeconds;
        } else if (r < block.rounds - 1) {
          nextLabel = block.intervals[0]?.label + ` (Round ${r + 2})`;
          nextDuration = block.intervals[0]?.durationSeconds;
        } else if (bi < blocks.length - 1) {
          nextLabel = blocks[bi + 1].intervals[0]?.label;
          nextDuration = blocks[bi + 1].intervals[0]?.durationSeconds;
        }
        phases.push({
          label: iv.label || (iv.isRest ? "Recupero" : "Lavoro"),
          durationSeconds: iv.durationSeconds,
          isRest: iv.isRest,
          roundDisplay: `${prefix}Round ${r + 1}/${block.rounds}`,
          nextLabel,
          nextDuration,
        });
      });
    }
  });
  return phases;
}

function fmt(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }, []);

  const beep = useCallback((freq: number, duration: number, vol = 0.35) => {
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }, [getCtx]);

  const beepWork  = useCallback(() => beep(880, 0.18), [beep]);
  const beepRest  = useCallback(() => beep(440, 0.22), [beep]);
  const beepTick  = useCallback(() => beep(660, 0.08, 0.2), [beep]);
  const beepDone  = useCallback(() => {
    [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 0.4), i * 120));
  }, [beep]);

  return { beepWork, beepRest, beepTick, beepDone };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  blocks: HiitBlock[];
  onClose: (roundsCompleted: number, totalSeconds: number) => void;
}

export default function HiitTimer({ blocks, onClose }: Props) {
  const phases = useMemo(() => buildPhases(blocks), [blocks]);
  const { beepWork, beepRest, beepTick, beepDone } = useAudio();

  const [phaseIdx, setPhaseIdx] = useState(0);
  const [remaining, setRemaining] = useState(phases[0]?.durationSeconds ?? 0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);
  const elapsedRef = useRef(0);

  const totalRounds = useMemo(() =>
    blocks.reduce((s, b) => s + b.rounds, 0), [blocks]);

  const currentPhase = phases[phaseIdx];

  // Tick
  useEffect(() => {
    if (!running || done) return;
    const id = setInterval(() => {
      elapsedRef.current += 1;
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [running, done]);

  // Countdown beeps
  useEffect(() => {
    if (running && !done && remaining > 0 && remaining <= 3) beepTick();
  }, [remaining, running, done, beepTick]);

  // Phase advance when remaining reaches 0
  useEffect(() => {
    if (!running || done || remaining > 0) return;
    const next = phaseIdx + 1;
    if (next >= phases.length) {
      setRunning(false);
      setDone(true);
      beepDone();
      try { navigator.vibrate?.([200, 100, 200, 100, 200]); } catch {}
      return;
    }
    const nextPhase = phases[next];
    setPhaseIdx(next);
    setRemaining(nextPhase.durationSeconds);
    if (nextPhase.isRest) beepRest();
    else beepWork();
    try { navigator.vibrate?.(150); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, running, done]);

  const handleStart = () => {
    if (!startedRef.current) {
      startedRef.current = true;
      if (currentPhase?.isRest) beepRest();
      else beepWork();
    }
    setRunning(true);
  };

  const handleSkip = () => {
    setRemaining(0);
  };

  const progress = phases.length > 0 ? phaseIdx / phases.length : 0;
  const phaseProgress = currentPhase
    ? (currentPhase.durationSeconds - remaining) / currentPhase.durationSeconds
    : 0;

  // ── Done screen ──────────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center gap-6 px-6">
        <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
          <svg className="w-12 h-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">Workout completato!</h2>
          <p className="text-slate-400 mt-2">
            {totalRounds} round · {fmt(elapsedRef.current)} totali
          </p>
        </div>
        <button
          onClick={() => onClose(totalRounds, elapsedRef.current)}
          className="w-full max-w-xs bg-primary text-white font-bold py-4 rounded-2xl text-base"
        >
          Salva e chiudi
        </button>
      </div>
    );
  }

  // ── Timer screen ─────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-safe-or-12 pb-3" style={{ paddingTop: "max(env(safe-area-inset-top), 3rem)" }}>
        <span className="text-sm font-medium text-slate-400">{currentPhase?.roundDisplay}</span>
        <button
          onClick={() => onClose(0, elapsedRef.current)}
          className="text-slate-500 hover:text-white p-1.5 rounded-lg"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Overall progress bar */}
      <div className="mx-6 h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-slate-600 rounded-full transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">

        {/* Phase badge */}
        <div className={`px-5 py-2 rounded-full text-sm font-bold uppercase tracking-widest transition-colors ${
          currentPhase?.isRest
            ? "bg-slate-700 text-slate-300"
            : "bg-primary/20 text-primary"
        }`}>
          {currentPhase?.isRest ? "Recupero" : "Lavoro"}
        </div>

        {/* Exercise name */}
        <h2 className="text-3xl font-bold text-white text-center leading-tight">
          {currentPhase?.label}
        </h2>

        {/* Countdown */}
        <div className={`text-[88px] font-bold tabular-nums leading-none transition-colors ${
          remaining <= 3 && running
            ? "text-red-400"
            : currentPhase?.isRest
              ? "text-slate-300"
              : "text-primary"
        }`}>
          {fmt(remaining)}
        </div>

        {/* Phase progress ring (subtle) */}
        <div className="w-full max-w-xs h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-none ${currentPhase?.isRest ? "bg-slate-500" : "bg-primary"}`}
            style={{ width: `${phaseProgress * 100}%` }}
          />
        </div>

        {/* Next up */}
        {currentPhase?.nextLabel && (
          <p className="text-slate-500 text-sm text-center">
            Prossimo:{" "}
            <span className="text-slate-300">{currentPhase.nextLabel}</span>
            {currentPhase.nextDuration != null && (
              <span className="text-slate-500"> · {currentPhase.nextDuration}s</span>
            )}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="px-6 pb-safe-or-8 flex gap-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 2rem)" }}>
        <button
          type="button"
          onClick={handleSkip}
          className="flex-1 py-4 rounded-2xl border border-slate-700 text-slate-400 font-medium text-sm"
        >
          Skip
        </button>
        {running ? (
          <button
            type="button"
            onClick={() => setRunning(false)}
            className="flex-[2] py-4 rounded-2xl bg-slate-700 text-white font-bold text-lg"
          >
            Pausa
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            className="flex-[2] py-4 rounded-2xl bg-primary text-white font-bold text-lg"
          >
            {startedRef.current ? "Riprendi" : "Start"}
          </button>
        )}
      </div>
    </div>
  );
}
