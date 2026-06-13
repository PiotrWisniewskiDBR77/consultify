# TECZKA M16 — Finanse (Economics / Financial Analysis v3)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu + kod) i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami · weryfikacja staleności legacy IDOR `e3945bc7fc` + **korekta i18n: 19× isPolish → realnie 0**). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · format: [`M13-inicjatywy.md`](M13-inicjatywy.md). **M16 → brak uwag żywych** (dziedziczy z karty).

## 00 · Nagłówek
- **Moduł:** M16 Finanse (Economics / Financial Analysis v3) · **Pula:** beta (kliencki: VTS/Apator/Elkomtech) · **Faza:** FAZA 2
- **Ocena audytu:** 58/100 (najsilniejszy moduł finansowy) · **Tier:** Alpha górny · **Rozmiar:** M (1–3 dni)
- **Żywy bloker:** brak — **P0 legacy IDOR `getModel` (`/api/financial-modeling`) NAPRAWIONY** (`e3945bc7fc`)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-XX · teczka 2026-06-13
- **Karta:** `Harvard/modules/M16-finanse/KARTA_AUDYTU.md`
- **Kod:** `src/components/Economics/` (`FinanceHub.tsx`, `SensitivityChart`, `CashFlowChart`, `CanonicalStatementTable`) · `server/src/services/financialAnalysisService.ts` · `valuationService.ts` · `financialModelingService.ts` · `useFinanceLane.ts` (`FinanceDegradedBanner`) · tabele `financial_statements/_values/_lines`, `financial_models/_outputs`, `financial_analyses`, `valuations`

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt | job-to-be-done + zakres |
| B UX docelowe | 🟢 | karta §5 (`ModuleHub`+§27 zgodne) | degraded banner (już WIDOCZNY — wzorzec) |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + serwisy | skrót obliczeń + org-scope |
| D AI/Teresa | 🟢 | karta §1 (matematyka, nie LLM) | granica AI |
| E Integracje | 🟢 | karta §1g | sync-to-finance STUB (M20) |
| F Epiki | 🟢 | poprzedni WP §3 | przeformułowane |
| G DoD/jakość | 🟢 | karta §0/§2 | **liczby grep + korekta i18n** |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + R3 (`e3945bc7fc`)** |

---

## A · INTENCJA
- **Job-to-be-done:** dać konsultantowi realną matematykę finansową — sprawozdania (import Excel→canonical), modele monthly, analiza wskaźnikowa, wycena (DCF/WACC), analiza inwestycyjna (NPV/IRR).
- **Persony/role:** konsultant (twórca modeli/wycen), klient (read), admin (org). Org-scope na V8+legacy.
- **Zakres v1:** statements + ratio/validation · modele finansowe (compute monthly) · analiza wskaźnikowa · forecast/budżety · wycena DCF/WACC/FCFF · investment_case NPV/IRR · export do Outputs. **POZA v1:** zaawansowane symulacje Monte-Carlo, integracje ERP na żywo.
- **Metryka:** poprawność liczb (DCF/WACC spot-check); trwałość modeli po reload.

## B · UX DOCELOWE
Stan obecny + §27: karta §5 (`ModuleHub`+`TableWithPreviewLayout`+`FilterableTable` zgodne; `CanonicalStatementTable` własny grid uzasadniony — sprawozdanie).
- **Wzorzec do naśladowania:** degraded banner V8→legacy **realny i WIDOCZNY** (`FinanceDegradedBanner`, `useFinanceLane.ts:209`) — lepiej niż cicha pustka M13/M14/M15. **M15 ma to skopiować.**
- **Delta docelowa:** brak `EntityStatusChip` (własne chipy `FinanceHub.tsx:1609,1034`) → SSOT chip (L-05). Empty-messages mieszane PL/EN (`:1739` EN vs `:1763-1771` PL) — ujednolicić (L-04).

## C · DANE + API + REGUŁY
- **Wiring/flagi:** karta §1e/§1f. Wszystkie analizy = **realna matematyka** (NPV/IRR bisekcja <0.0001 `financialAnalysisService.ts:264-318`; ratios safeDiv `:560`; DCF/WACC/Gordon/exit `valuationService.ts`; modele monthly `financialModelingService.ts:643`; import xlsx `finance-statements.routes.ts:221`). Tabele realne (bez fasady `new Map()`). Billing honest (mock usunięty, kill-switch OFF, token-billing 503 bez Stripe).
- **Org-scope / P0 NAPRAWIONE (`e3945bc7fc`):** legacy `/api/financial-modeling` by-id (GET/PUT/DELETE/compute/submit-review/events/approve) org-scoped (`WHERE id=? AND organization_id=?`). **WZORZEC SYSTEMOWY:** V8 czyste, legacy raw-DB dziurawe — audyt innych legacy routerów.

## D · AI / TERESA
- **Granica:** obliczenia to **matematyka, nie LLM** — Teresa nie „wymyśla" liczb. AI-explain wskaźników to objaśnienie, nie generacja wartości. (Brak AI-fill modeli.)

## E · INTEGRACJE
Pełna tabela: karta §1g. **←** M13 Inicjatywy (`v8_initiative_economics_linkages`). **→** M17 Outputs (export za beta). **sync-to-finance STUB:** `ModuleSyncService:57` (z M20) pisze tylko log do `tp_module_sync_results`; **żadna tabela `financial_*` nie konsumuje mostu** (potwierdzone obustronnie) — decyzja: realny odbiór lub „preview" (L-06, wspólne z M20).

## F · EPIKI *(z poprzedniego WP §3)*
- **EPIK 1 — Bezpieczeństwo:** beta-guard na `/finance`/`/economics` → plate `BETA_LOCKED` (L-01).
- **EPIK 2 — Testy obliczeń (P0):** przepisać `financialCalculatorService.test.js` na realny serwis (B1); numeryczne asercje DCF/WACC (B2); unit `ratioAnalysisService`/forecast (B3) — domyka „fałszywą zieleń" w module, gdzie liczby są produktem (L-02).
- **EPIK 3 — Naprawa 14 FAIL drift:** sekwencja mocków p05 (B5), label-drift FinanceHub (B6), economicsFlow env (B7) (L-03).
- **EPIK 4 — Integracja M20:** decyzja sync-to-finance (L-06).
- **EPIK 5 — Szlif:** ujednolicić empty-messages PL/EN (L-04); `EntityStatusChip` z SSOT (L-05).

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13)*
| # | Kryterium | Miara M16 |
|---|-----------|-----------|
| 1 | Front↔back | DCF/WACC/ratio/NPV/IRR/forecast na realnych danych trwałe po reload; degraded banner widoczny (już); billing honest (już); zero fasady |
| 2 | Bezpieczeństwo | legacy IDOR zamknięty (`e3945bc7fc`, z testem cross-org); beta-guard na route |
| 3 | i18n | **0** `isPolish`/`i18n.language==='pl'` w `Economics/` — **R3: WP twierdził „19× isPolish" — realnie 0 (już naprawione)**; pozostaje ujednolicić mieszane empty-messages PL/EN (literały, nie `isPolish`) |
| 4 | Tokeny | **51** hex w `Economics/` — skoncentrowane w chartach (`types.tsx` 13, `SensitivityChart` 10, `CashFlowChart` 10 = palety wykresów, jak M13 `DependencyGraphCanvas`); `EntityStatusChip` zamiast własnych chipów |
| 5 | §27 | **5** surowych `<table>` — `ModuleHub`+`TableWithPreviewLayout`+`FilterableTable` zgodne; `CanonicalStatementTable` własny grid uzasadniony (sprawozdanie) |
| 6 | E2E w PR-gate | obliczenia (DCF/WACC/ratio realne) + IDOR cross-org 404 zielone na `Londyn`; 14 FAIL → 0 |

Scenariusze S1–S8: karta §0. Bezpieczeństwo: karta §6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | karta | wiring/sec/plan | L-01..L-06 |
| W-02 | **Uwagi żywe** | 2026-06-13 | **brak uwag żywych dla M16** (dziedziczy z karty) | — |
| W-03 | Commit `e3945bc7fc` (Sprint3 gate equalization) | — | legacy IDOR `/api/financial-modeling` naprawiony | L-07 (naprawiona) |
| W-04 | Feedback prod (kliencki VTS/Apator/Elkomtech) | — | modele/wyceny używane produkcyjnie | A (metryka) |

### 02 · Stan obecny (prawda kodu) — karta §1. Wszystkie analizy realna matematyka (bez fasady). Billing honest. Degraded banner WIDOCZNY (wzorzec). Legacy IDOR naprawiony. **R3-korekta:** `isPolish` w `Economics/` = 0 (WP zawyżał 19); hex 51 skoncentrowane w chartach (legalne palety).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | beta-lock tylko nawigacyjny (`/finance`/`/economics` direct URL omija) | W-01 | `Sidebar.tsx:152` + `RouterSyncProvider` bez guarda | P1 | 2 | otwarta | — |
| L-02 | obliczenia finansowe częściowo testowane / fałszywa zieleń (test definiuje własny kalkulator) | W-01 | `financialCalculatorService.test.js` | P0-test | 2 | otwarta | — |
| L-03 | 14 FAIL drift (label/schema/mock-sekwencja p05) | W-01 | testy finance p05 | P0-test | 2 | otwarta | — |
| L-04 | empty-messages mieszane PL/EN (literały) | W-01 | `FinanceHub.tsx:1739` EN vs `:1763-1771` PL | P3 | 3 | otwarta | 2026-06-13 |
| L-05 | brak `EntityStatusChip` (własne chipy) | W-01 | `FinanceHub.tsx:1609,1034` | P3 | 3 | otwarta | — |
| L-06 | sync-to-finance STUB (M20 pisze log, Finance nie odbiera) | W-01 | `ModuleSyncService:57` (0 konsumentów) | INTEGRACJA | 2 | **D-01** (wspólne M20) | — |
| L-07 | cross-org IDOR legacy `getModel` | W-01,W-03 | `/api/financial-modeling` by-id (przed fix) | P0 | — | **NAPRAWIONA `e3945bc7fc` (R3: commit zweryfikowany w git; read-only proof cross-org 404)** | 2026-06-13 |

*(Korekta staleności WP: „i18n inline 19× `isPolish`" → grep `Economics/` = **0** już naprawione; `EconomicsViewPlaceholder.tsx` martwy już USUNIĘTY `b5de79ef03`.)*

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | sync-to-finance (M20 STUB): realny odbiór czy „preview"? | realny odbiór / preview+komunikat | Piotr | TBD (wspólne z M20) | otwarta |
| D-02 | 51 hex w chartach: tokenizować palety wykresów czy zostawić jako legalne (jak M13 graf)? | tokenizuj / zostaw | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — V8 Finance (env, degraduje→legacy z WIDOCZNYM banerem); billing kill-switch OFF („handled manually"); beta CLOSED w sidebarze (route bez guarda = L-01). `isFeatureBlocked('finance')` = polityka org, nie beta.
### 06 · Ryzyka — **WZORZEC SYSTEMOWY** legacy raw-DB IDOR (V8 czyste, legacy dziurawe) → audyt innych legacy routerów (jak M15/M20). Modele finansowe na PROD — szczególna ostrożność (dev `.env` może wskazywać PROD). sync-to-finance wspólne z M20.
### 07 · Log — 2026-06-13: teczka; **R3: `e3945bc7fc` zweryfikowany w git log** (legacy IDOR naprawiony); **korekta i18n** (`isPolish` Economics = 0, WP zawyżał 19); `b5de79ef03` (placeholder usunięty). Re-ocena po Fazie 2/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta+commit+feedback; brak uwag żywych = jawnie odnotowane) · R2 zero sierot · R3 statusy z dowodem (**L-07 `e3945bc7fc` zweryfikowany w git; korekta i18n 19→0 grepem**) · R4 DoD z liczbami (isPolish 0, hex 51 chart-skoncentrowane, table 5) · R5 decyzje z właścicielem · A–E docelowy zlinkowany · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = DCF/WACC spot-check + IDOR proof (Faza 4). **Teczka kompletna do egzekucji.**
