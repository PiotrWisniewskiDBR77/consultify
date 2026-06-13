# TECZKA M15 — Rezultaty (Results / Benefits Realization)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu + kod) i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami · weryfikacja staleności obu P0 `91c8245559`). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · format: [`M13-inicjatywy.md`](M13-inicjatywy.md). **M15 → brak uwag żywych** (dziedziczy z karty).

## 00 · Nagłówek
- **Moduł:** M15 Rezultaty (Results / Benefits Realization) · **Pula:** beta (kliencki: VTS/Apator/Elkomtech) · **Faza:** FAZA 2
- **Ocena audytu:** 54/100 · **Tier:** Alpha · **Rozmiar:** M (1–3 dni)
- **Żywy bloker:** brak — **oba P0 (cross-org time-series + RBAC bypass `x-kpi-role`) NAPRAWIONE** (`91c8245559`)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-XX · teczka 2026-06-13
- **Karta:** `Harvard/modules/M15-rezultaty/KARTA_AUDYTU.md`
- **Kod:** `src/components/Results/` (`ResultsHub`, `KpisTableV3`, `ResultsGridView`) · `server/src/services/resultsEnterpriseService.ts` · `kpiRuntime.ts` · tabele `v8_kpi_definitions`, `kpi_time_series`, `v8_roi_realization_entries`, `kpi_financial_mappings`

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt | job-to-be-done + zakres |
| B UX docelowe | 🟢 | karta §5 (KPI 4 tryby) | degraded banner (wzorzec M16) |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + serwisy | skrót obliczeń + org-scope |
| D AI/Teresa | 🟢 | karta §1 (obliczenia, nie generacja) | granica AI |
| E Integracje | 🟢 | karta §1g | sync-to-results dead-end (M20) |
| F Epiki | 🟢 | poprzedni WP §3 | przeformułowane |
| G DoD/jakość | 🟢 | karta §0/§2 | **liczby grep (najzdrowszy i18n)** |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + R3 (`91c8245559`)** |

---

## A · INTENCJA
- **Job-to-be-done:** zmierzyć i rozliczyć WARTOŚĆ wdrożeń — KPI (definicje, time-series, scorecards) i ROI (realization, NPV/payback), z raportami i bramką zatwierdzania.
- **Persony/role:** KPI owner (rola z JWT, nie nagłówek!), konsultant, klient (read scorecards), admin. Approval-gating egzekwowany serwerowo.
- **Zakres v1:** KPI 4 tryby (overview/queue/catalog/scorecards) + time-series + signal sheet · ROI (portfolio summary, ROI Analysis) · Reports 5 trybów + cron + approval gating · showcase/demo-data (jawny toggle). **POZA v1:** automatyczne wnioskowanie benefitów z surowych danych operacyjnych.
- **Metryka:** % inicjatyw z mierzalnym KPI→ROI; zgodność liczb po reload.

## B · UX DOCELOWE
Stan obecny + §27: karta §5. KPI/ROI = **realne obliczenia z realnych tabel** (AVG/COUNT/NPV/payback, bez fasady `new Map()`). Showcase = **wzorcowo bezpieczny** (`shouldUseResultsShowcaseData()` = wyłącznie jawny toggle, „NEVER auto-activate", podstawia tylko gdy realne PUSTE, chip „Showcase data — local").
- **Delta docelowa:** degraded banner V8→legacy **NIE renderowany** (`kpiRuntime.ts:39-74` cicho schodzi na `/api/benefits/*`, `source:'legacy'` nigdzie nie pokazany; chip tylko `'showcase'`; jedyny ślad `console.warn`) — cicha pustka jak M13/M14. Fix: renderować baner `source:'legacy'` (wzorzec M16 `FinanceDegradedBanner`) (L-01).

## C · DANE + API + REGUŁY
- **Wiring/flagi:** karta §1e/§1f. Tabele realne: `v8_kpi_definitions`, `kpi_time_series`, `v8_roi_realization_entries`, `kpi_financial_mappings`.
- **Org-scope / P0 NAPRAWIONE (`91c8245559`):** time-series UPDATE org-scoped (`AND organization_id`); `x-kpi-role` nagłówek USUNIĘTY, rola z JWT. **WZORZEC SYSTEMOWY:** autoryzacja sterowana nagłówkiem klienta — audyt innych v8-routerów.
- **Reguły:** approval-gating Reports egzekwowany serwerowo (`resultsEnterpriseService.ts:796`, pokryty `results-finalization-guard`).

## D · AI / TERESA
- **Granica:** M15 to **obliczenia**, nie generacja LLM — Teresa nie „wymyśla" KPI; karmienie KPI/ROI z M13/M16 przez kontrakt. (Brak dedykowanego AI-fill w tym module.)

## E · INTEGRACJE
Pełna tabela: karta §1g. **←** M13 Inicjatywy (tracked + KPI), M16 Finanse (ROI/economics). **sync-to-results dead-end:** `publish-to-results` (`table-platform.routes.ts:3413`, z M20) pisze tylko do `tp_module_sync_results`; **żaden moduł Results tego nie czyta** (0 trafień) — decyzja: wpiąć odbiór lub „preview" (L-05, wspólne z M20).

## F · EPIKI *(z poprzedniego WP §3)*
- **EPIK 1 — Widoczność degradacji:** renderować baner `source:'legacy'` zamiast cichej pustki (L-01).
- **EPIK 2 — Bezpieczeństwo:** szyfrowanie connector IRIS secrets + admin-only `GET /api/mcp/providers` (L-02); beta-guard `/benefits` (L-03); SEC-3 weryfikacja własności rodzica przy UPSERT (L-04).
- **EPIK 3 — Integracja M20:** decyzja sync-to-results (L-05).
- **EPIK 4 — Szlif:** wytnij martwy `BenefitsHub`/`BenefitsRealizationView` (L-06); §27 `ResultsGridView` (świadoma decyzja) (L-07).
- **EPIK 5 — Testy:** naprawa 5 FAIL drift (L-08); B3 szczelność showcase demo=ON (L-09); B4 fallback V8-OFF; B5 cron (L-10).

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13)*
| # | Kryterium | Miara M15 |
|---|-----------|-----------|
| 1 | Front↔back | KPI/ROI/Reports na realnych danych trwałe po reload; degraded banner widoczny przy V8-OFF; sync-to-results wpięty lub „preview"; 0 martwego `BenefitsHub` |
| 2 | Bezpieczeństwo | oba P0 zamknięte (`91c8245559`, z testem); connector secrets szyfrowane + admin-only; beta-guard na route |
| 3 | i18n | **0** `isPolish`/`i18n.language==='pl'` — **najzdrowszy w audycie** (134× `t()`); utrzymać |
| 4 | Tokeny | **0** hex — utrzymać |
| 5 | §27 | **7** surowych `<table>` — KPI Catalog (`KpisTableV3`)+Reports zgodne; `ResultsGridView`/`ResultsKPITable` raw (świadoma decyzja lub §27) |
| 6 | E2E w PR-gate | IDOR + RBAC (`x-kpi-role` spoof→403) + szczelność showcase demo=ON + naprawa 5 FAIL zielone na `Londyn` |

Scenariusze S1–S7: karta §0. Bezpieczeństwo: karta §6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | karta | wiring/sec/plan | L-01..L-10 |
| W-02 | **Uwagi żywe** | 2026-06-13 | **brak uwag żywych dla M15** (dziedziczy z karty) | — |
| W-03 | Commit `91c8245559` (Sprint1 W1/W2/W3) | — | oba P0 (cross-org time-series + `x-kpi-role`) naprawione | L-11,L-12 (naprawione) |
| W-04 | Feedback prod (VTS/Apator/Elkomtech kliencki) | — | KPI/ROI używane produkcyjnie | A (metryka) |

### 02 · Stan obecny (prawda kodu) — karta §1. KPI/ROI realne obliczenia (bez fasady). Approval-gating serwerowy. Showcase wzorcowo bezpieczny. i18n najzdrowszy (0× `isPolish`). Oba P0 naprawione.

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | degraded banner V8→legacy NIE renderowany (cicha pustka) | W-01 | `kpiRuntime.ts:39-74` | P2 | 2 | otwarta | — |
| L-02 | connector IRIS plaintext + `GET /api/mcp/providers` non-admin zwraca `config` | W-01 | `mcp.routes.ts:91` | P2 | 2 | otwarta | — |
| L-03 | beta-lock tylko nawigacyjny (`/benefits` direct URL omija) | W-01 | `AppRoutes.tsx:2136` | P2 | 2 | otwarta | — |
| L-04 | SEC-3 INSERT/UPSERT deviation/roi bez weryfikacji własności rodzica | W-01 | UPSERT deviation/roi | P3 | 2 | otwarta | — |
| L-05 | sync-to-results dead-end (M20 pisze log, Results nie czyta) | W-01 | `table-platform.routes.ts:3413` (0 odbiorców) | INTEGRACJA | 2 | **D-01** (wspólne M20) | — |
| L-06 | martwy `BenefitsHub.tsx`/`BenefitsRealizationView` (0 ścieżek renderu) | W-01 | `AppRoutes:115` lazy, nigdy w JSX | MARTWY | 3 | otwarta | — |
| L-07 | `ResultsGridView` raw `<table>` bez `TableWithPreviewLayout` | W-01 | grep 7× `<table>` | P3 | 3/4 | **D-02** | 2026-06-13 |
| L-08 | 5 FAIL test-drift (mock `resolveReconciliation`+`toMatchObject`) | W-01 | testy Results | P0-test | — | otwarta | — |
| L-09 | brak testu szczelności showcase demo=ON | W-01 | brak B3 | P0-test | — | otwarta | — |
| L-10 | fallback V8-OFF (S7) + cron (S3) nietestowane | W-01 | brak B4/B5 | P1-test | — | otwarta | — |
| L-11 | cross-org KPI time-series write | W-01,W-03 | UPDATE bez `organization_id` (przed fix) | P0 | — | **NAPRAWIONA `91c8245559` (R3: commit zweryfikowany w git; read-only proof cross-org)** | 2026-06-13 |
| L-12 | RBAC bypass `x-kpi-role` (header spoof) | W-01,W-03 | nagłówek `x-kpi-role` (usunięty) | P0 | — | **NAPRAWIONA `91c8245559` (R3: commit zweryfikowany; rola z JWT; curl viewer→403)** | 2026-06-13 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | sync-to-results (M20 dead-end): realny odbiór KPI z Tabel czy „preview"? | realny odbiór / preview+komunikat | Piotr | TBD (wspólne z M20) | otwarta |
| D-02 | `ResultsGridView` raw `<table>`: zostawić świadomie czy §27? | zostaw / `TableWithPreviewLayout` | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — V8 Results (env, degraduje→legacy `/api/benefits/*`); showcase (jawny toggle); beta core. `/benefits` tylko `ProductionModuleGate` (beta-guard = L-03).
### 06 · Ryzyka — **WZORZEC SYSTEMOWY** `x-kpi-role` (autoryzacja z nagłówka klienta) → audyt innych v8-routerów cross-module. Zapis KPI na PROD ostrożnie (dev `.env` może wskazywać PROD). sync-to-results wspólne z M20.
### 07 · Log — 2026-06-13: teczka; **R3: `91c8245559` zweryfikowany w git log** (oba P0 naprawione — cross-org time-series + `x-kpi-role`). i18n najzdrowszy (grep 0× isPolish, 0 hex). Re-ocena po Fazie 2/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta+commit+feedback; brak uwag żywych = jawnie odnotowane) · R2 zero sierot · R3 statusy z dowodem (**L-11/L-12 `91c8245559` zweryfikowany w historii git**) · R4 DoD z liczbami (isPolish 0, hex 0, table 7) · R5 decyzje z właścicielem · A–E docelowy zlinkowany · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = read-only proof cross-org + showcase szczelność (Faza 4). **Teczka kompletna do egzekucji.**
