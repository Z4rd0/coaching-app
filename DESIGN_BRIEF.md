# DESIGN BRIEF — Coaching App
> Documento generato il 10 maggio 2026 per uso in Claude Design e tool di prototipazione.

---

## 1. Panoramica del prodotto

> **Changelog giugno 2026** (gli sketch più sotto possono non riflettere ancora questi punti):
> - **Rimossi** l'analisi AI post-allenamento (niente badge "AI", card analisi, pagina feedback; bottone log = "Salva allenamento") e ogni riferimento a Garmin (stat card dashboard, dati nel dettaglio log).
> - **Aggiunto** login con Google su `/auth` e `/join/...` (bottone bianco "Continua con Google" sotto divider "oppure").
> - **Aggiunti** gruppi di allenamento con programmi condivisi, feed attività e classifica all-time (`GroupActivity`): vedi route `/groups*` e `/athlete/group`.
> - I log sono **indipendenti dal giorno**: il form atleta ha un selettore della sessione (personale o di gruppo), non più la deduzione dalla data.
> - **Link d'invito al gruppo**: dal dettaglio gruppo il coach copia un link `/join-group/{coachId}/{groupId}`; la landing pubblica gestisce utente loggato (un click), registrazione email e Google.
> - **Hardening (10 giu)**: API autenticate con ID token; classifica da contatori aggregati sul doc gruppo; eliminazioni a cascata server-side; `/auth` ha selettore "Sono un coach / Sono un atleta" in registrazione.
> - **Dashboard coach**: nuova sezione "I tuoi atleti" (aderenza: sessioni ultimi 7gg + giorni dall'ultimo log, pallino rosso se inattivo ≥5gg).
> - **Commenti coach**: il coach commenta i log da /athletes/[id]; l'atleta vede "💬 Dal tuo coach" nello storico.

PWA mobile-first per la gestione di coach e atleti. Due ruoli separati con interfacce distinte, dark theme, colore primario verde `#1D9E75`. Ottimizzata per uso su smartphone (iOS/Android) con BottomNav fissa.

**Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · Firebase (Auth con email+Google, Firestore) · Resend (email inviti) · Claude AI (solo import programmi da PDF)

---

## 2. Design System

### Colori

| Token | Valore | Uso |
|-------|--------|-----|
| `primary` / `primary-500` | `#1D9E75` | CTA, accenti, link attivi |
| `primary-50` | `#e6f7f2` | Background badge attivo leggero |
| `primary-100` | `#b3e8d5` | Hover states |
| `primary-200` | `#80d9b8` | — |
| `primary-300` | `#4dcb9b` | Testo badge su sfondo scuro |
| `primary-600` | `#178060` | Hover bottoni CTA |
| `primary-700` | `#11604a` | — |
| `slate-900` | `#0f172a` | Sfondo principale (background body) |
| `slate-850` | `#1a2234` | Sfondo custom intermedio |
| `slate-800` | `#1e293b` | Card, pannelli, input background |
| `slate-700` | `#334155` | Bordi card, dividers |
| `slate-600` | `#475569` | Bordi input, text disabilitato |
| `slate-500` | `#64748b` | Testo secondario, placeholder |
| `slate-400` | `#94a3b8` | Label, testo terziario |
| `slate-300` | `#cbd5e1` | Testo normale su sfondo scuro |
| `slate-200` | `#e2e8f0` | Testo calendario |
| `slate-100` | `#f1f5f9` | Foreground |
| `red-400` / `red-500` | — | Errori, danger zone |
| `green-400` / `green-600` | — | Successo, recupero completato |
| `yellow-400` | — | Circuit mode accent |
| `blue-500` | — | Tipo sessione Forza |
| `orange-400` | — | Tipo sessione Cardio |
| `purple-400` | — | Tipo sessione Mobilità |

### Variabili CSS

```css
:root {
  --background: #0f172a;
  --foreground: #f1f5f9;
}
```

### Tipografia

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  /* Tailwind: bg-slate-900 text-slate-100 antialiased */
}
```
Nessun font custom caricato — usa il system font stack nativo.

### Spacing & Shape

- **Border radius** dominante: `rounded-2xl` (16px) su card e pannelli; `rounded-xl` (12px) su bottoni e input; `rounded-lg` (8px) su chip/badge
- **Padding card standard**: `px-4 py-3` (header) / `p-4` (corpo)
- **Gap grid**: `gap-2` o `gap-3`
- **BottomNav height**: `~4.5rem` + `safe-area-inset-bottom`

### Utility classi custom (globals.css)

```css
.safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
.pb-nav      { padding-bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px)); }
```

### Pattern card standard

```html
<div class="bg-slate-800 rounded-2xl border border-slate-700 px-4 py-3">
  <!-- contenuto -->
</div>
```

### Colori tipo sessione

| Tipo | Dot color | Label |
|------|-----------|-------|
| `strength` | `bg-blue-500` | Forza |
| `cardio` | `bg-orange-400` | Cardio |
| `mobility` | `bg-purple-400` | Mobilità |
| `circuit` | `bg-yellow-400` | Circuit |
| `rest` | `bg-slate-500` | Riposo |
| `other` | `bg-slate-400` | Altro |

### Colori stato atleta

| Status | Classes |
|--------|---------|
| `active` | `bg-primary/20 text-primary` |
| `pending` | `bg-blue-500/20 text-blue-400` |
| `invited` | `bg-yellow-500/20 text-yellow-400` |
| `archived` | `bg-slate-700 text-slate-400` |

---

## 3. Struttura route / pagine

### Route group `(app)` — area Coach (layout protetto: solo `role !== "athlete"`)

| Route | File | Descrizione |
|-------|------|-------------|
| `/dashboard` | `app/(app)/dashboard/page.tsx` | Home coach: data odierna, sessione di oggi espandibile, stats settimana (allenamenti / RPE), ultimi 3 log |
| `/calendar` | `app/(app)/calendar/page.tsx` | Calendario mensile con griglia 7×N. Dot verde = log registrato, dot grigio = sessione pianificata. Click su giorno → dettaglio sessioni/log |
| `/athletes` | `app/(app)/athletes/page.tsx` | Lista atleti divisa in Attivi / In attesa / Archiviati. Avatar iniziale, badge stato, sport |
| `/athletes/new` | `app/(app)/athletes/new/page.tsx` | Form 2-step: (1) dati atleta → (2) mostra link di join da copiare |
| `/athletes/[id]` | `app/(app)/athletes/[id]/page.tsx` | Profilo atleta: edit inline, link recupero (pending), programmi assegnati, 5 log recenti con export (copia singolo / scarica tutti .md) |
| `/athletes/[id]/programs/new` | `app/(app)/athletes/[id]/programs/new/page.tsx` | Crea/assegna programma all'atleta: copia da libreria o nuovo da zero |
| `/athletes/[id]/programs/[pid]/edit` | `app/(app)/athletes/[id]/programs/[pid]/edit/page.tsx` | Modifica programma personale dell'atleta |
| `/log` | `app/(app)/log/page.tsx` | Form log allenamento coach: date picker, esercizi (Forza con timer recupero), metriche cardio, circuit mode, RPE slider, umore/energia emoji, note. Timer overlay fisso sopra BottomNav. Dopo il salvataggio → `/history/[id]` |
| `/history` | `app/(app)/history/page.tsx` | Storico con grafico RPE trend (Recharts LineChart), frequenza settimanale (4 settimane), filtro per tipo, lista log |
| `/history/[id]` | `app/(app)/history/[id]/page.tsx` | Dettaglio singolo log: stats row (durata/RPE/umore/energia), esercizi planned vs actual, metriche cardio con zone HR a barra, dati circuit |
| `/programs` | `app/(app)/programs/page.tsx` | Libreria template programmi coach: card con nome/sport/cicli, attiva/disattiva, + Nuovo, + Import PDF |
| `/programs/new` | `app/(app)/programs/new/page.tsx` | Crea nuovo programma template (usa ProgramBuilder) |
| `/programs/[id]` | `app/(app)/programs/[id]/page.tsx` | Dettaglio programma template |
| `/programs/[id]/edit` | `app/(app)/programs/[id]/edit/page.tsx` | Modifica programma template |
| `/programs/import` | `app/(app)/programs/import/page.tsx` | Import programma da PDF tramite AI |
| `/groups` | `app/(app)/groups/page.tsx` | Lista gruppi di allenamento: card con nome, n° atleti, sport |
| `/groups/new` | `app/(app)/groups/new/page.tsx` | Crea gruppo: nome/sport/descrizione + multi-select atleti con checkbox |
| `/groups/[id]` | `app/(app)/groups/[id]/page.tsx` | Dettaglio gruppo: programmi condivisi, membri (aggiungi/rimuovi), elimina gruppo |
| `/groups/[id]/programs/new` | `app/(app)/groups/[id]/programs/new/page.tsx` | Assegna programma condiviso al gruppo (copia da libreria o da zero) |
| `/groups/[id]/programs/[pid]/edit` | `app/(app)/groups/[id]/programs/[pid]/edit/page.tsx` | Modifica programma condiviso (visibile live a tutti i membri) |

### Route group `(athlete)` — area Atleta (layout protetto: solo `role !== "coach"`)

| Route | File | Descrizione |
|-------|------|-------------|
| `/athlete/dashboard` | `app/(athlete)/athlete/dashboard/page.tsx` | Home atleta: data, sessione oggi con CTA "Logga" (+ card separate "Oggi · 👥 {gruppo}" per le sessioni dei gruppi), stats settimana (sessioni / RPE), ultimi 3 log |
| `/athlete/program` | `app/(athlete)/athlete/program/page.tsx` | Visualizzazione read-only dei programmi: personali + condivisi dai gruppi (badge "👥 Gruppo X — programma condiviso") |
| `/athlete/log` | `app/(athlete)/athlete/log/page.tsx` | Form log atleta (identico al coach): date picker, esercizi con timer recupero, circuit mode, metriche, slider, emoji. Timer overlay |
| `/athlete/history` | `app/(athlete)/athlete/history/page.tsx` | Storico log atleta: lista con data, RPE, durata, badge "Tu/Coach", snippet AI feedback |

### Route pubbliche

| Route | Descrizione |
|-------|-------------|
| `/auth` | Login + signup (email/password) + bottone "Continua con Google" |
| `/invite/accept` | Accettazione invito email (token-based, legacy) |
| `/join/[coachId]/[athleteId]` | Nuovo flusso di accesso atleta via link diretto |

### API routes (server-side)

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/invite/send` | POST | Invia email di invito via Resend |
| `/api/invite/accept` | POST | Accetta invito: attiva atleta, crea `athleteAccess` |
| `/api/invite/info` | GET | Info invito per pagina accept |
| `/api/import-program` | POST | Import programma da PDF con AI |
| `/api/join` | POST | Flusso join link diretto (alternativo a invite) |

---

## 4. Componenti UI

### `BottomNav` — `/components/BottomNav.tsx`

**Props:** nessuna  
**Stato interno:** `pathname` via `usePathname()`  
**Descrizione:** Nav fissa bottom per coach. 7 tab: Home (`/dashboard`), Calendario (`/calendar`), Atleti (`/athletes`), Gruppi (`/groups`), Log (`/log`), Programmi (`/programs`), Storico (`/history`). Tab attivo = icona + label in `text-primary`. Sfondo `bg-slate-900`, bordo top `border-slate-700`, rispetta `safe-bottom`. ⚠️ 7 tab su 390px sono strette — candidata a ripensamento nel restyling.

---

### `AthleteBottomNav` — `/components/AthleteBottomNav.tsx`

**Props:** nessuna  
**Stato interno:** `pathname` via `usePathname()`  
**Descrizione:** Nav fissa bottom per atleta. 4 tab: Home (`/athlete/dashboard`), Programma (`/athlete/program`), Log (`/athlete/log`), Storico (`/athlete/history`).

---

### `ProgramBuilder` — `/components/ProgramBuilder.tsx`

**Props:**
```ts
interface Props {
  cycles: Cycle[];
  onChange: (cycles: Cycle[]) => void;
}
```
**Stato interno:** `openKey: string | null` (quale sessione è espansa), `copySource: {ci,wi,si} | null` (sorgente copia)

**Descrizione:** Builder drag-free per struttura a cicli/settimane/sessioni. Ogni sessione ha un header collassato (tipo dot colorato, giorno, titolo, riassunto esercizi) e form espanso con:
- Dropdown giorno + tipo sessione
- Data specifica opzionale (override del giorno)
- Titolo, Target RPE, Durata
- Campi circuit: Round target + Recupero tra round (visibili solo se tipo = `circuit`)
- Lista esercizi via `ExerciseForm`
- Note sessione
- Azioni: Duplica nella stessa settimana · Copia in altra settimana (picker inline) · Elimina

---

### `ExerciseForm` — `/components/ExerciseForm.tsx`

**Props:**
```ts
interface Props {
  exercise: Exercise;
  index: number;
  canRemove: boolean;
  onChange: (ex: Exercise) => void;
  onRemove: () => void;
}
```
**Stato interno:** `expanded: boolean` (varianti & note)

**Descrizione:** Form compatto per esercizio. Campi principali: Nome, Serie, Reps, Carico. Preset recupero: 30s / 60s / 90s / 2m / 3m / 5m (toggle colored) + input manuale. Sezione espandibile: Varianti/sostituzioni + Note tecniche.

---

### `LoadingSpinner` — `/components/LoadingSpinner.tsx`

**Props:** `className?: string`  
**Descrizione:** Spinner full-screen (o con classe custom). Usato ovunque durante fetch iniziali.

---

### `AuthContext` / `useAuth` — `/contexts/AuthContext.tsx`

**Context value:**
```ts
interface AuthContextValue {
  user: User | null;          // Firebase Auth user
  coach: Coach | null;        // Dati coach da Firestore
  athleteAccess: AthleteAccess | null; // Dati accesso atleta
  role: "coach" | "athlete" | null;
  loading: boolean;
  signIn: (email, password) => Promise<UserRole>;
  signUp: (name, email, password) => Promise<void>;
  signOut: () => Promise<void>;
}
```
**Logica ruolo:** al login cerca prima `/coaches/{uid}` → se esiste, role = "coach"; altrimenti cerca `/athleteAccess/{uid}` → role = "athlete". Self-heal: se nessuno dei due esiste, crea il documento coach.

---

### Componente inline: `StatCard` (in Dashboard)

```ts
function StatCard({ label, value }: { label: string; value: string })
```
Card centrata con valore grande (`text-2xl font-bold text-white`) e label sotto (`text-xs text-slate-400`).

---

### Componente inline: `Field` (in form pages)

```ts
function Field({ label, children }: { label: string; children: React.ReactNode })
```
Wrapper label + children per input form. Label: `text-xs text-slate-400 mb-1`.

---

### Timer overlay (inline in `/log` pages)

Overlay fisso `bottom-20` (sopra BottomNav), `z-50`. Due stati:
- **In countdown:** sfondo `bg-slate-800 border-primary/40`. Mostra label (es. nome esercizio), countdown `MM:SS` in `text-3xl font-bold`, progress bar che si svuota, bottone "Salta"
- **Completato (remaining=0):** sfondo `bg-green-600/20 border-green-500/40`. Messaggio "✓ Recupero completato!". Scompare dopo 3s. Vibrazione su mobile (`navigator.vibrate([200,100,200])`)

---

## 5. Tipi TypeScript

```ts
// ─── Coach ────────────────────────────────────────────────────────────────────
interface Coach {
  id: string;
  name: string;
  email: string;
  createdAt: Timestamp;
  settings: Record<string, unknown>;
}

// ─── Athlete ──────────────────────────────────────────────────────────────────
interface Athlete {
  id: string;
  name: string;
  email: string;
  sport: string;
  goals: string;
  notes: string;
  athleteUid?: string;         // set dopo accettazione invito
  status: "pending" | "invited" | "active" | "archived";
  garminConnected: boolean;
  createdAt: Timestamp;
}

interface AthleteAccess {     // /athleteAccess/{athleteUid} — per security rules
  coachId: string;
  athleteId: string;
  name: string;
  email: string;
}

// ─── Invite ───────────────────────────────────────────────────────────────────
interface Invite {
  id: string;
  athleteId: string;
  email: string;
  coachId: string;
  coachName: string;
  status: "pending" | "accepted" | "expired";
  createdAt: Timestamp;
  expiresAt: Timestamp;       // 7 giorni
}

// ─── Program ──────────────────────────────────────────────────────────────────
interface Exercise {
  name: string;
  sets: number;
  reps: string;               // es. "8-10" o "AMRAP"
  load: string;               // es. "70% 1RM" o "bodyweight"
  restSeconds?: number;
  variants?: string;
  notes: string;
}

interface Session {
  dayOfWeek: number;          // 0=Lun … 6=Dom
  scheduledDate?: string;     // ISO "YYYY-MM-DD" — override dayOfWeek
  type: "strength" | "cardio" | "mobility" | "rest" | "other" | "circuit";
  title: string;
  exercises: Exercise[];
  targetRPE: number;          // 1-10
  durationMin: number;
  notes: string;
  targetRounds?: number;          // solo circuit
  restBetweenRoundsSeconds?: number; // solo circuit
}

interface Week {
  weekNumber: number;
  sessions: Session[];
}

interface Cycle {
  cycleNumber: number;
  weeks: Week[];
}

interface Program {           // libreria template coach
  id: string;
  name: string;
  sport: string;
  cycles: Cycle[];
  createdAt: Timestamp;
  isActive?: boolean;
  startDate?: string;         // ISO "YYYY-MM-DD" — lunedì settimana 1
}

interface AthleteProgram {    // copia personalizzata per atleta
  id: string;
  name: string;
  sport: string;
  cycles: Cycle[];
  createdAt: Timestamp;
  isActive?: boolean;
  startDate?: string;
  sourceTemplateId?: string;  // ID del template sorgente
  status: "active" | "completed" | "paused";
}

// ─── Workout Log ──────────────────────────────────────────────────────────────
interface GarminData {
  activityType: string;
  distanceMeters?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  avgPace?: string;
}

interface ExerciseLog {
  name: string;
  plannedSets?: number;
  plannedReps?: string;
  plannedLoad?: string;
  actualSets?: number;
  actualReps?: string;
  actualLoad?: string;
  rpe?: number;
  notes?: string;
}

interface CardioLog {
  avgHeartRate?: number;
  maxHeartRate?: number;
  distanceMeters?: number;
  avgPaceMinPerKm?: string;
  calories?: number;
  hrZoneMinutes?: { z1?: number; z2?: number; z3?: number; z4?: number; z5?: number };
}

interface CircuitLog {
  roundsCompleted: number;
  restBetweenRoundsSeconds?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  hrZoneMinutes?: { z1?: number; z2?: number; z3?: number; z4?: number; z5?: number };
}

interface AIAnalysis {
  summary: string;
  positives: string[];
  suggestions: string[];
  flags: string[];
  nextSessionTip: string;
}

interface WorkoutLog {
  id: string;
  date: Timestamp;
  programId?: string;
  sessionRef?: { cycleNumber: number; weekNumber: number; dayOfWeek: number };
  plannedSession?: Session;
  actualDurationMin: number;
  perceivedRPE: number;
  mood: number;               // 1-5
  energyLevel: number;        // 1-5
  notes: string;
  exerciseLogs?: ExerciseLog[];
  cardioLog?: CardioLog;
  circuitLog?: CircuitLog;
  garminActivityId?: string;
  garminData?: GarminData;
  aiAnalysis?: AIAnalysis;
  writtenBy?: "coach" | "athlete";
  createdAt: Timestamp;
}
```

### Enum labels

```ts
const SESSION_TYPE_LABELS = {
  strength: "Forza", cardio: "Cardio", mobility: "Mobilità",
  rest: "Riposo", other: "Altro", circuit: "Circuit"
}

const MOOD_LABELS    = { 1: "😩", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" }
const ENERGY_LABELS  = { 1: "🪫", 2: "😴", 3: "⚡", 4: "🔋", 5: "🚀" }
```

---

## 6. Struttura dati Firestore

```
/coaches/{coachId}
  name, email, createdAt, settings

  /athletes/{athleteId}
    name, email, sport, goals, notes, athleteUid?, status, garminConnected, createdAt

    /programs/{programId}
      name, sport, cycles[], isActive?, startDate?, status, sourceTemplateId?

    /logs/{logId}
      date, programId?, plannedSession?, actualDurationMin, perceivedRPE,
      mood, energyLevel, notes, exerciseLogs[]?, cardioLog?, circuitLog?,
      garminData?, aiAnalysis?, writtenBy, createdAt

  /programs/{programId}          ← libreria template
    name, sport, cycles[], isActive?, startDate?

  /invites/{inviteId}
    athleteId, email, coachId, coachName, status, createdAt, expiresAt

  /groups/{groupId}              ← gruppi di allenamento (giugno 2026)
    name, sport, description, memberIds[], memberUids[], createdAt

    /programs/{programId}        ← programma CONDIVISO (un solo doc per tutto il gruppo)
      name, sport, cycles[], isActive?, startDate?, status, sourceTemplateId?

    /feed/{entryId}              ← fase 2 "gara": log condivisi tra membri (regole pronte, UI da fare)

/athleteAccess/{athleteUid}      ← lookup globale per security rules
  coachId, athleteId, name, email
```

### Principali query Firestore

```ts
// Atleti coach
query(athletesRef(coachId), orderBy("createdAt", "desc"))

// Log (paginati)
query(logsRef(coachId, athleteId), orderBy("date", "desc"), limit(N))

// Programma attivo
query(programsRef(coachId), where("isActive", "==", true), limit(1))

// Programma attivo atleta
query(athleteProgramsRef(coachId, athleteId), where("isActive", "==", true), limit(1))
```

---

## 7. Descrizione visiva delle schermate

### AREA COACH

---

#### `/dashboard` — Home Coach
```
┌─────────────────────────────────┐
│ mar 10 maggio          [⎋ exit] │
│ Ciao, Marco 👋                   │
├─────────────────────────────────┤
│ SESSIONE DI OGGI                │
│ ┌─────────────────────────────┐ │
│ │ [Forza]  Squat + Upper  ›  │ │
│ │ ⏱ 75 min  💪 5 esercizi    │ │
│ │ ▼ (espandibile: lista ex.) │ │
│ │ [Registra allenamento    ] │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ QUESTA SETTIMANA                │
│ ┌──────┐ ┌──────┐ ┌──────┐    │
│ │  3   │ │ 7.2  │ │  ⌚  │    │
│ │ All. │ │ RPE  │ │Garmin│    │
│ └──────┘ └──────┘ └──────┘    │
├─────────────────────────────────┤
│ ULTIMI LOG                  tutti│
│ ┌─────────────────────────────┐ │
│ │ 😄  Squat + Upper          │ │
│ │     8 mag · 75min · RPE 7  │ │
│ │                        [AI]│ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
[Home] [Cal.] [Atleti] [Log] [Prog] [Stor.]
```

---

#### `/calendar` — Calendario
```
┌─────────────────────────────────┐
│ Calendario              [+ Log] │
│                                 │
│  maggio 2026       ‹         ›  │
│  L  M  M  G  V  S  D           │
│        1  2  3  4  5            │
│  6  7  8  9 10 11 12            │
│     ●        ◉  ○              │
│ 13 14 15 16 17 18 19            │
│ ●  = log registrato (verde)     │
│ ○  = sessione pianificata (grey)│
├─────────────────────────────────┤
│ Sabato 10 maggio                │
│                                 │
│ ALLENAMENTI REGISTRATI          │
│ │  Squat + Upper        AI ✨  │
│ │  75 min · RPE 7              │
│                                 │
│ SESSIONE PROGRAMMATA            │
│ │  Forza · Squat + Upper       │
│ │  Ciclo 1 · Settimana 2 [Log] │
└─────────────────────────────────┘
```

---

#### `/athletes` — Lista Atleti
```
┌─────────────────────────────────┐
│ Atleti                 [Invita] │
├─────────────────────────────────┤
│ ATTIVI                          │
│ ┌─────────────────────────────┐ │
│ │ [M] Mario Rossi        Attivo│ │
│ │     Powerlifting         ›  │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ [G] Giulia Bianchi    Attivo│ │
│ │     Running              ›  │ │
│ └─────────────────────────────┘ │
│ IN ATTESA                       │
│ ┌─────────────────────────────┐ │
│ │ [L] Luca Verdi       Invitato│ │
│ │     luca@email.com       ›  │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

---

#### `/athletes/[id]` — Profilo Atleta
```
┌─────────────────────────────────┐
│ ‹  Mario Rossi            [✎]  │
│    mario@email.com              │
│ [Attivo]  Powerlifting          │
├─────────────────────────────────┤
│ Obiettivi: Aumentare 1RM squat  │
│ Note private: Problemi schiena  │
├─────────────────────────────────┤
│ PROGRAMMI              [+ Nuovo]│
│ ● Programma Forza 12w           │
│   2 cicli · attivo · ›          │
├─────────────────────────────────┤
│ LOG RECENTI      [↓ Esporta tutti]│
│ Mar 8 mag  RPE7  75min Atleta [⧉]│
│ Dom 5 mag  RPE6  60min Coach  [⧉]│
├─────────────────────────────────┤
│ [Elimina atleta]                │
└─────────────────────────────────┘
```
> Bottone `[⧉]` copia il log negli appunti (formato Markdown per Claude).  
> `[↓ Esporta tutti]` scarica file `.md` con tutti i log.

---

#### `/log` — Form Log Allenamento (Forza)
```
┌─────────────────────────────────┐
│ Log allenamento                 │
│ 📅 Squat + Upper · Forza        │
├─────────────────────────────────┤
│ Data allenamento                │
│ [10/05/2026               ▼]   │
├─────────────────────────────────┤
│ ESERCIZI                        │
│ ┌─────────────────────────────┐ │
│ │ Back Squat    prev. 5×5@80% │ │
│ │ Serie  Reps      Carico     │ │
│ │ [5]   [4,4,4,4,5] [82.5kg] │ │
│ │ RPE esercizio          8 ── │ │
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │
│ │ Note: _____________________  │ │
│ │ [⏱ Avvia recupero · 3m    ] │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ Durata effettiva        75 min  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━        │
│ RPE percepito globale   7/10    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━        │
│ Umore  😩 😕 😐 [🙂] 😄        │
│ Energia 🪫 😴 ⚡ [🔋] 🚀       │
│ Note generali: _______________  │
├─────────────────────────────────┤
│ [Salva e analizza con AI ✨]    │
└─────────────────────────────────┘

   Timer overlay (quando attivo):
   ┌────────────────────────────┐
   │ BACK SQUAT                 │
   │ 02:47              [Salta] │
   │ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░     │
   └────────────────────────────┘
```

---

#### `/log` — Form Log (Circuit mode)
```
┌─────────────────────────────────┐
│ Round completati  (target: 4)   │
│                          3      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━ ←→    │
├─────────────────────────────────┤
│ ESERCIZI DEL CIRCUIT            │
│ ┌─────────────────────────────┐ │
│ │ Push-up        20 reps      │ │
│ │ Reps effettive  Carico      │ │
│ │ [18]            [—]         │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ Recupero effettivo tra round    │
│ [90                       sec]  │
│ [⏱ Avvia recupero round      ] │ ← giallo
├─────────────────────────────────┤
│ METRICHE CARDIO                 │
│ FC media  FC max   Calorie      │
│ [152]     [178]    [420]        │
│ Z1  Z2  Z3  Z4  Z5             │
│ [5] [20][15][8] [2]  min       │
└─────────────────────────────────┘
```

---

#### `/history` — Storico
```
┌─────────────────────────────────┐
│ Storico                         │
├─────────────────────────────────┤
│ TREND RPE              (Recharts)│
│ ┌─────────────────────────────┐ │
│ │ 10│                         │ │
│ │  7│    ●─●─●    ─ ─ ─      │ │
│ │  4│  ●         ─ ─          │ │
│ │   └─────────────────────    │ │
│ │     1/5  3/5  5/5  8/5      │ │
│ │  ── RPE effettivo  - target │ │
│ └─────────────────────────────┘ │
│ FREQUENZA SETTIMANALE           │
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐       │
│ │ 2 │ │ 3 │ │ 4 │ │ 3 │       │
│ │-3w│ │-2w│ │Sc.│ │Qt.│       │
│ └───┘ └───┘ └───┘ └───┘       │
├─────────────────────────────────┤
│ [Tutti] [Forza] [Cardio] [Mob.] │
├─────────────────────────────────┤
│ 😄  Squat + Upper               │
│     Prog. Forza 12w             │
│     gio 8 mag · 75min · RPE7    │
│                          AI ›   │
└─────────────────────────────────┘
```

---

#### `/history/[id]` — Dettaglio Log
```
┌─────────────────────────────────┐
│ ‹  giovedì 8 maggio 2026        │
│    Squat + Upper · Forza        │
├─────────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│ │75m │ │7/10│ │ 🙂 │ │ 🔋 │   │
│ │Dur.│ │RPE │ │Umr.│ │En. │   │
│ └────┘ └────┘ └────┘ └────┘   │
├─────────────────────────────────┤
│ ESERCIZI                        │
│ ┌─────────────────────────────┐ │
│ │ Back Squat            RPE 8 │ │
│ │ Pianif.  │  Effettivo       │ │
│ │ 5×5@80%  │  5×5@82.5kg     │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ Note: Mi sentivo bene…          │
├─────────────────────────────────┤
│ ANALISI AI ✨                   │
│ ┌─────────────────────────────┐ │
│ │ Ottima sessione! RPE coer.  │ │  ← verde primario
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ ✅ Progressione carico      │ │  ← verde
│ │ ✅ Tecnica coerente         │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 💡 Aumenta leggermente…     │ │  ← giallo
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 💬 Prossima: focus su…      │ │  ← grigio
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

---

### AREA ATLETA

---

#### `/athlete/dashboard`
```
┌─────────────────────────────────┐
│ mar 10 maggio          [Esci]   │
│ Ciao 👋                          │
├─────────────────────────────────┤
│ OGGI        Programma Forza 12w │
│ [Forza] Squat + Upper           │
│ 5 esercizi · 75 min · RPE 7     │
│ [Logga allenamento            ] │
├─────────────────────────────────┤
│ ┌────────────────┐ ┌──────────┐ │
│ │ Sessioni questa│ │ RPE medio│ │
│ │ settimana      │ │          │ │
│ │       3        │ │    7.2   │ │
│ └────────────────┘ └──────────┘ │
├─────────────────────────────────┤
│ Ultimi allenamenti        Tutti →│
│ gio 8 mag  😄  RPE7  75min      │
│ lun 5 mag  🙂  RPE6  60min      │
└─────────────────────────────────┘
[Home] [Programma] [Log] [Storico]
```

---

#### `/athlete/history`
```
┌─────────────────────────────────┐
│ Storico allenamenti             │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ giovedì 8 maggio 2026       │ │
│ │ Squat + Upper               │ │
│ │ RPE 7/10 · 75 min  [Tu]    │ │
│ │ ────────────────────────    │ │
│ │ ✨ AI Feedback              │ │
│ │ Ottima sessione! RPE…       │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

---

## 8. Pattern UI ricorrenti

### Input standard
```css
/* inputCls */
w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2(.5) 
text-sm text-white placeholder-slate-500 
focus:outline-none focus:ring-1 focus:ring-primary
```

### Bottone CTA primario
```css
w-full bg-primary text-white font-bold py-4 rounded-2xl text-base
hover:bg-primary-600 disabled:opacity-60 transition-colors
```

### Bottone secondario / outline
```css
border border-slate-600 text-slate-400 rounded-xl py-2.5 text-sm
hover:text-white hover:border-slate-400
```

### Badge/chip sessione tipo (esempio)
```css
text-xs font-medium px-2 py-0.5 rounded-full
bg-primary/20 text-primary   /* Forza / attivo */
bg-yellow-500/20 text-yellow-400  /* Circuit / invitato */
```

### Slider (range input)
```css
w-full accent-primary   /* verde per RPE/durata */
w-full accent-yellow-400  /* giallo per round circuit */
```

### Griglia zone HR (5 colonne)
```
Z1: text-blue-400   Z2: text-green-400   Z3: text-yellow-400
Z4: text-orange-400  Z5: text-red-400
Input: bg-slate-900 border border-slate-600 rounded-lg text-center
```

### Header sezione uppercase
```css
text-xs font-semibold text-slate-400 uppercase tracking-wider
```

### Link / freccia "see all"
```css
text-primary text-xs font-medium
```

### Analisi AI card colorata
| Tipo | Background | Border | Label |
|------|-----------|--------|-------|
| Summary | `bg-primary/10` | `border-primary/30` | — |
| Positivi | `bg-green-500/10` | `border-green-500/30` | ✅ verde |
| Suggerimenti | `bg-yellow-500/10` | `border-yellow-500/30` | 💡 giallo |
| Flag attenzione | `bg-red-500/10` | `border-red-500/30` | ⚠️ rosso |
| Tip prossima | `bg-slate-800` | `border-slate-700` | 💬 grigio |

---

## 9. Dipendenze chiave UI

```json
{
  "date-fns": "formattazione date in italiano",
  "recharts": "LineChart RPE trend in /history",
  "firebase": "Firestore + Auth",
  "@anthropic-ai/sdk": "analisi AI (server-side only)",
  "resend": "email inviti (server-side only)"
}
```

---

## 10. Note per Claude Design

1. **Tutto è dark** — background `#0f172a`, card `#1e293b`. Non esiste un tema light.
2. **Mobile-first PWA** — larghezza massima `max-w-lg mx-auto`, pensato per 390px (iPhone 15). Non c'è desktop layout.
3. **BottomNav fissa** — tutti i contenuti devono avere `pb-nav` per non essere coperti.
4. **Colore primario esclusivo** — `#1D9E75` è il verde usato per CTA, accenti, stati attivi. Non usare altri verdi al di fuori delle zone HR.
5. **Rounded generosi** — `rounded-2xl` (card), `rounded-xl` (bottoni), `rounded-lg` (input). Non usare angoli netti.
6. **Testo gerarchico** — titoli `text-xl font-bold text-white`, label sezione `text-xs uppercase tracking-wider text-slate-400`, testo secondario `text-sm text-slate-300/400`.
7. **Circuit = giallo** — tutto ciò che riguarda il circuit training usa `yellow-400` come accent (bordi, slider, bottone timer, section header).
8. **AI feedback** — usa 4 card colorate con opacity bassa (10%) per un look sofisticato, non alert aggressivi.
9. **Il timer** è un overlay floating centrato in basso, NON una modale full-screen.
10. **Status atleti** — 4 stati con colori precisi (verde=attivo, blu=pending, giallo=invitato, grigio=archiviato).
