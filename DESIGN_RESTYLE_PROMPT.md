# Prompt per Claude Design — Restyling completo Coaching App

> Da usare **insieme** a `DESIGN_BRIEF.md` (inventario aggiornato di route,
> componenti, tipi e screen attuali). Il brief dice cosa esiste oggi; questo
> file dice cosa migliorare, con quali vincoli, e cosa produrre.

---

## Missione

Sei un product designer senior specializzato in app fitness mobile (riferimenti
di qualità: WHOOP, Strava Premium, Fitbod, TrainingPeaks, Hevy). Fai il
**restyling visivo completo** di una PWA di coaching coach↔atleti, portandola
da "funzionale ma anonima" a un prodotto **premium, sportivo e riconoscibile** —
**senza cambiarne la struttura informativa né i flussi**.

L'utente tipo guarda l'app ogni giorno in palestra. Deve essere leggibile a
colpo d'occhio sotto luce LED, piacevole da riaprire la sera, e dare
soddisfazione dopo un allenamento.

---

## Vincoli non negoziabili

1. **Stack invariato**: Next.js 14 + Tailwind CSS. Output = classi Tailwind,
   design token in `tailwind.config.ts`, CSS custom in `globals.css`. Nessuna
   libreria UI nuova (no shadcn, no MUI, no Headless UI). Recharts resta per i
   grafici.
2. **Dark theme only** — non esiste tema light. La palette scura può evolvere
   in profondità (oggi è tutta slate piatta).
3. **Mobile-first PWA**: viewport di riferimento 390×844, contenuto in
   `max-w-lg mx-auto`. Nessun layout desktop.
4. **Il verde brand `#1D9E75` resta l'identità**. Può evolvere in scala/gradiente
   ma deve restare riconoscibile.
5. **BottomNav fissa** in basso, `pb-nav` su tutto il contenuto. La nav si può
   ridisegnare (problema noto: coach ha 7 tab) ma resta una bottom navigation.
6. **Due aree (coach e atleta) devono sembrare la stessa app**, stesso linguaggio
   visivo. Accenti diversi solo se motivati.
7. **Tutti i testi UI in italiano**.
8. **Niente immagini raster o stock**: solo SVG, CSS, emoji dove già usate.
9. **Accessibilità AA**: contrasto su testo normale, touch target ≥ 44px, nessuna
   informazione affidata al solo colore.

---

## Problemi attuali da risolvere (in ordine di impatto)

### Gerarchia visiva

1. **Tutto è la stessa card**: `bg-slate-800 + border slate-700 + rounded-2xl`
   ovunque — dashboard, form, liste, modali. Non c'è gerarchia tra contenuto
   primario e secondario. Servono **3+ livelli di superficie** (es. base /
   elevated / highlight) e una "hero card" distintiva per la sessione di oggi.

2. **Nessun momento di carattere**. Niente gradienti, glow, illustrazioni,
   numeri-eroe con personalità. La dashboard sembra una lista di settings.
   Bisogna **scegliere 2-3 elementi-firma** (es. il countdown del timer recupero,
   il numero "round HIIT", la classifica del gruppo) e renderli memorabili.

3. **Tipografia di sistema senza voce.** Solo system font, pochi pesi e
   dimensioni. Valutare un **font variabile self-hostato via `next/font`** (Inter,
   Manrope, Geist Sans o simili) con scala tipografica chiara. I **numeri**
   (RPE, durata, countdown, classifica, stats) meritano un trattamento display
   tabellare con `tabular-nums`.

### Navigazione

4. **BottomNav coach satura: 7 tab** (Home, Calendario, Atleti, Gruppi, Log,
   Programmi, Storico) su 390px con label da 9px — illeggibili. Proporre una
   soluzione e motivarla:
   - **opzione A**: 5 voci + FAB centrale per "Log" (azione frequente, merita un
     posto speciale)
   - **opzione B**: 5 voci + tab "Altro" che apre un bottom sheet con le
     restanti
   - **opzione C**: riorganizzare l'IA (es. fondere Programmi sotto Atleti,
     Calendario sotto Storico)

   Lato atleta la nav è a 5 voci, leggibile.

### Stati e interazioni

5. **Loading = spinner full-screen ovunque** (`LoadingSpinner`). Sostituire
   con **skeleton screen** che riflettono il layout di ogni pagina (card-shaped
   shimmer, righe lista).

6. **Empty state poveri** (icona grigia + frase). Renderli accoglienti e
   azionabili con illustrazione SVG leggera in tinta brand, una micro-copy
   calda e un CTA chiaro.

7. **Zero micro-interazioni**. Definire un **sistema motion minimale** (durate,
   easing, transizioni di stato per: tab attivo, espansione card sessione,
   apertura modale edit log, salvataggio riuscito, completamento timer recupero,
   nuova voce in classifica, transizione tra intervalli HIIT).

### Componenti specifici da elevare

8. **Il timer HIIT (`HiitTimer`) è il momento più "magico" dell'app** — un
   componente fullscreen che guida secondo per secondo l'atleta tra lavoro e
   recupero. Va trattato come una **schermata distinta e immersiva**, non come
   un riquadro qualsiasi. Numero countdown enorme, ring di progresso, anteprima
   "next" leggibile, ergonomia perfetta per dito sudato.

9. **La classifica del gruppo (`GroupActivity`)** è il motore di ingaggio
   del prodotto. Oggi è una lista uguale alle altre. Va resa **iconica**:
   medaglie distintive, treatment "podio" per i primi 3, evidenziazione "sei
   tu" che dia soddisfazione (non solo un bg/10), animazione quando le
   posizioni cambiano.

10. **Lo slider RPE/durata/round** è un input range nativo anonimo. RPE è il
    dato centrale del prodotto. **Disegnare un selettore RPE memorabile**
    (scala 1-10 con gradiente di colore progressivo verde→rosso, tick
    discreti, label "facile / massimale" agli estremi).

11. **Avatar atleti = iniziale su cerchio verde**, tutti uguali. Sistema di
    **colori deterministico per persona** (hash del nome o UID), trattamento per
    i gruppi con stack di avatar sovrapposti.

12. **Il dettaglio log (`LogDetailBody`)** ha sezioni eterogenee (esercizi,
    cardio con zone HR, circuit, HIIT, commento coach). Vanno **chiaramente
    raggruppate visivamente** con un linguaggio coerente — oggi sono solo
    card slate-800 in serie.

13. **Il modale di edit log (`LogEditModal`)** è bottom-sheet su mobile.
    Va trattato con cura: drag-handle in cima, save sticky bottom, animazione
    slide-up. Oggi è un overlay statico.

### Brand & coerenza

14. **Niente identità di marca**: non c'è un logo, un wordmark, un piccolo
    elemento decorativo che dica "questa è la *mia* app". Anche solo un
    monogramma SVG ben fatto + nome wordmark in tipografia variabile fa
    differenza nella **schermata di auth** e nella **landing degli inviti**.

15. **Schermate pubbliche scarne** (`/auth`, `/invite/accept`, `/join/...`,
    `/join-group/...`). Sono il primo contatto dell'atleta con il prodotto:
    meritano una hero illustrata, un'introduzione visiva al concetto di "coach +
    atleti + gruppo".

---

## Aree dell'app coperte dal restyle

### Coach
Dashboard con sessione di oggi + stats settimana + radar atleti inattivi · calendario
mensile · lista atleti · profilo atleta con commenti coach inline · **gruppi
con classifica e feed** · builder programmi (cicli/settimane/sessioni) · form
log con timer recupero, circuit, **HIIT** · storico con grafico RPE.

### Atleta
Dashboard con sessione di oggi (anche dei gruppi 👥) · vista programma read-only ·
form log con selettore sessione · storico cliccabile con commento del coach ·
**pagina gruppo** con classifica e feed.

### Pubbliche
`/auth` (con selettore ruolo) · `/join/...` · **`/join-group/...`** (nuova).

---

## Schermate prioritarie per i mockup (in quest'ordine)

1. **`/dashboard` coach** — la prima impressione quotidiana, include la sezione
   "I tuoi atleti" con i dot di aderenza
2. **`/athlete/dashboard`** — idem lato atleta, con le card sessioni di gruppo
3. **`/log` con sezione HIIT attiva + HiitTimer fullscreen** — la schermata che
   l'atleta vede in palestra
4. **`/groups/[id]` coach e `/athlete/group`** — il banco di prova della
   classifica e del feed (il "gioco" dell'app)
5. **BottomNav ridisegnata** (proposta per le 7 tab del coach)
6. **`/history/[id]` con LogDetailBody** + il modale edit aperto
7. **`/auth` con selettore Coach/Atleta** + landing `/join-group/...`
8. **`/athletes` + `/athletes/[id]`** con i commenti coach inline

---

## Deliverable richiesti

### 1. Design system aggiornato — pronto da implementare

- **Palette completa**: superfici a 3+ livelli (base/elevated/highlight),
  scala del verde brand, colori semantici (success/warning/danger/info), colori
  per tipo sessione rivisti ma riconoscibili (incluso HIIT/rose e
  Circuit/yellow). Tutto come estensione di `tailwind.config.ts`.
- **Scala tipografica**: font, pesi, dimensioni, line-height, tracking. Setup
  `next/font`. Variante numerica tabellare per RPE/timer/classifica.
- **Sistema spaziature / radius / ombre / glow** — sì, glow leggeri sui CTA
  primari e sull'avatar attivo possono dare vita.
- **Regole di motion**: durate (xs/sm/md/lg), easing (`ease-out` default,
  `spring` per micro-celebrazioni), quali proprietà animare (`transform` e
  `opacity`, non `width`/`height`).

### 2. Pattern di componenti (HTML + Tailwind copia-incollabili)

- **Card 3 livelli** (base, elevated, highlight con accento brand)
- **Hero card "sessione di oggi"** (la più ricca: tipo, titolo, metriche, CTA, espandibile)
- **CTA primaria / secondaria / ghost / danger**
- **Badge e chip di stato** (tipo sessione, stato atleta, ruolo)
- **Input, select, slider** (con il selettore RPE custom)
- **Avatar singolo + stack gruppo + indicatore inattività**
- **Skeleton** per ogni layout principale (dashboard, lista, dettaglio log)
- **Empty state azionabili** con illustrazione SVG leggera
- **Bottom nav** (la nuova versione proposta) + indicatore tab attivo animato
- **Timer recupero overlay** (countdown + completato + skip)
- **HiitTimer fullscreen** — è il deliverable più importante
- **Classifica e feed gruppo** (con treatment podio e riga "tu")
- **Modale edit log bottom-sheet**
- **LogDetailBody** con sezioni esercizi / cardio (zone HR a barra) / circuit /
  HIIT chiaramente distinte

### 3. Mockup HTML/Tailwind ad alta fedeltà per le schermate prioritarie

Una pagina HTML standalone per schermata, 390px wide, con `max-w-lg mx-auto`.

### 4. Note di migrazione

Per ogni pattern, una mappatura **"da" → "a"**: le classi attuali (sono nel
`DESIGN_BRIEF.md` §2 e §5) e le nuove. Così la conversione delle ~30 pagine
esistenti è meccanica e si può fare in pezzi piccoli su branch separati.

---

## Cosa NON fare

- Non aggiungere feature, schermate o contenuti nuovi (è un restyling visivo).
- Non introdurre tema light, sidebar desktop, hamburger menu, drawer laterali.
- Non usare **gradienti arcobaleno o neon da crypto-app**: il riferimento è
  sportivo-premium sobrio, con il verde come firma.
- Non spingere oltre nella distinzione coach vs atleta — le due aree devono
  sembrare la stessa app.
- Non rompere l'accessibilità: contrasto AA, touch target ≥ 44px, nessuna
  informazione affidata al solo colore.
- Non sostituire le emoji con icone SVG dove sono parte dell'identità di
  prodotto (mood, energia, podio 🥇🥈🥉, badge gruppo 👥).

---

## Come usare questo file con Claude Design

Apri una conversazione in Claude Design e allega **entrambi i file**
(`DESIGN_BRIEF.md` e questo). Apri con qualcosa tipo:

> "Esegui la missione descritta in DESIGN_RESTYLE_PROMPT.md.
> L'inventario aggiornato dell'app è in DESIGN_BRIEF.md.
> Parti dalla schermata prioritaria n°1 (dashboard coach) e poi la 2.
> Mostrami prima il design system + i pattern di componenti, poi i mockup."

Procedere una schermata alla volta (o due) dà risultati molto migliori che
chiedere "fai tutto". Tra una iterazione e l'altra, valida i pattern con un
piccolo test su una pagina vera prima di propagarli.
