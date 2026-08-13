# WP-A02 — API and consumer freeze (statyczna analiza kodu)

Data: 2026-08-09
Zakres: Gate A / WP-A02, "API and consumer freeze".
Metoda: **wyłącznie statyczna** — `Read`/`grep` po kodzie tras (`server/src/routes/`), serwisach
frontendowych (`src/services/api/`) i komponentach (`src/components/Economics`, `src/components/Finance`,
`src/components/Benefits`, `src/views`, `src/components/Results`). Zero połączeń z bazą (live lub
efemeryczną), zero uruchomienia serwera, zero realnych requestów. Praca wykonana przez 5 równoległych
sub-agentów (statyczne czytanie plików), zsyntetyzowana w tym dokumencie.
Branch: `codex/finance-v3-gate-a-20260809`, worktree `/private/tmp/finance-v3-gate-a-20260809` (świeży
z `origin/demo`).

**EVIDENCE_MISSING**: `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`
(punkt wejścia wskazany w zadaniu, sekcja "WP-A02 API and consumer freeze" oraz "sekcja 3, punkt 11" z
handoffu — "12 problemów") **nie istnieje w tym worktree** (`find docs -iname
"*FINANCE_IMPLEMENTATION_MASTER_PLAN*"` → brak wyników). Ten sam brak dotknął już `WP-A03_legacy_classification.md`
(ten sam katalog, poprzednia sesja tego samego dnia) — nie jest to nowy problem tej sesji. Klasyfikacja
poniżej (SUPPORTED_FROZEN / ADAPTER_TARGET / INTERNAL_ONLY) jest więc **rekomendacją opartą o widoczny
kod i realnych konsumentów frontendowych**, nie o dosłowną definicję z master planu — do potwierdzenia
przy zamknięciu Gate A.

## 0. Reguła klasyfikacji (jawna, bo master plan niedostępny)

- **SUPPORTED_FROZEN** — kontrakt I implementacja zostają dokładnie takie, jakie są; endpoint nie jest
  częścią przepisywanego silnika Finance (most do innego modułu, dane referencyjne/statyczne, endpoint
  celowo wyłączony/martwy, plik-propozycja nigdy niezamontowany).
- **ADAPTER_TARGET** — kontrakt (request/response shape) musi zostać zachowany dla konsumenta, ale
  implementacja może zostać owinięta adapterem do nowego silnika `/api/v8/finance-v2/*`. Dotyczy realnej
  domeny Finance będącej przedmiotem przebudowy (statements ingestion, financial models, valuations,
  budgets, financial-analyses, value-tracking M16, planning/valuation compute engines) — niezależnie od
  tego, czy dziś jest to trwałe (DB) czy czyste obliczenie (stateless).
- **INTERNAL_ONLY** — brak potwierdzonego konsumenta w tym przebiegu (frontend lub inny moduł) LUB
  endpoint jest jawnie martwy/wyłączony (410/501 na stałe) LUB plik nigdy nie jest montowany w Gateway.
  Można zmienić bez adaptera — ale patrz zastrzeżenia (⚠) przy pozycjach, gdzie "brak dowodu" nie
  oznacza pewności ("nie znaleziono konsumenta w audytowanym zakresie katalogów" ≠ "na pewno nieużywane").

## 1. Streszczenie liczbowe

| Router / plik | Mount | Liczba endpointów | SUPPORTED_FROZEN | ADAPTER_TARGET | INTERNAL_ONLY |
|---|---|---|---|---|---|
| A. `economics.routes.ts` | `/api/economics` (`betaGate`, **bez** `deprecationHeader`) | 66 | 0 | 62 | 4 |
| B. `finance-statements.routes.ts` | `/api/finance-statements` (`deprecationHeader→/api/v8/finance`) | 30 | 0 | 29 | 1 |
| C. `finance-enterprise.routes.ts` | `/api/finance-v4` (`deprecationHeader→/api/v8/finance`) | 29 | 0 | 0 | 29 |
| D. `financial-modeling.routes.ts` | `/api/financial-modeling` (**bez** `deprecationHeader`) | 16 | 0 | 16 | 0 |
| E. `financeCandidateHandoff{InvestmentCase,StatementPack,ValuationRecommendation}.routes.ts` | `/api/finance/candidate-handoff/*` (3 routery) | 9 | 9 | 0 | 0 |
| F. `v8/finance.routes.ts` | `/api/v8/finance` | 62 | 0 | 60 | 2 |
| G. `v8/finance-value.routes.ts` | `/api/v8/finance/value-tracking` | 25 | 0 | 25 | 0 |
| H. `v8/financeValueRoutes.ts` | `/api/v8/finance/value` **i** `/api/v8/finance-value` (double-mount) | 6 (×2 ścieżki) | 0 | 4 | 2 |
| I. `v8/finance-intelligence.routes.ts` | `/api/v8/finance-intelligence` | 13 | 0 | 1 | 12 |
| J. `v8/finance-planning.routes.ts` | `/api/v8/finance-planning` | 17 | 0 | 6 | 11 |
| K. `v8/finance-valuation.routes.ts` | `/api/v8/finance-valuation` | 19 | 0 | 9 | 10 |
| L. `v8/financeValueDemoAllowlist.ts` | **niezamontowany** (proposal only) | 1 (plik, nie router) | 1 | 0 | 0 |
| **RAZEM** | | **293** | **10** | **212** | **71** |

## 2. Split-brain economics/v8 — POTWIERDZONY

Tak, potwierdzony wielowarstwowo, nie jest to domysł:

1. **Dowód w komentarzach kodu (pierwsza strona, nie interpretacja)**:
   - `financial-modeling.routes.ts:326` — *"FIN-005: same Date leak as the v8 model-detail route — see there."*
   - `finance-statements.routes.ts:1111` (wewnątrz `/upload-and-analyze`) — *"the v8 twin at
     /api/v8/finance/statements/upload-and-analyze"*.
   - `v8/finance.routes.ts:214-222, 1376-1380` — jawnie nazywa `finance-statements.routes.ts` jako
     "legacy" bliźniaka o tej samej klasie defektu.
2. **Prawie 1:1 dopasowanie ścieżek** `economics.routes.ts` `/financial-analyses/*`
   (`run`,`approve`,`ratios`,`initiative-proposals`,`initiatives`) vs `v8/finance.routes.ts` `/analyses/*`
   (te same 5 sufiksów) — brak komentarza w v8 przyznającego się do tego bliźniactwa (w przeciwieństwie
   do #1), czyli jest to **nieudokumentowany** split-brain, silniejszy sygnał ryzyka niż udokumentowany.
3. **Frontend aktywnie realizuje wzorzec v8-najpierw-legacy-fallback** w `useFinanceData.ts`,
   `useFinanceRowActions.ts`, `FinancialModelWorkspace.tsx`, `FinanceHub.tsx` — oba systemy są
   jednocześnie żywe w tej samej sesji użytkownika, nie tylko w kodzie serwera.
4. **Niespójność nawet w jednym pliku**: `useFinanceRowActions.ts` używa v8-fallback dla modeli/analiz,
   ale akcja "confirm" na statement wywołuje WYŁĄCZNIE `/api/finance-statements/:id/confirm` (legacy),
   mimo że `V8FinanceApi.confirmStatement` istnieje. Ten sam wzorzec powtórzony w `FinanceHub.tsx`
   (linie ~2071, ~2253).
5. **Valuations i Budgets są legacy-only end-to-end** — `v8/finance.routes.ts` ma dla nich tylko cienki
   `GET`/`POST`-create, cała reszta (compute/approve/assumptions/peers/export/advisory/lines/scenarios/
   import-document) istnieje wyłącznie pod `/api/economics`. `ValuationWorkspace.tsx` (11 surowych
   `fetch()` do `/economics/valuations*`) i `CreateBudgetModal.tsx`/`CreateValuationModal.tsx` nie mają
   żadnej ścieżki v8, do której mogłyby "spaść".
6. **Trzeci, nieudokumentowany kontrakt "finance value"**: backend montuje `/finance/value`,
   `/finance/value-tracking` i `/finance-value` (alias `/finance/value`) jako trzy odrębne routery.
   Typowany klient `financeValue.ts` obsługuje tylko `/finance/value-tracking`. Trzy panele
   (`InvestmentAppraisalPanel.tsx`, `ValueOfficePanel.tsx`, `VarianceBridgePanel.tsx`) wywołują surowo
   `/api/v8/finance/value/*` (sąsiedni mount) bez żadnego typowanego klienta i bez fallbacku.

**Wniosek dla Gate A**: pipeline statement-ingestion (detect/extract/map/confirm/values/upload-and-analyze)
jest *zamierzonym* odbudowaniem v8 z jawną linią rodowodu w komentarzach — to najbezpieczniejszy
ADAPTER_TARGET. `/analyses` vs `/financial-analyses`, `/valuations`, `/budgets` to **nieudokumentowane**
duplikacje wymagające decyzji rekoncyliacyjnej PRZED napisaniem adaptera, nie tylko mechanicznego
przepięcia.

## 3. Tabela endpointów

Legenda kolumn: **Kl.** = klasyfikacja (SF=SUPPORTED_FROZEN, AT=ADAPTER_TARGET, IO=INTERNAL_ONLY).
⚠ = zastrzeżenie / brak pewności co do konsumenta w tym przebiegu.

### A. `server/src/routes/economics.routes.ts` — mount `/api/economics` (`betaGate` only, auth: `verifyToken` na każdej trasie, ZERO idempotency-key w całym pliku)

#### A.1 Digitization Analyses `/analyses*` (tabela `digitization_analyses`)

| Metoda + ścieżka | Kl. | Konsumenci | Uwagi |
|---|---|---|---|
| GET `/analyses` | AT | `FullROIView.tsx` (`Api.getEconomicsAnalyses`) | potwierdzony jedyny caller listy; ⚠ reszta CRUD tego zasobu (poniżej) nie ma potwierdzonego callera w audytowanym zakresie (Economics/Finance/Benefits/Results) — prawdopodobnie inny ekran ROI spoza zakresu |
| GET `/stats` | AT ⚠ | brak potwierdzonego | |
| POST `/analyses` | AT ⚠ | brak potwierdzonego | Zod `.strict()` |
| GET `/analyses/:id` | AT ⚠ | brak potwierdzonego | |
| PUT `/analyses/:id` | AT ⚠ | brak potwierdzonego | |
| POST `/analyses/:id/link-initiative` | AT ⚠ | brak potwierdzonego | |
| GET `/analyses/:id/financials` | AT ⚠ | brak potwierdzonego | |
| PUT `/analyses/:id/financials` | AT ⚠ | brak potwierdzonego | M08-H01 fail-closed write (503 jeśli brak `analysis_financial_scenarios`) |
| GET `/analyses/:id/scenarios` | AT ⚠ | brak potwierdzonego | |
| POST `/analyses/:id/scenarios` | AT ⚠ | brak potwierdzonego | **NIE** owinięte `financeWrite` (niespójne z sąsiadem, `fallback:true` może cicho no-opować) |
| POST `/analyses/:id/scenarios/:scenarioId/activate` | AT ⚠ | brak potwierdzonego | |
| GET `/analyses/:id/benefits` | AT ⚠ | brak potwierdzonego | |
| PUT `/analyses/:id/benefits` | AT ⚠ | brak potwierdzonego | M08-H02 fail-closed write (503 jeśli brak `benefit_tracking`) |
| POST `/analyses/:id/calculate-metrics` | AT ⚠ | brak potwierdzonego | |
| POST `/analyses/:id/business-case` | **IO** | — | **zawsze 501** (`not_implemented`, BUG-07) — martwy stub-replacement, wskazuje na `/api/v8/advisory/business-case` |
| POST `/analyses/:id/create-initiative` | AT ⚠ | brak potwierdzonego | gałąź wg `INITIATIVE_FUNNEL_ENABLED` |
| POST `/analyses/:id/decisions` | AT ⚠ | brak potwierdzonego | |
| GET `/analyses/:id/decisions` | AT ⚠ | brak potwierdzonego | |
| DELETE `/analyses/:id` | AT ⚠ | brak potwierdzonego | hard delete |
| POST `/analyses/:id/duplicate` | AT ⚠ | brak potwierdzonego | |
| GET `/analyses/:id/export` | AT ⚠ | brak potwierdzonego | |

#### A.2 Financial Analyses `/financial-analyses*` (tabela `financial_analyses` — **v8 twin: F `/analyses*`**)

| Metoda + ścieżka | Kl. | Konsumenci | Uwagi |
|---|---|---|---|
| POST `/financial-analyses` | AT | `useFinanceData.ts`/`CreateAnalysisModal.tsx` (legacy fallback) | split-brain z F#42 |
| GET `/financial-analyses` | AT | `useFinanceData.ts`, `FinancialAnalysisWorkspace.tsx` (legacy fallback) | split-brain z F#41 |
| GET `/financial-analyses/:id` | AT | `FinancialAnalysisWorkspace.tsx` | |
| PUT `/financial-analyses/:id` | AT ⚠ | brak potwierdzonego bezpośrednio | |
| POST `/financial-analyses/:id/run` | AT | `useFinanceRowActions.ts` (legacy fallback) | split-brain z F#46 |
| POST `/financial-analyses/:id/approve` | AT | `useFinanceRowActions.ts` (legacy fallback) | split-brain z F#47 |
| GET `/financial-analyses/:id/ratios` | AT | `FinancialAnalysisWorkspace.tsx` (legacy fallback) | split-brain z F#43 |
| GET `/financial-analyses/:id/insights` | AT ⚠ | brak potwierdzonego | |
| POST `/financial-analyses/:id/insights` | AT ⚠ | brak potwierdzonego | **BUG-06 — aktywny stub, zwraca sfabrykowane "Analiza gotowa" bez realnego wywołania AI** |
| GET `/financial-analyses/:id/initiative-proposals` | AT | `FinancialAnalysisWorkspace.tsx` | split-brain z F#44 |
| POST `/financial-analyses/:id/initiatives` | **IO** | — | **zawsze 410** `DIRECT_INITIATIVE_CREATION_DISABLED` (FIN-06) — celowo wyłączone |
| POST `/financial-analyses/live-preview` | AT ⚠ | brak potwierdzonego | |
| DELETE `/financial-analyses/:id` | AT | `useFinanceRowActions.ts` (legacy fallback) | |

#### A.3 Enterprise Valuations `/valuations*` — **LEGACY-ONLY end-to-end, brak v8 dla zapisu**

| Metoda + ścieżka | Kl. | Konsumenci | Uwagi |
|---|---|---|---|
| GET `/valuations/sources` | AT | `CreateValuationModal.tsx` (`Api.get('/api/economics/valuations/sources')`) | |
| GET `/valuations` | AT | `ValuationWorkspace.tsx` (raw `fetch`) | v8 F#24 ma tylko odczyt listy — NIE jest zamiennikiem tego zapisu |
| POST `/valuations` | AT | `CreateValuationModal.tsx`, `ValuationWorkspace.tsx` | `depth` (managerial/banking) F-4 |
| PUT `/valuations/:id/depth` | AT ⚠ | brak potwierdzonego wprost | F-4 EV depth switch |
| GET `/valuations/:id` | AT | `ValuationWorkspace.tsx` | |
| GET `/valuations/:id/assumptions` | AT | `ValuationWorkspace.tsx` | |
| PUT `/valuations/:id/assumptions` | AT | `ValuationWorkspace.tsx` | |
| PUT `/valuations/:id/peers` | AT | `ValuationWorkspace.tsx` | |
| POST `/valuations/:id/compute` | AT | `ValuationWorkspace.tsx` | |
| GET `/valuations/:id/basket` | AT ⚠ | brak potwierdzonego wprost | deterministyczny football-field basket, F-4 depth |
| POST `/valuations/:id/approve` | AT | `ValuationWorkspace.tsx` | |
| POST `/valuations/:id/advisory` | AT | `ValuationWorkspace.tsx` | |
| POST `/valuations/:id/negotiation-pack` | AT | `ValuationWorkspace.tsx` | |
| GET `/valuations/:id/export/negotiation-pack` | AT ⚠ | brak potwierdzonego wprost | download Markdown |
| POST `/valuations/:id/advisory/:recommendationId/convert-to-initiative` | AT ⚠ | brak potwierdzonego wprost (możliwy duplikat E-grupy `valuation-recommendation`) | "idempotentna kwitancja" (FIN-06) — produkuje Candidate, nie Initiative |
| POST `/valuations/:id/export/pptx` | AT | `ValuationWorkspace.tsx` | |
| GET `/valuations/:id/export/pptx/download` | AT ⚠ | brak potwierdzonego wprost | binary stream |
| DELETE `/valuations/:id` | AT ⚠ | brak potwierdzonego wprost | |

#### A.4 Budgeting `/budgets*` — **LEGACY-ONLY end-to-end poza listą/create**

| Metoda + ścieżka | Kl. | Konsumenci | Uwagi |
|---|---|---|---|
| POST `/budgets` | AT | `CreateBudgetModal.tsx` | v8 F#26 ma tylko create bez reszty CRUD |
| GET `/budgets` | AT ⚠ | brak potwierdzonego wprost | |
| GET `/budgets/:id` | AT ⚠ | brak potwierdzonego wprost | |
| PUT `/budgets/:budgetId/lines/:lineId` | AT ⚠ | brak potwierdzonego wprost | brak v8 odpowiednika |
| POST `/budgets/:budgetId/scenarios/:scenarioId/project` | AT ⚠ | brak potwierdzonego wprost | brak v8 odpowiednika |
| PUT `/budgets/:budgetId/scenarios/:scenarioId/adjustments` | AT ⚠ | brak potwierdzonego wprost | brak v8 odpowiednika |
| POST `/budgets/:id/approve` | AT ⚠ | brak potwierdzonego wprost | brak v8 odpowiednika |
| DELETE `/budgets/:id` | AT ⚠ | brak potwierdzonego wprost | |
| POST `/budgets/:id/import-document` | AT ⚠ | brak potwierdzonego wprost | heurystyka regex, NIE LLM; brak v8 odpowiednika |
| GET `/budgets/:id/initiatives` | AT ⚠ | brak potwierdzonego wprost | |
| POST `/budgets/:id/initiatives` | AT ⚠ | brak potwierdzonego wprost | `INSERT OR IGNORE` (naturalna idempotencja przez unique constraint) |
| DELETE `/budgets/:id/initiatives/:initiativeId` | AT ⚠ | brak potwierdzonego wprost | |

#### A.5 Finance Settings `/finance-settings*`

| Metoda + ścieżka | Kl. | Konsumenci | Uwagi |
|---|---|---|---|
| GET `/finance-settings` | IO ⚠ | brak w audytowanym zakresie | może być wołane z ekranu Organization Settings poza zakresem tego przebiegu |
| PUT `/finance-settings` | IO ⚠ | brak w audytowanym zakresie | `defaultWacc` clamp [0,100] |

---

### B. `server/src/routes/finance-statements.routes.ts` — mount `/api/finance-statements` (`gatewayVerifyToken`, `highRiskSurfaceGuard(upload,export)`, `deprecationHeader→/api/v8/finance`) — **v8 twin: F sekcja Statements, potwierdzone komentarzem w kodzie**

| Metoda + ścieżka | Kl. | Konsumenci | Uwagi |
|---|---|---|---|
| POST `/upload` | **IO** | — | komentarz w kodzie: *"nothing in the frontend calls this"* — martwe, mimo pełnej maszyny idempotency-key |
| POST `/upload-and-analyze` | AT ⚠ | nie potwierdzone jako aktywnie wołane (import wizard woła v8 F#30 bezpośrednio); komentarz w kodzie twierdzi inaczej — możliwie nieaktualny | pełna maszyna idempotency (`Idempotency-Key`, lock, `reserveIdempotentUpload`/`finalizeIdempotentUpload`/`failIdempotentUpload`) — patrz fixture #1 |
| POST `/:id/detect` | AT ⚠ | brak bezpośredniego, prawdop. legacy-fallback | |
| POST `/:id/extract` | AT ⚠ | brak bezpośredniego | |
| POST `/:id/map` | AT ⚠ | brak bezpośredniego | |
| PUT `/:id/values` | AT ⚠ | brak bezpośredniego | |
| POST `/:id/validate` | AT ⚠ | brak bezpośredniego | |
| POST `/:id/confirm` | AT | `useFinanceRowActions.ts:420`, `FinanceHub.tsx:2071,2253` — **wołane BEZPOŚREDNIO, z pominięciem v8**, mimo że `V8FinanceApi.confirmStatement` istnieje | ⚠ adapter musi zachować tę ścieżkę identycznie — realny, aktywny ruch |
| GET `/` | AT ⚠ | brak bezpośredniego (prawdop. legacy-fallback list) | fallback na starszy schemat przy `isSchemaCompatError` |
| GET `/packs` | AT | `FinanceHub.tsx`, `useFinanceData.ts` (legacy fallback) | |
| GET `/packs/:id` | AT | `useFinanceSelection.ts` (legacy fallback) | |
| POST `/packs/:id/recompute` | AT ⚠ | brak bezpośredniego | |
| POST `/packs/:id/report-section` | AT ⚠ | brak bezpośredniego | F5 "silnik→papier", 409 na `FinanceReportReconcileBlockedError` |
| GET `/packs/:id/reconcile-summary` | AT ⚠ | brak bezpośredniego | read-only badge, fail-soft |
| GET `/packs/:id/report-section/lineage` | AT ⚠ | brak bezpośredniego | #82g LIVE lineage |
| GET `/aggregate-scope/initiatives/:initiativeId/delta` | AT ⚠ | brak bezpośredniego | A2 Finance↔Results bridge, read-only |
| GET `/packs/:id/aggregate-scope/portfolio` | AT ⚠ | brak bezpośredniego | A3, read-only |
| POST `/packs/:id/statements/:statementId/assign` | AT ⚠ | brak bezpośredniego | |
| DELETE `/packs/:id` | AT ⚠ | brak bezpośredniego | kaskada manualnych DELETE po 8 tabelach |
| GET `/canonical-lines` | AT | `FinancialStatementImportWizard.tsx`, `FinancialStatementWorkspace.tsx` (legacy fallback) | split-brain z F#40, IDENTYCZNA ścieżka |
| GET `/:id/analytics` | AT ⚠ | brak bezpośredniego | |
| GET `/:id/values/:valueId/explain` | AT ⚠ | brak bezpośredniego | brak odpowiednika w v8 |
| GET `/:id` | AT | `FinanceHub.tsx`, `useFinanceSelection.ts`, `FinancialStatementWorkspace.tsx`, `FinancialStatementPackWorkspace.tsx` (legacy fallback) | |
| GET `/:id/document-intelligence/search` | AT | `FinancialStatementWorkspace.tsx` (legacy fallback) | split-brain z F#34, `authoritativeForNumbers:false` |
| DELETE `/:id` | AT ⚠ | brak bezpośredniego | podwójna semantyka (pack-id LUB statement-id) |
| GET `/ratios/catalog` | AT ⚠ | brak bezpośredniego | brak odpowiednika w v8 (v8 ma tylko `/statements/:id/ratios`) |
| GET `/:id/ratios` | AT | `FinancialStatementWorkspace.tsx` (legacy fallback) | split-brain z F#33 |
| POST `/ratios/growth` | AT ⚠ | brak bezpośredniego | brak odpowiednika w v8 |
| GET `/benchmarks` | AT ⚠ | brak bezpośredniego | brak odpowiednika w v8 |
| PUT `/benchmarks` | AT ⚠ | brak bezpośredniego | brak odpowiednika w v8 |

---

### C. `server/src/routes/finance-enterprise.routes.ts` — mount `/api/finance-v4` (`deprecationHeader→/api/v8/finance`) — **⚠ brak potwierdzonego konsumenta frontendowego w tym przebiegu dla CAŁEGO pliku**

Zakres audytu frontendu (Economics/Finance/Benefits/Results/FullROIView) nie wykrył ŻADNEGO wywołania
`/api/finance-v4/*`. Jedyny potwierdzony fakt: `v8/finance.routes.ts` **importuje bezpośrednio**
`financeEnterpriseService.js` (linie 1071, 1092) dla własnych endpointów `GET /models/:id/versions` i
`GET /models/:id/versions/diff` — czyli serwis żyje, ale przez v8, nie przez te trasy. Cała grupa 29
endpointów sklasyfikowana **INTERNAL_ONLY z zastrzeżeniem**: brak dowodu użycia w audytowanym zakresie
katalogów ≠ dowód braku użycia (mogła istnieć osobna, nieodwiedzona w tym przebiegu powierzchnia V4).
**Rekomendacja**: dedykowany grep po `finance-v4` w całym `src/` (nie tylko Economics/Finance/Benefits)
przed ostatecznym zamknięciem Gate A.

| Metoda + ścieżka | Kl. | Uwagi |
|---|---|---|
| POST `/models/:modelId/versions` | IO ⚠ | |
| GET `/models/:modelId/versions` | IO ⚠ | możliwy caller: `v8/finance.routes.ts` przez `financeEnterpriseService` (pośrednio, nie przez tę trasę) |
| GET `/versions/:fromId/compare/:toId` | IO ⚠ | |
| POST `/versions/:versionId/merge` | IO ⚠ | |
| POST `/dimensions` | IO ⚠ | |
| GET `/dimensions` | IO ⚠ | |
| POST `/models/:modelId/allocations` | IO ⚠ | SEC: cross-org modelId → 404 |
| GET `/models/:modelId/allocations` | IO ⚠ | |
| POST `/consolidations` | IO ⚠ | SEC: cross-org sourceModelIds → 404 |
| GET `/consolidations` | IO ⚠ | |
| POST `/models/:modelId/budgets` | IO ⚠ | SEC: 404 comment |
| GET `/models/:modelId/budgets` | IO ⚠ | |
| POST `/budgets/:budgetId/actuals` | IO ⚠ | |
| POST `/budgets/:budgetId/approve` | IO ⚠ | |
| POST `/models/:modelId/forecast-cycles` | IO ⚠ | SEC: 404 comment |
| GET `/budgets/:budgetId/variance-alerts` | IO ⚠ | |
| POST `/connectors` | IO ⚠ | enum: excel/erp_sap/erp_oracle/csv/api |
| GET `/connectors` | IO ⚠ | |
| POST `/connectors/:connectorId/sync-log` | IO ⚠ | |
| GET `/connectors/:connectorId/sync-log` | IO ⚠ | limit capped 100 |
| POST `/models/:modelId/valuations` | IO ⚠ | enum: dcf/comparables/asset_based/custom; SEC 404 |
| GET `/models/:modelId/valuations` | IO ⚠ | |
| GET `/valuations/:snapshotId/audit` | IO ⚠ | |
| POST `/models/:modelId/ai-assumptions` | IO ⚠ | SEC 404 |
| GET `/models/:modelId/ai-assumptions` | IO ⚠ | |
| POST `/ai-assumptions/:assumptionId/accept` | IO ⚠ | |
| POST `/models/:modelId/roi-links` | IO ⚠ | SEC 404 |
| GET `/models/:modelId/roi-links` | IO ⚠ | |
| POST `/roi-links/:linkId/realize` | IO ⚠ | |

---

### D. `server/src/routes/financial-modeling.routes.ts` — mount `/api/financial-modeling` (`gatewayVerifyToken`, `betaGate`, **BEZ** `deprecationHeader` — niespójne z sąsiadami B i C) — **v8 twin: F sekcja Models, potwierdzone komentarzem `GET /models/:id`**

| Metoda + ścieżka | Kl. | Konsumenci | Uwagi |
|---|---|---|---|
| POST `/models` | AT | `FinancialModelWorkspace.tsx` (`createModelWithFallback`) | Zod `createModelSchema` (eksportowany, używany też przez Health Panel probe) |
| GET `/models` | AT ⚠ | brak bezpośredniego | |
| GET `/models/:id` | AT | `FinancialModelWorkspace.tsx` (legacy fallback) | **"FIN-005: same Date leak as the v8 model-detail route"** — jawny dowód split-brain |
| GET `/models/:id/assumptions-status` | AT ⚠ | brak bezpośredniego | #82f, read-only, fail-soft |
| PUT `/models/:id` | AT | `FinancialModelWorkspace.tsx` (legacy fallback) | guard: `status:'approved'` tylko przez `/approve` |
| POST `/models/:id/refresh-source` | AT | `FinancialModelWorkspace.tsx` (legacy fallback) | S6.4d |
| DELETE `/models/:id` | AT ⚠ | brak bezpośredniego | blokada przy `status==='approved'` |
| POST `/models/:id/compute` | AT | `FinancialModelWorkspace.tsx` (legacy fallback) | 500 `FINANCE_MODEL_COMPUTE_FAILED`, nigdy nie echo `e.message` (H6.4) |
| POST `/models/:id/submit-review` | AT ⚠ | brak bezpośredniego | |
| POST `/models/:id/approve` | AT | `FinancialModelWorkspace.tsx` (legacy fallback) | |
| POST `/models/:id/events` | AT | `FinancialModelWorkspace.tsx` (legacy fallback) | Zod `createEventSchema`, 13-wartościowy enum `eventType` |
| GET `/models/:id/events` | AT ⚠ | brak bezpośredniego | |
| PUT `/events/:eventId` | AT | `FinancialModelWorkspace.tsx` (legacy fallback) | ownership JOIN → 404 cross-org |
| DELETE `/events/:eventId` | AT | `FinancialModelWorkspace.tsx` (legacy fallback) | ownership JOIN → 404 cross-org |
| GET `/models/:id/outputs` | AT ⚠ | brak bezpośredniego | |
| GET `/models/:id/validations` | AT ⚠ | brak bezpośredniego | |

---

### E. FIN-06 Candidate Handoff bridges — most do `initiative_candidates` (NIE część silnika Finance — SUPPORTED_FROZEN)

Trzy odrębne routery, zaprojektowane celowo tak, aby nigdy nie dotykać "zamrożonych" plików
finance-statements/financial-modeling/economics. To most 1-kierunkowy do modułu Initiatives/Ideas —
poza zakresem przebudowy silnika Finance, więc kontrakt zamrożony wprost.

| Metoda + ścieżka | Mount | Kl. | Konsumenci | Uwagi |
|---|---|---|---|---|
| GET `/:modelId/preview` | `/api/finance/candidate-handoff/investment-case` | SF | `ExportToOutputDialog.tsx` | |
| POST `/:modelId/confirm` | jw. | SF | `ExportToOutputDialog.tsx` | create-or-return (`result.created` → 201/200), BRAK `Idempotency-Key` (idempotencja domenowa) |
| GET `/:modelId` | jw. | SF | `ExportToOutputDialog.tsx` | 404 `NO_CANDIDATE_HANDOFF` |
| GET `/:packId/preview` | `/api/finance/candidate-handoff/statement-pack` | SF | `FinancialStatementPackWorkspace.tsx` | |
| POST `/:packId/confirm` | jw. | SF | `FinancialStatementPackWorkspace.tsx` | create-or-return |
| GET `/:packId` | jw. | SF | `FinancialStatementPackWorkspace.tsx` | |
| GET `/:recommendationId/preview` | `/api/finance/candidate-handoff/valuation-recommendation` | SF | `ValuationWorkspace.tsx` | |
| POST `/:recommendationId/confirm` | jw. | SF | `ValuationWorkspace.tsx` | create-or-return |
| GET `/:recommendationId` | jw. | SF | `ValuationWorkspace.tsx` | |

**⚠ Uwaga niezależna od zamrożenia (do naprawy niezależnie od migracji)**: mount
`/api/finance/candidate-handoff/investment-case` w `Gateway.ts` **NIE ma żadnego middleware
uwierzytelniania** (`app.use('/api/finance/candidate-handoff/investment-case',
financeCandidateHandoffInvestmentCaseRoutes)` — brak `verifyToken`), a plik routera też nie woła
`verifyToken`/`isAuthenticated`, tylko `requireUser(req)`, który rzuca zwykły `Error('Unauthorized')`
nieobsługiwany przez `mapError`. Dwaj sąsiedzi (`statement-pack`: `router.use(verifyToken,
isAuthenticated)`; `valuation-recommendation`: per-route `verifyToken`) są poprawnie zabramkowani. To
lukę auth, nie kwestię zamrożenia kontraktu — zgłoszona tu, bo wypłynęła przy inwentaryzacji.

---

### F. `server/src/routes/v8/finance.routes.ts` — mount `/api/v8/finance` (łańcuch: `verifyToken`→`requireV8OrgContext`→`v8OrgGate`→`attachV8Context`→`v8MetricsMiddleware`→`mutationAbortCanary`)

| # | Metoda + ścieżka | Kl. | Konsumenci | Uwagi |
|---|---|---|---|---|
| 1 | GET `/dashboard` | AT | `FinanceHub.tsx` | |
| 2 | GET `/models` | AT | `FinancialModelWorkspace.tsx` | |
| 3 | POST `/models` | AT | `CreateModelModal.tsx`, `FinancialModelWorkspace.tsx` | idempotency-key pełna (FIN-03/04) — patrz fixture #2 |
| 4 | GET `/models/:modelId` | AT | `CreateModelModal.tsx`, `useFinanceSelection.ts`, `FinancialModelWorkspace.tsx` | Date-leak dokumentowany, split-brain z D — patrz fixture #3 |
| 5 | GET `/models/:modelId/validations` | AT | `useFinanceSelection.ts`, `FinancialModelWorkspace.tsx` | |
| 6 | GET `/models/:modelId/outputs` | AT | `FinanceModelDocumentView.tsx`, `FinancialModelWorkspace.tsx` | |
| 7 | GET `/models/:modelId/appraisal` | AT ⚠ | brak bezpośredniego | "FIN-005/006 golden-flow closer" |
| 8 | POST `/models/:modelId/compute` | AT | `FinancePreviewPanel.tsx`, `useFinanceRowActions.ts`, `FinancialModelWorkspace.tsx` | |
| 9 | POST `/models/:modelId/approve` | AT | `FinancePreviewPanel.tsx`, `useFinanceRowActions.ts`, `FinancialModelWorkspace.tsx` | idempotency-key + CAS `expectedVersion`/`X-Model-Version` — patrz fixture #4 |
| 10 | POST `/models/:modelId/refresh-source` | AT | `FinancialModelWorkspace.tsx` | |
| 11 | PUT `/models/:modelId` | AT | `FinancialModelWorkspace.tsx` | CAS jak #9 |
| 12 | POST `/models/:modelId/events` | AT | `FinancialModelWorkspace.tsx` | |
| 13 | DELETE `/events/:eventId` | AT | `FinancialModelWorkspace.tsx` | |
| 14 | DELETE `/models/:modelId` | AT | `useFinanceRowActions.ts`, `FinancialModelWorkspace.tsx` | |
| 15 | GET `/models/:modelId/case` | AT | `useFinanceLane.ts`, `FinancialModelWorkspace.tsx` | FIN-04 |
| 16 | POST `/models/:modelId/set-baseline` | AT | `FinancialModelWorkspace.tsx` | FIN-04 |
| 17 | GET `/models/:modelId/versions` | AT | `ModelVersionHistory.tsx` | M16/6.5 |
| 18 | GET `/models/:modelId/versions/diff` | AT | `ModelVersionHistory.tsx` | |
| 19 | GET `/models/:modelId/events` | AT ⚠ | brak bezpośredniego | BUG-04 |
| 20 | POST `/models/:modelId/duplicate` | AT ⚠ | brak bezpośredniego | BUG-09, degradacja stale-FK |
| 21 | POST `/models/:modelId/analyze` | AT ⚠ | brak bezpośredniego | **BUG-10 — STUB, zawsze 202 `queued`, zero realnego przetwarzania** — wymaga naprawy funkcjonalnej niezależnie od migracji |
| 22 | GET `/models/:modelId/outputs/download` | AT ⚠ | brak bezpośredniego | BUG-11 |
| 23 | GET `/models/:modelId/export` | AT ⚠ | brak bezpośredniego | BUG-12 |
| 24 | GET `/valuations` | AT | `ValuationWorkspace.tsx`(?), brak jawnego w audycie | **tylko odczyt listy** — nie jest zamiennikiem legacy CRUD (patrz A.3) |
| 25 | GET `/budgets` | AT | brak jawnego w audycie | tylko odczyt listy |
| 26 | POST `/budgets` | AT ⚠ | brak jawnego w audycie | tylko create, brak reszty CRUD |
| 27 | GET `/statement-packs` | AT | `FinanceHub.tsx`, `useFinanceData.ts` | |
| 28 | GET `/statement-packs/:packId` | AT | `useFinanceSelection.ts` | |
| 29 | GET `/statements` | AT | `FinancialStatementWorkspace.tsx` | |
| 30 | POST `/statements/upload-and-analyze` | AT | `FinancialStatementImportWizard.tsx` | ~600-linowy handler, pełna idempotency (patrz fixture #1) |
| 31 | GET `/statements/:statementId` | AT | `FinanceHub.tsx`, `useFinanceSelection.ts`, `FinancialStatementWorkspace.tsx`, `FinancialStatementPackWorkspace.tsx` | |
| 32 | GET `/statements/:statementId/analytics` | AT | `FinancialStatementPackWorkspace.tsx` | |
| 33 | GET `/statements/:statementId/ratios` | AT | `FinancialStatementWorkspace.tsx` | split-brain z B `/:id/ratios` |
| 34 | GET `/statements/:statementId/document-intelligence/search` | AT | `FinancialStatementWorkspace.tsx` | split-brain z B, `authoritativeForNumbers:false` |
| 35 | POST `/statements/:statementId/detect` | AT | `FinancialStatementImportWizard.tsx`, `FinancialStatementWorkspace.tsx` | |
| 36 | POST `/statements/:statementId/extract` | AT | jw. | |
| 37 | POST `/statements/:statementId/map` | AT | jw. | |
| 38 | POST `/statements/:statementId/confirm` | AT ⚠ | istnieje w klientach, ale FE realnie woła legacy B (patrz B `/:id/confirm`) | **ryzyko**: adapter musi rozstrzygnąć, czy przekierować legacy confirm tutaj, czy zachować dwie ścieżki |
| 39 | PUT `/statements/:statementId/values` | AT | `FinancialStatementImportWizard.tsx`, `FinancialStatementWorkspace.tsx` | |
| 40 | GET `/canonical-lines` | AT | `FinancialStatementImportWizard.tsx`, `FinancialStatementWorkspace.tsx` | split-brain z B, identyczna ścieżka |
| 41 | GET `/analyses` | AT | `useFinanceData.ts` (v8-first) | split-brain z A.2 `/financial-analyses` |
| 42 | POST `/analyses` | AT | `CreateAnalysisModal.tsx` (v8-first) | split-brain z A.2 |
| 43 | GET `/analyses/:analysisId/ratios` | AT | `FinancialAnalysisWorkspace.tsx` (v8-first) | split-brain z A.2 |
| 44 | GET `/analyses/:analysisId/initiative-proposals` | AT | `FinancialAnalysisWorkspace.tsx` (v8-first) | split-brain z A.2 |
| 45 | POST `/analyses/:analysisId/initiatives` | **IO** | — | **zawsze 410** `DIRECT_INITIATIVE_CREATION_DISABLED` — przekierowuje na E-grupę (`candidate-handoff/investment-case`) |
| 46 | POST `/analyses/:analysisId/run` | AT | `useFinanceRowActions.ts` (v8-first) | split-brain z A.2 |
| 47 | POST `/analyses/:analysisId/approve` | AT | `useFinanceRowActions.ts` (v8-first) | split-brain z A.2 |
| 48 | POST `/analyses/:analysisId/archive` | AT ⚠ | brak bezpośredniego | |
| 49 | DELETE `/analyses/:analysisId` | AT | `useFinanceRowActions.ts` (v8-first) | |
| 50 | POST `/lane/start` | AT | `useFinanceLane.ts` | P05-B |
| 51 | POST `/lane/:runId/advance` | AT | `useFinanceLane.ts` | dodatkowa kontrola roli SQL (`owner,admin,editor,finance_admin,finance_editor`) poza middleware routera |
| 52 | GET `/lane/:runId` | AT ⚠ | brak bezpośredniego | |
| 53 | GET `/lane` | AT | `useFinanceLane.ts` | |
| 54 | POST `/lane/:runId/mutation-audit` | AT | `useFinanceLane.ts` | |
| 55 | GET `/lane/:runId/mutation-audit` | AT | `useFinanceLane.ts` | |
| 56 | POST `/versions/snapshot` | AT | `useFinanceLane.ts` | |
| 57 | POST `/versions/:snapshotId/finalize` | AT | `useFinanceLane.ts` (`finalizeVersion`) | |
| 58 | GET `/versions` | AT | `useFinanceLane.ts` | |
| 59 | GET `/lane/:runId/kpi-coherence` | AT | `useFinanceLane.ts` | |
| 60 | POST `/exports/packages` | AT ⚠ | brak jawnego callera w audytowanym zakresie | pakiet akceptacyjny ZIP+XLSX+manifest na `/data`; prawdopodobny caller: przycisk eksportu FinanceHub poza zakresem audytu |
| 61 | GET `/exports/packages` | AT ⚠ | jw. | |
| 62 | GET `/exports/packages/:artifactId/download` | AT ⚠ | jw. | path-traversal guard + checksum SHA-256 przed streamem |

---

### G. `server/src/routes/v8/finance-value.routes.ts` — mount `/api/v8/finance/value-tracking`

| Metoda + ścieżka | Kl. | Konsumenci | Uwagi |
|---|---|---|---|
| POST `/ledger/baselines` | AT | `ValueLedgerPanel.tsx` | |
| GET `/ledger/baselines/active` | AT | `ValueLedgerPanel.tsx` | |
| POST `/ledger/entries` | AT | `ValueLedgerPanel.tsx` | |
| GET `/ledger/entries` | AT | `ValueLedgerPanel.tsx` | |
| GET `/ledger/current-value` | AT | `ValueLedgerPanel.tsx` | baseline.frozen_value + Σ ledger.value_delta |
| POST `/attribution/rollup` | AT | `ValueAttributionPanel.tsx` | |
| POST `/attribution/by-initiative` | AT | `ValueAttributionPanel.tsx` | |
| GET `/capture/gates` | AT | `ValueCapturePipelinePanel.tsx` | |
| POST `/capture/gates` | AT | `ValueCapturePipelinePanel.tsx` | |
| POST `/capture/gates/:id/advance` | AT | `ValueCapturePipelinePanel.tsx` | |
| GET `/capture/funnel` | AT | `ValueCapturePipelinePanel.tsx` | |
| POST `/reconciliation/check` | AT ⚠ | brak bezpośredniego | |
| POST `/reconciliation/portfolio` | AT ⚠ | brak bezpośredniego | |
| GET `/reconciliation/organization` | AT ⚠ | brak bezpośredniego | DB-assembled (roi_realized_values→kpi_financial_mappings→financial_statement_lines) |
| POST `/lineage/early-warnings` | AT ⚠ | brak bezpośredniego | |
| POST `/banking/bank` | AT | `BankingValuePanel.tsx` | |
| POST `/banking/status` | AT | `BankingValuePanel.tsx` | |
| POST `/banking/portfolio` | AT ⚠ | brak bezpośredniego | |
| POST `/ratios/extended` | AT | `ExtendedRatiosPanel.tsx` | |
| POST `/ratios/dupont` | AT | `ExtendedRatiosPanel.tsx` | |
| POST `/ratios/benchmark` | AT ⚠ | brak bezpośredniego | |
| GET `/approved-baselines` | AT | `PostInvestmentActualForm.tsx` (Results module) | konsument **cross-module** — adapter musi zachować kontrakt 1:1 |
| POST `/post-investment-reviews` | AT | `PostInvestmentActualForm.tsx` (Results module) | **`Idempotency-Key` WYMAGANY** (400 `IDEMPOTENCY_KEY_REQUIRED` bez niego) — patrz fixture #10 |
| GET `/post-investment-reviews/:id` | AT ⚠ | brak bezpośredniego | |
| GET `/post-investment-reviews` | AT | `PostInvestmentReviewPanel.tsx` (Results module) | konsument cross-module |

---

### H. `server/src/routes/v8/financeValueRoutes.ts` — **double-mount** `/api/v8/finance/value/*` (kanoniczny, przywrócony po zgubieniu w rebase 2026-06-25) **i** `/api/v8/finance-value/*` (alias) — auth: lokalny `resolveOrganizationId(req)`, nie `getV8Context` — WSZYSTKIE trasy POST, ZERO GET

| Metoda + ścieżka | Kl. | Konsumenci | Uwagi |
|---|---|---|---|
| POST `/value-bridge` | AT | `ValueOfficePanel.tsx` (surowy `Api.post`, bez typowanego klienta) | trzeci, nieudokumentowany kontrakt "finance value" — patrz sekcja 2 pkt 6 |
| POST `/portfolio/prioritize` | AT | `ValueOfficePanel.tsx` (surowy) | jw. |
| POST `/capital/ration` | **IO** | brak (audytowane przez `financeValueDemoAllowlist.ts`: "no production caller anywhere in src/") | |
| POST `/appraise` | AT | `InvestmentAppraisalPanel.tsx` (surowy) | patrz fixture #9 |
| POST `/variance-bridge` | AT | `VarianceBridgePanel.tsx` (surowy) | |
| POST `/value-assurance` | **IO** | brak (jw.) | |

**⚠ Ryzyko demo-guard**: wszystkie 6 tras to POST bez wyjątku → `demoWriteProtection` (klasyfikuje po
czasowniku HTTP) traktuje je jak zapisy i 403-uje w trybie demo, mimo że są czystym obliczeniem bez
dostępu do DB (potwierdzone przez `financeValueDemoAllowlist.ts` — zero importów DB w 6 audytowanych
serwisach). `financeValueDemoAllowlist.ts` to gotowa, ale **nigdy niewpięta** propozycja wyjątku —
patrz grupa L.

---

### I. `server/src/routes/v8/finance-intelligence.routes.ts` — mount `/api/v8/finance-intelligence`

| Metoda + ścieżka | Kl. | Konsumenci | Uwagi |
|---|---|---|---|
| GET `/packs/:packId/tie-out` | IO ⚠ | brak w audytowanym zakresie | |
| POST `/completeness/normalize-currency` | IO ⚠ | brak | czyste obliczenie, bez odczytu DB |
| POST `/completeness/multi-year` | IO ⚠ | brak | |
| POST `/completeness/readiness` | IO ⚠ | brak | |
| POST `/completeness/convert-currency` | IO ⚠ | brak | |
| POST `/anomalies/detect` | IO ⚠ | brak | |
| POST `/variance/narrate` | AT | `VarianceNarrationPanel.tsx` (przez `financePlanning.ts`) | jedyny potwierdzony konsument w tym pliku |
| POST `/business-case/one-pager` | IO ⚠ | brak | |
| POST `/business-case/compare` | IO ⚠ | brak | |
| POST `/business-case/from-analysis/:analysisId` | IO ⚠ | brak | `assertAnalysisOwnedByOrg` 404-guard |
| POST `/pipeline/run` | IO ⚠ | brak | `aiRateLimiter`, grounded LLM, max 200k znaków |
| POST `/pipeline/document` | IO ⚠ | brak | jw. |
| GET `/canonical-lines/:statementType` | IO ⚠ | brak | |

---

### J. `server/src/routes/v8/finance-planning.routes.ts` — mount `/api/v8/finance-planning` (wszystkie trasy POST)

| Metoda + ścieżka | Kl. | Konsumenci | Uwagi |
|---|---|---|---|
| POST `/cash-forecast` | AT | `CashForecastPanel.tsx` | |
| POST `/rolling-forecast/reforecast` | AT | `RollingForecastPanel.tsx` | |
| POST `/rolling-forecast/roll-forward` | AT | `RollingForecastPanel.tsx` | |
| POST `/rolling-forecast/fy-bridge` | IO ⚠ | brak | |
| POST `/rolling-forecast/snapshot` | IO ⚠ | brak | |
| POST `/headcount/opex` | AT | `HeadcountPlannerPanel.tsx` | |
| POST `/headcount/cash` | IO ⚠ | brak | |
| POST `/headcount/summary` | AT | `HeadcountPlannerPanel.tsx` | |
| POST `/headcount/role-cost` | IO ⚠ | brak | |
| POST `/run-rate/split` | IO ⚠ | brak | |
| POST `/run-rate/phasing-curve` | IO ⚠ | brak | |
| POST `/run-rate/in-year` | IO ⚠ | brak | |
| POST `/run-rate/bankable` | IO ⚠ | brak | |
| POST `/driver-tree/evaluate` | AT | `DriverTreePanel.tsx` | 400 `DRIVER_TREE_CYCLE`/`DRIVER_TREE_INVALID_TREE` |
| POST `/driver-tree/propagate` | IO ⚠ | brak | |
| POST `/driver-tree/chart` | AT | `DriverTreePanel.tsx` | |
| POST `/nl-to-model` | IO ⚠ | brak | deterministyczny ekstraktor regułowy, **planowany follow-up LLM** (jawny TODO w nagłówku pliku) |

---

### K. `server/src/routes/v8/finance-valuation.routes.ts` — mount `/api/v8/finance-valuation` (wszystkie trasy POST)

| Metoda + ścieżka | Kl. | Konsumenci | Uwagi |
|---|---|---|---|
| POST `/monte-carlo-npv` | AT | `MonteCarloNpvPanel.tsx` | |
| POST `/value-at-risk` | IO ⚠ | brak | |
| POST `/value-at-risk/portfolio` | IO ⚠ | brak | |
| POST `/real-options/defer` | AT | `RealOptionsPanel.tsx` | |
| POST `/real-options/abandon` | AT | `RealOptionsPanel.tsx` | |
| POST `/real-options/staged` | AT | `RealOptionsPanel.tsx` | |
| POST `/efficient-frontier` | AT | `EfficientFrontierPanel.tsx` | |
| POST `/efficient-frontier/portfolio` | IO ⚠ | brak | |
| POST `/sensitivity/one-way` | IO ⚠ | brak | |
| POST `/sensitivity/tornado` | AT | `WhatIfSensitivityPanel.tsx` | |
| POST `/sensitivity/data-table` | AT | `WhatIfSensitivityPanel.tsx` | |
| POST `/sensitivity/break-even` | IO ⚠ | brak | |
| POST `/scenarios/apply` | AT | `ScenarioComputePanel.tsx` | |
| POST `/scenarios/compare` | IO ⚠ | brak | |
| POST `/scenarios/fan` | AT | `ScenarioComputePanel.tsx` | |
| POST `/capital-decision/hurdle-rate` | IO ⚠ | brak | |
| POST `/capital-decision/risk-adjusted-npv` | IO ⚠ | brak | |
| POST `/capital-decision/evaluate-hurdle` | IO ⚠ | brak | |
| POST `/capital-decision/rank` | IO ⚠ | brak | |

**Uwaga architektoniczna** (z nagłówka pliku, istotna dla adaptera): callbacki (`npvFn`/`targetFn`/
`computeFn`) nie mogą przejść przez JSON body, więc most eksponuje **generyczny model liniowy**
`value = intercept + Σ(driver_i * weight_i)` — jawnie oznaczone jako "deliberate simplification...
a richer expression engine can replace buildLinearFn later without changing route contracts". Ważne przy
projektowaniu adaptera do v2 — kontrakt request/response już zakłada uproszczenie, nie pełną ewaluację
wyrażeń.

---

### L. `server/src/routes/v8/financeValueDemoAllowlist.ts` — **NIE jest routerem, nigdy niezamontowany**

| Pozycja | Kl. | Uwagi |
|---|---|---|
| `financeValueDemoAllowlist.ts` (cały plik) | SF | Propozycja (nie kod produkcyjny) allowlisty 4 z 6 tras grupy H, które powinny być zwolnione z `demoWriteProtection`. Nigdy nie zaimportowany w `Gateway.ts` — decyzja bezpieczeństwa świadomie pozostawiona poza tym pakietem. Gotowy diff wskazany w `docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/FIN-006_CROSS_MODULE_CURRENCY_AND_VALUE_ENGINE.md §B.3`. Zamrożony jako dokument-propozycja — nie wymaga adaptera, bo nie jest aktywnym kodem. |

---

## 4. Ryzyka do rozstrzygnięcia przed napisaniem adaptera (nie tylko inwentaryzacyjne)

1. **`/analyses` (v8, F#41-49) vs `/financial-analyses` (legacy, A.2)** — nieudokumentowany split-brain,
   prawdopodobnie ta sama tabela `financial_analyses` przez dwa różne serwisy. Wymaga decyzji
   rekoncyliacyjnej: który jest kanoniczny w v2, i czy adapter musi obsłużyć OBIE ścieżki identycznie
   (bo obie mają żywych konsumentów frontendowych).
2. **Statement `confirm`** — frontend woła WYŁĄCZNIE legacy `/api/finance-statements/:id/confirm`
   (B), nigdy v8 F#38, mimo że oba istnieją i mimo że reszta pipeline'u (detect/extract/map/values) w
   tych samych plikach woła v8. Adapter musi obsłużyć confirm przez legacy ścieżkę identycznie.
3. **Valuations i Budgets są legacy-only end-to-end** (A.3, A.4) — v8 ma tylko cienkie
   odczyt/create. Adapter dla tej pary musi pokryć PEŁNY zakres CRUD+compute+export+advisory, nie
   tylko listę.
4. **Trzeci kontrakt "finance value"** (grupa H, `/api/v8/finance/value/*`) używany surowo (bez
   typowanego klienta) przez 3 panele — inny mount niż typowany `financeValue.ts` (`/finance/value-tracking`,
   grupa G). Adapter musi rozróżnić te dwa mounty jako odrębne kontrakty, nie scalać ich.
5. **Auth gap w `financeCandidateHandoffInvestmentCase.routes.ts`** (grupa E) — brak middleware
   uwierzytelniania na mount i w pliku. Niezależne od zamrożenia kontraktu, ale powinno być naprawione
   w tym samym oknie zmian (ryzyko bezpieczeństwa, nie tylko techniczny dług).
6. **BUG-06 (A.2, aktywny fabrykowany stub `/financial-analyses/:id/insights`) i BUG-10 (F#21, martwy
   stub `/models/:id/analyze`)** — oba mają kontrakt "SUPPORTED"-wyglądający (200/202), ale nie robią
   deklarowanej pracy. Zamrożenie kontraktu nie powinno zamrozić też fałszywego zachowania — do
   flagowania jako dług techniczny przy adapterze.
7. **`/api/finance-v4` (grupa C, 29 endpointów)** — sklasyfikowane INTERNAL_ONLY wyłącznie na podstawie
   nieznalezienia konsumenta w audytowanym zakresie katalogów. Zalecany dodatkowy grep całego `src/`
   przed ostatecznym zamknięciem Gate A, żeby nie zgubić realnego konsumenta spoza zakresu tego
   przebiegu.
8. **`GET /api/economics/finance-settings`** i **`PUT /api/economics/finance-settings`** — bez
   potwierdzonego konsumenta w tym przebiegu; możliwy konsument w Organization Settings (poza zakresem
   audytu). Sklasyfikowane INTERNAL_ONLY z zastrzeżeniem, nie z pewnością.

## 5. Metodyka i ograniczenia

- Cała inwentaryzacja to **statyczne czytanie kodu** przez 5 równoległych sub-agentów (bez połączenia z
  bazą, bez uruchamiania serwera, bez requestów HTTP) — zgodnie z twardym zakazem w briefie.
  Zaufanie/skala: rzędu **293 endpointów** przejrzanych w całości (żaden plik nie był próbkowany
  wybiórczo).
- Kolumna "Konsumenci" pochodzi z grep+Read po `src/services/api/`, `src/components/Economics/`,
  `src/components/Finance/`, `src/components/Benefits/`, `src/components/Results/`,
  `src/views/FullROIView.tsx`. **Nie jest to pełny grep całego `src/`** — endpointy oznaczone ⚠ "brak
  potwierdzonego" mogą mieć konsumenta poza tym zakresem (np. Organization Settings, Admin Panel,
  ekrany ROI spoza `views/FullROIView.tsx`). Traktować ⚠ jako "nie znaleziono w tym przebiegu", nie
  jako "na pewno nieużywane".
- Plik master planu (`FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`) **nie istnieje w tym
  worktree** — patrz EVIDENCE_MISSING na górze dokumentu. Klasyfikacja jest rekomendacją do
  potwierdzenia, nie cytatem z dokumentu źródłowego.
- Zero prób uruchomienia serwera nawet w trybie offline/disposable — statyczna analiza routera
  (grep+Read `router.get/post/put/patch/delete` i `app.use`) była wystarczająca do pełnej
  inwentaryzacji ścieżek i middleware bez potrzeby faktycznego bootowania Express.
