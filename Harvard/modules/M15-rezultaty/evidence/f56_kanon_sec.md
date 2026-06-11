# M15 — Rezultaty (Results / Benefits Realization) — F5 KANON + F6 BEZPIECZEŃSTWO

Agent: KANON+SEC. Branch: feat/deliverables-light. Data: 2026-06-11.
Zakres: Hub `src/components/Results/ResultsHub.tsx` (ModuleHub, ~1610 l.); trasa `/benefits`
(`src/routes/AppRoutes.tsx`); serwer `/api/results` (results-kpi-reports.routes.ts),
`/api/benefits` (benefits.routes.ts, 1788 l. — legacy), `/api/results-v4`
(results-enterprise.routes.ts), `/api/v8/results` (v8/results.routes.ts, 2334 l. — kanon SSOT).
Beta CLOSED dla wszystkich (`src/utils/betaAccess.ts:39` MODULE_BENEFITS:'closed').

═══════════════════════════════════════════════════════════════════════════════
FAZA 5 — KANONY
═══════════════════════════════════════════════════════════════════════════════

## Wzorzec hubowy — ModuleHub vs MELS — ZGODNY
ResultsHub używa kanonicznego `ModuleHub` shell:
- `src/components/Results/ResultsHub.tsx:18-22` import ModuleHub, ModuleTab, useModuleOpenDocuments,
  HubWorkAreaLoadError, FilterChip; render `<ModuleHub>` 1327-1568.
- Open-documents przez `useModuleOpenDocuments('results')` (kanon).
- Werdykt: hub-pattern OK. Brak lokalnej kopii shellu.

## §27 TABLE_AND_PREVIEW_CANON — per tabela

### Tabela 1 — KPI Catalog (ResultsKpisTableV3.tsx) — PRIMARY, ZGODNA (wysoki)
- A0 PARITY: `TableWithPreviewLayout<PreviewKpi>` (l.40, render l.389) — preview pane ISTNIEJE
  (single-click → boczny panel, nie nawigacja). `FilterableTable` z ModuleHub (l.36-39) — filtry kolumn
  ISTNIEJĄ. ✅
- I Preview: pełny preview (PreviewMetaCard/PreviewRelations/PreviewActionBar/PreviewAIHintStrip l.21-27). ✅
- R i18n: t() wszędzie (l.243+ `results.columns.*`). ✅
- Werdykt: kanon-zgodna, brak istotnych odstępstw.

### Tabela 2 — KPI Reports (ResultsKpiReportsView.tsx) — ZGODNA (wysoki)
- A0: `TableWithPreviewLayout` (l.27) + `FilterableTable` (l.22-25) + `PreviewableItem`. ✅
- H Kebab: akcja 'preview'/'Open preview' (l.528-529) + akcje raportu. ✅
- Tryby tracked/schedules: hub przełącza `reportWorkspaceMode` ('tracked'); brak osobnej tabeli „schedules"
  jako cron — patrz niżej (SEC: brak server-cron).
- Werdykt: kanon-zgodna.

### Tabela 3 — KPI Scorecards (ResultsKpiScorecardsView.tsx) — render w hubie (l.1544). Średni priorytet;
  bazuje na tym samym runtime; nie audytowano komórka-po-komórce (poza zakresem czasu) — REKOMENDACJA: A–S smoke.

### Tabela 4 — Tracked Initiatives (ResultsInitiativesView.tsx) — render w hubie (l.1447)
- Używa `statusChipTone` z kanonicznego `EntityStatusChip`
  (`src/components/ui/primitives/chips/EntityStatusChip` l.29) — kolory sygnałów z SSOT (§27.K). ✅

### Tabela 5 — Grid/Card view (ResultsKPITable.tsx → export ResultsGridView, l.51 hub) — ODSTĘPSTWO (P3)
- To NIE jest główna tabela list — to alternatywny widok grid/card (`ResultsGridView`).
- Surowy `<table className="w-full">` (l.354) z własnym `ColumnFilterDropdown` (l.135) + sort (l.238-315)
  + `onRowClick` (l.225) — ale BEZ `TableWithPreviewLayout` (preview pane brak w tym wariancie).
- Ocena: dopuszczalne jako grid-fallback (główny katalog = KpisTableV3 z pełnym preview). Gdyby był to
  jedyny widok list — byłoby blokujące A0. Tu: P3 (drobne, wariant pomocniczy).

## UI-standards — kolory / chipy / lokalne kopie — CZYSTO
- Hardkody hex w ResultsHub.tsx: **0** (`grep #hex` = 0). ✅
- EntityStatusChip importowany w InitiativesView (kanon, nie lokalna kopia). ✅
- `isPolish` anty-wzorzec (jak M19 25×/M16 19×): **0 wystąpień** w `src/components/Results/`. ✅

## i18n PL/EN — DOBRY (kontrast do M18 EN-only)
- ResultsHub: **134× `t(...)`** z bilingual fallback (`t('results.runtime.showcase','Showcase data')`).
- Brak hardcoded PL/EN mieszanki, brak `isPolish`. Werdykt: i18n zdrowy, nie powiela patologii M16/M18/M19.

## Stany empty / loading / error — OBECNE
- loading (`setLoading`), error (`kpiLoadError`+`kpiLoadErrorCode`, `mapHubLoadFailureToPresentation`),
  empty (`source:'empty'`) — ResultsHub.tsx l.307-326, HubWorkAreaLoadError. ✅

## ⚠️ DEGRADED BANNER V8→legacy — BRAK (cicha pustka jak M13/M14) — P2 (UX/zaufanie)
- `src/components/Results/kpiRuntime.ts:39-74`: gdy V8 (`/api/v8/results`) rzuci błąd i
  `shouldFallbackToLegacyResults(error)` → fallback na **deprecated `/api/benefits/kpis` + `/kpi-mappings`**,
  ustawia `source:'legacy'` (l.73).
- `setResultsSource(result.source)` (ResultsHub.tsx:315), ale w UI **`'legacy'` NIE jest renderowany
  NIGDZIE** — chip/banner pojawia się TYLKO dla `'showcase'` (ResultsHub.tsx:909-919). Brak jakiegokolwiek
  warunku na `'legacy'` w całym ResultsHub.tsx (grep: jedyne wystąpienie to definicja typu l.207).
- Skutek: degradacja do legacy jest **cicha** — user widzi dane jakby były governed/V8, jedyny ślad to
  `console.warn` (kpiRuntime.ts:44-49). To wzorzec „cicha pustka" M13/M14, NIE działający banner M16.
- REKOMENDACJA: dodać widoczny degraded-banner dla `source==='legacy'` (jak M16).

## SHOWCASE / demo — OZNACZONE (wzorowo) + bez wycieku cross-org
- `source==='showcase'` → render `ResultsRuntimeChip label="Showcase data" value="local"` z błękitną kropką
  (ResultsHub.tsx:909-919). User WIDZI że to demo. ✅ (lepiej niż brak oznaczenia).
- `shouldUseResultsShowcaseData()` (resultsShowcaseData.ts) = `shouldAllowDemoData()` — komentarz: „Demo data
  must NEVER auto-activate… No localhost/DEV/hostname auto-trigger". Aktywacja tylko po jawnym toggle usera.
- Dane showcase = statyczne fixtures w pliku FE (`createResultsShowcaseKpis/Initiatives`) — te same dla
  każdego kto włączy demo; NIE pochodzą z DB innej org → brak wycieku cross-org. ✅ (SEC-OK).

## CARD_CONTENT_FORMULA — n.d. (zgodnie ze zleceniem).

═══════════════════════════════════════════════════════════════════════════════
FAZA 6 — BEZPIECZEŃSTWO
═══════════════════════════════════════════════════════════════════════════════

## SEC-1 [P0] — RBAC / approval-gating V8 oparte na PODRABIALNYM nagłówku HTTP
Plik: `server/src/routes/v8/results.routes.ts`
- `:100` `const P04_KPI_ROLE_HEADER = 'x-kpi-role';`
- `:108-113` `p04KpiRoleFromRequest`:
  ```
  const raw = String(req.headers['x-kpi-role'] ?? 'viewer').toLowerCase();
  return P04_CANON_KPI_ROLES.includes(raw) ? raw : 'viewer';
  ```
- `:127-137` `p04AssertKpiPermission` → `canPerformKpiAction(role, action)` (kpiWorkflowCanon.ts:268),
  matryca uprawnień `KPI_PERMISSION_MATRIX` (kpiWorkflowCanon.ts:248-263).
- PROBLEM: rola brana WYŁĄCZNIE z nagłówka żądania klienta, BEZ porównania z realną rolą usera w org.
  Domyślnie `viewer`, ale każdy klient może wysłać `x-kpi-role: kpi_owner` (lub finance_owner) i przejść
  WSZYSTKIE bramki: `delete_kpi` (:605), `edit_definition` (:336,:414), `create_report` (:1357),
  `manage_deviation` (:782,:826,:872,:925,:992), `manage_reconciliation` (:2182), `create_signal`,
  `create_next_action`. To pełny bypass in-org authorization + approval-gating raportów.
- ZASIĘG: tylko WEWNĄTRZ org (organizationId pochodzi z `getV8Context`/tokena, NIE z nagłówka — cross-org
  bezpieczne, patrz SEC-2). Ale dowolny zalogowany członek org (np. viewer) może usuwać KPI, edytować
  definicje, tworzyć/„zatwierdzać" raporty, rozwiązywać rekoncyliacje.
- DOWÓD dodatkowy: matryca działa poprawnie (viewer nie ma delete) — luka jest w ŹRÓDLE roli, nie w matrycy.
- FIX: wyprowadzać rolę KPI z realnego kontekstu (capability/permissionService po userId+org), nie z nagłówka;
  nagłówek najwyżej jako podpowiedź zawężająca, nigdy podnosząca uprawnienia.

## SEC-2 [OK / NEGATIVE FINDING] — ORG-SCOPE: M15 CZYSTY (kontrast do core/M16-HYBRYDA)
Sprawdzono próbkę by-id/by-:kpiId/:reportId/:initiativeId we wszystkich 3 warstwach. Wszystkie filtrują org.

V8 (`v8/results.routes.ts`) — `organizationId` z `getV8Context(req)` (token), nie z URL/body:
- PUT `/kpis/:kpiId` :449-451 `WHERE k.id = ? AND COALESCE(k.organization_id,i.organization_id)=?`
  [kpiId, organizationId] — ownership SELECT przed UPDATE. ✅
- DELETE `/kpis/:kpiId` :622 `WHERE k.id=? AND COALESCE(...)=?` [kpiId, organizationId]. ✅
- POST `/deviation-cases/:caseId/acknowledge` :792-794 ownership SELECT `WHERE id=? AND organization_id=?`
  + UPDATE `WHERE id=? AND organization_id=?` :806-810. ✅
- POST `/reconciliations/:reconciliationId/resolve` :2185 `resolveReconciliation(id, organizationId, status)`. ✅
- POST `/signals/:signalId/acknowledge` :2240 `acknowledgeKpiSignal(id, organizationId, ...)`. ✅
- GET `/dashboard`,`/kpis/catalog`,`/roi/initiative/:initiativeId/*` — wszystkie [param, organizationId]. ✅

Legacy (`benefits.routes.ts`, `router.use(verifyToken)`, `getOrgId(req)` z tokena) — KLUCZOWE: sprawdzono
wzorzec M16 (legacy getModel `SELECT WHERE id=?` BEZ org). W M15 legacy NIE występuje — wszystkie by-id mają org:
- PUT `/kpis/:kpiId` :247-253 ownership SELECT `WHERE k.id=? AND COALESCE(k.organization_id,i.organization_id)=?`
  [kpiId, orgId] → 404 jeśli nie należy; UPDATE po sprawdzeniu. ✅
- DELETE `/kpis/:kpiId` :313-319 analogicznie + cascade DELETE z `AND organization_id=?` (:323-352). ✅
- GET `/kpis/:kpiId/time-series` :371-385 `WHERE ts.kpi_id=? AND ts.organization_id=?`. ✅
- GET `/kpis/:kpiId/deviation-cases` :524-535 `WHERE organization_id=? AND kpi_id=?`. ✅
- POST `/deviation-cases/:caseId/{acknowledge,rca,actions,resolve,close}` — każdy: ownership SELECT/UPDATE
  `WHERE id=? AND organization_id=?` (:599-610, :642-651, :686 itd.). ✅
- GET/PUT `/roi/:initiativeId/assumptions` :1285-1287, :1356-1359 `WHERE initiative_id=? AND organization_id=?`. ✅
- GET `/roi/:initiativeId/realized`,`/variance` :1361, :1407-1414 `AND organization_id=?`. ✅
- GET `/attribution/:kpiId/*`, `/financial/*` :1474+ — org-scoped.

results-kpi-reports.routes.ts (`/api/results`, verifyToken+getOrgId):
- GET `/kpi-reports/:snapshotId` :352 `getKpiReportSnapshot({organizationId:orgId, snapshotId})`;
  serwis kpiReportSnapshotService.ts:463 `WHERE id=? AND organization_id=?`. ✅
- POST `/kpi-reports/:snapshotId/refresh` :370 ten sam org-scoped lookup przed refreshem. ✅

WERDYKT: M15 = brak systemowego cross-org IDOR (ani legacy, ani V8). NIE jest HYBRYDĄ jak M16/M20 —
legacy `benefits.routes` jest tu konsekwentnie org-scoped (autor dodał ownership-SELECT do każdego by-id).

## SEC-3 [P3] — Drobne: INSERT/UPSERT bez weryfikacji własności rodzica (data-pollution, bez cross-org read)
Plik: `server/src/routes/benefits.routes.ts`
- POST `/deviation-cases/:caseId/actions` :674-700: robi SELECT `kpi_id … WHERE id=? AND organization_id=?`
  (:684), ALE nie blokuje gdy `deviationCase` = null — i tak INSERT action z `case_id` z URL (:691-695).
  Można dopiąć action do nieistniejącego/cudzego caseId. Wpływ ograniczony (action niewidoczny bez dostępu
  do org-scoped case GET). P3.
- PUT `/roi/:initiativeId/assumptions` :1294 + POST `/roi/:initiativeId/realized` :1368: INSERT z
  `initiative_id` z URL + `organization_id=orgId` z tokena, BEZ sprawdzenia że initiative należy do org.
  Skutek: można utworzyć roi_assumptions/realized dla dowolnego initiativeId, ale otagowane WŁASNĄ org →
  brak cross-org read (GET filtruje `AND organization_id=?`). To data-pollution własnej przestrzeni, P3.

## SEC-4 [n.d.] — Reports approval/finalization-gating — EGZEKWOWANE SERWEROWO (stan danych)
Plik: `server/src/routes/v8/results.routes.ts`
- POST `/kpi-reports` :1374-1387 `findKpiReportFinalizationViolation({organizationId, kpiIds})`
  (def :162-) → blokuje 409 gdy KPI w statusie finalized/locked lub istnieje finalized snapshot dla scope
  (`RESULTS_FINALIZED_REPORT_STATUSES=['finalized','locked','approved']` :153). Guard org-scoped, oparty
  na stanie danych (nie na nagłówku) — POPRAWNY i nie do obejścia headerem.
- ALE bramka roli PRZED guardem (`create_report` :1357) zależy od podrabialnego nagłówka (SEC-1). Czyli:
  „kto może utworzyć raport" = bypass (P0), „czy można nadpisać sfinalizowany" = solidne (OK).

## SEC-5 [n.d.] — Cron / schedules — BRAK server-side cron w Results
- `grep schedule|cron` w v8/results + benefits + results-kpi-reports: brak harmonogramów/cron.
- Jedyny tło-runner: `ResultsEnterpriseRuntimeExecutor.start(60_000)` (index.ts:504-506) — wewnętrzny
  executor runtime, nie user-plannable cron. Tworzenie raportów jest on-demand. „Reports schedules" jako
  encja z bramką roli/capability NIE istnieje serwerowo. Brak findingu.

## SEC-6 [P2] — Connectors (IRIS, poz.3 Reports): SEKRETY PLAINTEXT at rest + zwracane non-adminom
Pliki: `server/src/routes/mcp.routes.ts`, `server/src/routes/benefits.routes.ts`,
`server/src/services/mcp/mcpProviderClient.ts`
- Konfiguracja providera (zawiera sekret: `mes_api_token`/`MES_API_TOKEN` → `Authorization: Bearer` oraz
  dowolne `headers`) — mcpProviderClient.ts:184-192, :154/:176.
- Zapis: `mcp.routes.ts:91-93` INSERT `mcp_providers(... config ...) VALUES (..., JSON.stringify(config))` —
  PLAINTEXT JSON, brak encrypt (grep encrypt w mcp.routes = 0). Wzorzec plaintext jak M25/M20 SSO. (Write
  gated `verifyAdmin` :80.)
- Odczyt sekretu: `benefits.routes.ts:937-948` (`/kpis/:kpiId/refresh/iris`) i `:1082` (`/iris/health`)
  czytają `config` z DB (org-scoped) — to OK serwerowo.
- BROADENING: `GET /api/mcp/providers` (`mcp.routes.ts:60-75`) ma TYLKO `verifyToken + isAuthenticated`
  (NIE verifyAdmin) i zwraca kolumnę `config` (z tokenem IRIS w plaintext) DOWOLNEMU członkowi org. Czyli
  każdy zalogowany user widzi sekret konektora. P2 (sekret w spoczynku plaintext + nadmierna ekspozycja
  odczytu). FIX: szyfrować config at rest, maskować/strippować sekrety w GET, ograniczyć GET do admina.

## SEC-7 [OK] — Sekrety / PII w logach — CZYSTO
- `benefits.routes.ts:1061-1068` IRIS failure log = {orgId, kpiId, providerId, error(msg), retriable} —
  bez tokenu/config/PII. ✅ Brak logowania sekretów w Results.

## SEC-8 — Trzy warstwy gatingu trasy `/benefits`
1. NAWIGACJA (Sidebar): beta CLOSED — `betaAccess.ts:39` MODULE_BENEFITS:'closed', konsumowane w
   `Sidebar.tsx` (l.352 / menuConfig.ts:110). Ukrywa/blokuje w UI nawigacji.
2. ROUTE (`AppRoutes.tsx:2136-2150`): TYLKO `ProductionModuleGate` (l.567-576) — ten gate sprawdza WYŁĄCZNIE
   `hideNonCoreModulesOnPublicProduction` (hostname public-prod), NIE beta-closed. **Brak beta-locka na trasie.**
3. API: `verifyToken` (benefits/results), `v8FeatureGate` (ENABLE_V8_GLOBAL env, NIE beta) na /api/v8. Brak
   bramki beta/RBAC modułu na endpointach.
- WERDYKT [P2]: beta-lock TYLKO nawigacyjny — wpisanie URL `/benefits` wprost OMIJA blokadę beta i renderuje
  ResultsHub (tożsame z patologią M16-M20). Endpointy też nie mają bramki beta. Direct-URL bypass.

═══════════════════════════════════════════════════════════════════════════════
PODSUMOWANIE FINDINGÓW
═══════════════════════════════════════════════════════════════════════════════
P0  SEC-1  RBAC/approval V8 z podrabialnego nagłówka `x-kpi-role` → in-org bypass (delete/edit/report/recon)
P2  SEC-6  Connector IRIS: sekret plaintext at rest + `GET /api/mcp/providers` zwraca config non-adminom
P2  SEC-8  Beta-lock tylko nawigacyjny; trasa `/benefits` direct-URL omija (route ma tylko ProductionModuleGate)
P2  KANON  Degraded banner V8→legacy BRAK — cicha degradacja (source='legacy' nigdzie w UI), wzorzec M13/M14
P3  SEC-3  INSERT/UPSERT (actions, roi assumptions/realized) bez weryfikacji własności rodzica (data-pollution)
P3  KANON  ResultsGridView (raw <table>) bez TableWithPreviewLayout (wariant grid, nie główna tabela)
OK  SEC-2  ORG-SCOPE czysty we wszystkich warstwach (legacy + V8) — brak cross-org IDOR; NIE hybryda
OK  SEC-4  Finalization-gating raportów egzekwowane serwerowo (stan danych); SEC-5 brak server-cron
OK  SEC-7  Brak sekretów/PII w logach; showcase oznaczony chipem + bez wycieku cross-org; i18n zdrowy (134× t)
