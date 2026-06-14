# DESIGN BRIEF — Coaching App

> Inventario dello stato attuale dell'app. Da usare insieme a `DESIGN_RESTYLE_PROMPT.md`
> (il brief dice **cosa esiste**, il prompt dice **cosa migliorare**). Ultimo aggiornamento:
> 11 giugno 2026.

---

## 1. Panoramica

PWA mobile-first per coaching sportivo. Due ruoli netti — coach e atleta — con
interfacce e navigazioni distinte. Dark theme, colore primario verde `#1D9E75`.
Ottimizzata per iPhone (390×844) con BottomNav fissa. Si installa come app.

**Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · Firebase
(Firestore + Auth con email/password + Google) · Resend (email inviti) ·
Claude API (solo per l'import di programmi da PDF).

**Cosa NON c'è (rimosso o mai aggiunto, può tornare in futuro):** AI feedback
post-allenamento, integrazione Garmin, notifiche push, tema chiaro, layout desktop.

---

## 2. Design system attuale

### Palette

| Token | Valore | Uso |
|---|---|---|
| `primary` | `#1D9E75` | CTA, accenti, link attivi, badge "attivo" |
| `primary-300/600` | scala calcolata | Hover e varianti |
| `slate-900` | `#0f172a` | Sfondo body (unica superficie "page") |
| `slate-800` | `#1e293b` | Card, pannelli, input background |
| `slate-700` | `#334155` | Bordo card, divider |
| `slate-600` | `#475569` | Bordo input, testo disabilitato |
| `slate-500` | `#64748b` | Testo secondario, placeholder |
| `slate-400` | `#94a3b8` | Label, testo terziario |
| `slate-300` | `#cbd5e1` | Testo normale |
| `slate-100` | `#f1f5f9` | Foreground |

**Accenti semantici** (intensità: bg `/10` con bordo `/30`, testo `400`):
- `red-400/500` — danger, conferma elimina, flag/errori
- `green-400/500` — successo (timer recupero completato)
- `yellow-400` — **Circuit mode** (intero ramo UI)
- `rose-500` — **HIIT mode** (intero ramo UI, novità giugno)
- `blue-500` — tipo sessione Forza
- `orange-400` — tipo sessione Cardio
- `purple-400` — tipo sessione Mobilità

### Tipografia

System font stack nativo (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`).
Nessun font custom caricato. Pesi usati: 400/500/600/700.

| Ruolo | Classi tipiche |
|---|---|
| H1 di pagina | `text-xl font-bold text-white` |
| H2 / titolo sezione | `text-sm font-semibold text-slate-400 uppercase tracking-wider` |
| Body | `text-sm text-slate-300` |
| Label form | `text-xs text-slate-400 mb-1` |
| Caption | `text-xs text-slate-500` |
| Numero hero (RPE, durata, countdown) | `text-2xl/3xl font-bold text-white tabular-nums` |

### Spacing & forma

- **Radius**: `rounded-2xl` (16px) per card; `rounded-xl` (12px) per bottoni e input;
  `rounded-lg` (8px) per badge/chip
- **Padding card standard**: header `px-4 py-3`, corpo `p-4`
- **Gap grid**: `gap-2` (denso) o `gap-3` (default)
- **Larghezza max**: `max-w-lg mx-auto` su tutte le pagine
- **BottomNav**: altezza ~4.5rem + safe-area; tutti i contenuti hanno `pb-nav`

### Utility CSS custom (`globals.css`)

```css
.safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
.pb-nav      { padding-bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px)); }
```

### Pattern visivi ricorrenti

```html
<!-- Card standard -->
<div class="bg-slate-800 rounded-2xl border border-slate-700 p-4">...</div>

<!-- Input -->
<input class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2
              text-sm text-white placeholder-slate-500
              focus:outline-none focus:ring-1 focus:ring-primary" />

<!-- CTA primaria -->
<button class="w-full bg-primary disabled:opacity-60 text-white
               font-bold py-4 rounded-2xl text-base hover:bg-primary-600
               transition-colors">...</button>

<!-- Header sezione -->
<p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">SEZIONE</p>
```

### Badge stato atleta

| Status | Classi |
|---|---|
| `active` | `bg-primary/20 text-primary` |
| `pending` | `bg-blue-500/20 text-blue-400` |
| `invited` | `bg-yellow-500/20 text-yellow-400` |
| `archived` | `bg-slate-700 text-slate-400` |

### Slider (range input)

- Default: `accent-primary` (RPE, durata, mood/energia, round HIIT)
- Circuit: `accent-yellow-400`
- HIIT round logged: `accent-rose-500`

---

## 3. Navigazione

### Coach — BottomNav a 7 tab (problema noto: troppo denso)

`Home` · `Calendario` · `Atleti` · `Gruppi` · `Log` · `Programmi` · `Storico`

### Atleta — BottomNav a 5 tab

`Home` · `Programma` · `Log` · `Gruppo` · `Storico`

Tab attiva: icona + label in `text-primary`; le altre in `text-slate-400`.
Sfondo `bg-slate-900`, bordo top `border-slate-700`. Label da 9px (piccola).

---

## 4. Route

### Coach `(app)/` — protette dal layout (`role !== "athlete"`)

| Route | Descrizione |
|---|---|
| `/dashboard` | Home: data, sessione di oggi espandibile, stats settimana (sessioni / RPE medio), **sezione "I tuoi atleti"** con aderenza 7 giorni e pallino rosso se inattivo ≥5gg, ultimi 3 log |
| `/calendar` | Calendario mensile 7×N. Dot verde = log, dot grigio = sessione pianificata. Click su giorno → dettaglio |
| `/athletes` | Lista atleti divisa in Attivi / In attesa / Archiviati con avatar iniziale e badge stato |
| `/athletes/new` | Form 2-step: dati atleta → link di join da copiare |
| `/athletes/[id]` | Profilo atleta: modifica inline, programmi assegnati, log recenti con **commento del coach inline**, export Markdown, danger zone elimina |
| `/athletes/[id]/programs/new` | Crea/assegna programma all'atleta: copia da libreria o nuovo da zero |
| `/athletes/[id]/programs/[pid]/edit` | Modifica programma personale dell'atleta |
| `/log` | Form log coach: selettore sessione (qualsiasi programma, qualsiasi giorno), date picker, sezioni che cambiano per tipo (forza/cardio/circuit/HIIT), RPE/mood/energia slider con emoji, note. Timer recupero overlay fisso |
| `/history` | Storico coach: grafico RPE trend (Recharts, **caricato lazy**), frequenza settimanale 4w, filtro tipo, lista log clickabili |
| `/history/[id]` | Dettaglio log: stats row, esercizi planned vs actual, metriche cardio con zone HR a barra, dati circuit, **dati HIIT**, note. Azioni **modifica/elimina** nell'header |
| `/programs` | Libreria template, attiva/disattiva, + Nuovo, + Import PDF |
| `/programs/new` / `/programs/[id]/edit` | Builder programma con ProgramBuilder |
| `/programs/[id]` | Dettaglio template (include sezione HIIT con blocchi e intervalli) |
| `/programs/import` | Import programma da PDF tramite Claude |
| `/groups` | Lista gruppi: card con nome, numero atleti, sport |
| `/groups/new` | Crea gruppo: nome/sport/descrizione + multi-select atleti |
| `/groups/[id]` | Dettaglio gruppo: link d'invito condivisibile, programmi condivisi, **classifica e feed gruppo**, membri (aggiungi/rimuovi), elimina |
| `/groups/[id]/programs/new` / `/edit` | Programma condiviso del gruppo |

### Atleta `(athlete)/` — protette dal layout (`role !== "coach"`)

| Route | Descrizione |
|---|---|
| `/athlete/dashboard` | Home: data, sessione di oggi (programma personale) + card separata per ogni sessione di gruppo prevista oggi, stats settimana, ultimi 3 log |
| `/athlete/program` | Programmi assegnati read-only (personali + di gruppo con badge 👥), selettore programma se multipli, espansione settimana/sessione |
| `/athlete/log` | Form log atleta: **selettore sessione esplicito** (programma personale + programmi di gruppo + libera), nessun vincolo al giorno. Sezioni come il coach |
| `/athlete/history` | Storico log: card cliccabili, snippet commento coach |
| `/athlete/history/[id]` | Dettaglio log con stessa UI del coach + azioni modifica/elimina |
| `/athlete/group` | I gruppi a cui appartiene: classifica (medaglie 🥇🥈🥉) e feed attività, CTA log |

### Route pubbliche

| Route | Descrizione |
|---|---|
| `/auth` | Login + signup (email/password) + bottone "Continua con Google". **In registrazione c'è il selettore "Sono un coach / Sono un atleta"** — agli atleti dice di usare il link del coach |
| `/invite/accept` | Accettazione invito email (token, flusso legacy) |
| `/join/[coachId]/[athleteId]` | Link diretto coach→atleta: registrazione/login con Google |
| `/join-group/[coachId]/[groupId]` | **Link d'invito gruppo**: utente loggato → un click; nuovo → registrazione email o Google. Gestione casi edge (coach esistente, atleta di altro coach) |

### API server-side (Admin SDK + verifica Firebase ID token)

| Endpoint | Metodo | Auth | Cosa fa |
|---|---|---|---|
| `/api/invite/send` | POST | coach uid==coachId | Crea atleta pending e invia email |
| `/api/invite/accept` | POST | qualsiasi auth | Collega atleta a UID + crea athleteAccess |
| `/api/invite/info` | GET | pubblica | Info invito per pagina accept |
| `/api/join` | GET | pubblica | Info join per link diretto atleta |
| `/api/join-group` | GET / POST | pubblica / token | Info gruppo, ingresso server-side con cascata |
| `/api/import-program` | POST | qualsiasi auth | Import PDF via Claude |
| `/api/group-feed` | POST | token atleta | Scrive entry feed e incrementa stats classifica |
| `/api/delete-athlete` | POST | coach token | Cascade: log, programmi, athleteAccess, membership gruppi |
| `/api/delete-group` | POST | coach token | Cascade: feed, programmi del gruppo |
| `/api/delete-log` | POST | coach o atleta token | Elimina log + cascade feed e classifica |
| `/api/update-log` | POST | coach o atleta token | Aggiorna metadata log + cascade feed (delta minuti) |

---

## 5. Componenti UI

### `BottomNav` (coach) / `AthleteBottomNav` (atleta)
Nav fissa bottom. Vedi §3.

### `ProgramBuilder` — `components/ProgramBuilder.tsx`
Builder a cicli → settimane → sessioni. Ogni sessione: header collassato (dot
colorato del tipo, giorno, titolo, riassunto) + form espanso con dropdown
tipo, data specifica opzionale, RPE/durata, esercizi via `ExerciseForm`, note.
Sezioni specifiche per **Circuit** (round + recupero) e **HIIT** (formato +
blocchi di intervalli ripetuti).

### `ExerciseForm` — `components/ExerciseForm.tsx`
Form compatto esercizio: nome, serie, reps, carico, preset di recupero
(30s/60s/90s/2m/3m/5m). Sezione espandibile per varianti e note tecniche.

### `HiitTimer` — `components/HiitTimer.tsx`
Timer guidato fullscreen per HIIT. Sequenza: warmup → blocchi → intervalli con
label, durata, isRest. Mostra round corrente, intervallo successivo, countdown.
Segnali audio (oscillatore Web Audio) + vibrazione. Bottoni pausa, skip, exit.

### `LogEditModal` — `components/LogEditModal.tsx`
Modale bottom-sheet su mobile (centrata su desktop) per modificare un log:
data, durata, RPE, mood, energia, note. Esercizi non editabili (un edit lì è un re-log).

### `LogDetailBody` — `components/LogDetailBody.tsx`
Componente condiviso di rendering dettaglio log: stats row, commento coach
(se presente), esercizi planned vs actual, pannelli cardio/circuit/HIIT con
zone HR a barra, note. Usato da `/history/[id]` (coach) e `/athlete/history/[id]`.

### `GroupActivity` — `components/GroupActivity.tsx`
Doppia sezione "Classifica" + "Attività recente" del gruppo. La classifica è
all-time (mai resettata), calcolata da `group.stats` (contatori aggregati,
fallback al feed per gruppi vecchi). Medaglie 🥇🥈🥉, riga utente loggato evidenziata.

### `RPEChart` — `components/RPEChart.tsx`
Wrapper Recharts LineChart per il trend RPE in `/history`. **Caricato lazy** via
`next/dynamic` (recharts pesa ~100kB).

### `LoadingSpinner`
Spinner full-screen. Usato ovunque durante fetch iniziali (candidato a essere
sostituito da skeleton — vedi prompt restyle).

### `AuthContext` / `useAuth` — `contexts/AuthContext.tsx`
- Espone: `user`, `coach`, `athleteAccess`, `role`, `loading`, `signIn`, `signUp`,
  `signInWithGoogle`, `signOut`
- Logica ruolo: cerca `/coaches/{uid}` → se esiste, coach; altrimenti
  `/athleteAccess/{uid}` → atleta. Self-heal disabilitato su `/join*` e `/invite*`
  per evitare di "promuovere" un atleta a coach durante la registrazione.

### Pattern inline ricorrenti

- **Timer recupero overlay** (`/log` e `/athlete/log`): floating `bottom-20`,
  `z-50`. Due stati: countdown (`bg-slate-800`, bordo primary) e completato
  (`bg-green-600/20`, vibrazione). Scompare dopo 3s.
- **StatCard inline** (dashboard): card con numero grande `text-2xl font-bold` e
  label sotto `text-xs text-slate-400`.
- **Field wrapper** (form): label + input con label `text-xs text-slate-400 mb-1`.
- **Empty state card**: cerchio icona grigia + 1-2 righe slate-400 + link primary.
- **Card cliccabile in lista**: `flex items-center gap-3 bg-slate-800 rounded-2xl
  px-4 py-3 border border-slate-700 hover:border-slate-600 transition-colors`.

---

## 6. Tipi TypeScript principali

```ts
type Role = "coach" | "athlete" | null;

interface Coach { id; name; email; createdAt; settings; }

interface Athlete {
  id; name; email; sport; goals; notes;
  athleteUid?: string;   // UID Firebase Auth, set dopo accettazione invito
  status: "pending" | "invited" | "active" | "archived";
  createdAt: Timestamp;
}

interface AthleteAccess { coachId; athleteId; name; email; }

// Programma
type SessionType = "strength" | "cardio" | "mobility" | "rest" | "other"
                 | "circuit" | "hiit";

interface Session {
  dayOfWeek: number;          // 0=Lun … 6=Dom (giorno suggerito, non vincolante per il log)
  scheduledDate?: string;     // ISO YYYY-MM-DD: pin a una data specifica
  type: SessionType;
  title; targetRPE; durationMin; notes;
  exercises: Exercise[];
  // Circuit
  targetRounds?: number;
  restBetweenRoundsSeconds?: number;
  // HIIT
  hiitFormat?: "interval" | "tabata" | "emom" | "amrap" | "for_time";
  hiitBlocks?: HiitBlock[];   // rounds × intervals (label, durationSec, isRest)
  hiitTotalSeconds?: number;  // cap totale (per amrap/for_time)
}

interface Program { id; name; sport; cycles: Cycle[]; isActive?; startDate?; }
interface AthleteProgram extends Program {
  status: "active" | "completed" | "paused";
  sourceTemplateId?: string;
}
type GroupProgram = AthleteProgram;

// Gruppo
interface Group {
  id; name; sport; description;
  memberIds: string[];   // athlete profile ids
  memberUids: string[];  // auth UIDs (usati dalle security rules)
  stats?: Record<string, { name; sessions: number; minutes: number }>;
  createdAt: Timestamp;
}

interface GroupFeedEntry {
  id; athleteId; athleteUid; athleteName; logId;
  date: Timestamp;
  sessionTitle?: string;
  sessionType?: SessionType;
  actualDurationMin: number;
  perceivedRPE: number;
  createdAt: Timestamp;
}

// Log
interface WorkoutLog {
  id; date: Timestamp;
  programId?: string;
  groupId?: string;           // se la sessione viene da un programma di gruppo
  plannedSession?: Session;
  actualDurationMin; perceivedRPE; mood; energyLevel; notes;
  exerciseLogs?: ExerciseLog[];
  cardioLog?: CardioLog;      // FC media/max, distanza, pace, calorie, zone Z1-Z5
  circuitLog?: CircuitLog;    // round completati, FC, zone
  hiitLog?: HiitLog;          // round, tempo totale, FC, calorie
  coachComment?: string;      // feedback scritto dal coach
  writtenBy?: "coach" | "athlete";
  createdAt: Timestamp;
}
```

### Etichette UI

```ts
SESSION_TYPE_LABELS = {
  strength: "Forza", cardio: "Cardio", mobility: "Mobilità",
  rest: "Riposo", other: "Altro", circuit: "Circuit", hiit: "HIIT"
};
MOOD_LABELS   = { 1: "😩", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };
ENERGY_LABELS = { 1: "🪫", 2: "😴", 3: "⚡", 4: "🔋", 5: "🚀" };
```

---

## 7. Struttura Firestore

```
/coaches/{coachId}
  /athletes/{athleteId}
    /programs/{programId}      ← copia personalizzata
    /logs/{logId}              ← writtenBy: coach|athlete; può avere coachComment
  /programs/{programId}        ← libreria template
  /invites/{inviteId}
  /groups/{groupId}            ← memberIds, memberUids, stats per classifica
    /programs/{programId}      ← programma CONDIVISO (un solo doc)
    /feed/{logId}              ← entry id = logId (idempotente)

/athleteAccess/{athleteUid}    ← lookup globale per security rules
```

**Security rules chiave**:
- Coach: pieno controllo del proprio sottoalbero `/coaches/{uid}`
- Atleta: legge/scrive solo il proprio profilo e i propri log, legge programmi
- `athleteAccess`: leggibile solo da se stesso e dal coach proprietario
- Gruppo: membri leggono doc + programmi + feed; scritture al feed sono
  server-side only (anti-cheating per la classifica)
- Cancellazioni: a cascata, sempre server-side (mai dal client)

---

## 8. Tipi di sessione — comportamento di logging

| Tipo | Cosa logga il form |
|---|---|
| `strength` | Esercizio per esercizio: serie/reps/carico previsti vs effettivi, RPE per esercizio, note, timer recupero |
| `cardio` | FC media/max, distanza, passo medio, calorie, minuti per zona Z1-Z5 |
| `circuit` | Round completati (con target), reps/carico per esercizio, recupero tra round con timer, metriche cardio + zone |
| `hiit` | Round completati, tempo totale, FC media/max, calorie. **Timer guidato fullscreen** (HiitTimer) opzionale prima del log |
| `mobility` / `other` | Stesso form di Forza |
| `rest` | Non comparirà nel selettore log (escluso) |

Tutti i log hanno comunque: durata effettiva, RPE percepito, umore, energia, note.

---

## 9. Screen reference (descrizione visiva sintetica)

### `/dashboard` (coach)

```
mar 10 giugno              [⎋]
Ciao, Marco 👋
──────────────────────────────
SESSIONE DI OGGI
[Forza] Squat + Upper      ›
⏱75min · 💪5 esercizi   RPE 7
[Registra allenamento      ]
──────────────────────────────
QUESTA SETTIMANA
[  3 allenamenti ] [ 7.2 RPE ]
──────────────────────────────
I TUOI ATLETI         Tutti →
[M] Mario     3 ses · oggi
[L] Luca      0 ses · 7gg fa ●  ← pallino rosso (inattivo)
[G] Giulia    2 ses · ieri
──────────────────────────────
ULTIMI LOG            Tutti →
😄 Lower A   8 giu · 75min · 7
[Home][Cal][Atleti][Gruppi][Log][Prog][Stor]
```

### `/groups/[id]` (coach)

```
←  Forza Primavera 2026          🗑
   8 atleti · Powerlifting

LINK D'INVITO
Chi apre il link entra…
[ 📋 Copia link d'invito ]

PROGRAMMI       + Nuovo
● 12w Forza Base    Attivo  ›

🏆 CLASSIFICA
🥇 Marco       12 sessioni · 720 min
🥈 Luca         9 sessioni · 540 min
🥉 Giulia       7 sessioni · 420 min

ATTIVITÀ RECENTE
[M] Marco · Squat + Upper
    8 giu · 75min · RPE 7   ●

MEMBRI                 + Aggiungi
[M] Marco              ›  ×
[L] Luca               ›  ×
```

### `/log` (form, modalità HIIT)

```
Log allenamento
──────────────────────────────
Allenamento  [ Settimana 2 · Gio · HIIT Tabata ▼]
HIIT · 16 esercizi · 25 min · RPE target 9

Data: [10/06/2026]
──────────────────────────────
[ ▶ Avvia Timer HIIT (rosa)  ]

Round completati  (target: 16)
                        14
━━━━━━━━━━━━━━━━━━━━━━━━━━━ (slider rosa)

METRICHE
FC media [152]  FC max [185]
Calorie  [320]
──────────────────────────────
Durata effettiva     22 min
RPE percepito        9/10
Umore 😩 😕 😐 [🙂] 😄
Energia 🪫 😴 ⚡ [🔋] 🚀
Note: ___________________
[Salva allenamento]
```

### `/history/[id]` (dettaglio log)

```
←  giovedì 8 maggio 2026          ✎  🗑
   Squat + Upper · Forza
──────────────────────────────
[75m][7/10][🙂][🔋]
──────────────────────────────
💬 DAL TUO COACH (se atleta lo vede)
Ottima sessione! Tieni d'occhio…
──────────────────────────────
ESERCIZI
┌──────────────────────────┐
│ Back Squat        RPE 8 │
│ Pianif. 5×5@80%         │
│ Effett. 5×5@82.5kg      │  ← bold se diverso
└──────────────────────────┘
…
NOTE
Mi sentivo bene oggi…
```

### `/athlete/group` (atleta)

```
👥 Forza Primavera 2026
8 atleti · Powerlifting
──────────────────────────────
🏆 CLASSIFICA
🥇 Marco      12 sessioni · 720 min
   Tu        ← evidenziato
🥈 Luca        9 sessioni · 540 min
🥉 Giulia      7 sessioni · 420 min

ATTIVITÀ RECENTE
[M] Marco · Squat + Upper
    8 giu · 75min · RPE 7  ●

[Logga un allenamento 💪]
[Home][Programma][Log][Gruppo][Storico]
```

---

## 10. Dipendenze UI

```json
{
  "next": "14",
  "react": "18",
  "tailwindcss": "3",
  "date-fns": "formattazione date in italiano",
  "recharts": "LineChart RPE (lazy-loaded)",
  "firebase": "Firestore + Auth (email + Google)",
  "firebase-admin": "server-side",
  "@anthropic-ai/sdk": "import PDF",
  "resend": "email inviti"
}
```
