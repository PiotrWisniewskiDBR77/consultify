# M16 — Finanse — FAZA 1: Prawda kodu

Branch: feat/deliverables-light. Metoda: czytanie kodu runtime (services/routes/migracje), nie dokumentów.
Hub żywy: `src/views/EconomicsView.tsx:22` (`<FinanceHub/>`) ← routed `src/routes/AppRoutes.tsx:1760/1775/1790` (/finance, /economics, deep-linki). Beta CLOSED dla wszystkich.

## WERDYKT NACZELNY
**Analizy finansowe są REALNE — prawdziwe obliczenia na danych, nie demo/placeholder.** Persistencja = realne tabele Postgres (raw SQL migracje, brak fasady `new Map()`). Billing honest (mock usunięty, kill-switch OFF, 503-stub bez Stripe). Cross-org IDOR: **Finanse CZYSTE** (org-scope konsekwentny). Jedyny realny brak: sync M20→Finance to STUB (Finanse nic nie odbierają).

---

## TABELE 1a–1d: werdykty per pozycja INV

| # | Pozycja | Werdykt | Dowód |
|---|---------|---------|-------|
| 1 | Statements (import Excel, canonical table, mapping, ratio, validation, explain) | **REALNE** | xlsx parse `finance-statements.routes.ts:221` (ranking arkuszy, sheet_to_csv); persist do `financial_statements/_values/_lines` (migracja `20260316_financial_statement_packs.sql`); analytics rekurencyjny `financeStatementAnalyticsService.ts:136-200` (formuły z `formulaJson`, difference/sum) na realnych wierszach `financial_statement_values` (SELECT `:185+`) |
| 2 | Modele finansowe (lista+create+workspace) | **REALNE** | `financialModelingService.computeModel():643` — silnik monthly z growthFactor `Math.pow(1+g/100, m/12):630`; output persist `INSERT INTO financial_model_outputs:950/966`; create `INSERT INTO financial_models:1042`; 32× dbRun/dbAll |
| 3 | Analiza finansowa (+create) | **REALNE** | `financialAnalysisService.ts`: `computeRatios():560` (current/quick/gross/net margin, EBITDA, labor/energy ratio — formuły księgowe z safeDiv/safePct), `computeVerticalAnalysis():512`, `computeHorizontalAnalysis():532`; dane z `StatementData` (pl/bs/cf po kodach kanonicznych) |
| 4 | Predykcja (forecasty modeli + budżety) | **REALNE** | silnik `computeModel` generuje okresy/projekcje; budżety przez economics.routes `/budgets`; brak fabrykacji |
| 5 | Wycena przedsiębiorstw (valuations+workspace) | **REALNE** | `valuationService.ts`: DCF z WACC breakdown `:33/192`, terminal Gordon/exit_multiple `:18`, FCFF, dyskonto `Math.pow:72`; persist `INSERT INTO valuations:236` (migracja `571_valuation_t055_t056_t057.sql`) |
| 6 | Analiza inwestycyjna (investment_case) | **REALNE** | `computeInvestmentRatios():264` — **realne NPV i IRR**: zdyskontowane CF `:283` (`Σ cf/(1+r)^i`), IRR przez bisekcję `:296-318` (zbieżność `<0.0001`), payback z interpolacją `:318` |
| 7 | Runtime V8 za flagą + degradacja legacy | **REALNE (dual-runtime)** | `useFinanceData.ts:63-159`: próbuje `V8FinanceApi`, na błąd `shouldFallbackToLegacyFinance()` → legacy `/api/finance-statements/packs`, `/api/financial-modeling/models`, `/api/economics/financial-analyses`; przy total-fail honest error "real source failed" (BEZ demo-fabrykacji nawet gdy demo ON `:73-84`) |
| 8 | Degraded banner + lane strip | **DZIAŁA** | `FinanceHub.tsx:2156` `<FinanceDegradedBanner degradedAlerts={lane.degradedAlerts}/>`, `FinanceLaneStrip`/`FinanceLanePanel` zasilane `useFinanceLane`; degradacja NIE jest niemą pustką |
| 9 | Export do Outputs | **REALNE** (za flagą beta) | `src/services/financeExportService.ts` obecny; eksport wpięty w hub |
| 10 | Czat Teresy | **DZIAŁA** | `FinanceHub.buildFinanceTeresaPrompt` (ref `useOpenChatWithContext.ts:159`) |
| 11 | Token-billing 503-stub bez Stripe | **STUB (honest)** | `billing/tokenBilling.routes.ts:19` `notConfigured → 503 not_configured`; Stripe init tylko gdy `STRIPE_SECRET_KEY:51`; checkout tylko gdy `stripe && pkg.stripe_price_id:253`; webhook 400 gdy brak sekretów `:291`. **Brak fake-success.** |
| 12 | AddCardModal — mock usunięty, kill-switch OFF | **HONEST (flaga OFF)** | `pm_..._mock` w runtime **USUNIĘTY** (grep: tylko komentarze/testy dokumentujące usunięcie — `billingSelfServeFlag.ts:9`, `AddCardModal.honest.test.tsx`); domyślnie OFF `billingSelfServeFlag.ts:28,48,77`; OFF→panel "billing handled manually" `AddCardModal.tsx:78`; ON→realny SetupIntent (sukces tylko gdy `STRIPE_SECRET_KEY`), brak fake-success |

## TABELA 1e — Wiring (encja → tabela DB)

| Encja | Tabela / migracja | In-memory? |
|-------|-------------------|------------|
| Statements (packi/linie/wartości) | `financial_statement_packs`, `financial_statements`, `financial_statement_lines`, `financial_statement_values`, `financial_ratio_snapshots` (`20260316_*`, `567_*`) | NIE — realne (dbRun/dbGet/dbAll via DbPromise; 41× w statement service) |
| Modele | `financial_models`, `financial_model_outputs` (`570_*`) | NIE — realne |
| Analizy | `financial_analyses`, `analysis_financials`, `digitization_analyses` (`068_*`, `618_*`) | NIE — realne |
| Valuations | `valuations`, `valuation_snapshots` (`571_*`, `573_*`) | NIE — realne |
| v8 integracja | `v8_initiative_economics_linkages`, `tp_module_sync_results` (`20260323_v8_*`) | NIE — realne |

**Persistencja-fasada (wzorzec M18 `new Map()` udające DB): NIE WYSTĘPUJE.** Jedyne `new Map()` w finansach to lokalne bufory obliczeniowe `financeStatementAnalyticsService.ts:222-223` (grupowanie wierszy w pamięci podczas requestu), nie magazyn. Encje przeżywają restart — Postgres.

**MARTWY HUB jak BenefitsHub: BRAK.** FinanceHub jest jedynym hubem i jest żywy (routed + renderowany). `EconomicsViewPlaceholder.tsx` = martwy plik (zero importów poza self), ale to placeholder, nie równoległy fałszywy hub.

## TABELA 1f — Flagi (realne defaulty runtime)

| Flaga | Default runtime | Dowód |
|-------|-----------------|-------|
| Beta gate `MODULE_ECONOMICS` | **'closed'** + `ALLOW_PRIVILEGED_BYPASS=false` → pełna blokada wszystkich | `src/utils/betaAccess.ts:40,30` |
| `useV8FeatureFlag('finance')` | serwerowy flag (per-org), FE `FinanceHub.tsx:177`; degradacja do legacy gdy OFF/błąd | `useFinanceData.ts:63-159` |
| `VITE_BILLING_SELF_SERVE` / `billingSelfServeFlag` | **OFF** (env null→false `:48`; final `:77` `readEnvFlag`) | `billingSelfServeFlag.ts:28,44-52,72-78` |

## TABELA 1g — Połączenia

| Połączenie | Status | Dowód |
|-----------|--------|-------|
| Inicjatywy ROI/economics ← M13 | **REALNE** | `v8/financeIntegrationService.ts:311` `INSERT INTO v8_initiative_economics_linkages` (finance_model_ref ↔ initiative_id) |
| Export → Outputs (M17) | obecne (za beta) | `financeExportService.ts` |
| **Governed sync z Tabel (M20) → Finance** | **STUB — POTWIERDZONE Z DRUGIEJ STRONY: Finanse NIC nie odbierają** | `table-platform.routes.ts:3454` woła `syncToModule(modelId,'finance',...)`, a `tablePlatform/ModuleSyncService.ts:57-110` jedynie liczy rekordy źródłowe i pisze wiersz do **`tp_module_sync_results`** (tabela-most/log). Brak jakiegokolwiek INSERT/UPDATE do `financial_*`. Żadna tabela Finanse nie konsumuje `tp_module_sync_results`. |

## SEC — próbka org-scope (cross-org IDOR)

**Finanse CZYSTE** (zgodnie z mapą: rdzeń M16 trzyma się org-scope). Wszystkie sprawdzone `:id` filtrują po `organization_id`:

- `economics.routes.ts:302` GET `/analyses/:id` → `WHERE da.id=? AND da.organization_id=?` (`:322`), 401 gdy brak orgId
- `finance-statements.routes.ts` — gatekeeper `getStatementOrFail(id, orgId, res)` → `SELECT * FROM financial_statements WHERE id=? AND organization_id=?`; 401 gdy brak org, 404 gdy nie nasze; użyty na każdym `:id` (`:815,956,1161,1366,1392`)
- `valuationService.ts:278/296/302` → `WHERE id=? AND organization_id=?`; modele/analizy krzyżowo `String(model.organization_id)!==orgId` (`:118,324`)
- `v8/finance.routes.ts` — `getV8Context(req)` + `String(model.organization_id)!==organizationId` na `:id` (`:324,380,405`); 138 odniesień do organizationId

Brak gołych `WHERE id=?` bez org na próbce 6 endpointów. Sygnał IDOR: **negatywny dla Finanse**.

---

## PODSUMOWANIE SYGNAŁÓW
- Fabrykowane liczby finansowe: **NIE** — NPV/IRR/DCF/WACC/ratios to realna matematyka na danych z DB.
- Persistencja-fasada: **NIE** — realne tabele Postgres, przeżywają restart.
- Fake billing success: **NIE** — 503-stub bez Stripe, mock pm usunięty, self-serve OFF.
- Ciche degradacje: **NIE** — degraded banner + honest error states.
- Martwy hub: **NIE** (FinanceHub żywy).
- **Realny dług**: (a) M20→Finance sync to stub-log (Finanse nic nie konsumują); (b) `EconomicsViewPlaceholder.tsx` martwy plik.
