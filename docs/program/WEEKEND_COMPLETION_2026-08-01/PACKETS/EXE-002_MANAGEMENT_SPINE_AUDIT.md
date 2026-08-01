---
doc_id: EXE-002
truth_type: verified-as-is
status: ACCEPTED_BACKEND_A1
owner: codex
product_owner: piotr
priority: P0
depends_on: EXE-001
last_reviewed: 2026-08-01
---

# EXE-002 — audyt management spine Execution

## Odbiór backend A1 — 2026-08-01

Przyjęto addytywny, read-only kontrakt
`execution_management_snapshot_v1`: kanoniczna inicjatywa, milestones, linked tasks i
wyłącznie linked decisions z org/project scope, provenance oraz rozróżnieniem pustej
sekcji od sekcji niedostępnej. Nie utworzono nowego store ani migracji.

UI consumption oraz `task mutation → snapshot read-back` pozostają osobną paczką
`EXE-002A2`; cały management spine nadal ma werdykt `FIX`.

## Decyzja audytowa

Stan obecny: **FIX**.

Po `EXE-001` istnieje jeden kanoniczny entry point `/execution`, lecz zamontowany
`ExecutionHub` nie ma jeszcze jednego kanonicznego management spine. Ma wiele realnych,
wartościowych pionów, ale ich źródła prawdy, zakresy i read-back są rozdzielone pomiędzy:

- Initiative API i dokument inicjatywy;
- Tasks i Decisions API;
- legacy Execution Control oraz częściowo równoległe V8 Execution Control;
- osobny Rollout store dla KPI, risks, changes i closures;
- PMO health, executive aggregate i raporty;
- V8 execution/approval spine dla agent runs i proposals;
- fire-and-forget bridge do Results.

Nie należy budować kolejnego równoległego CRUD. Minimalna droga do ujednolicenia to
kanoniczny, org- i project-scoped **Execution Initiative Management Snapshot**, który
składa istniejące owner objects, ujawnia provenance/degraded state i po każdej mutacji
potwierdza read-back z tego samego kontraktu.

## Zakres audytu

Prześledzono component → handler → API → route/service → persistence/read-back → test dla:

- wejściowych inicjatyw i statusów;
- planu, milestone'ów i czasu;
- tasków i decyzji;
- ryzyk, issues, mitigations i change requests;
- ról, RACI, zasobów i capacity;
- budżetu, actuals i overspend;
- portfolio health, action queue i reporting;
- rekomendacji AI oraz approval spine;
- closure i integracji Execution → Results.

Audyt nie zmienia runtime, API ani danych.

## Zamontowana powierzchnia

`src/components/Execution/ExecutionHub.tsx` jest właścicielem aktywnego runtime. Udostępnia:

- `Portfolio` — table, kanban, timeline oraz initiative document/preview;
- `Rollout` — plan, KPI tracking, risk register, change log i closure checklist;
- `Raporty` — katalog raportów, preview, generator i workload preview;
- `Manager` — action lanes dla queue, decisions, blockers, workload, risk i people/change;
- opcjonalny `Kokpit` za feature flagą `summaryOneLook`.

Tasks i Decisions są widoczne jako przekrojowe buckety w powierzchni Portfolio, ale nie
stanowią osobnych tabów ModuleHub. V8 execution/approval runs nie są kanoniczną warstwą
zarządzania inicjatywą w tym Hubie; są osobnym governance spine dla propozycji agentowych.

## Macierz funkcji i źródeł prawdy

| Obszar | Status | Aktywny tor | Główna luka |
| --- | --- | --- | --- |
| Inicjatywy wejściowe | `CZĘŚCIOWA+` | `Api.getInitiatives(projectId)` → filtr statusów Execution → Portfolio | filtr wykonywany w kliencie; retry może przejść na `fullSessionData`; brak jednego server-side execution scope/read receipt |
| Status inicjatywy | `CZĘŚCIOWA+` | `PATCH /initiatives/:id/status`, także bulk/kanban | UI odświeża kilka lokalnych projekcji; closure side effect jest asynchroniczny i bez receipt |
| Plan i czas | `CZĘŚCIOWA` | initiative dates, timeline, Rollout Master Plan, timeline warnings/update | baseline, current plan, rollout plan i warningi nie są jednym wersjonowanym planem; plan Rollout jest głównie projekcją inicjatyw |
| Milestones | `CZĘŚCIOWA` | initiative document/sections, health snapshot i next milestones | brak jednego Hub-level CRUD/read-back i jawnego powiązania baseline→variance→approved replan |
| Tasks | `CZĘŚCIOWA+` | `Api.getTasks({projectId})`, `PATCH /tasks/:id`, initiative document/My Work | realny read/write, ale Hub agreguje project tasks i dopiero w kliencie wiąże je z execution initiatives; brak jednej wersji stanu po mutacji |
| Decisions | `CZĘŚCIOWA+` | `GET /decisions?projectId=...`, initiative links, due buckets | decyzje bez `relatedObjectId` są zachowywane w Execution; scope jest przez project, a związek z inicjatywą opcjonalny |
| Risks/issues/mitigations | `CZĘŚCIOWA` | V8/legacy risk signals, RAID governance, Rollout risk register, Manager lanes | co najmniej trzy reprezentacje: sygnał, RAID item i rollout risk; brak canonical identity/dedupe/promotion |
| Change requests | `CZĘŚCIOWA` | Rollout changes CRUD, timeline update/replan, V8 proposals | zmiana planu, change-log row i approval proposal nie tworzą jednego audytowalnego lifecycle |
| Role/RACI | `CZĘŚCIOWA` | Initiative sections/team/RACI i governance routes | ExecutionHub nie posiada złożonego read modelu owner/accountable/escalation dla planu i tasków |
| Resources/capacity | `CZĘŚCIOWA+` | V8/legacy leveling alerts, capacity timeline, workload view | realne obliczenia, ale alerts są niezależnym readem; brak snapshotu demand→allocation→availability→task impact |
| Budżet/actual | `CZĘŚCIOWA+` | execution budget service/control routes, overspend signals, executive aggregate | budget summary i signals istnieją; brak jednego atomic read-back razem z initiative status/plan i jawnego EAC/variance receipt |
| Health/status | `CZĘŚCIOWA+` | `/execution/:projectId/health`, `/pmo/health/:projectId`, executive aggregate | kilka health modeli; klient ma local degraded fallback i osobne failure flags, więc dwie osoby mogą zobaczyć różne wyliczenie |
| Reporting | `CZĘŚCIOWA+` | report definitions, execution packs, preview/generator/PDF/cadence | katalog ma hardcoded fallback, a wygenerowane raporty są dopinane do lokalnego state; nie każdy output ma wspólny persisted artifact receipt |
| AI rekomendacje | `CZĘŚCIOWA` | Manager problem lanes/actions, intelligence panels, Teresa risk touchpoint, V8 proposals | rekomendacja, approval i zastosowana mutacja nie mają jednego UI-visible chain evidence→proposal→approval→apply→read-back |
| Results integration | `CZĘŚCIOWA` | budget health KPI signal; DONE → `initiative_benefits`; results handoff events | closure handoff jest celowo fire-and-forget; brak transakcyjnego/outbox receipt i pełnego closure→Results→Finance actual E2E |

## Najważniejsze dowody w kodzie

### Inicjatywy, taski, decyzje i health

- `ExecutionHub.tsx` ładuje wszystkie inicjatywy przez `Api.getInitiatives(projectId)`, a
  statusy Execution filtruje w kliencie. Po błędzie sieci może użyć
  `fullSessionData.initiatives` i jednocześnie pokazuje degraded error.
- Taski pochodzą z `Api.getTasks({ projectId })`; zmiana statusu używa
  `PATCH /tasks/:id`.
- Decyzje pochodzą z `/decisions?projectId=...`. Decyzje bez powiązanej inicjatywy są
  jawnie pozostawiane w przekroju Execution.
- PMO health i Execution health są osobnymi requestami. Hub uznaje
  `/execution/:projectId/health` za authoritative dla health score, lecz potrafi
  konstruować lokalny executive snapshot, gdy aggregate read zawiedzie.

### Control Tower, czas, zasoby i budżet

- risk/delay/overspend signals preferują `V8ExecutionControlApi`, lecz dla wybranych
  błędów przechodzą na `/api/execution-control/...`.
- timeline warnings, capacity leveling alerts i capacity timeline mają analogiczny
  V8→legacy fallback.
- fallback jest jawny w części UI, lecz nie ma jednego `source`, `asOf`, `contractVersion`
  i zestawu failure flags wspólnego dla całej inicjatywy.

### Rollout

- `RolloutTab.tsx` używa osobnych CRUD `/rollout/kpis`, `/rollout/risks`,
  `/rollout/changes`, `/rollout/closures`.
- gdy rejestry są puste, KPI, risks i closures mogą być wyliczone z inicjatyw lub
  sygnałów. Derived items nie są równoważne persisted items, choć żyją w tej samej
  powierzchni.
- Master Plan grupuje inicjatywy według dat; nie jest osobnym, wersjonowanym baseline.
- change row nie jest automatycznie tym samym obiektem co approved timeline replan.

### AI i approvals

- `server/src/types/executionSpine.ts` oraz V8 `/execution/runs` definiują dojrzały
  proposal/approval contract z risk class, preview, reversibility i stanami runu.
- ten spine dotyczy agent runs/proposals. ExecutionHub Manager korzysta z problem/action
  lanes i osobnych action APIs; Hub nie prezentuje jednego łańcucha od rekomendacji do
  potwierdzonego management snapshotu.
- docelowe ograniczenia pozostają właściwe: Teresa nie może samodzielnie zmieniać
  baseline, ownera, approved milestone, akceptować risk/change ani zamknąć wykonania.

### Results

- `server/src/services/executionResultsBridge.ts` tworzy `budget_health` KPI signal oraz
  przy DONE materializuje planned KPI jako `initiative_benefits`.
- handoff jest idempotentny i ma fallback do `expected_roi`, lecz wrapper jest
  fire-and-forget, aby awaria Results nie blokowała statusu.
- oznacza to poprawną dostępność operacyjną, ale nie gwarantuje użytkownikowi, że DONE
  zostało przyjęte przez Results. Ten brak należy zamknąć w `FLOW-001`, nie w pierwszym
  slice `EXE-002`.

## Ryzyka kontraktowe

1. **Równoległe reprezentacje.** Rollout KPI nie są automatycznie tym samym co
   `initiative_kpis`; Rollout risk nie jest automatycznie RAID itemem; change row nie
   jest approved replanem.
2. **Nieostry scope.** Project-scoped task/decision read może zawierać elementy spoza
   aktywnych execution initiatives. Filtr w kliencie nie jest authorization boundary.
3. **Fallback jako inna prawda.** V8, legacy oraz local aggregate mogą mieć różne
   timestampy i reguły, mimo że zasilają jeden ekran.
4. **Rozproszony read-back.** `executionTruthRefreshKey` i wspólny refresh store
   ponawiają requesty, lecz nie są receipt ani gwarancją wersji po mutacji.
5. **AI action discontinuity.** Problem → rekomendacja → approval → apply nie kończy się
   jednym persisted snapshotem pokazującym before/after.
6. **Closure bez potwierdzenia.** DONE może być sukcesem, gdy Results handoff jeszcze nie
   został zapisany albo zawiódł.

## Docelowy minimalny kontrakt management spine

Nie wprowadzać nowej bazy obiektów. Dodać read-model/assembler nad istniejącymi owner
objects:

```ts
interface ExecutionInitiativeManagementSnapshot {
  initiative: { id: string; projectId: string | null; status: string; version: string | null };
  plan: { start: string | null; end: string | null; baselineVersion: string | null; milestones: unknown[] };
  work: { tasks: unknown[]; overdueCount: number; blockedCount: number };
  governance: { decisions: unknown[]; risks: unknown[]; changes: unknown[] };
  ownership: { ownerId: string | null; raci: unknown[] };
  resources: { allocations: unknown[]; capacityAlerts: unknown[] };
  finance: { budget: unknown | null; actual: unknown | null; variance: unknown | null };
  results: { kpis: unknown[]; handoffStatus: 'not_due' | 'pending' | 'delivered' | 'failed' | 'unknown' };
  provenance: { asOf: string; source: 'canonical' | 'degraded'; degradedSections: string[]; contractVersion: 'v1' };
}
```

Każda kolekcja musi zachować owner object id i source type. Snapshot nie może kopiować
danych do kolejnego store ani używać rollout rows jako substytutu initiative-native
objects bez jawnego `sourceType`.

## Minimalny pierwszy implementowalny slice — EXE-002A

### Cel

Udowodnić jeden pion:

`execution initiative → tasks + decisions + dates/owner/status → task status mutation → canonical snapshot read-back`

To jest najmniejszy slice, który poprawia codzienną pracę i tworzy wzorzec dla risk,
resource, budget, change i Results bez podejmowania od razu migracji tych domen.

### Zakres

1. Dodać org-scoped endpoint read-only, np.
   `GET /api/v8/execution/management/initiatives/:initiativeId`.
2. Zweryfikować, że inicjatywa należy do organization i opcjonalnego project scope.
3. Złożyć wyłącznie istniejące dane: initiative status/owner/dates, milestones, tasks i
   linked decisions; nie dołączać niepowiązanych project decisions.
4. Zwrócić `asOf`, `contractVersion`, per-section source i degraded sections.
5. W `ExecutionHub`/initiative document użyć snapshotu dla jednego otwartego rekordu.
   Portfolio list pozostaje bez zmian.
6. Po istniejącym `PATCH /tasks/:id` pobrać snapshot ponownie i potwierdzić zmieniony
   task status. Nie wykonywać optimistic success bez read-back.
7. Zachować obecne endpointy i dane; brak migracji, dual-write i zmian Results.

### Pliki przewidywane

- `server/src/routes/v8/execution-control.routes.ts` albo mały dedykowany route
  `server/src/routes/v8/execution-management.routes.ts`;
- nowy `server/src/services/v8/executionManagementSnapshotService.ts`;
- typ/schema response w `server/src/types/` oraz odpowiadający frontend type/client;
- `src/components/Execution/ExecutionHub.tsx` lub docelowy initiative document adapter;
- dedykowane testy route/service/component.

Nie dodawać logiki assemblera bezpośrednio do 5,000+ liniowego `ExecutionHub.tsx`.

### Acceptance criteria

- foreign-org initiative zwraca 404 i nie ujawnia istnienia obiektu;
- snapshot zawiera tylko taski i decyzje związane z daną inicjatywą;
- brak tasków/decyzji jest odróżniony od degraded/unavailable;
- status, owner i dates pochodzą z kanonicznej initiative row;
- response ma stabilne `contractVersion`, `asOf` i provenance per sekcja;
- zmiana statusu taska kończy się ponownym GET snapshot i UI pokazuje stan z serwera;
- błąd read-back nie pokazuje success; mutacja może być oznaczona jako
  `saved_unconfirmed` i oferuje retry;
- żadna tabela rollout/RAID/budget nie jest kopiowana ani migrowana;
- brak regresji Portfolio/Kanban/Timeline i My Work task status;
- permission policy zapisu tasków pozostaje zgodna z istniejącym task endpointem i jest
  objęta testem roli.

### Testy obowiązkowe

#### Service

- składa initiative + milestones + linked tasks + linked decisions;
- nie pobiera decyzji tylko dlatego, że należą do tego samego project;
- normalizuje puste sekcje i oznacza częściową awarię jako degraded;
- nie miesza organization/project scope.

#### Route

- 401 bez tokenu;
- 404 dla foreign-org i nieistniejącej inicjatywy;
- 200 ze stabilnym envelope/schema;
- project mismatch nie przecieka danych;
- role read/write matrix dla task mutation.

#### Frontend

- loading, empty, degraded i hard-error są rozróżnione;
- otwarcie initiative pokazuje snapshot owner/dates/tasks/decisions;
- task update wywołuje mutation, potem snapshot read-back;
- read-back failure nie daje fałszywego success;
- deep link `?open=` i istniejące view modes pozostają sprawne.

#### Integration/E2E

1. Otwórz `/execution?open=<initiativeId>`.
2. Potwierdź owner, dates, task i linked decision.
3. Zmień task `todo → in_progress`.
4. Przeładuj stronę.
5. Potwierdź `in_progress` z API i ten sam stan w My Work.

## Kolejne slice'y po EXE-002A

- `EXE-002B`: baseline + milestones + governed replan + version/read-back;
- `EXE-002C`: RACI + allocation + capacity impact;
- `EXE-002D`: budget/actual/variance/EAC snapshot;
- `EXE-003A`: canonical identity dla signal → RAID risk → mitigation;
- `EXE-003B`: change request → approval proposal → applied replan;
- `EXE-003C`: AI evidence → recommendation → approval → apply → before/after receipt;
- `FLOW-001`: transactional/outbox-backed closure receipt → Results → Finance actual.

## Recovery i granice

- pierwszy slice jest additive i read-model only poza użyciem istniejącej task mutation;
- wdrożenie osłonić flagą `executionManagementSnapshotV1` na konsumencie UI;
- rollback polega na wyłączeniu flagi i powrocie do obecnych reads; brak rollbacku danych;
- nie usuwać legacy/V8 fallbacków przed porównaniem snapshotów na stagingu;
- telemetry powinna porównywać snapshot z dotychczasowym UI dla owner, dates, task count
  i decision count przed przełączeniem;
- jeśli assembler nie może rozstrzygnąć source identity, zwraca degraded/unknown zamiast
  zgadywać albo tworzyć nowy rekord.

## GO / FIX / NO-GO

- **GO** dla `EXE-002A` po zatwierdzeniu kontraktu snapshotu i ownerów pól.
- **FIX** dla całego management spine: realne funkcje istnieją, ale wymagają wspólnego
  read modelu, provenance i read-back.
- **NO-GO** dla scalenia przez skopiowanie Rollout/RAID/Tasks do nowej tabeli lub przez
  masowy rewrite `ExecutionHub`.
- **NO-GO** dla uznania fire-and-forget closure za zakończony golden flow; to osobna
  bramka `FLOW-001`.
