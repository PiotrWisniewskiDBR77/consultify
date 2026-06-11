# M14 — Wdrożenie (Execution) — Karta F5+F6 (KANON + SEC)

Data: 2026-06-11 · Agent: KANON+SEC · Branch: feat/deliverables-light
Hub: `src/components/Execution/ExecutionHub.tsx` (5048 l.), trasa `/implementation` (alias `/execution`, `/rollout`→redirect)
API: `/api/execution/*` (PMO), `/api/rollout/*`, `/api/executive/aggregate`, `/api/execution-control/*` (legacy, deprecated), `/api/v8/execution-control/*`, `/api/v8/execution/*` (spine), `/api/execution-modules/*` (governance read-only)

---

## FAZA 5 — KANONY

### 1. §27 TABLE_AND_PREVIEW_CANON — per tabela

| Tabela / powierzchnia | Komponent | Renderer | A0 (preview/filter/sort/resize/sticky/kebab/bulk/stany) | Odstępstwa |
|---|---|---|---|---|
| **Portfel egzekucji** (tab `list`, viewMode `table`) | ExecutionHub:4811-4904 | `TableWithPreviewLayout` + `FilterableTable` | ✅ komplet — preview pane, filtry (`activeFilters`), sort, resize, sticky header, kebab (`getRowActions`), persistKey `execution-summary`, empty (`execution.empty.noInExecution`), loading (`HubWorkAreaLoading`), error (4672-4709 z retry) | **Bulk bar = tylko „N selected · Clear"** (4855-4870) — łamie §27.D Formuła 2 i A0 „pasek bulk ma akcje": po Clear **0 innych przycisków** → FAIL 🔴. Kebab: `Open/Edit/Archive/Delete` ale Archive/Delete/Delay `disabled` „Wkrótce (backend)" (2386-2414) — dolna strefa OK (slot widoczny), ale brak realnego soft-archive/scope (§27.H/§14). |
| **Raporty** (tab `reports`, viewMode `table`) | ExecutionHub:4472-4541 | `TableWithPreviewLayout` + `FilterableTable` | ✅ preview, filtry, sort, kebab, persistKey `execution-reports` | Kebab Edit/Archive `disabled` (katalog generowany — uzasadnione). **Brak bulk bar w ogóle** dla raportów (§27.D Formuła 2 nieobsłużona) — N/A częściowo (katalog read-only), ale brak deklaracji. Presety Menu 3 mają **hardkodowane liczniki** `count: 11/4/4/2/2/5` (3338-3343) i hardcoded label `'Weekly'/'Monthly'/'Bi-weekly'/'On demand'/'Sponsor'` poza i18n → FAIL §27.R. |
| **Rollout — KPI / Risks / Changes / Closures** (tab `rollout`) | RolloutTab.tsx:1125-1148 (`RegisterTable`) | **surowy `<table>`** (RolloutTab:1130) | ❌ **BRAK preview pane, BRAK filtrów kolumn, BRAK sortu, BRAK resize, BRAK kebaba, BRAK bulk, BRAK portalowego popovera kolumn** | 🔴🔴 **Blokujące** — `RegisterTable` to ręczny `<table>` (RC-5, §27.A „brak surowego `<table>`"). Tylko sticky header + divide-y. Single-click nie otwiera preview. Cała powierzchnia Rollout jest poza maszynerią kanonu §27. To **5 osobnych tabel listowych** (KPI, Risk register, Change log, Closure checklist, + Master Rollout Plan) bez ani jednego punktu A0 poza sticky. |
| **Manager — Problem lanes** (tab `people_change`) | ProblemTable.tsx:273-320 | **CSS grid** (`grid-cols-[...]`), nie `FilterableTable` | Częściowo: sticky-ish header, kebab `RowActionsMenu` (381), keyboard nav (handleKeyDown), preview (`ProblemPreview`) | Brak `FilterableTable` → brak filtrów kolumn / sortu / resize / persistKey / portalowego popovera kolumn. Kolumna „Overdue" osobna (§27.F: termin = jeden `DueChip`) → FAIL. |

**Werdykt §27:** Portfel + Raporty = w maszynerii (`TableWithPreviewLayout`/`FilterableTable`), z lukami (bulk bar bez akcji, hardkody w presetach raportów). **Rollout (5 tabel) = całkowicie poza kanonem — surowy `<table>`, zero A0** → największy dług kanonowy modułu. Manager = grid hybryda bez filtrów/sortu.

### 2. Wzorzec hubowy
✅ ExecutionHub używa współdzielonego `ModuleHub` (4978-5019): taby (`tabs`), Menu 2 (search/view-modes/filters/CTA), Menu 3 (`commandRowContent`), breadcrumbs przez `MainLayout` (AppRoutes:1848 `['Implementation']`), document-tabs cross-module. Zgodny z `ModuleHub`. Taby chromeless (`people_change`, `rollout`) świadomie wyłączają document-tabs/filtry (4926-4928) — OK.

### 3. UI-standards — hardkody kolorów
- ⚠️ **180 trafień klas surowych kolorów** (`rose-/blue-/emerald-/amber-/red-/green-/slate-`) w ExecutionHub. Większość to ikony sygnałowe (`text-rose-400`, `text-blue-400`) i akcenty Kanbana — tolerowane jako sygnały, ale nie zawsze przez tokeny `c.*`.
- ✅ Status w tabeli portfela = `EntityStatusChip` (1885), termin = `DueChip` (1980) — zgodne §27.F.
- ❌ RolloutTab `DerivedKpiGrid` (1164-1177): hardkodowane `bg-crimson-50/amber-50/emerald-100/slate-100` zamiast chipów `c.*`/`EntityStatusChip`. Sparkline `bg-emerald-500/30` (1116).
- ❌ exec-chip w `rightControls` (2135-2146): `text-emerald-500/text-rose-500/text-amber-500/text-primary-500` na surowo.
- Brak lokalnych kopii komponentów współdzielonych (preview/footer reuse z `InitiativePreviewV3*`, `ReportDocumentView`).

### 4. i18n PL/EN
- ✅ Klucze `execution.*` w PL i EN **symetryczne** (399 = 399, zero rozjazdu między plikami).
- 🔴 **~141 kluczy `t(...)` użytych w kodzie M14, których NIE MA w `public/locales/pl/translation.json`** (działają tylko przez inline-fallback drugiego argumentu, więc render OK, ale to dług i ryzyko EN-only). Główni winowajcy: `WhyRedChain.tsx` (8 kluczy `execution.whyRed.*`), `ExecutionTimelineView.tsx` (15× `execution.timeline.deps.*`), `PeopleChangeWorkspace.tsx` (14× `capability.*`/`change.*`/`stakeholder.*`), `RolloutTab.tsx` (11× statusy KPI/risk/change derived), `ReportCompactPanel/ReportDocumentView` (`execution.reportPanel.*`), `ExecutionHub` (`execution.actionCenter.*`, `execution.hub.loadErrorTitle`, `common.archive/clear/delay/comingSoonBackend`). Pełna lista w sekcji „Dowody i18n" niżej.
- 🔴 Hardcoded stringi UI (poza `t()`): presety raportów `'Weekly'/'Monthly'/'Bi-weekly'/'On demand'/'Sponsor'` (ExecutionHub:3339-3343); `'No history yet'` (RolloutTab:1106); `'exec v2'`/`exec-chip` etykieta techniczna (2133).

### 5. Stany standardowe + cicha degradacja v8
- ✅ Portfel: loading (`HubWorkAreaLoading`), error z retry (4672-4709), empty (i18n). RolloutTab: loading + error z retry/dismiss (641-655).
- 🔴 **Cicha degradacja v8→legacy BEZ banera/komunikatu** — `shouldFallbackToLegacyExecutionControl` (execution-control.ts:3-6) milcząco przełącza na `/api/execution-control/*` przy 400/404/405/501 (ExecutionHub:1044-1196, ≥6 miejsc). Przy twardym błędzie sygnały lecą do `[]` w `catch` (1061-1063, 1087-1089, 1108-1110) — **user nie dostaje informacji, że control-tower/risk/delay/budget są niedostępne**. To dokładnie wzorzec z M13: Finance/Results mają baner posture, M14 (jak M13) **nie ma**. Wewnątrz v8 jest `degradedNote`/`stale` w `refreshControlTower` (v8/execution-control.routes:697-700) i `control-tower/health`, ale ExecutionHub ich nie eksponuje jako baner. → FAIL §27.L (error → karta) dla sygnałów; brak komunikatu degradacji.

### 6. CARD_CONTENT_FORMULA
✅ N/D potwierdzone — moduł nie produkuje kart Insight/Initiative. Dokument inicjatywy w preview/full to **reuse z M13**: `ExecutionInitiativeDocumentView` ładuje `Initiatives/InitiativeDocumentView` (ExecutionHub:135-137), preview body/footer = `InitiativePreviewV3Body`/`Footer` (4827-4848). Brak własnej formuły kart w M14.

---

## FAZA 6 — BEZPIECZEŃSTWO

### Warstwy gatingu
- **Nawigacja (sidebar):** `MODULE_EXECUTION` widoczny dla pilota (`PILOT_VISIBLE_MENU_IDS`, pilotAccess.ts:10). Nie na liście `betaAccess` closed → moduł **core/otwarty**.
- **Route:** `/implementation` za `ProductionModuleGate` (AppRoutes:1846-1862) — tylko ukrywa na public-prod, brak RBAC. Pilot: filtr klienta `isPilotAllowedPath('/implementation')` (pilotAccess.ts:26).
- **API:** każdy router ma `verifyToken`. v8 dodatkowo `requireV8OrgContext`+`attachV8Context`+`v8OrgGate` (v8/index.ts:40-67). Legacy/rollout: `requireOrgRole`. **Org NIE jest spoofowalny** z nagłówka — `x-organization-id`/`x-org-context` honorowane tylko po potwierdzeniu **ACTIVE membership** (auth.middleware:619-640); inaczej fallback do realnej org usera. ✅

### Findingi SEC (severity + dowód plik:linia)

#### 🔴 P1 — Cross-org write IDOR: legacy budget entry → unscoped UPDATE na cudzej inicjatywie
- Endpoint `POST /api/execution-control/budget/entries` (`executionControl.routes.ts:485-499`) wywołuje `createBudgetEntry(orgId, {...req.body})` **bez weryfikacji, że `initiativeId` należy do org atakującego** (wersja v8 to robi — `v8/execution-control.routes.ts:523-533` `SELECT id FROM initiatives WHERE id=? AND organization_id=?`; legacy NIE).
- Wpis budżetu trafia z `organization_id = atakujący`, `initiative_id = ofiara`, po czym `recalcInitiativeActualTotal` wykonuje:
  `executionBudgetService.ts:413` → `UPDATE initiatives SET actual_budget_total = ?, updated_at = NOW() WHERE id = ?` — **bez `organization_id`**. Atakujący (rola admin we własnej org) nadpisuje `actual_budget_total` inicjatywy innej organizacji.
- Wymaga `requireOrgRole('admin')` (linia 489), ale to wciąż cross-tenant write. Powierzchnia legacy jest deprecated, lecz nadal zamontowana (`Gateway.ts:985-989`).
- **Fix:** dodać w legacy route ten sam guard własności inicjatywy co v8 ORAZ doścopować `recalcInitiativeActualTotal` UPDATE o `AND organization_id = ?`.

#### 🔴 P1 — Cross-org IDOR (write): dependency link/unlink na `task_dependencies` bez org-scope
- `POST /api/v8/execution-control/interventions/dependency` (`v8/execution-control.routes.ts:1135-1148`):
  `INSERT OR IGNORE INTO task_dependencies (id, from_task_id, to_task_id, dependency_type, created_at) VALUES (?, ?, ?, ?, NOW())` oraz `DELETE FROM task_dependencies WHERE from_task_id = ? AND to_task_id = ?` — **przyjmują surowe `fromEntityId`/`toEntityId` z body bez sprawdzenia, że taski należą do org**.
- Tabela `task_dependencies` **nie ma kolumny `organization_id`** (`migrations/000_initdb_core_tables.sql:512-520`) → zapis/usuwanie jest globalne. Każdy nie-viewer (`checkInterventionPermission` przepuszcza USER, blokuje tylko VIEWER/READONLY — linia 659-666) może linkować/odlinkowywać zależności między taskami **dowolnych organizacji**.
- To dokładnie systemowy wzorzec cross-org IDOR (M01/M03/M10/M13).
- **Fix:** zweryfikować przynależność obu tasków do `organizationId` (np. `SELECT id FROM tasks WHERE id IN (?,?) AND organization_id = ?` = 2 wiersze) przed INSERT/DELETE.

#### 🟠 P2 — Initiative dependency INSERT bez weryfikacji własności encji
- Ten sam endpoint, gałąź INITIATIVE (`v8/execution-control.routes.ts:1149-1156`): INSERT stempluje `organization_id = atakujący`, ale **nie sprawdza, że `from_initiative_id`/`to_initiative_id` należą do tej org**. Tworzy wiersz w org atakującego wskazujący na cudze inicjatywy (mniejszy impact niż task — wiersz jest org-scoped, DELETE też). Wzorzec ten sam.
- **Fix:** `SELECT ... WHERE id IN (?,?) AND organization_id = ?` przed INSERT.

#### 🟠 P2 — Pilot (VTS) blokada zapisu na Rollout tylko po stronie klienta
- Rollout CRUD (`rollout.routes.ts`): cały router za `requireOrgRole('user')` (linia 30) — POST/PATCH/DELETE dla KPI/risk/change/closure dostępne dla **każdego USERa**. Frontend wyłącza zapis przez `readOnly={isPilotParticipant}` (ExecutionHub:4665, RolloutTab), ale serwer nie zna pojęcia „pilot". Uczestnik pilota (rola USER) może tworzyć/edytować/usuwać zasoby rollout bezpośrednim wywołaniem API. To wzorzec z M13 („pilot tylko klient"). Wszystko org-scoped (brak cross-org), więc nie IDOR — ale obejście blokady produktowej.
- **Fix:** capability serwerowa dla mutacji rollout (gating pilota / `requireOrgRole('admin')` jeśli rollout ma być managerial).

#### 🟡 P3 — Cross-org tamper przez `ON CONFLICT (id)` bez org-guard (risk + delay signals)
- `risk_signal_alerts` dismiss: `executionControl.routes.ts:128-132` oraz `v8/execution-control.routes.ts:147-152` — `INSERT ... VALUES (?signalId, ?orgId, ...) ON CONFLICT (id) DO UPDATE SET is_dismissed=TRUE, dismissed_by=?` . `signalId` jest **client-controlled PK**; klauzula `ON CONFLICT (id) DO UPDATE` **nie filtruje po `organization_id`** → trafienie w `id` alertu innej org nadpisuje jej `is_dismissed/dismissed_by`.
- `delay_signals` dismiss: `executionControl.routes.ts:410-418` / `v8/...:389-397` — UPDATE-first jest org-scoped (OK), ale gdy `changes===0` wykonywany jest `INSERT ... ON CONFLICT (id) DO UPDATE` z `id=signalId` bez org-guardu w konflikcie → analogiczny tamper na cudzym wierszu delay_signals.
- Impact ograniczony (tylko flaga dismiss heurystycznych sygnałów), ale to cross-tenant zapis. Wymaga znajomości/zgadnięcia deterministycznego `signalId`.
- **Fix:** włączyć `organization_id` do warunku konfliktu albo do `WHERE` przy DO UPDATE.

#### ✅ Zweryfikowane jako poprawne (org-scope OK)
- `ExecutionController` (PMO `/api/execution/:projectId/*`): wszystkie zapytania `WHERE project_id = ? AND organization_id = ?` (summary/blockers/health/action-queue/gate). `getActionQueue` używa `safeQueryAll` + org-scoped sub-selecty. ✅
- `executiveAggregate` `/api/executive/aggregate`: wymaga `projectId`, dla nie-adminów `ProjectMemberService.getMember` + `canViewProject` (`executiveAggregate.routes.ts:36-41`); serwis cały org+project-scoped. ✅
- `rollout.routes.ts`: każdy GET/PATCH/DELETE ma `WHERE ... AND organization_id = ?`, PATCH/DELETE poprzedzone `dbGet ... AND organization_id` (np. 124-128, 270-274, 385-389, 499-503). ✅ (brak IDOR; in-memory już wcześniej naprawione — nie powielam)
- `executionControl` timeline-update / mitigation / workarounds / budget-summary: org-scoped (`WHERE id=? AND organization_id=?`), dynamiczny `${field}` z zod-enum allowlist (brak SQLi). ✅
- v8 `interventions/reassign|smooth|replan|escalate`: lookup encji `WHERE id=? AND organization_id=?` przed UPDATE (727-770, 813-897, 935-1019, 1055-1058). ✅
- v8 `/api/v8/execution/runs` (spine): create weryfikuje `initiativeId` org-scope (`v8/execution.routes.ts:203-215`); reads przez `ensureRunExists(runId, organizationId)`. ✅
- Manager-lane surface gated capability `requirePermission('manage_workstreams')` (`v8/execution-control.routes.ts:1420`) — naprawione PII-leak z BUG-18. ✅

### Zasoby publiczne / share tokeny
- N/D — M14 nie wystawia share-linków raportów. `copyExecutionLink` (ExecutionHub:1732) kopiuje wewnętrzny URL `/implementation`, nie token publiczny. Brak revoke/enumeracji do sprawdzenia.

### WS/realtime
- N/D — brak kanałów realtime specyficznych dla execution/rollout.

### Sekrety / PII w logach
- ✅ Brak logowania tokenów/haseł/sekretów w `rollout.routes`, `executionControl.routes`, `v8/execution-control.routes`, `ExecutionController`. PII (imiona/nazwiska) w manager-lane jest teraz za capability (BUG-18 fix).

---

## Dowody i18n (klucze użyte, brak w PL translation.json) — wybór
- `WhyRedChain.tsx`: `execution.whyRed.{decisions,decisionsCount,overdue,risks,risksCount,signals,tasks,tasksCount}`
- `ExecutionTimelineView.tsx`: `execution.timeline.deps.{add,createFailed,created,current,deleteFailed,deleted,empty,loading,manage,predecessor,remove,select,self,successor,title}`
- `PeopleChangeWorkspace.tsx`: `capability.{items,matching,runMatch,title}`, `change.{acknowledge,recentComments,title,trend.label}`, `stakeholder.{distributeNow,distributedOn,dueSince,inactive,nextSend,noSends,noSteercoPacks}`
- `RolloutTab.tsx`: `execution.rollout.change.status.{proposed,approved,implemented,rejected}`, `execution.rollout.risks.status.{open,mitigated,closed}`, `execution.rollout.{kpi,risks,closure}.derivedNote`, `common.dismiss`
- `ExecutionHub.tsx`: `common.{archive,clear,delay,comingSoonBackend,openPreview}`, `execution.actionCenter.{actionQueue,actionQueueDesc,kpiNoPlan,kpiNoPlanDesc,missingPlan,missingPlanDesc}`, `execution.hub.{loadErrorTitle,transportBlockedTitle}`, `execution.reportCatalog.cadence.{biweekly,monthly}`
- `ReportCompactPanel/ReportDocumentView`: `execution.reportPanel.{copied,copy,copyFailed,exportDeck,exportPdf,generate,generateAI,pdfExported,pdfFailed,presentationOpened}`
- (łącznie ~141 kluczy; render bezpieczny dzięki inline fallbackom)
