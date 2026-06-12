# M16 — Finanse (Economics / Financial Analysis v3) — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `7f0c890fb3`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M16 · inwentarz `Harvard/podzial/inventory/INV_D_*.md` (sekcja FINANSE, poz.1-12) · poprzednia karta `docs/audit/2026-06-02/MODULE_08_finanse.md` (47/100) · SSOT `docs/product/FINANCIAL_ANALYSIS_V3.md`
**Evidence:** `Harvard/modules/M16-finanse/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 57/100 — Tier: Alpha górny · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)
> **Re-audit 2026-06-11 po Sprintach 1–5:** F: 3→7 (W1 `getModel` org-scope naprawiony dla całego legacy routera, commit `e3945bc7fc`, hard cap zdjęty).

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 22 | Wszystkie 12 pozycji REALNE — **prawdziwa matematyka finansowa** (NPV/IRR/DCF/WACC, realny parsing Excel), billing honest (mock usunięty), bez fasady. |
| B. Wiring i dane | 15 | 13 | Realne tabele Postgres (`financial_*`, `valuations`), dual-runtime V8→legacy z realnym banerem; bez fasady in-memory. |
| C. Testy automatyczne | 15 | 8 | 510 PASS/14 FAIL (drift, nie logika), ale **obliczenia finansowe tylko częściowo testowane** (DCF/WACC tylko `typeof`, ratio/forecast bez compute, `financialCalculatorService.test.js` = fałszywa zieleń); nic w PR-gate. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana. |
| E. Kanony/UI | 10 | 7 | §27 zgodny (`ModuleHub`+`TableWithPreviewLayout`+`FilterableTable`), **degraded banner DZIAŁA i widoczny** (lepiej niż M13/M14); i18n 19× `isPolish`, empty-messages mieszane PL/EN. |
| F. Bezpieczeństwo/dostęp | 10 | 7 | W1 `getModel` org-scope naprawiony dla całego legacy routera (commit `e3945bc7fc`); economics/statements/v8 czyste; W7 beta-lock 3-warstwowy; pozostałe: P2 i18n i minor. |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **NIE — cross-org P0 naprawiony (W1, commit `e3945bc7fc`), hard cap zdjęty.** Suma surowa 57 < 70 (Faza 4 niewykonana). |

**Werdykt jednym akapitem:** Funkcjonalnie najsilniejszy moduł finansowy — **wszystkie analizy to realna matematyka, nie demo/placeholder** (NPV/IRR przez bisekcję ze zbieżnością <0.0001, payback z interpolacją `financialAnalysisService.ts:264-318`; ratios księgowe z safeDiv/safePct `:560`; DCF z WACC breakdown, terminal Gordon/exit-multiple, FCFF, dyskonto `valuationService.ts`; silnik modeli monthly z growth-factorem persistowany do `financial_model_outputs` `financialModelingService.ts:643`; import Excel = realny parsing xlsx z rankingiem arkuszy `finance-statements.routes.ts:221`), persystencja na realnych tabelach Postgres (`financial_statements/_values/_lines`, `financial_models/_outputs`, `financial_analyses`, `valuations` — **bez fasady `new Map()` z M18**, encje przeżywają restart), **billing honest** (mock `pm_..._mock` usunięty z runtime, self-serve kill-switch default OFF → „billing handled manually", token-billing 503 `not_configured` bez Stripe — żadnego fake-success), a degraded banner V8→legacy jest realny i WIDOCZNY (`FinanceDegradedBanner`, `useFinanceLane.ts:209` — inaczej niż cicha pustka M13/M14). **Główny blocker: P0 cross-org IDOR na legacy routerze `/api/financial-modeling`** — `getModel(modelId)` to `SELECT * FROM financial_models WHERE id = ?` BEZ `organization_id` (`:1107`), a wszystkie legacy by-id (GET/PUT/DELETE/compute/submit-review/events/approve, `financial-modeling.routes.ts:320-360+`) używają go pod samym `verifyToken+isAuthenticated` → **każdy zalogowany user czyta/edytuje/USUWA/zatwierdza modele finansowe innej firmy po UUID** (zweryfikowane osobiście). Wersja V8 (`v8/finance.routes.ts`) używa tego samego `getModel`, ale dokłada `model.organization_id !== organizationId → 403` — klasyczny wzorzec M20/M16: **V8 czyste, legacy raw-DB dziurawe**. Pozostałe routery (economics/finance-statements/v8) są org-scoped (`getStatementOrFail`, jawny re-check). Drugorzędne: beta-lock tylko nawigacyjny (P1); obliczenia finansowe niedostatecznie pokryte testami (ryzyko regresji liczb w module, gdzie liczby są produktem). Hard cap (cross-org write → 50) + niewykonane Fazy 3+4.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_D sekcja FINANSE, poz.1-12.
**Scenariusze krytyczne (8):**
1. **S1** — Statements: import Excel → canonical table → ratio/validation/explain.
2. **S2** — Modele finansowe: create → workspace → compute.
3. **S3** — Analiza finansowa (ratio/obliczenia).
4. **S4** — Predykcja/forecast + budżety.
5. **S5** — Wycena (valuation DCF/WACC).
6. **S6** — Analiza inwestycyjna (investment_case, NPV/IRR).
7. **S7** — Dual-runtime V8→legacy + degraded banner.
8. **S8** — Export do Outputs.
**Obowiązujące kanony:** §27 — **TAK** (listy statements/models/analyses/valuations) · CARD_CONTENT_FORMULA: **N/D** · wzorzec: **ModuleHub** · gating: **beta CLOSED dla wszystkich** + v8 `useV8FeatureFlag('finance')`.

## 1. Prawda kodu (FAZA 1)
> Raport: `evidence/f1_code_truth.md`. Werdykty: **REALNE 10 · DZIAŁA 2 (banner, czat) · STUB-honest 2 (billing) · MARTWY 1 plik.**

### 1a. REALNE (zweryfikowane)
- Statements (import Excel realny `:221`, workspace, ratio panel), modele (silnik monthly `:643`), analiza (ratios `:560`, vertical/horizontal `:512,532`), predykcja (forecasty+budżety), wycena (DCF/WACC/terminal `valuationService.ts`), inwestycyjna (NPV/IRR `:264-318`), dual-runtime V8→legacy, export do Outputs (za beta), czat Teresy. **Realna matematyka na danych z DB.**

### 1b. MOCK / STUB / fabrykowane
- **[honest] Token-billing 503-stub** — zwraca 503 `not_configured` bez `STRIPE_SECRET_KEY` (nie fake-success).
- **[honest] AddCardModal** — mock `pm_..._mock` USUNIĘTY z runtime; karta za `billingSelfServeFlag` default OFF.
- **(z M20) sync-to-finance STUB** — `ModuleSyncService:57` pisze tylko log do `tp_module_sync_results`; **Finanse nic nie odbierają** (potwierdzone z drugiej strony — żadna tabela `financial_*` nie konsumuje mostu).

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- Brak (poza P0 IDOR — sekcja 6).

### 1d. UKRYTE / MARTWY KOD
- **[MARTWY] `EconomicsViewPlaceholder.tsx`** — 0 importów poza self → wytnij. (Brak martwego huba typu BenefitsHub — FinanceHub żywy.)

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint/serwis | Tabela DB | Status |
|---|---|---|---|
| Statements | `/api/finance-statements` | financial_statements/_values/_lines | DZIAŁA (org-scoped `getStatementOrFail`) |
| Modele | `/api/financial-modeling` (legacy) + v8 | financial_models/_outputs | DZIAŁA obliczeniowo; **legacy IDOR (P0)** |
| Analiza/wycena | `/api/economics` | financial_analyses, valuations | DZIAŁA (org-scoped) |
| Dual-runtime | `useV8FeatureFlag('finance')` | — | DZIAŁA (realny degraded banner) |

### 1f. Flagi (realne defaulty RUNTIME)
| Flaga | Default | Wpływ |
|---|---|---|
| beta gate (`betaAccess.ts:40`) | CLOSED dla wszystkich | sidebar lock (tylko nawigacja) |
| `useV8FeatureFlag('finance')` | per-org | V8 runtime vs legacy fallback (z banerem) |
| `VITE_BILLING_SELF_SERVE` | OFF (null→false) | OFF → manual billing; ON → realny Stripe SetupIntent |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Status |
|---|---|---|---|
| WEJŚCIE ← | M13 Inicjatywy | ROI/economics linkages (`v8_initiative_economics_linkages`) | DZIAŁA |
| WYJŚCIE → | M17 Outputs | export analiz | DZIAŁA (za beta) |
| WEJŚCIE ← | M20 Tabele | governed sync-to-finance | **STUB (M20 pisze log, Finance nie odbiera)** |
| przekrój | M01 Czat | czat Teresy w kontekście finansów | DZIAŁA |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · log: `f2_tests.log`.
**Uruchomienie (lokalnie @ `7f0c890fb3`):** **510 PASS / 14 FAIL / 0 SKIP (~22.5 s).**
| Blok | PASS | FAIL |
|---|---|---|
| FE komponenty/hooki (23) | 142 | 2 |
| Unit serwisy (19) | 160 | 0 |
| Integration (5) | 37 | 4 |
| BE server (4) | 171 | 8 |

**Root-cause 14 FAIL (drift, nie logika):** 2 FE label-drift (`+ Importuj statement`/`complete-import` toolbar zmieniony); 4 integration schema-drift PG/rola `iris` (`MOCK_DB=false` mimo to PG); 8 BE mock-drift sekwencji `DbPromise` w p05-finance-lane (kolejność wywołań DB zmieniona, mock nie).
**Czy obliczenia finansowe testowane realnie? CZĘŚCIOWO:** ✅ modele P&L/BS/CF, NPV/IRR/ROI/payback (asercje numeryczne); ⚠️ DCF/WACC tylko `toBeTypeOf('number')`; ❌ ratio/forecast bez compute-testów; ❌ **`financialCalculatorService.test.js` fałszywa zieleń** (definiuje własny kalkulator w teście, nie importuje produkcji).
**Pokrycie scenariuszy:**
| Scenariusz | FE | BE | E2E | PR-gate | Luka |
|---|---|---|---|---|---|
| S1 statements | ✓ | częśc. | — | ✗ | — |
| S2 modele | ✓ | ✓ | — | ✗ | najlepszy |
| S3 ratio | częśc. | ✗ | — | ✗ | **nieliczone realnie** |
| S4 forecast | — | ✗ | — | ✗ | **brak compute** |
| S5 wycena | — | ⚠️ typeof | — | ✗ | **silnik nieweryfikowany numerycznie** |
| S6 inwestycje | ✓ | ✓ | — | ✗ | calculatorService fałszywy |
| S7 dual-runtime | 2 FAIL | ✓ | — | ✗ | label-drift |
| S8 export | ✓ FE | — | — | ✗ | — |

**CI:** `test-suite.yml` tylko `[main,develop]`; default `Londyn` → PR-gate M16 ≈ 0; testy mockują flagę V8 ON (stan beta-OFF prawie niepokryty).
**Backlog testowy:** [P0] B1 przepisać `financialCalculatorService.test.js` na realny serwis; [P0] B2 numeryczne asercje DCF wyceny; [P0] B3 unit `ratioAnalysisService`; [P0] B5 naprawić sekwencję mocków p05 (8×404); [P1] B6 label-drift, B7 economicsFlow env, B10 `Londyn` w PR-gate.

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** Smoke: statements import, model compute, analiza/wycena, **próba cross-org na `/api/financial-modeling/models/:id`** (potwierdzić IDOR — read-only proof!), degraded banner. Migracje `financial_*`/`valuations` zastosowane?; wartość `useV8FeatureFlag('finance')` na prod. **Uwaga DB:** dev `.env` może wskazywać Railway PROD — szczególna ostrożność z modyfikacją modeli finansowych.
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** 8 scenariuszy; szczególnie: S5 wycena (czy liczby DCF poprawne na żywo), S7 degraded banner (czy widoczny przy degradacji V8), **IDOR legacy financial-modeling (read-only proof cross-org)**, billing (czy 503 bez Stripe, brak fake-success).
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S8 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**§27 (FinanceHub):** ZGODNE — `ModuleHub`+`TableWithPreviewLayout`+`FilterableTable` z preview/filtrami/column-settings (`:60-82,1774-1808`). **Odstępstwa P3:** brak `EntityStatusChip` (własne chipy `:1609,1034`); empty-messages mieszane PL/EN (`:1739` EN vs `:1763-1771` PL hardkod). `CanonicalStatementTable` = własny grid (macierz pozycje×okresy — uzasadnione, to sprawozdanie nie lista).
**Wzorzec hubowy:** `ModuleHub` (nie MELS) — zgodny.
**i18n:** **[P3]** 148× `t()` ale 19× `isPolish`/`i18n.language` inline (antywzorzec jak M19/M20).
**Stany:** **Degraded banner V8→legacy POTWIERDZONY DZIAŁA i WIDOCZNY** (`FinanceDegradedBanner`, `:2156` — tytuł+licznik+severity+nextAction); kontrast z cichą pustką M13/M14.
**CARD_CONTENT_FORMULA:** N/D potwierdzone.

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md`.
| Warstwa | Stan | Dowód |
|---|---|---|
| Org-scope economics/statements/v8 | CZYSTE | `getStatementOrFail:2284`, v8 re-check `model.organization_id!==orgId→403` |
| Legacy financial-modeling by-id | **DZIURAWE** | `getModel:1107` `WHERE id=?` bez org |
| Excel upload | guarded | `fileUpload.middleware.ts` 10MB+allowlist; formuły nie wykonywane |
| Billing | honest | 503 bez Stripe; brak `pm_..._mock` |

**Findingi:**
- **[P0] F-SEC-1 cross-org IDOR legacy `/api/financial-modeling/models/:id`** — `getModel(modelId)` (`financialModelingService.ts:1107`) `SELECT * FROM financial_models WHERE id=?` bez org; GET/PUT/**DELETE**/compute/submit-review/events/approve (`financial-modeling.routes.ts:320-360+`) używają go pod samym `verifyToken+isAuthenticated`. **Każdy user czyta/edytuje/usuwa/zatwierdza modele finansowe innej org.** **Zweryfikowane osobiście.** V8 broni (`v8/finance.routes.ts` +403), legacy nie. Fix: douczyć org w `getModel`/route albo wyłączyć legacy router.
- **[P1] F-SEC-2 beta-lock tylko nawigacyjny** — CLOSED w sidebarze (`Sidebar.tsx:152`), `RouterSyncProvider` bez beta-guarda; direct URL `/finance`/`/economics` omija (wzorzec M17-M20). Mityguje `isFeatureBlocked('finance')` (`:2114`) — ale to polityka org, nie beta.

**OK/czyste:** economics/finance-statements/v8 org-scoped (3/4 routerów); Excel upload guarded (BE waliduje, formuły nie wykonywane); billing honest (503-stub, mock usunięty, kill-switch serwerowy); export/sekrety w logach czyste.

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P0/P1)
1. **Org-scope na legacy financial-modeling** — douczyć `organization_id` w `getModel` (+ filtr w route) lub wyłączyć legacy router na rzecz V8 — Weryfikacja: cross-org GET/PUT/DELETE/compute → 403/404; test IDOR.
2. **Beta-guard na route** `/finance`/`/economics` (nie tylko sidebar) — Weryfikacja: direct URL → plate BETA_LOCKED.
3. **Testy obliczeń finansowych** — przepisać `financialCalculatorService.test.js` na realny serwis (B1), numeryczne asercje DCF/WACC (B2), unit ratio/forecast (B3) — Weryfikacja: zielone, weryfikują wartości liczb.

### Fala 2 — Domknięcie wartości (P1/P2)
1. **Naprawa sekwencji mocków p05** (8×404) + label-drift FinanceHub — Weryfikacja: testy zielone bez drift.
2. **Decyzja o sync-to-finance** (M20 pisze log, Finance nie odbiera) — wpiąć realny odbiór lub jawnie oznaczyć „preview" — Weryfikacja: rekord z Tabel ląduje w Finanse albo jasny komunikat.

### Fala 3 — Jakość i kanony (P3)
1. **i18n** — usunąć 19× `isPolish`, ujednolicić empty-messages PL/EN — Weryfikacja: PL/EN komplet.
2. **`EntityStatusChip`** zamiast własnych chipów + wytnij `EconomicsViewPlaceholder.tsx` — Weryfikacja: spójność, 0 referencji.
3. **CI** — `Londyn` w PR-gate + testy server/ (systemowe) — Weryfikacja: biegnie na PR.

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych (zwł. obliczenia + IDOR) zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: migracje + flagi + smoke 200 + czyste logi
- [ ] 4. Kanony: i18n, EntityStatusChip
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE
- [ ] 6. Legacy financial-modeling org-scoped (P0 zamknięty)

---
**Pozostałe do domknięcia audytu M16:** Faza 3 (Railway) + Faza 4 (żywe 8 scenariuszy). **Blocker P0: IDOR legacy financial-modeling** (cross-org read/edit/DELETE/approve modeli finansowych — wrażliwe dane). Moduł funkcjonalnie najmocniejszy z finansowych (realna matematyka, realna persystencja, honest billing) — po naprawie P0 + Fazach 3/4 realnie Beta. Wzorzec V8-czyste/legacy-dziurawe wspólny z M20.
