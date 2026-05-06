"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="it">
      <body style={{ margin: 0, background: "#0f172a", color: "#94a3b8", fontFamily: "system-ui, sans-serif",
                     display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                     minHeight: "100dvh", gap: "12px", textAlign: "center", padding: "24px", boxSizing: "border-box" }}>
        <div style={{ fontSize: "2.5rem" }}>⚠️</div>
        <h1 style={{ color: "#f1f5f9", fontSize: "1.1rem", margin: 0 }}>Qualcosa è andato storto</h1>

        {/* Show the actual error so we can debug */}
        <pre style={{ background: "#1e293b", color: "#f87171", fontSize: "0.7rem", padding: "12px",
                      borderRadius: "8px", maxWidth: "100%", overflowX: "auto", textAlign: "left",
                      whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0 }}>
          {error?.message || String(error)}
          {error?.digest ? `\nDigest: ${error.digest}` : ""}
        </pre>

        <button
          onClick={reset}
          style={{ marginTop: "8px", padding: "12px 28px", background: "#1D9E75", color: "#fff",
                   border: "none", borderRadius: "12px", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer" }}
        >
          Riprova
        </button>
        <button
          onClick={() => { window.location.href = "/dashboard"; }}
          style={{ padding: "8px 20px", background: "transparent", color: "#94a3b8",
                   border: "1px solid #334155", borderRadius: "10px", fontSize: "0.85rem", cursor: "pointer" }}
        >
          Torna alla home
        </button>
      </body>
    </html>
  );
}
