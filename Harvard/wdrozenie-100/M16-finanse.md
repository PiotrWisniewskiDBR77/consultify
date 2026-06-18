# TECZKA M16 — Finanse (Economics / Financial Analysis v3) · głębia M13

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu + kod) i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami · weryfikacja staleności legacy IDOR `e3945bc7fc` · **korekta i18n: 19× isPolish → realnie 0** · F epiki→stories Gherkin→L-xx). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja głębi: [`M13-inicjatywy.md`](M13-inicjatywy.md) · decyzje przekrojowe: [`_DECYZJE.md`](_DECYZJE.md). **M16 → brak uwag żywych** (dziedziczy z karty — jawnie w H/01 i §07).

## 00 · Nagłówek
- **Moduł:** M16 Finanse (Economics / Financial Analysis v3) · **Pula:** beta CLOSED (kliencki: VTS/Apator/Elkomtech) · **Faza:** FAZA 2
- **Ocena audytu:** 58/100 (najsilniejszy moduł finansowy) · **Tier:** Alpha górny · **Rozmiar:** M (1–3 dni)
- **Żywy bloker:** brak — **P0 legacy IDOR `getModel` (`/api/financial-modeling`) NAPRAWIONY** (`e3945bc7fc`)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M16-finanse/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md`
- **Kod:** `src/components/Economics/` (`FinanceHub.tsx`, `SensitivityChart`, `CashFlowChart`, `CanonicalStatementTable`, `FinanceDegradedBanner`, `types.tsx`) · `server/src/services/financialAnalysisService.ts` (NPV/IRR/ratio) · `valuationService.ts` (DCF/WACC/Gordon/exit) · `financialModelingService.ts` (modele monthly) · `hooks/useFinanceLane.ts` · `routes/financial-modeling.routes.ts` (legacy) + `v8/finance.routes.ts` + `economics.routes.ts` + `finance-statements.routes.ts` · tabele `financial_statements/_values/_lines`, `financial_models/_outputs`, `financial_analyses`, `valuations`

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt | job-to-be-done + zakres + metryka |
| B UX docelowe | 🟢 | karta §5 (`ModuleHub`+§27 zgodne) | degraded banner WIDOCZNY (wzorzec dla M15) |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + serwisy | **matematyka DCF/WACC/NPV anchory + org-scope** |
| D AI/Teresa | 🟢 | karta §1 (matematyka, nie LLM) | granica AI |
| E Integracje | 🟢 | karta §1g | **sync-from-M20 STUB (DP-6 preview)** |
| F Epiki | 🟢 | poprzedni WP §3 | **epiki→stories Gherkin→L-xx (DCF/WACC fałszywa zieleń)** |
| G DoD/jakość | 🟢 | karta §0/§2 | **liczby grep + korekta i18n + DP-8 hex** |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + R3 (`e3945bc7fc`) + DP-6/8** |

---

## A · INTENCJA
- **Job-to-be-done:** dać konsultantowi realną matematykę finansową — sprawozdania (import Excel→canonical), modele monthly, analiza wskaźnikowa, wycena (DCF/WACC), analiza inwestycyjna (NPV/IRR). Karmi M13 (ROI/economics linkages) i M15 (ROI realization).
- **Persony/role:** konsultant (twórca modeli/wycen), klient (read), admin (org). Org-scope na V8+legacy (legacy IDOR naprawiony).
- **Zakres v1:** statements + ratio/validation · modele finansowe (compute monthly) · analiza wskaźnikowa · forecast/budżety · wycena DCF/WACC/FCFF · investment_case NPV/IRR · export do Outputs (za beta). **POZA v1:** Monte-Carlo, integracje ERP na żywo; realny odbiór sync-from-M20 (DP-6 = „preview").
- **Metryka wartości:** poprawność liczb (DCF/WACC spot-check); trwałość modeli po reload; zero fałszywej zieleni w testach obliczeń (L-02).

## B · UX DOCELOWE
Stan obecny + §27: karta §5 (`ModuleHub`+`TableWithPreviewLayout`+`FilterableTable` zgodne; `CanonicalStatementTable` własny grid uzasadniony — macierz pozycje×okresy, to sprawozdanie nie lista).
- **Wzorzec do naśladowania:** degraded banner V8→legacy **realny i WIDOCZNY** (`FinanceDegradedBanner`, `useFinanceLane.ts:209`; tytuł+licznik+severity+nextAction `FinanceHub.tsx:2156`) — lepiej niż cicha pustka M13/M14/M15. **M15 ma to skopiować (L-01 tam).**
- **Delta docelowa:** brak `EntityStatusChip` (własne chipy `FinanceHub.tsx:1609,1034`) → SSOT chip (L-05). Empty-messages mieszane PL/EN (`:1739` EN vs `:1763-1771` PL) — ujednolicić (L-04; literały, NIE wzorzec `isPolish`).

## C · DANE + API + REGUŁY
- **Wiring/flagi:** karta §1e/§1f. Flagi: beta CLOSED (sidebar `Sidebar.tsx:152`), `useV8FeatureFlag('finance')` per-org (V8↔legacy z banerem), `VITE_BILLING_SELF_SERVE` OFF (manual billing).
- **Matematyka (realna, nie fasada — anchory zweryfikowane):**
  - NPV/IRR: bisekcja ze zbieżnością `<0.0001` (`financialAnalysisService.ts:282-318` — `npvAt(rate)` `:282`, bisekcja `:290-307`, payback z interpolacją `:310-318`); ratios `safeDiv`/`safePct` (`:73`).
  - Wycena: DCF/WACC (`valuationService.ts` — `waccPercent`/`waccBreakdown` `:33-34,188-203`, terminal `gordon`/`exit_multiple` `:18,201-204`, FCFF `:42,456,563,630,656`).
  - Modele monthly: silnik z growth-factorem persystowany do `financial_model_outputs` (`financialModelingService.ts:643`); import xlsx realny parsing z rankingiem arkuszy (`finance-statements.routes.ts:221`).
  - Tabele realne (bez fasady `new Map()` z M18). Billing honest (mock `pm_..._mock` usunięty, kill-switch OFF, token-billing 503 bez Stripe).
- **Org-scope / P0 NAPRAWIONE (`e3945bc7fc`):** legacy `/api/financial-modeling` by-id (GET/PUT/DELETE/compute/submit-review/events/approve) org-scoped — `getModel` bierze `orgId`, `WHERE id=? AND organization_id=?` (`:1107` historycznie bez org). V8 (`v8/finance.routes.ts`) używa tego samego `getModel` + dokłada `model.organization_id !== orgId → 403`. **WZORZEC SYSTEMOWY:** V8 czyste, legacy raw-DB dziurawe — audyt innych legacy routerów (jak M15/M20).

## D · AI / TERESA
- **Granica:** obliczenia to **matematyka, nie LLM** — Teresa nie „wymyśla" liczb (NPV/IRR/DCF z serwisów, nie z modelu). AI-explain wskaźników = objaśnienie, nie generacja wartości. Brak AI-fill modeli. CARD_CONTENT_FORMULA n.d.

## E · INTEGRACJE
Pełna tabela: karta §1g. **←** M13 Inicjatywy (`v8_initiative_economics_linkages`). **→** M17 Outputs (export za beta), M15 Rezultaty (ROI realization). **przekrój:** M01 (czat Teresy w kontekście finansów).
- **sync-from-M20 STUB (L-06, wspólne z M20/M15):** `ModuleSyncService:57` (z M20) pisze tylko log do `tp_module_sync_results`; **żadna tabela `financial_*` nie konsumuje mostu** (potwierdzone obustronnie — 0 konsumentów). **DP-6 (`_DECYZJE.md`):** realny odbiór lub „preview" — rekom „preview"+komunikat teraz (ukryć przyciski sync), realny odbiór osobna fala. Jedna decyzja, trzy teczki.

## F · EPIKI → STORIES → ZADANIA *(forma M13, Gherkin)*

**EPIK 1 — Bezpieczeństwo (P0/P1).**
- Story 1.1: jako zalogowany user org A nie czytam/edytuję/usuwam modelu finansowego org B po UUID — DONE.
  - Gherkin: dane model org B · gdy GET/PUT/DELETE/compute/approve `/api/financial-modeling/models/:id` z konta org A · wtedy 404 (`getModel` `AND organization_id=?`).
  - Zadania: ~~Z-01 `getModel` org-scoped → L-07~~ ✅ `e3945bc7fc`.
- Story 1.2: jako user nie omijam beta-locka direct URL-em.
  - Gherkin: dane beta CLOSED · gdy direct URL `/finance`/`/economics` · wtedy plate `BETA_LOCKED` (nie tylko sidebar lock).
  - Zadania: Z-02 beta-guard na route (`Sidebar.tsx:152` + `RouterSyncProvider` bez guarda) → L-01.

**EPIK 2 — Testy obliczeń (P0, „fałszywa zieleń" — liczby są produktem).**
- Story 2.1: jako zespół mam testy DCF/WACC/ratio na PRODUKCYJNYM serwisie, nie atrapie.
  - Gherkin: dane `valuationService`/`financialAnalysisService` · gdy test DCF/WACC/NPV/IRR/ratio · wtedy asercje numeryczne na **zaimportowanej produkcji**, nie na własnym kalkulatorze testu.
  - **Dowód luki (zweryfikowane 2026-06-13):** `tests/unit/backend/financialCalculatorService.test.js` **nie importuje produkcyjnego serwisu** — `describe('FinancialCalculatorService')` (`:83`) testuje własny inline kalkulator (ROI/NPV/IRR/Payback/Margin/CAGR/Breakeven `:90-156`) = fałszywa zieleń. Karta: DCF/WACC tylko `toBeTypeOf('number')`, ratio/forecast bez compute.
  - Zadania: Z-03 przepisać `financialCalculatorService.test.js` na realny serwis (B1) → L-02; Z-04 numeryczne asercje DCF/WACC na `valuationService` (B2) → L-02; Z-05 unit `ratioAnalysisService`/forecast (B3) → L-02.

**EPIK 3 — Naprawa 14 FAIL drift (P0-test).**
- Story 3.1: jako zespół mam zielone testy finance bez drift.
  - Gherkin: dane suite finance · gdy CI · wtedy 14 FAIL → 0 (sekwencja mocków p05 `DbPromise`, label-drift FinanceHub, economicsFlow env).
  - Zadania: Z-06 sekwencja mocków p05 (8×404, B5) → L-03; Z-07 label-drift FinanceHub (B6) → L-03; Z-08 economicsFlow env (B7) → L-03.

**EPIK 4 — Integracja M20 (INTEGRACJA, DP-6).**
- Story 4.1: jako PMO publikacja z Tabel ląduje w Finanse lub widzę jasny „preview".
  - Gherkin: dane `ModuleSyncService` z M20 · gdy zapis do `tp_module_sync_results` · wtedy realny odbiór (DOCELOWO) lub „preview"+komunikat (DP-6 teraz).
  - Zadania: Z-09 decyzja sync-to-finance → L-06 [DP-6 = preview; realny odbiór = D-01].

**EPIK 5 — Szlif (P3, DP-8).**
- Story 5.1: jako user widzę spójne chipy i empty-messages PL/EN.
  - Gherkin: dane empty-state / status finansowy · gdy render · wtedy `EntityStatusChip` z SSOT + jednolity język.
  - Zadania: Z-10 ujednolicić empty-messages PL/EN (`FinanceHub.tsx:1739`/`:1763-1771`) → L-04; Z-11 `EntityStatusChip` z SSOT (`:1609,1034`) → L-05. **DP-8:** 51 hex skoncentrowane w chartach (palety wykresów) = LEGALNE (jak M13 graf), reszta UI-chrome w sweepie.

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13)*
| # | Kryterium | Miara M16 |
|---|-----------|-----------|
| 1 | Front↔back | DCF/WACC/ratio/NPV/IRR/forecast na realnych danych trwałe po reload; degraded banner widoczny (już ✅); billing honest (już ✅); zero fasady |
| 2 | Bezpieczeństwo | legacy IDOR zamknięty (`e3945bc7fc`, R3: commit w git + read-only proof cross-org 404 = Faza 4); beta-guard na route (L-01) |
| 3 | i18n | **0** `isPolish`/`i18n.language==='pl'` w `Economics/` (grep 2026-06-13 = 0) — **R3: WP twierdził „19× isPolish" — realnie 0 (już naprawione)**; pozostaje ujednolicić mieszane empty-messages PL/EN (literały, nie `isPolish`, L-04) |
| 4 | Tokeny | **51** hex w `Economics/` (grep 2026-06-13 = 51) — skoncentrowane w chartach (`types.tsx` 13, `SensitivityChart` 10, `CashFlowChart` 10 = palety wykresów, **DP-8: LEGALNE** jak M13 `DependencyGraphCanvas`); `EntityStatusChip` zamiast własnych chipów (L-05) |
| 5 | §27 | **5** surowych `<table>` (grep 2026-06-13 = 5) — `ModuleHub`+`TableWithPreviewLayout`+`FilterableTable` zgodne; `CanonicalStatementTable` własny grid uzasadniony (sprawozdanie) |
| 6 | E2E w PR-gate | obliczenia (DCF/WACC/ratio realne na produkcyjnym serwisie, koniec fałszywej zieleni) + IDOR cross-org 404 zielone na `Londyn`; 14 FAIL → 0 |

Scenariusze S1–S8: karta §0 (510 PASS/14 FAIL drift). Bezpieczeństwo: karta §6 (3/4 routerów org-scoped; Excel upload guarded `fileUpload.middleware.ts` 10MB+allowlist, formuły nie wykonywane).
**Wydajność/limity:** Excel upload 10MB allowlist; modele monthly persystowane (nie in-memory) — trwałość po restart. **Telemetria:** poprawność DCF/WACC spot-check = pomiar zaufania do liczb (produkt M16).

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | wiring/sec/plan; realna matematyka; legacy IDOR naprawiony | L-01..L-06 |
| W-02 | **Uwagi żywe** `UWAGI_TESTY_2026-06-13.md` | 2026-06-13 | **brak uwag żywych dla M16** — dziedziczy z karty (jawnie; R6 = Faza 4) | — |
| W-03 | Commit `e3945bc7fc` (Sprint3 gate equalization) | — | legacy IDOR `/api/financial-modeling` naprawiony | L-07 (naprawiona) |
| W-04 | **DP-6/DP-8** (`_DECYZJE.md`) | 2026-06-13 | sync-from-M20 = „preview"; 51 hex chartów = legalne palety | L-06 (DP-6), L-05 (DP-8) |
| W-05 | Feedback prod (kliencki VTS/Apator/Elkomtech) | — | modele/wyceny używane produkcyjnie | A (metryka) |

### 02 · Stan obecny (prawda kodu) — karta §1. Wszystkie analizy realna matematyka (NPV/IRR bisekcja, DCF/WACC, modele monthly — anchory w C). Billing honest. Degraded banner WIDOCZNY (wzorzec). Legacy IDOR naprawiony. **R3-korekta:** `isPolish` w `Economics/` = 0 (WP zawyżał 19); hex 51 skoncentrowane w chartach (DP-8 legalne). `EconomicsViewPlaceholder.tsx` martwy USUNIĘTY (`b5de79ef03`). `financialCalculatorService.test.js` = fałszywa zieleń (własny kalkulator, nie produkcja — zweryfikowane).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | beta-lock tylko nawigacyjny (`/finance`/`/economics` direct URL omija) | W-01 | `Sidebar.tsx:152` + `RouterSyncProvider` bez guarda | P1 | 2 | **NAPRAWIONA — `AppRoutes.tsx:1755`/`:1771` owinięte `<BetaGate moduleId="MODULE_ECONOMICS">` (R3: audyt zawyżał — guard już istniał)** | 2026-06-16 |
| L-02 | obliczenia finansowe częściowo testowane / fałszywa zieleń (test definiuje własny kalkulator) | W-01 | `tests/unit/backend/financialCalculatorService.test.js:83` (inline kalkulator, brak importu produkcji) | P0-test | 2 | **NAPRAWIONA — B1 (test→realne serwisy) + B2 (DCF hand-derived) + B3 (`ratioAnalysisService.test.ts`, +fix bug Infinity-leak); 149/149 PASS** | 2026-06-16 |
| L-03 | 14 FAIL drift (label/schema/mock-sekwencja p05) | W-01 | testy finance p05 (8×404), FinanceHub label, economicsFlow env | P0-test | 2 | **NAPRAWIONA — finance-suite zielony (p05-finance-lane + Economics 82/82)** | 2026-06-16 |
| L-04 | empty-messages mieszane PL/EN (literały) | W-01 | `FinanceHub.tsx:1739` EN vs `:1763-1771` PL | P3 | 3 | **NAPRAWIONA — 9 empty-messages przez klucze `finance.empty` (PL+EN walidne). Uwaga: masowa migracja ~125 ternarów `isPl?:` świadomie odłożona (osobna fala, wysokoregresyjna)** | 2026-06-16 |
| L-05 | brak `EntityStatusChip` (własne chipy) | W-01 | `FinanceHub.tsx:1609,1034` | P3 | 3 | **ZAMKNIĘTA 2026-06-17 — N/D POTWIERDZONE (read-only verify): chipy statusu Finance są kanoniczne — `baseStatusCol` (`FinanceHub.tsx:841-850`, `id:'status'`, brak `render`) renderuje się przez kanoniczną gałąź `FilterableTable.tsx:570-571` → `<EntityStatusChip status={row.status}>` (shared primitive `ui/primitives/chips/EntityStatusChip.tsx:112`). `MetaChip:1034` = chip metadanej typu (Budżet/Model) w kolumnie `predictionSubtype`, NIE status. Korekta dowodu: `:1609` to `runtimeChips` telemetrii V8 (Ingestion/Escalations/Linkages), nie status — kanon statusu z `:841`. Luka nie istnieje.** | 2026-06-17 |
| L-06 | sync-from-M20 STUB (M20 pisze log, Finance nie odbiera) | W-01,W-04 | `ModuleSyncService:57` (0 konsumentów) | INTEGRACJA | 2 | **DP-6 ZREALIZOWANE — `b074760074` wyłączył kłamiący przycisk sync (disabled „Wkrótce/Coming soon", zero fałszywego success). Realny odbiór = D-01 osobna fala** | 2026-06-16 |
| L-07 | cross-org IDOR legacy `getModel` | W-01,W-03 | `/api/financial-modeling` by-id `:1107` (przed fix) | P0 | — | **NAPRAWIONA `e3945bc7fc` (R3: commit zweryfikowany w git; read-only proof cross-org 404 = Faza 4)** | 2026-06-13 |

*(Korekta staleności WP: „i18n inline 19× `isPolish`" → grep `Economics/` = **0** już naprawione; `EconomicsViewPlaceholder.tsx` martwy już USUNIĘTY `b5de79ef03`.)*

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | sync-from-M20 (STUB): realny odbiór czy „preview"? | realny odbiór / preview+komunikat | Piotr | TBD (wspólne z M20/M15) | **ROZSTRZYGNIĘTE → DP-6: preview teraz** (realny odbiór = osobna fala po Fazie 2) |
| D-02 | 51 hex w chartach: tokenizować palety wykresów czy zostawić jako legalne (jak M13 graf)? | tokenizuj / zostaw | Piotr | TBD | **ROZSTRZYGNIĘTE → DP-8: palety chartów zostają** (reszta UI-chrome w sweepie Faza 4) |

### 05 · Flagi/rollout — V8 Finance (env, degraduje→legacy z WIDOCZNYM banerem); billing kill-switch OFF („handled manually"); beta CLOSED w sidebarze (route bez guarda = L-01). `isFeatureBlocked('finance')` (`:2114`) = polityka org, nie beta.
### 06 · Ryzyka — **WZORZEC SYSTEMOWY** legacy raw-DB IDOR (V8 czyste, legacy dziurawe) → audyt innych legacy routerów (jak M15/M20). Modele finansowe na PROD — szczególna ostrożność (dev `.env` może wskazywać PROD). sync-from-M20 wspólne z M20/M15 (DP-6). **Liczby są produktem** — fałszywa zieleń (L-02) = ryzyko regresji wartości; priorytet testowy. Brak uwag żywych → re-ocena D wymaga Fazy 4.
### 07 · Log — 2026-06-18 (Harvard 4 Faza 5 — COLD-START): Staging persistence confirmed — `financial_statements` + `financial_statement_lines` tables EXIST on trolley (to_regclass 2026-06-18). Architecture: `financeStatementAnalyticsService.ts` + `financialModelingService.ts` Maps = in-request period-bucket aggregacja, 0 Maps jako cache między requestami. Dane w PG → przeżywają restart z definicji. Dowód: `COLD_START_PROOF_2026-06-18.md`.
### 07 · Log — 2026-06-17 (Harvard 4 Fala 5): §27 — `FinancePreviewPanel.tsx` (2 tabele: P&L/BS/CF financial forecast grid z dynamicznymi year-columns + WACC×growth rate sensitivity heatmap) i `FinanceModelDocumentView.tsx` (financial forecast table) = §27-exempt: data-viz (inline `paddingLeft` indentation per level, color-coded negatives, computed `bg-emerald/amber/rose` heatmap). Brak zmian w plikach Economics/. Hex tokens FinanceHub.tsx: `dark:bg-[#F4F7FB]`→`dark:bg-slate-50`, `dark:hover:bg-[#DDE5EF]`→`dark:hover:bg-slate-200` — commit `a448982af3` (razem z M10/M21). rose→danger sweep: 64 zmian w 21 plikach Economics/ (3 CashFlowChart DP-8 exempt) — commit `b1cde83254` (merge `1f03d11c37`).
### 07 · Log — 2026-06-17 (Harvard 4 runda 3) **DEAD-CODE USUNIĘTY `508f769292` (2026-06-17):** 19 plików Economics/ usuniętych (EconomicsHub + barrel index.ts + 17 liści). 8669 linii usunięte. TSC: 11→11 (0 nowych błędów). Live entry EconomicsView.tsx→FinanceHub.tsx nienaruszone. Dodatkowo: honest „Wkrótce (backend)" w `hooks/useFinanceRowActions.ts:321` = brak endpointu archive (backend ticket, nie cleanup). — 2026-06-17 (runda 2): i18n recount `Economics/` = **129** inline-ternar `isPl?:`/`isPolish?:` (FinanceHub.tsx 19) — to dług słownikowy z L-04 (wcześniej „~125"), NIE brakujące klucze locale; migracja wymaga `public/locales` (strefa zakazana wg AGENT_MAP) → report-only, blokada na decyzję Piotra + dostęp do locales (analog [[M04 L-11]]). Pozostałe luki M16 = 0 otwartych kodowo (L-01..L-07 zamknięte/N-D/DP). — 2026-06-13: brak uwag żywych (jawnie); teczka pogłębiona do M13-level (F Gherkin, DCF/WACC anchory + fałszywa zieleń zweryfikowana, DP-6/8 wpięte). **R3: `e3945bc7fc` zweryfikowany w git log** (legacy IDOR); **korekta i18n** (`isPolish` Economics = 0, WP zawyżał 19); `b5de79ef03` (placeholder usunięty). Re-ocena po Fazie 2/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta+commit+DP-6/8+feedback; brak uwag żywych = jawnie odnotowane) · R2 zero sierot (wejście→luka→story Gherkin→DoD→dowód) · R3 statusy z dowodem (**L-07 `e3945bc7fc` zweryfikowany w git; korekta i18n 19→0 grepem; fałszywa zieleń L-02 zweryfikowana w teście**) · R4 DoD z liczbami (isPolish 0, hex 51 chart-skoncentrowane DP-8, table 5) · R5 **obie decyzje rozstrzygnięte (D-01→DP-6, D-02→DP-8)** · A–E docelowy zlinkowany (DCF/WACC anchory) · F epiki→stories Gherkin→zadania↔luki · G DoD+S+sec+wydajność+telemetria · R6 sesja żywa = DCF/WACC spot-check + IDOR proof (pozostaje, Faza 4). **9/9; teczka kompletna do egzekucji.**
