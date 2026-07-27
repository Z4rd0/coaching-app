"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getPrograms } from "@/lib/firestore";
import type { Cycle, Program } from "@/types";
import type { ProgramStore, ProgramFormValues, ProgramStatus } from "@/lib/programStore";
import { emptyCycle } from "@/lib/programHelpers";
import LoadingSpinner from "@/components/LoadingSpinner";
import ProgramBuilder from "@/components/ProgramBuilder";

const inputCls =
  "w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary";

/**
 * The single authoring screen for a training program, in every context.
 *
 * It used to be six pages — library/athlete/group × new/edit — that differed
 * only in which CRUD functions they called and in a couple of strings. Every
 * fix had to be repeated six times and inevitably wasn't, which is how they
 * ended up disagreeing about required fields, about what "programma corrente"
 * means, and about whether a start date could be cleared. The context now comes
 * in as a ProgramStore; this component owns the behaviour.
 */
export default function ProgramFormPage({
  mode,
  programId,
  makeStore,
  title,
  allowTemplateCopy = false,
}: {
  mode: "create" | "edit";
  /** Required in edit mode. */
  programId?: string;
  /** Built from the auth uid, so the caller doesn't need to wait for it. */
  makeStore: (coachId: string) => ProgramStore;
  title: string;
  /** Offer "copy from library" alongside "build from scratch" (create mode). */
  allowTemplateCopy?: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [contextLabel, setContextLabel] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [flow, setFlow] = useState<"pick" | "build">(allowTemplateCopy ? "pick" : "build");
  const [templates, setTemplates] = useState<Program[]>([]);

  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [startDate, setStartDate] = useState("");
  const [cycles, setCycles] = useState<Cycle[]>([emptyCycle(1)]);
  // Starts false and is turned on in the effect below for contexts that offer
  // the toggle. The library has no toggle: a new template must NOT become the
  // coach's active program just by being created.
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<ProgramStatus>("active");

  const store = user ? makeStore(user.uid) : null;

  useEffect(() => {
    if (!user) return;
    const s = makeStore(user.uid);
    (async () => {
      const [label, loaded, tpl] = await Promise.all([
        s.contextLabel(),
        mode === "edit" && programId ? s.load(programId) : Promise.resolve(null),
        allowTemplateCopy ? getPrograms(user.uid) : Promise.resolve([] as Program[]),
      ]);
      setContextLabel(label);
      setTemplates(tpl);
      if (mode === "create" && s.supportsStatus) setIsActive(true);
      if (loaded) {
        setName(loaded.name);
        setSport(loaded.sport);
        setStartDate(loaded.startDate);
        setCycles(loaded.cycles);
        setIsActive(loaded.isActive);
        setStatus(loaded.status);
      }
    })().finally(() => setLoading(false));
    // makeStore is a fresh closure each render; the identity that matters is
    // (user, programId, mode).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, programId, mode, allowTemplateCopy]);

  const values = (): ProgramFormValues => ({ name, sport, startDate, cycles, isActive, status });

  /** Activation is setActive*'s job alone: it is the only thing that also
   *  deactivates the others, so it must run whenever the toggle is on. */
  const finish = async (id: string) => {
    if (!store) return;
    if (isActive) await store.setActive(id);
    router.push(store.returnPath);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    if (!name.trim()) { setError("Inserisci il nome del programma"); return; }
    if (!startDate) { setError("Scegli la data di inizio"); return; }
    setSaving(true);
    setError("");
    try {
      const id = mode === "edit" && programId
        ? (await store.update(programId, values()), programId)
        : await store.create(values());
      await finish(id);
    } catch {
      setError("Errore nel salvataggio");
      setSaving(false);
    }
  };

  const handleCopyTemplate = async (template: Program) => {
    if (!store?.copyTemplate) return;
    if (!startDate) { setError("Scegli la data di inizio"); return; }
    setSaving(true);
    setError("");
    try {
      // The copy gets the date chosen here, never the template's — see
      // programCopyPayload.
      await finish(await store.copyTemplate(template, startDate));
    } catch {
      setError("Errore nella copia");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!store || !programId) return;
    setSaving(true);
    try {
      await store.remove(programId);
      router.push(store.returnPath);
    } catch {
      setError("Errore nell'eliminazione");
      setSaving(false);
    }
  };

  if (loading || !store) return <LoadingSpinner className="min-h-screen" />;

  const startDateField = (
    <div>
      <label className="block text-xs text-slate-400 mb-1">Data inizio (Lunedì settimana 1)</label>
      <input
        type="date"
        required
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        className={inputCls}
      />
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
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{title}</h1>
          {contextLabel && <p className="text-xs text-slate-400">{contextLabel}</p>}
        </div>
        {mode === "edit" && (
          <button type="button" onClick={() => setShowDelete(true)} className="text-red-400 p-1" aria-label="Elimina">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        )}
      </div>

      {showDelete && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-4 space-y-3">
          <p className="text-red-400 text-sm font-medium">Eliminare questo programma?</p>
          <p className="text-slate-400 text-xs">Questa azione non può essere annullata.</p>
          <div className="flex gap-2">
            <button onClick={() => setShowDelete(false)} className="flex-1 py-2 border border-slate-600 text-slate-400 rounded-xl text-sm">
              Annulla
            </button>
            <button onClick={handleDelete} disabled={saving} className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
              Elimina
            </button>
          </div>
        </div>
      )}

      {allowTemplateCopy && (
        <div className="flex bg-slate-800 rounded-xl p-1 mb-6">
          {([["pick", "Copia da libreria"], ["build", "Crea da zero"]] as const).map(([f, label]) => (
            <button
              key={f}
              type="button"
              onClick={() => setFlow(f)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                flow === f ? "bg-primary text-white" : "text-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {allowTemplateCopy && flow === "pick" ? (
        <div className="space-y-3">
          {templates.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-slate-400 text-sm mb-2">Nessun programma in libreria</p>
              <button type="button" onClick={() => setFlow("build")} className="text-primary text-sm">
                Crea da zero →
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-1">
                Scegli un template dalla tua libreria — verrà creata una copia{contextLabel ? ` ${contextLabel}` : ""}.
              </p>

              {/* The copy needs its own calendar anchor: the template's start
                  date belongs to the template. */}
              <div className="bg-slate-800 rounded-xl px-4 py-3 border border-slate-700">{startDateField}</div>

              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={saving}
                  onClick={() => handleCopyTemplate(t)}
                  className="w-full flex items-center gap-3 bg-slate-800 rounded-2xl px-4 py-3 border border-slate-700 hover:border-primary/50 transition-colors text-left disabled:opacity-60"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5M3.75 6.75h16.5M3.75 17.25h16.5" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{t.name}</p>
                    <p className="text-slate-500 text-xs">{t.cycles.length} cicli · {t.sport || "—"}</p>
                  </div>
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              ))}

              <label className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3 border border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm text-slate-300">Imposta come programma attivo</span>
              </label>
            </>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nome programma</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome programma" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Sport / disciplina</label>
              <input value={sport} onChange={(e) => setSport(e.target.value)} placeholder="Es. Powerlifting…" className={inputCls} />
            </div>
            {startDateField}
            {store.supportsStatus && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Stato</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProgramStatus)}
                  className={inputCls}
                >
                  <option value="active">Attivo</option>
                  <option value="paused">In pausa</option>
                  <option value="completed">Completato</option>
                </select>
              </div>
            )}
            {store.supportsStatus && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm text-slate-300">
                  {mode === "edit" ? "Programma corrente" : "Imposta come programma attivo"}
                </span>
              </label>
            )}
          </div>

          <ProgramBuilder cycles={cycles} onChange={setCycles} />

          {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary disabled:opacity-60 text-white font-semibold py-3 rounded-xl"
          >
            {saving ? "Salvataggio…" : mode === "edit" ? "Salva modifiche" : "Crea programma"}
          </button>
        </form>
      )}
    </div>
  );
}
