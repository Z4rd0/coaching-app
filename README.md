# Coaching App

PWA per un personal trainer che segue uno o più atleti: il coach scrive programmi
(forza, cardio a ripetute, circuit, HIIT, ibridi), li assegna a singoli atleti o a gruppi,
l'atleta registra le sedute e il coach le rivede, con carico, alert e record calcolati.

Stack: Next.js 14 (App Router) · React 18 · Firebase Auth + Firestore · Tailwind ·
recharts · Resend (inviti email) · Anthropic SDK (import AI dei programmi) · Vitest.

Server MCP collegato (creare e assegnare programmi parlando con Claude): repo `coaching-mcp`.

## Avvio

```bash
npm install
cp .env.local.example .env.local   # poi compila i valori
npm run dev
```

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo |
| `npm run build` | build di produzione |
| `npm test` | test Vitest sulle funzioni pure (`lib/`) |
| `npx tsc --noEmit` | type-check |
| `npm run lint` | ESLint |

La CI (`.github/workflows/ci.yml`) esegue type-check, lint, test e build a ogni push e PR.

## Variabili d'ambiente

Vedi `.env.local.example`. Servono almeno le `NEXT_PUBLIC_FIREBASE_*` e le credenziali
Firebase Admin per le route `app/api/*`. Le integrazioni sono opzionali e spente finché le
variabili sono vuote: Strava (`STRAVA_*`), Tredict (`TREDICT_*`), email (`RESEND_*`),
import AI (`ANTHROPIC_API_KEY`, modello opzionale con `IMPORT_MODEL`).

## Struttura

- `app/(app)/` area coach · `app/(athlete)/athlete/` area atleta · `app/api/` route server
- `lib/` logica pura e testata (carico, alert, record, scheduling, segmenti) e accesso Firestore
- `firestore.rules` regole di sicurezza: i token OAuth stanno in collection chiuse a client
- `scripts/` migrazioni e backfill una tantum

## Documenti di progetto (nella root del monorepo)

`ROADMAP.md` (cosa fare e in che ordine) · `AUDIT.md` · `ANALISI_CONFLITTI.md` ·
`MIGRATION_SEGMENTS.md` · `BENCHMARK_COACHPEAKING.md` · `TREDICT_INTEGRAZIONE.md`
