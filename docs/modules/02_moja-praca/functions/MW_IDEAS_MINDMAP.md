---
module_id: MODULE_MY_WORK
function_id: MW_IDEAS_MINDMAP
function_name: Ideas — Mindmap / Mapa rekomendacji
doc_kind: FUNCTION_CONTRACT
status: approved_for_planning
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Ideas / Mindmap

## 1. Function Identity

- Function ID: `MW_IDEAS_MINDMAP`
- Module: `02_moja-praca`
- Parent function: `MW_IDEAS`
- UI labels/aliases: `Mapa rekomendacji`, `Recommendation map`, `mindmap`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/*"` with idea workspace lane under `"/my-work/ideas/:ideaId"` and tool mode `mindmap` (including workspace tool routing such as `.../workspace/mindmap` and query-param `tool=mindmap`)
- Feature state: `real`

## 2. User Job and Business Outcome

- User job-to-be-done:
  - user wybiera `Mind Map`, gdy chce przejsc od chaotycznych obserwacji do struktury "problem -> hipotezy -> opcje -> decyzje/nastepne kroki",
  - user potrzebuje zobaczyc zaleznosci miedzy obszarami, luki evidence i potencjalne miejsca konwersji do taskow/inicjatyw.
- Business outcome:
  - powstaje czytelna mapa struktury myslenia z provenance i statusem zatwierdzenia,
  - mapa jest gotowa do kontrolowanego handoffu do downstream functions i owner modules.
- Non-goals:
  - brak cichej mutacji obiektow kanonicznych poza `02_moja-praca`,
  - brak traktowania sugestii AI jako automatycznie zatwierdzonej prawdy.

## 3. Trigger and Entry Points

- Entry points:
  - `Ideas` detail workspace + tool switcher ustawiony na `mindmap`,
  - deep-link do workspace idea lane (z tool param lub segmentem workspace),
  - cross-tool transform z `table` / `process_flow` / `whiteboard` do `mindmap`.
- Preconditions:
  - istnieje kontekst `ideaId`,
  - user ma dostep do `My Work` w tenant scope.
- Blocking conditions:
  - deny ACL/tenant,
  - brak dostepu do danych mapy (error/degraded fallback bez ukrytych write).

## 4. UI Component Footprint

- Top-level container/view components: `MyWorkView`, `MyWorkHub`, `IdeaMapWorkspace`.
- Tool-specific runtime: `IdeaRecommendationMap`.
- Supporting components:
  - `IdeaWorkspaceToolbar` (system switch + command context),
  - `CanvasLeftToolbar` (node/edge edit actions),
  - `AIGovernanceBadge`, `AIGovernancePanel` (AI provenance i status),
  - `ErrorBoundary` dla narzedzi workspace.
- Component ownership notes:
  - canvas + node semantics sa tool-local dla `MW_IDEAS_MINDMAP`,
  - shell navigation, panel strip i command row sa wspoldzielone przez `MW_IDEAS`.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields:
  - `ideaId`, `title`, `stage`, `seedText`,
  - graph payload (`nodes`, `edges`, `mapExtensions`),
  - selection/focus context (`selectedNodeIds`, quick-action context).
- Upstream modules/services:
  - workspace graph runtime (`useWorkspaceGraphRuntime`),
  - AI proposal runtime (chat-triggered and workspace-triggered proposals),
  - preference persistence (`activeTool`, viewport and map extensions).
- APIs/models (as-is):
  - frontend API boundary: `Api.getMyIdea`, `Api.getMyIdeaMap`, `Api.updateMyIdea`, `Api.getMyIdeaAISuggestions`, `Api.convertMyIdeaSelection` i pokrewne endpointy `my-work/my-ideas/*`,
  - backend ownership: `server/src/routes/my-work.routes.ts` dla `GET/PUT /my-ideas/:id/map`, `POST /my-ideas/:id/map/ai-suggestions`, `POST /my-ideas/:id/convert`, `POST /my-ideas/:id/outcomes/:outcomeId/convert`.
- Data freshness assumptions:
  - graph + AI suggestions moga byc eventual-consistent,
  - degraded source coverage musi byc widoczny w UI.

## 6. Outputs and Side Effects

- Produced objects/artifacts:
  - zaktualizowany graph mapy (`nodes/edges/extensions`),
  - provenance metadata per node/cluster (source refs, evidence hints),
  - conversion intents dla downstream lanes.
- Downstream handoff:
  - explicit `convert selection` / `convert idea` actions do owner flows (`05_inicjatywy`, `06_realizacja`, artifact lanes),
  - handoff payload zawiera co najmniej source context i selected object references.
- Side effects visible to user:
  - edycja struktury, grouping, relacji i fokusu,
  - AI proposal preview + explicit accept/reject,
  - eventy quick-action (np. create task from node) bez ukrytej finalizacji owner-state.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects:
  - `MW_IDEAS_MINDMAP` jest ownerem tylko mapy idei w `02_moja-praca`.
- Handoff contract (`from -> to`):
  - `MW_IDEAS_MINDMAP -> MW_TASKS/MW_DECISIONS/05_inicjatywy/06_realizacja` przez explicit conversion APIs,
  - payload minimalny: `ideaId`, selection ids, source/evidence refs, intent metadata.
- Forbidden ownership:
  - brak bezposredniego ustawiania lifecycle/status owner records w `05_inicjatywy` i `06_realizacja`,
  - brak implicit approval podczas konwersji.

## 8. Runtime States and UX Behavior

- Loading:
  - ladowanie mapy i runtime metadata, bez mylenia z zapisem sukcesu.
  - next action: poczekaj albo wroc do listy Ideas.
- Empty:
  - starter canvas + guidance: dodaj node centralny, potem relacje i evidence.
  - next action: rozpocznij od struktury problemu/hipotez.
- Error:
  - error boundary z retry i jasnym komunikatem bez raw internals.
  - next action: retry albo fallback do innego narzedzia workspace.
- Degraded:
  - czesc AI/source context niedostepna, ale core edycja grafu pozostaje mozliwa.
  - next action: kontynuuj manualnie, uzupelnij evidence przed konwersja.
- Success:
  - graf zapisany i gotowy do review/convert.
  - next action: przejdz do conversion handoff albo doprecyzuj provenance.

## 9. AI, Source, Evidence, Approval

- AI action placement:
  - contextual AI controls sa w Menu 3 / command-row-right i panelach governance,
  - zakaz duplikacji tych samych akcji jako oddzielny toolbar w canvas.
- Source/provenance/evidence rules:
  - kazdy node wygenerowany lub wzbogacony przez AI ma status pochodzenia (`ai_suggestion`, `user_authored`, `imported_source`),
  - evidence refs sa widoczne przed high-impact handoff.
- AI suggestion vs approved truth:
  - `AI suggestion` = propozycja robocza (nie jest prawda kanoniczna),
  - `Approved truth` = element jawnie zaakceptowany przez user i gotowy do owner review/convert,
  - UI musi pokazywac ten podzial w badge/panel i eventach.
- Approval/diff/review:
  - accept/reject propozycji AI jest jawny,
  - conversion do owner modules wymaga ich review policy (no silent pass-through).
- Audit trail/evidence:
  - logowane sa co najmniej: proposal accepted/rejected, convert actions, cross-tool transforms.

## 10. Security, Roles, and Tenancy

- Allowed roles:
  - user role z dostepem do `My Work` i konkretnej idei.
- Denied/restricted roles:
  - ACL denied i users poza tenant boundary.
- ACL/tenant scope:
  - wszystkie operacje na mapie i comments/snapshots sa tenant-scoped (`organization_id` / `user_id` checks po stronie API).
- Sensitive data masking/redaction:
  - brak eksponowania surowych internals i sekretow; UI pokazuje tylko bezpieczne komunikaty bledu.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks (critical claims):
  - mindmap mode uruchamia sie w workspace idei i utrzymuje wspolny shell narzedzi,
  - user moze tworzyc i laczyc node'y oraz uruchamiac quick actions bez ukrytych write,
  - AI proposals pozostaja propozycjami do akceptacji/odrzucenia,
  - conversion handoff jest jawny i source-aware,
  - loading/empty/error/degraded/success sa rozroznialne i prowadza do "co dalej".

### 11A. Evidence Matrix (mandatory)

| Claim | Route evidence | Component evidence | API evidence | Test evidence |
| --- | --- | --- | --- | --- |
| Mindmap jest dostepny tylko w lane `My Work` / idea workspace | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/views/MyWorkView.tsx`, `src/components/MyWork/MyWorkHub.tsx` | `src/services/api.ts` (`my-work/my-ideas/*`) | `tests/navigation/routeMapping.test.ts`, `tests/components/MyWork/IdeasMindMap.redirect.test.tsx` |
| Narzedzie `mindmap` dziala jako jeden z 4 systemow workspace | `src/routes/AppRoutes.tsx` (`MyWorkView`) | `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/IdeaWorkspaceToolbar.tsx`, `src/components/MyWork/IdeaRecommendationMap.tsx` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/map*`) | `tests/e2e/smoke/wave1-mywork-deep-acceptance.spec.ts`, `tests/unit/mywork/crossToolTransform.test.ts` |
| Source/provenance i AI governance sa widoczne przed handoff | `src/routes/routeConfig.ts` (`MY_WORK`) | `src/components/MyWork/mindmap/AIGovernancePanel.tsx`, `src/components/MyWork/mindmap/CanvasLeftToolbar.tsx` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/map/ai-suggestions`, `/my-ideas/:id/activity`) | `tests/unit/mindmap/canvasLeftToolbar.test.tsx`, `tests/unit/mywork/aiProposalRuntime.test.ts` |
| Handoff jest jawny i source-aware (bez hidden mutation) | `src/routes/AppRoutes.tsx` + downstream route navigation pattern | `src/components/MyWork/IdeaMapWorkspace.tsx` (convert/quick-action flow) | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/convert`, `/my-ideas/:id/outcomes/:outcomeId/convert`) | `tests/integration/routes/my-work.test.js`, `tests/integration/p12-mindmap-builder.contract.test.ts` |
| States loading/error/degraded/success sa jawne i odporne UX-owo | `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/IdeaProcessFlowTool.tsx` (error boundary pattern), `src/components/MyWork/mindmap/CollaborationOverlay.tsx` | `server/src/routes/my-work.routes.ts` (map read/write + presence) | `tests/components/MyWork/IdeaProcessFlowTool.error-state.test.tsx`, `tests/components/CollaborationOverlay.degraded-state.test.tsx` |

- Known `doc_gap`:
  - brak oddzielnego, szczegolowego katalogu semantyki node/edge (taxonomy + required fields) dla Mind Map.
- Known `code_gap`:
  - brak jednego dedykowanego e2e testu "mindmap governance full flow" obejmujacego caly lancuch `proposal -> approval -> convert -> owner read-back`.

## 12. Open Risks and Change Log

- Risks/assumptions:
  - bez twardej taksonomii node/edge mapa moze dryfowac miedzy zespolami,
  - wysokie obciazenie AI suggestions moze zaciemnic granice miedzy proposal i approved truth.
- Open decisions:
  - finalny minimalny zestaw pol evidence per node przy konwersji,
  - czy wymagac explicit confidence label dla kazdej sugestii AI w mapie.
- Change log:
  - `2026-05-10`: przebudowa kontraktu do egzekwowalnej wersji Mind Map (JTBD, governance, states, handoff i evidence matrix `route/component/API/test`).
  - `2026-05-10`: planning closeout accepted; contract status set to `approved_for_planning`. Runtime backlog remains open for dedicated e2e owner read-back and node/edge taxonomy.

## 13. Planning Closeout

- closeout_status: `APPROVED_FOR_PLANNING`
- closeout_scope: documentation and planning for `MW_IDEAS_MINDMAP`
- owner_acceptance: `ACCEPTED_FOR_PLANNING_CLOSEOUT`
- runtime_status: `NO_RUNTIME_CHANGE_IN_THIS_PHASE`
- completion statement:
  - Mind Map planning is complete enough to end the planning phase.
  - Remaining gaps are implementation backlog, not planning blockers.
- required next implementation items:
  - `MW-MM-P0-001`: full Mind Map `proposal -> approval -> convert -> owner read-back` e2e.
  - `MW-MM-P1-001`: node/edge taxonomy and required evidence fields.
  - `MW-MM-P1-002`: Menu 3 placement audit for Mind Map AI controls.
