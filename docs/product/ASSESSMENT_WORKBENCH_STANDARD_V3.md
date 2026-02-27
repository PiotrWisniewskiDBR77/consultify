# Assessment Workbench Standard v3 — DRD / SIRI / ADMA (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** ujednolicić **format konsultingowy pracy** dla 3 kluczowych assessmentów w Consultify: **DRD, SIRI, ADMA**:  
> assessment → podsumowanie → inicjatywy → raport/deck → zarządzanie.

## 0) Zakres (co standaryzujemy)

Standaryzujemy **proces i mechanikę pracy**, nie merytorykę:

- wspólny układ UI (nawigacja / praca / grafika),
- wspólny kontrakt “question bank” + “evidence discipline”,
- wspólny model “as‑is vs to‑be” (current/target),
- wspólne outputy: summary, initiatives, report, deck,
- wspólny “chat coach” (instrukcje prowadzenia przez czat),
- wspólne zasady governance: propose→accept, traceability, audit.

Nie standaryzujemy:

- osi merytorycznych (DRD ≠ SIRI ≠ ADMA),
- metod licencyjnych (SIRI/ADMA mają własne kanoniczne źródła).

---

## 1) Kanoniczny workflow (dla wszystkich 3)

### 1.1 Faza A — Setup sesji

- wybór narzędzia (DRD/SIRI/ADMA),
- zakres: zakład/linia/obszar, uczestnicy, czas,
- definicja “target horizon” (np. 12–24 mies.).

### 1.2 Faza B — Assessment (evidence-first)

Dla każdej jednostki oceny (area/dimension):

- **current (AS‑IS)**: ustalamy poziom na bazie dowodów,
- **target (TO‑BE)**: ustalamy ambicję (opcjonalnie, ale zalecane),
- **evidence**: link/attachment + krótka notatka “dlaczego ten poziom”.

### 1.3 Faza C — Konsolidacja i spójność

- spójność odpowiedzi między rolami (różnice opinii są normalne),
- dopięcie braków dowodowych (lista “missing evidence”),
- finalne “score freeze” (snapshot).

### 1.4 Faza D — Summary + maps

Minimum:

- overall score + “shape” (radar/spider),
- top gaps,
- priorytety (top 3–6).

### 1.5 Faza E — Inicjatywy (propose→accept)

Generator inicjatyw bierze:

- top gaps (current→target),
- zależności foundation→value,
- kontekst organizacji (jeśli dostępny),

…i tworzy propozycje inicjatyw z:

- source traceability (assessment session id),
- owner role,
- KPI do Results (outcome + leading driver),
- ryzyka i założenia.

### 1.6 Faza F — Raport + Deck

Raport i deck są eksportem: muszą być:

- spójne z wynikami,
- audytowalne (skąd score),
- gotowe do akceptacji i przekucia w plan.

---

## 2) Wspólny kontrakt UI/UX (Workbench)

### 2.1 Układ (kanon)

Każde narzędzie assessmentowe musi mieć:

- **Navigation panel (right or left)**: lista obszarów (z progressem).
- **Work area (center)**: scoring + pytania + evidence + notatki.
- **Graphic mirror**: mapa (radar/heatmap/gap) jako “stan systemu”.

Kod‑anchor (as-is):

- split shell: `src/components/assessment/AssessmentToolShell.tsx`
- DRD editor: `src/components/assessment/drd/DRDAssessmentEditor.tsx`
- SIRI editor: `src/components/assessment/siri/SIRIAssessmentEditor.tsx`
- ADMA editor: `src/components/assessment/adma/ADMAAssessmentEditor.tsx`

### 2.2 “Question Bank” (MUST)

Każdy obszar oceny musi mieć dostępne, zwięzłe pytania:

- minimum 3 pytania yes/no na poziom (lub równoważny zestaw),
- pytania mają wymuszać dowody i rozróżnienie poziomów.

Źródło:

- Tool Knowledge Bank packs: `knowledge/tool-kb/<tool>/qbank/...`

### 2.3 Evidence (MUST)

Każdy score musi mieć:

- evidence (link/attachment) **albo**
- jawny stan “unknown / needs evidence”.

Nie ma:

- “score by opinion” bez śladu.

### 2.4 As‑is vs To‑be

Wspólny model:

- `current`: jak jest dzisiaj,
- `target`: ambicja (opcjonalnie),
- “gap” jest liczony deterministycznie.

---

## 3) Wspólny kontrakt grafiki (maps)

Minimum (dla 3 narzędzi):

1) **Radar/Spider** (shape)
2) **Gap bars** (current vs target)
3) **Top gaps** (ranking)

Narzędziowe rozszerzenia:

- DRD: matrix area×level (primary)
- SIRI: prioritisation matrix (PM) + legal notice
- ADMA: FoF benchmark overlay + 7 transformations view

---

## 4) Wspólny kontrakt outputów (reports/decks)

Każdy tool ma:

- **Report template** (MD/PDF) z sekcjami:
  - Executive summary
  - Scores + maps
  - Evidence discipline summary (braki dowodowe)
  - Priorities
  - Initiatives (proposals) + KPIs
- **Deck template**:
  - 5–10 slajdów, te same sekcje w skrócie

---

## 5) Chat Coach (MUST) — instrukcja prowadzenia przez czat

Chat działa jak “konsultant prowadzący” i przechodzi przez 6 etapów:

1) **Kickoff**: scope, uczestnicy, horyzont targetu, wymagane dane wejściowe.
2) **Area loop**: dla każdej area/dimension:
   - pytania,
   - prośba o evidence,
   - propozycja score (propose),
   - akceptacja (accept) lub “needs evidence”.
3) **Consistency check**: sprzeczności + missing evidence.
4) **Summary**: shape + top gaps + priorytety.
5) **Initiatives**: propozycje + akceptacja + przypisanie ownerów.
6) **Export**: raport i deck + checklista “co dalej”.

**Wymóg:** chat nie “nadpisuje” — zawsze propose→accept.

---

## 6) Video enablement (żeby dało się nagrać instruktaż)

Każde narzędzie musi mieć:

- scenariusz “samodzielne przeprowadzenie” (15–25 min),
- scenariusz “z konsultantem” (45–90 min),
- checklisty:
  - przygotowanie danych,
  - udział ról,
  - evidence,
  - interpretacja wyników,
  - inicjatywy.

Te scenariusze trzymamy:

- w SSOT (per tool pack) oraz
- w Tool Knowledge Bank (pack `help`).

---

## 7) Definition of Done (DoD) — “narzędzie assessmentowe jest kompletne”

### 7.1 DoD — UX

- workbench ma: nawigację, scoring, evidence, notatki, grafikę (maps),
- statusy “unknown / needs evidence” są widoczne,
- current/target są rozdzielone i czytelne.

### 7.2 DoD — outputy

- report template istnieje i jest spójny z danymi,
- deck template istnieje (skrót),
- inicjatywy da się wygenerować i zaakceptować,
- export działa (co najmniej PDF/print‑friendly).

### 7.3 DoD — AI/chat coach

- są packi `help` i `qbank` (min. PL lub EN),
- chat działa w trybie propose→accept,
- jest checklista “self‑service” + “warsztat”.

### 7.4 DoD — SSOT

- istnieje `*_ASSESSMENT_PACK_V3.md` dla toola,
- jest jawne mapowanie (jeśli tool ma warstwy canon vs runtime),
- są odwołania do źródeł kanonicznych (PDF/whitepaper).

