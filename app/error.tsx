"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6 gap-4 text-center">
      <div className="text-4xl">⚠️</div>
      <h1 className="text-white text-lg font-semibold">Qualcosa è andato storto</h1>

      <pre className="bg-slate-800 text-red-400 text-xs p-3 rounded-xl max-w-full overflow-x-auto text-left whitespace-pre-wrap break-all">
        {error?.message || String(error)}
        {error?.digest ? `\nDigest: ${error.digest}` : ""}
      </pre>

      <button
        onClick={reset}
        className="px-6 py-3 bg-primary text-white font-semibold rounded-xl"
      >
        Riprova
      </button>
      <button
        onClick={() => { window.location.href = "/dashboard"; }}
        className="px-5 py-2 text-slate-400 border border-slate-700 rounded-xl text-sm"
      >
        Torna alla home
      </button>
    </div>
  );
}
