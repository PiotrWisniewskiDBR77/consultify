# ZAŁOŻENIA GENERATORA BIZNESPLANU (BundleOrchestrator + AssumptionsModel) — SSOT

> Cel: jeden brief → **spójna wiązka konsultanta**: założenia + model finansowy → raport Word + deck inwestorski + tabela Excel, wszystko z jednego źródła prawdy. Założenia oparte na standardach rynkowych (McKinsey/BCG/Bain, Sequoia/YC/a16z, FAST/CFI/Wall Street Prep, Bessemer/Benchmarkit) — bo **naśladujemy konsultantów**. Research+cytaty: [`MULTITHREAD_BIZPLAN_ANALYSIS.md`](../qa/deliverables/MULTITHREAD_BIZPLAN_ANALYSIS.md) + 3 raporty researchowe w historii sesji 2026-06-23.

## 0. Doktryna (co naśladujemy)
- **Narracja:** Minto Pyramid (answer-first) · SCQA opener · MECE · hypothesis-driven · action-titles („so-what", title read-through = cała historia) · arc problem→solution→why-now→market→model→traction→financials→team→ask.
- **Założenia:** issue/driver-tree (każda liczba ma nazwany driver) · top-down ∧ bottom-up triangulacja (reconcile ~15%) · reference-class/outside-view (anty-optymizm) · benchmark + source na każdej kluczowej liczbie · sensitivity na 3-5 driverów · base case konserwatywny.
- **Model finansowy:** FAST (Flexible-Appropriate-Structured-Transparent) · integralność 3-statement (P&L↔BS↔CF reconcile) · driver-based nie hardcode · inputs ≠ calculations · single source of truth · zero circularity · corkscrew/roll-forward · color-coding input/formula/link.

## 1. Architektura (3 warstwy + konsumenci)
```
brief ─► [1] AssumptionsModel ──► [2] FinancialEngine ──► [3] BundleOrchestrator ──► B4 tabela
            (driver-tree,            (3-statement,           (wspólny SPINE,            B3 raport
             TAM/SAM/SOM,             ARR bridge,             hero-number identity,      B1 deck
             source/range/sens,       unit-econ, KPI,         section↔slide↔table,       + grafiki
             scenariusze)             CFO-review)             coherence gate)
```
**Wspólny SPINE** (jeden obiekt) = źródło prawdy konsumowane przez wszystkie 3 generatory. Zmiana założenia propaguje się wszędzie.

## 2. ZAŁOŻENIA — wymagania (DoD generatora)

### A. AssumptionsModel — założenia i ich obrona
- [ ] A1 Buduje założenia przez MECE driver-tree; każda liczba traceable do nazwanego drivera (parent = arytmetyka children → samokontrola pokrycia).
- [ ] A2 Rynek jako zagnieżdżone **TAM→SAM→SOM** (3 odrębne liczby, nigdy jedna „rynek").
- [ ] A3 **Bottom-up** (klienci×ARPU / jednostki×cena) jako PODSTAWA; TAM = wynik buildu, nie premisa.
- [ ] A4 Niezależny **top-down** + reconcile z bottom-up; flaga gdy rozbieżność >~15%.
- [ ] A5 Udział/SOM z buildu GTM+capacity, **nigdy** „X% wielkiego rynku".
- [ ] A6 Każde materialne założenie: **source/benchmark (źródło+rok) + zakres (range, nie fałszywa precyzja) + ranga sensitivity**; blokuje kluczowe liczby bez źródła.
- [ ] A7 **Rejestr założeń** (jeden log provenance) zasilający wszystkie artefakty; audytowalny.
- [ ] A8 Outside-view/reference-class base-rate obok każdej kluczowej projekcji (wzrost/adopcja/timeline); default do base-rate gdy estymata zespołu > klasa referencyjna.
- [ ] A9 **Detektory anty-wzorców** (flaga/odrzuć): hockey-stick bez drivera · TAM bez źródła / tylko top-down · ukryta circularity (dependency-trace) · false precision · „1% rynku" · brak CAC/payback przed rampą przychodu.
- [ ] A10 Jawny blok „kluczowe założenia & ryzyka": lista założenie → źródło → zakres → ranga sensitivity.

### B. FinancialEngine — model finansowy
- [ ] B1 Jeden kanoniczny **assumptions object = source of truth**; driver zdefiniowany raz, referowany wszędzie; inputs ≠ calculations (zero założeń wbitych w formuły).
- [ ] B2 **3-5 letni P&L z driverów** (przychód = cena×wolumen×retencja − koszty), nie hardcode totali.
- [ ] B3 Zintegrowany **3-statement** (P&L, uproszczony BS, CF) który reconciluje (net income→retained earnings; CF cash = BS cash).
- [ ] B4 Bilanse przez **corkscrew/roll-forward** (cash, debt, PP&E, deferred rev, ARR): Begin = prior End + inflows − outflows.
- [ ] B5 **ARR/MRR bridge**: Begin + New + Expansion − Contraction − Churn = End; miesięcznie; reconcile do przychodu P&L.
- [ ] B6 **Unit-economics** (CAC, LTV gross-margin-adjusted, LTV:CAC, CAC payback) per segment.
- [ ] B7 **SaaS KPI** (NRR, Rule of 40, burn multiple, magic number, CAC payback).
- [ ] B8 **Break-even / runway** (okres EBITDA+ i miesiąc wyczerpania skumulowanej gotówki).
- [ ] B9 **Valuation range** z 3 metod (DCF + mnożniki porównawcze ARR/revenue + VC method) jako pasmo z cross-checkiem; terminal value flagowany gdy >~75-90% EV (early-stage).
- [ ] B10 **Zero circular references** (pętla odsetki↔finansowanie bez circularity).
- [ ] B11 Scenariusze **base/bull/bear** z jednego zestawu założeń przez udokumentowane delty (opcjonalnie probability-weighted First-Chicago); base = konserwatywny.
- [ ] B12 **Sensitivity** na top driverach (wzrost, NRR/churn, CAC, discount rate) + swing outputu.
- [ ] B13 **Klasyfikacja input/formula/link** każdej wartości → konsumenci kolorują blue/black/green.
- [ ] B14 **Maszynowy raport walidacji** (każdy check pass/fail + wartość vs benchmark) → appendix defensibility w Word/deck/Excel.

### C. CFO-review — bramka walidacji (przed outputem)
- [ ] C1 BS się bilansuje (Assets = L+E każdy okres) · CF ties to cash.
- [ ] C2 Marże w normach (gross 70-80%+, S&M ~48%, R&D ~23-26%, G&A ~20%, OpEx total 40-50%) — flaga out-of-range.
- [ ] C3 LTV:CAC ≥ 3 · CAC payback w pasmie motion (PLG <12m / sales-assisted 12-18m / enterprise 18-24m) · Rule of 40 ≥ 40.
- [ ] C4 Brak ujemnej gotówki bez modelowanego finansowania; runway jawny.
- [ ] C5 ARR bridge reconciluje do przychodu; valuation cross-checked (nie pojedyncza metoda).
- [ ] C6 Każde założenie sourced/benchmarked; pokrycie scenariuszy base/bull/bear; sensitivity na top driverach.

### D. BundleOrchestrator — spójność wielowątkowa
- [ ] D1 Emituje **jeden wspólny SPINE** (thesis, rejestr założeń, model finansowy, sekcje, glosariusz) konsumowany przez B4+B3+B1.
- [ ] D2 **Tabela finansowa = single source of truth**; raport i deck POBIERAJĄ każdą liczbę, nie re-autorują.
- [ ] D3 **Identyczność hero-numbers** wszędzie (TAM/SAM/SOM, przychód, EBITDA, LTV:CAC, payback, ask).
- [ ] D4 **Wspólny glosariusz** — jedno pojęcie = jedna nazwa we wszystkich 3 (segmenty, produkt, metryki).
- [ ] D5 **Parytet section↔slide↔table** — każda sekcja ma slajd i (gdy liczbowa) blok tabeli; zero orphan claims.
- [ ] D6 **Jedna teza nadrzędna** raz, reużyta w exec summary + slajd-purpose + summary modelu.
- [ ] D7 **Pass walidacji spójności** przed outputem: parytet, zgodność liczb, zgodność terminologii, brak sprzeczności cross-doc.

### E. Narracja/struktura (konsultanci)
- [ ] E1 Pełny **kanon sekcji** (exec summary→problem→solution→market→model→GTM→competition/moat→traction→financials→unit-econ→team→risks→ask/use-of-funds→roadmap); exec summary zawsze pierwszy, answer-first (teza+hero+ask).
- [ ] E2 Każda sekcja otwiera **SCQA**; każdy tytuł = **action-title** (zdanie-„so-what"); test title-read-through walidowany.
- [ ] E3 Sekcje **MECE**, punkty ≤3-4 per węzeł.
- [ ] E4 Deck = **kanon Sequoia/YC 10-14 slajdów** mapowany 1:1 do sekcji; oznacza slajdy **table-reuse** (market/model/traction/financials/ask) vs **product-graphic** (purpose/solution/product).
- [ ] E5 Najmocniejszy **hero-fact** może prowadzić deck (konfigurowalny front-load traction); jedna myśl/slajd.

## 3. Definicja Done (consultant-grade gate)
Generator zdaje, gdy: wszystkie A-E `[x]`, CFO-review zielony na przykładzie DBR77, hero-numbers identyczne w 3 artefaktach (auto-test), title-read-through narratywny, defensibility-appendix z source+range+sensitivity, scenariusze base/bull/bear, eksport .docx/.xlsx/.pptx z zachowaniem spójności.

## 4. Plan realizacji (etapy) — STATUS 2026-06-23 (build nocny)
- **F1 — SPINE + AssumptionsModel ✅** — `businessPlanSpine.ts` (typ SoT) + `assumptionsModel.ts` (LLM brief→założenia z driver-tree/TAM-SAM-SOM/source-range-sensitivity + walidatory anty-wzorców A9). Commit `a11c52d79b`, `95fc3a7bd1`.
- **F2 — FinancialEngine ✅** — `financialEngine.ts`: 3-statement bilansujący tożsamościowo, ARR bridge, unit-econ, KPI, scenariusze base/bull/bear, wycena DCF+comps+VC, dźwignia operacyjna (krzywa J), CFO-review deterministyczny z twardym gate fundowalności (LTV:CAC≥3, Rule40). **11/11 testów.** Commit `cd2b701af2`.
- **F3 — BundleOrchestrator ✅** — `bundleOrchestrator.ts`: `buildSpine` (hero-number identity, kanon 14 sekcji, coherence gate), `generateBusinessPlan` z **pętlą naprawczą** (CFO-review fail→re-prompt z preskryptywnym feedbackiem). **8/8 testów** (kluczowy: hero-number identyczny w tabeli/raporcie/decku). Commit `95fc3a7bd1`, `c84093d638`.
- **F4 — Generatory honor SPINE ✅(częściowo)** — `spineToDeck/Doc/Table` mapują SPINE→wejścia B1/B3/B4; `spineToDocPlan` buduje plan raportu DETERMINISTYCZNIE z SPINE (omija flaky `planDocumentStructure`). Dowód E2E: `scripts/deliverables/_dbr77-from-brief.mts` (brief→spójna wiązka). 🟡 zostaje: deck auto-render grafik z briefów + PPTX honor composition.
- **F5 — Eksport wiązki 🟡** — XLSX z SPINE zrobiony (`tableSchemaToWorkbook`→`buildWorkbookBuffer`→realny .xlsx z CF). DOCX/PPTX: content/deck gotowe, render do pliku idzie przez istniejącą warstwę live-route (materializeDocumentArtifact / PptxExportService) — wpięcie SPINE→ta warstwa = następny slice (nie przepinane na ryzyko w nocy).
- **Flaga:** całość za `ENABLE_DELIVERABLES_PREMIUM` (OFF=byte-identyczne); niewpięte w route; PROD nietknięty; staging→odbiór→prod osobno.

## 5. Dowód działania (DBR77 z briefu)
`scripts/deliverables/_dbr77-from-brief.mts` → `docs/qa/deliverables/runs/2026-06-23-DBR77-from-brief.{md,json}` + `.xlsx`. Łańcuch: brief (free text) → LLM autoruje obronne założenia → CFO-review + pętla naprawcza → SPINE (passing) → karmi B4/B3/B1 z identycznymi hero-numbers. Testy: 194/194 deliverables zielone, tsc czysty.
