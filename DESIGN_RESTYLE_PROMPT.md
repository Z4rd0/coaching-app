# Prompt per Claude Design — Restyling completo Coaching App

> Da usare insieme a `DESIGN_BRIEF.md` (inventario completo di design system, route,
> componenti e schermate attuali). Questo file dice **cosa migliorare e con quali vincoli**;
> il brief dice **cosa esiste oggi**.

---

## Missione

Sei un product designer senior specializzato in app fitness mobile (riferimenti di qualità:
WHOOP, Strava, Fitbod, TrainingPeaks). Devi fare il **restyling visivo completo** di una PWA
di coaching sportivo coach↔atleti, portandola da "funzionale ma anonima" a un prodotto che
sembri disegnato, premium e riconoscibile — **senza cambiarne la struttura informativa né i flussi**.

L'utente tipo guarda l'app ogni giorno in palestra: deve essere leggibile a colpo d'occhio,
piacevole da riaprire, e dare soddisfazione quando si completa un allenamento.

---

## Vincoli non negoziabili

1. **Stack invariato**: Next.js 14 + Tailwind CSS. Output = classi Tailwind, design token in
   `tailwind.config.ts` e CSS custom in `globals.css`. Nessuna libreria UI nuova (no shadcn,
   no MUI). Recharts resta per i grafici.
2. **Dark theme only** — non esiste tema light. Puoi però arricchire la palette scura
   (oggi è tutta slate piatta).
3. **Mobile-first PWA**: viewport di riferimento 390px, contenuto in `max-w-lg mx-auto`,
   nessun layout desktop da progettare.
4. **Il verde brand `#1D9E75` resta il colore primario** (può evolvere in scala/gradiente,
   ma deve rimanere riconoscibile come identità).
5. **BottomNav fissa** in basso; il contenuto usa `pb-nav`. La nav si può ridisegnare
   (vedi problemi sotto) ma resta una bottom navigation.
6. **Due aree separate** (coach e atleta) che devono sembrare la stessa app: stesso
   linguaggio visivo, al massimo accenti diversi.
7. Tutti i testi UI sono **in italiano**.
8. Niente immagini raster/stock: solo SVG, CSS, emoji dove già usate.

---

## Problemi attuali da risolvere (in ordine di priorità)

1. **Tutto è la stessa card.** Ogni elemento è `bg-slate-800 + border slate-700 + rounded-2xl`:
   dashboard, form, liste, feedback AI… non c'è gerarchia tra contenuto primario e secondario.
   Serve un sistema di superfici a livelli (es. base / elevated / highlight) e una card "hero"
   per la sessione di oggi.
2. **Nessun momento di carattere.** Non c'è un elemento firma: niente gradienti, glow,
   illustrazioni, numeri grandi con personalità. La dashboard sembra una lista di settings.
3. **Tipografia di sistema senza voce.** Solo system font, pochi pesi e dimensioni. Valutare un
   font variabile self-hostabile via `next/font` (es. Inter, Manrope o simile) con scala
   tipografica chiara; i numeri (RPE, durata, countdown timer) meritano un trattamento display.
4. **BottomNav coach satura: 7 tab** (Home, Calendario, Atleti, Gruppi, Log, Programmi, Storico)
   su 390px con label da 9px. Proponi una soluzione: es. 5 voci + FAB centrale per "Log",
   oppure tab "Altro", oppure riorganizzazione delle sezioni. Motivare la scelta.
5. **Loading = spinner full-screen ovunque.** Sostituire con skeleton screen coerenti
   con il layout di ogni pagina.
6. **Empty state poveri** (icona grigia + frase). Renderli accoglienti e azionabili,
   con illustrazione SVG leggera in tinta.
7. **Zero micro-interazioni.** Definire un sistema di motion minimale (durate, easing,
   transizioni di stato per: tab attivo, espansione card sessione, salvataggio riuscito,
   completamento timer recupero, arrivo del feedback AI).
8. **Il feedback AI è il momento più prezioso dell'app** (analisi post-allenamento di Claude)
   ma visivamente è solo un'altra card. Va celebrato: è il "reward" dopo il log.
9. **Gli slider RPE/durata** sono input range nativi anonimi, eppure l'RPE è il dato centrale
   del prodotto. Disegnare un selettore RPE memorabile (scala 1–10 con colore progressivo?).
10. **Avatar atleti = iniziale su cerchio verde**, tutti uguali. Serve un sistema di colori
    deterministico per persona, e un trattamento per i gruppi (stack di avatar sovrapposti).

---

## Aree dell'app (dettagli completi in DESIGN_BRIEF.md)

**Coach:** dashboard con sessione di oggi + stats settimana · calendario mensile con dot ·
lista atleti con stati (attivo/pending/invitato/archiviato) · profilo atleta · **gruppi di
allenamento** (novità: lista gruppi, dettaglio con membri e programmi condivisi) · builder
programmi a cicli/settimane/sessioni · form log con timer recupero e circuit mode ·
storico con grafico RPE (Recharts).

**Atleta:** dashboard con sessione di oggi (anche dei gruppi, badge 👥) · vista programma
read-only · form log · storico con feedback AI.

**Schermate prioritarie per i mockup** (in quest'ordine):
1. `/dashboard` (coach) — la prima impressione quotidiana
2. `/athlete/dashboard` — idem lato atleta
3. `/log` — la schermata usata in palestra, anche col timer overlay attivo
4. BottomNav ridisegnata (proposta per il problema delle 7 tab)
5. `/history` + `/history/[id]` — grafici e feedback AI
6. `/groups` + `/groups/[id]` — sezione nuova, ancora "neutra": è il banco di prova
   del nuovo linguaggio. Tieni conto che qui arriverà una "fase 2" con feed/classifica
   tra membri del gruppo (gara amichevole): prevedi spazio/pattern per un leaderboard.
7. `/athletes` e `/athlete/program`

---

## Deliverable richiesti

1. **Design system aggiornato**, pronto da implementare:
   - palette completa (superfici a 3+ livelli, scala del verde brand, colori semantici,
     colori tipo-sessione rivisti ma riconoscibili) come estensione di `tailwind.config.ts`
   - scala tipografica (font, pesi, dimensioni, line-height) con setup `next/font`
   - sistema spaziature/radius/ombre-glow
   - regole di motion (durate, easing, quali proprietà animare)
2. **Pattern di componenti** in HTML+Tailwind copia-incollabile: card (3 livelli), card hero
   "sessione di oggi", CTA primaria/secondaria, badge e chip di stato, input e select, slider
   RPE custom, avatar singolo e stack gruppo, skeleton, empty state, bottom nav, timer overlay,
   le 4 card del feedback AI.
3. **Mockup per le schermate prioritarie** (HTML/Tailwind ad alta fedeltà, 390px).
4. **Note di migrazione**: per ogni pattern, da quali classi attuali si parte
   (sono elencate in DESIGN_BRIEF.md §2 e §8) e a quali si arriva, così la conversione
   delle ~25 pagine esistenti è meccanica.

## Cosa NON fare

- Non aggiungere feature, schermate o contenuti nuovi (solo il restyling del visivo).
- Non introdurre un tema light, sidebar desktop o hamburger menu.
- Non usare gradienti arcobaleno/neon da crypto-app: il riferimento è sportivo-premium,
  sobrio, con il verde come firma.
- Non rompere l'accessibilità: contrasto AA su testo normale, touch target ≥ 44px,
  niente informazione affidata al solo colore.
