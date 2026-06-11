# M16 — Finanse — FAZA 5 (Kanony) + FAZA 6 (Bezpieczeństwo)

**Data:** 2026-06-11 · **Branch:** feat/deliverables-light · **Agent:** KANON+SEC
**Zakres:** FinanceHub (FE), routes `economics` / `finance-statements` / `financial-modeling` / `v8/finance` (BE)

---

## FAZA 5 — KANONY

### 1. §27 — tabele list (A–S)

**Lista statements/models/analyses/valuations (FinanceHub):**
- Renderowana przez `ModuleHub` + `TableWithPreviewLayout` + `FilterableTable` — `src/components/Economics/FinanceHub.tsx:60-82,1774-1808`. ZGODNE z kanonem (preview pane, filtry kolumn, column settings `enableColumnSettings`).
- Preview: single-click → boczny podgląd (`renderPreviewBody`/`renderPreviewFooter`), double-click → full. OK §27.A0.
- Empty/Error: `emptyMessage` per zakładka (FinanceHub:1737-1772). Error/retry — delegowane do FilterableTable (kanon). OK.
- **Odstępstwo (i18n):** komunikaty empty MIESZANE — `statements` po EN (`'No ready statements…'` 1739), a `models`/`analysis`/`valuation`/`investment` po PL hardkodowane (`'Brak modeli. Dodaj pierwszy model finansowy.'` 1763-1771). Niespójność PL/EN w jednym module. **P3.**
- **Odstępstwo (status chip):** brak `EntityStatusChip`/`statusChipTone()` w FinanceHub — status renderowany własnymi chipami runtime (`runtimeChips`, FinanceHub:1609+, `MetaChip` 1034). §27 wymaga `EntityStatusChip`. **P3.**

**Canonical financial table (sprawozdania):** `src/components/Finance/CanonicalStatementTable.tsx` — to **własny grid** (macierz pozycji × okresy z delta), NIE `TableWithPreviewLayout`. **Uzasadnione:** to tabela sprawozdania finansowego (matrix line-items), nie lista rekordów — §27 dotyczy tabel-list. Kolory przez tailwind tokeny (`slate/blue/emerald`, brak hex). OK z uwagą: `bg-blue-50` zamiast tokenu statusowego (kosmetyka, P3).

### 2. Wzorzec hubowy
- **ModuleHub** (nie MELS) — `FinanceHub.tsx:64-69,2132`. ZGODNE. Menu3 right-slot, AI button styles z kanonu (`getMenu3AiButtonClass`).

### 3. UI-standards
- Brak hex hardkodów w FinanceHub (`grep #[0-9a-f]{6}` = 0). CanonicalStatementTable też bez hex.
- Banner przez współdzielony `shared/Banner` (FinanceDegradedBanner.tsx). OK.
- **Brak EntityStatusChip** (lokalne chipy) — patrz wyżej.

### 4. i18n PL/EN
- **148× `t()`** w FinanceHub — przyzwoite pokrycie.
- **19× `isPolish`/`isPl`/`i18n.language`** inline-branching (FinanceHub) + CanonicalStatementTable `isPl` (linia 47) — antywzorzec jak M19 (25× isPolish). Działa, ale rozjazd PL/EN przy zmianie języka runtime. **P3.**
- Mieszanka EN/PL w empty messages (patrz §27). **P3.**

### 5. Stany + degraded banner V8→legacy
- **POTWIERDZONE: degraded banner DZIAŁA i jest WIDOCZNY dla usera** (w odróżnieniu od cichej pustki M13/M14).
  - `FinanceDegradedBanner` (`src/components/Economics/FinanceDegradedBanner.tsx`) — realny komponent: tytuł z liczbą issue, top-alert (severity destructive/warning/info), nextAction, akcja „View all". i18n przez `t()`.
  - Źródło: `useFinanceLane.ts:209-211` → `mapDegradedToAlerts(activeLaneRun.degraded)` z `V8FinanceApi.getLaneRuns()` (linia 112). Baner renderowany w FinanceHub:2156 wewnątrz ModuleHub.
  - Konkluzja: poz. 8 inwentarza („DZIAŁA") **potwierdzona** — user dostaje widoczny baner przy degradacji lane V8.

### 6. CARD_CONTENT_FORMULA
- **POTWIERDZONE n.d.** — analizy finansowe to sprawozdania/modele/wyceny (tabele, ratio panels, macierze), nie karty insight. Formuła kart nie obowiązuje.

---

## FAZA 6 — BEZPIECZEŃSTWO

### F-SEC-1 — [P0] IDOR cross-org: legacy `/api/financial-modeling/models/:id` bez filtra organizacji
**Dowód:**
- `server/src/services/financialModelingService.ts:1106-1114` — `getModel(modelId)` = `SELECT * FROM financial_models WHERE id = ?` — **BEZ `organization_id`**.
- Wszystkie endpointy by-id legacy używają TYLKO `getModel(modelId)` bez douczenia org:
  - `GET /models/:id` — `financial-modeling.routes.ts:168-216` (czyta cudzy model + source_statement/pack).
  - `PUT /models/:id` — `:218-230` (`updateModel(modelId, req.body)`).
  - `DELETE /models/:id` — `:232-251` (`DELETE FROM financial_models WHERE id = ?` :245 — usuwa cudzy model i outputs/validations/events).
  - `POST /models/:id/compute|...` — `:255+,322,358` — ten sam `getModel` bez org.
- **Brak jakiegokolwiek guardu na mount:** `Gateway.ts:1000` → `app.use('/api/financial-modeling', financialModelingRoutes)` — żadnego middleware (porównaj `/api/finance-statements` :994-999 ma `gatewayVerifyToken` + `highRiskSurfaceGuard`).
- **Kontrast — wersja V8 jest BEZPIECZNA:** `server/src/routes/v8/finance.routes.ts:321,380,405,443,471,501,519,590` — ten sam `getModel`, ale ZA KAŻDYM razem `if (!model || String(model.organization_id||'') !== organizationId) → 403/404`.
- **Wzorzec M20:** „legacy endpointy dosadzone raw-DB dziurawe" — V8 czyste, legacy modeling dziurawe. Każdy zalogowany user z dowolnej org może czytać/edytować/USUWAĆ modele finansowe innej firmy znając/zgadując `id`.
- **Fix:** w `getModel` przyjąć `orgId` i dodać `AND organization_id = ?`, albo na każdym `/models/:id*` douczyć org (jak v8). Najlepiej: zdeprecjonować/wyłączyć legacy `/api/financial-modeling` (V8 pokrywa funkcjonalnie).

### F-SEC-2 — [P1] Beta-lock TYLKO nawigacyjny — direct URL omija gating
**Dowód:**
- Beta CLOSED: `src/utils/betaAccess.ts:40` `MODULE_ECONOMICS: 'closed'`, `BETA_ADMINS_EXEMPT=false` (:32).
- Gating egzekwowany WYŁĄCZNIE w sidebarze: `src/components/navigation/Sidebar/Sidebar.tsx:152-156` (`lockClosedBetaModules`) + dispatch modala on-click (:248). Brak guardu na route — `src/providers/RouterSyncProvider.tsx` nie ma żadnego `beta`/`BETA_LOCKED`.
- Wejście `/finance` lub `/economics` bezpośrednio z URL renderuje FinanceHub bez beta-bramki (wzorzec M17/M18/M19/M20).
- **Częściowa mitygacja (policy, nie beta):** FinanceHub ma `usePolicySnapshot().isFeatureBlocked('finance')` (`FinanceHub.tsx:178-179,2114`) → ekran „restricted by organization policy". To jednak bramka POLITYKI org (płatność/plan), nie beta-CLOSED — jeśli polityka nie blokuje 'finance', closed-beta i tak jest dostępna z URL.
- **Uwaga:** dane finansowe są org-scoped na API (poza F-SEC-1), więc nie ma wycieku cross-org przez sam dostęp; ryzyko = ekspozycja niedokończonego closed-beta modułu. **P1** (nie P0 bo API broni danych).

### F-SEC-3 — ORG-SCOPE głównych endpointów — CZYSTE (poza F-SEC-1)
- **`economics.routes.ts`** — KONSEKWENTNIE org-scoped. Każde by-id `AND organization_id = ?` (np. analiza `:323`, scenariusze `:846`, wyceny przez `valuationSvc.getValuation(orgId, id)` `:1864`, budżety `budgetingSvc.getBudget(orgId, id)` `:2140`, financial_analyses `:1599,1649`). DELETE poprzedzone org-checked SELECT (`:2098,2204`). Export download org-scoped (`:2061`), path z DB (nie user input) → brak traversal. **CZYSTE.**
- **`finance-statements.routes.ts`** — guard helper `getStatementOrFail(id, orgId, res)` (`:2284-2302`) = `WHERE id = ? AND organization_id = ?`; użyty na każdym `/:id*` (`:815,956,1161,1366,1392,1512,1872…`). Listy/packi `WHERE fs.organization_id = ?` (`:1644,1771`). Endpoint `/:id/values/:valueId/explain` (`:1872` `WHERE fsv.statement_id=? AND fsv.id=?`) poprzedzony `getStatementOrFail` → bezpieczny. Mount ma `highRiskSurfaceGuard(['upload','export'])` (`Gateway.ts:996`). **CZYSTE.**
- **`v8/finance.routes.ts`** — `getV8Context(req).organizationId` + jawny re-check `model.organization_id !== organizationId` na każdym by-id (`:321…590`). Eventy `WHERE e.id=? AND m.organization_id=?` (`:569`). **CZYSTE.**
- Konkluzja: Finance NIE ma jednego wspólnego org-guarda — jest **per-endpoint**; trzy z czterech routerów robią to poprawnie, **legacy `financial-modeling` jest jedyną dziurą (F-SEC-1)**.

### F-SEC-4 — Import Excel / upload guard — OK
**Dowód:** `server/src/middleware/fileUpload.middleware.ts`
- Limit rozmiaru: `fileSize: 10 * 1024 * 1024` (10MB), `files: 1` (`:87-90`).
- Allowlist typu: `fileFilter` ext `pdf|xlsx|xls|docx|doc` + mime `pdf|spreadsheet|document|msword|ms-excel` (`:64-82`), inaczej reject „Only PDF, Excel, Word".
- Upload na statements: `upload.single('file')` (`finance-statements.routes.ts:275`), walidacja `if(!file) 400` (`:283`).
- **Formula/CSV-injection:** XLSX parsowany `XLSX.read({type:'buffer'})` → `sheet_to_csv` (`:219-237`) — wartości czytane, formuły NIE wykonywane po stronie serwera; brak eval. Niskie ryzyko. (FE ExcelImportWizard też waliduje `.xlsx/.xls` + 10MB, ale FE jest bypassowalny — liczy się BE guard, który JEST.)
- **OK.**

### F-SEC-5 — Billing 503-stub + flag self-serve — OK (honest)
**Dowód:**
- `billingSelfServeFlag` default **OFF** — `src/utils/billingSelfServeFlag.ts` (Decision D8: self-serve DEFERRED, default OFF; resolution: query→localStorage→env→OFF).
- `AddCardModal.tsx` — **brak fabrykowanego `pm_..._mock`** (usunięty; test `AddCardModal.honest.test.tsx` to weryfikuje). Gdy flag OFF → honest „billing handled manually". Gdy ON → realny Stripe SetupIntent, **bez fake-success** (`:46-47,117-128`).
- Serwer egzekwuje (nie tylko FE): `/setup-intent` gating na `process.env.STRIPE_SECRET_KEY` (`billing/billing.routes.ts:2698-2704`); token-billing Stripe inicjowany tylko gdy `STRIPE_SECRET_KEY` (`tokenBilling.routes.ts:46-50`, webhook wymaga `STRIPE_SECRET_KEY`+`STRIPE_WEBHOOK_SECRET` `:287`). Bez kluczy → realna niedostępność, nie fake. **OK.**
- (Pełny audyt billing należy do modułu billing M17; tu potwierdzam tylko styk Finance.)

### F-SEC-6 — Export do Outputs — org-scoped, OK
- FE `financeExportService.exportFinancialAnalysis` → `Api.post('/report-builder', {sourceId: analysisId})` (`src/services/financeExportService.ts:71`) — granica org po stronie report-builder.
- BE eksporty w economics (`/analyses/:id/export` `:1459`, `/valuations/:id/export/*` `:1954,2029`) — org-scoped (F-SEC-3). Brak wycieku cudzych.

### F-SEC-7 — Sekrety / PII w logach — CZYSTE
- Brak logowania `STRIPE_SECRET`/token/password w routach finance (`grep` = 0 trafień w economics/statements/modeling).
- `logFinanceEvent` loguje metadane (sizeBytes, mimeType, statementId) — bez treści PII finansowej. OK.

---

## PODSUMOWANIE SEVERITY
| ID | Sev | Tytuł | Dowód |
|---|---|---|---|
| F-SEC-1 | **P0** | IDOR cross-org legacy financial-modeling (read/update/DELETE) | financialModelingService.ts:1106 + financial-modeling.routes.ts:168-251 + Gateway.ts:1000 |
| F-SEC-2 | P1 | Beta-lock tylko nawigacyjny, direct URL omija | betaAccess.ts:40 + Sidebar.tsx:152 + RouterSyncProvider (brak guarda) |
| §27/i18n | P3 | Empty messages EN/PL mieszane | FinanceHub.tsx:1739-1771 |
| §27 | P3 | Brak EntityStatusChip (lokalne chipy) | FinanceHub.tsx:1609,1034 |
| i18n | P3 | 19× isPolish inline-branching | FinanceHub.tsx |

**CZYSTE:** org-scope economics/finance-statements/v8-finance (F-SEC-3), Excel upload guard (F-SEC-4), billing 503/flag (F-SEC-5), export Outputs (F-SEC-6), sekrety w logach (F-SEC-7), degraded banner widoczny (FAZA 5.5).
