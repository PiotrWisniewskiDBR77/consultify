---
module_id: MODULE_MY_WORK
doc_kind: RAW_TO_TARGET_MODULE_PACKET
packet_version: 2.0
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# RAW -> Target State 2.0 Packet — 02_moja-praca

## 0A. Scope Management Notice

This packet contains multiple function addenda for `02_moja-praca`.

It MUST NOT be used as a single mixed implementation backlog.

Function-level work is managed through immutable `scope_anchor` dispatch and function execution cards per:

- `docs/modules/_FUNCTION_AGENT_DISPATCH_PROTOCOL_2026-05-10.md`
- `docs/modules/_FUNCTION_EXECUTION_CARD_TEMPLATE.md`

Current known function scopes in this packet:

| Scope anchor | Function area | Primary section | Implementation management |
| --- | --- | --- | --- |
| `02_moja-praca/MW_HOME_RADAR` | Radar | sections `1`-`10` | separate function execution card required before implementation |
| `02_moja-praca/MW_IDEAS_MINDMAP` | Ideas / Mind Map | section `11` | separate function execution card required before implementation |
| `02_moja-praca/MW_IDEAS_TABLE` | Ideas / Table | section `12` | separate function execution card required before implementation |
| `02_moja-praca/MW_IDEAS_WHITEBOARD` | Ideas / Whiteboard | section `13` | separate function execution card required before implementation |
| `02_moja-praca/MW_IDEAS_PROCESS_FLOW` | Ideas / Flow | section `14` | separate function execution card required before implementation |

If an agent is dispatched for one of these functions and begins work on another scope, the correct result is `BLOCKED_SCOPE_DRIFT`, not continuation.

## 0. Metadata

- module: `02_moja-praca`
- packet composition: multiple function addenda; active function scope must be declared in the agent prompt
- active scope for sections `1`-`10`: `MW_HOME_RADAR` only
- cycle mode: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- change type: `RAW-to-contract conversion` + `function contract hardening`

## 1. RAW Sources

- `docs/modules/02_moja-praca/RAW_INPUT.md`
- `docs/UI_UX/108_RAW_RADAR_TECHNOLOGY_TRANSFORMATION_INTELLIGENCE_2026-05-09.md`
- `docs/RAW/radar/108_RAW_RADAR_TECHNOLOGY_TRANSFORMATION_INTELLIGENCE_2026-05-09.md`
- `docs/RAW/workbench/102_RAW_WORKBENCH_AI_SIDE_WORKSPACE_2026-05-09.md`
- `docs/RAW/ideas-tables/101_RAW_IDEAS_TABLES_STRUCTURED_THINKING_TABLE_ENGINE_2026-05-09.md`
- `docs/RAW/idea-notebook/97_RAW_IDEA_NOTEBOOK_CONTEXT_ENGINE_2026-05-09.md`
- `docs/RAW/process-flow/98_RAW_PROCESS_FLOW_AI_PROCESS_INTELLIGENCE_2026-05-09.md`
- `docs/RAW/whiteboard/95_RAW_WHITEBOARD_AI_COLLABORATIVE_WHITEBOARD_ENGINE_2026-05-09.md`
- context boundary source: `docs/UI_UX/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md`

## 1A. RAW extraction -> requirement classes (`must/should/out`)

### Must (kontrakt krytyczny)

- Radar jako warstwa inspiracji/edukacji przed inicjatywa i PMO.
- Czytelnosc i reading-first UX (bez top hero "co zrobic teraz").
- Literalna mapa radarowa jako glowny anchor wizualny.
- Source/provenance/confidence/freshness i explainability rekomendacji.
- Tenant/ACL safety, hallucination guard, assumption labeling.
- Twarde granice: no PMO rule, no task-manager rule, no hidden mutation.

### Should (rozwoj P1)

- Rozszerzone soczewki rola/firma/pathfinder.
- Adoption guidance engine i porownania technologii.
- Briefingi per persona (executive/team) i checklisty wdrozeniowe.

### Out (poza tym cyklem dokumentacyjnym)

- Runtime implementation zmian UI i nowych endpointow.
- Przebudowa innych modulow poza jawnym opisem impactu.
- Nadpisanie ownership/handoff bez zmian w globalnych graphach.

## 2. DECISION — Scope Freeze for RADAR

### 2.1 Verified As-Is runtime baseline

- My Work route and shell are active.
  - route evidence: `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
  - component evidence: `src/views/MyWorkView.tsx`, `src/components/MyWork/MyWorkHub.tsx`
- Radar home rendering exists with loading and retryable fallback.
  - component evidence: `src/components/MyWork/Home/HomeView.tsx`, `src/components/MyWork/Home/useHomeData.ts`
  - API evidence: `server/src/routes/my-work/home.routes.ts`
  - test evidence: `tests/components/MyWork/HomeView.outputs.test.tsx`
- Radar data and triage surfaces exist, including handoff endpoint.
  - component evidence: `src/components/MyWork/Home/useRadarData.ts`, `src/components/MyWork/Home/useRadarTriageData.ts`, `src/components/MyWork/Home/RadarTriageCard.tsx`
  - API evidence: `server/src/routes/my-work/radar.routes.ts`, `server/src/routes/v8/radar-triage.routes.ts`, `server/src/Gateway.ts`
  - test evidence: `tests/integration/p06-radar-triage.contract.test.ts`

### 2.2 Decision table (AS-IS -> TARGET -> DELTA -> Decision)

| Topic | AS-IS (confirmed) | TARGET (author intent) | DELTA | Decision |
| --- | --- | --- | --- | --- |
| Naming | Home tab uses `Start/Home`; docs already mention `Radar` alias. | `Radar` as clear intelligence layer label. | Label priority is not fully unified. | `ENHANCE` |
| Top narrative block | Top radar brief/headline strip is present in Home Radar. | Remove this block from main Radar layout. | Current top section lowers readability and is unnecessary for target. | `NEW` |
| Main visual archetype | Mixed dashboard-like blocks with triage cards. | Elegant technology portal with reading-first composition. | Need explicit UX contract reset and target composition rule. | `NEW` |
| Literal radar visualization | No explicit module-level requirement as hard contract in prior docs. | Include a literal radar view/map with technologies and context items. | Requirement existed in RAW intent but was not locked in module packet. | `NEW` |
| Radar role boundary | Radar shows prioritized signals and handoff intents. | Radar is explicit pre-initiative intelligence layer; never PMO/task cockpit. | Boundary exists but not fully explicit in module contract. | `ENHANCE` |
| Prioritization grammar | Triaged signals have `priorityLevel`, `score`, hard gates, degraded states. | Strong "why now", urgency, and next-step guidance per signal. | Contract lacked explicit grammar/invariants. | `ENHANCE` |
| Source/provenance visibility | Triage cards render evidence pointers and uncertainty boundary. | Every critical recommendation clearly shows provenance and confidence posture. | Module-level docs did not bind this as hard acceptance. | `ENHANCE` |
| AI action placement | Home contains inline AI controls in radar hero section. | Contextual AI actions only in Menu 3 right slot, no duplication. | Current runtime and target invariant are not aligned. | `ENHANCE` |
| Handoff to Ideas/Initiatives/Execution | Triage handoff API exists and returns target payload. | Explicit cross-module path to `05_inicjatywy`/`06_realizacja` without ownership breach. | Impact/ownership wording was too generic. | `ENHANCE` |
| Watchlist/full Radar map | Not fully evidenced as current shipped contract in module docs/tests. | Full technology radar map, watchlist evolution, role/company lenses. | Target breadth > confirmed runtime evidence. | `DEFER` |
| PMO/Execution controls in Radar | Not canonical in Radar runtime contract. | Explicitly forbidden in Radar layer. | Needed as hard anti-pattern statement. | `KEEP` |
| Direct canonical mutation from Radar | Not evidenced as expected behavior. | Never mutate owner canon silently; only handoff/proposal path. | Needed as formal invariant in function/module contracts. | `KEEP` |
| Dedicated E2E Radar suite | Missing. | End-to-end proof `load -> triage -> handoff -> owner read-back`. | Coverage gap remains. | `NEW` |

### 2.3 Justification for `ENHANCE` / `NEW`

| Item | Business value | Integration risk | Cost / complexity | Evidence readiness |
| --- | --- | --- | --- | --- |
| Remove top narrative block (`NEW`) | High readability gain and lower cognitive load on entry. | Low (layout-level). | Low-medium (runtime UI changes later). | High (owner decision explicit). |
| Portal-style reading-first layout (`NEW`) | High user satisfaction and comprehension for strategic Radar use. | Medium (requires reprioritizing block hierarchy). | Medium. | High (owner decision explicit; runtime pending). |
| Literal radar visualization requirement (`NEW`) | Restores core product metaphor and differentiation. | Medium-high (visual + data mapping). | Medium-high. | Medium (RAW strong; runtime proof pending). |
| Naming + role boundary hardening (`ENHANCE`) | Reduces product ambiguity ("Radar vs dashboard/PMO"). | Low-medium (doc alignment across module files). | Low (documentation-only). | High (RAW + runtime routes/components). |
| Prioritization + state grammar (`ENHANCE`) | Increases trust and decision speed. | Medium (must align UX copy and acceptance expectations). | Low-medium (doc + test mapping). | High (triage contract + component evidence). |
| Provenance + uncertainty visibility (`ENHANCE`) | Protects decision quality and AI trust posture. | Medium (cross-module interpretation of evidence labels). | Low (contract-level lock). | High (triage card + integration tests). |
| Menu 3 AI placement (`ENHANCE`) | Prevents UI governance drift and duplicated controls. | Medium (runtime currently has inline radar AI controls). | Low in docs, medium in later runtime refactor. | Medium-high (global rules clear; runtime mismatch visible). |
| Cross-module handoff clarity (`ENHANCE`) | Avoids ownership conflicts and hidden writes. | Medium-high (touches `01/05/06` boundaries). | Low in docs. | High (handoff endpoint + ownership standards). |
| Radar E2E acceptance row (`NEW`) | Enables release confidence for critical workflow. | Medium (requires stable owner-module read-back criteria). | Medium (test design/automation later). | Medium (contract ready, runtime proof incomplete). |

## 3. UI/UX Contract Directive (RADAR)

- Primary user job: inspire and educate user on technology position/relevance, then suggest exploration paths.
- Mandatory state behavior: loading / empty / error / degraded / success with explicit next-step guidance.
- Priority signals: `P0/P1/P2` posture + "why now" rationale + safe fallback.
- Source/provenance: evidence pointers + uncertainty boundary required in Radar card UX.
- AI action placement: Menu 3 right-side slot only; duplicated inline AI actions are non-compliant with target contract.
- Approval/review posture: Radar recommends and hands off; owner modules approve/mutate.
- Locked owner decisions from feedback:
  - remove top narrative/to-do block,
  - default archetype = elegant technology portal (reading-first),
  - literal radar visualization is mandatory in target design,
  - Radar is inspiration/education surface, not event-management surface.

## 4. BUILD CONTRACT Update Set (this cycle)

- Updated module contracts:
  - `docs/modules/02_moja-praca/03_BEHAVIOR.md`
  - `docs/modules/02_moja-praca/04_UI_UX.md`
  - `docs/modules/02_moja-praca/07_ACCEPTANCE_AND_TESTS.md`
- Updated function contract:
  - `docs/modules/02_moja-praca/functions/MW_HOME_RADAR.md`
- Added packet:
  - `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md`
- Invariants locked:
  - Radar is pre-initiative intelligence, not PMO/task owner.
  - No hidden mutation from Radar to owner-module canon.
  - Critical claims require route/component/API/test evidence.

### Layout v1 blueprint (locked)

- Structure:
  - compact header strip,
  - literal radar map section (primary visual),
  - reading-first insight feed,
  - drill-down detail panel.
- Removed:
  - top narrative/to-do hero strip.
- Interaction:
  - `scan -> select -> read -> optionally capture/handoff`.
- Menu 3:
  - contextual AI actions only in right-side slot.
- Compliance intent:
  - this layout is implementation target for readability reset and becomes acceptance baseline once runtime update lands.

## 5. IMPACT — Cross-module and system effect

### 5.1 `01_czat`

- Impact:
  - Radar can consume conversationally-derived insights as input signal context.
- No ownership change:
  - conversation canon remains in `01_czat`.
- Traceability requirement:
  - when signal comes from chat-origin artifact, provenance remains visible in Radar card evidence or handoff payload.

### 5.2 `05_inicjatywy` and `06_realizacja`

- `05_inicjatywy`:
  - Radar may hand off initiative suggestion context; initiative lifecycle remains owned by `05_inicjatywy`.
- `06_realizacja`:
  - Radar may direct user toward execution context/handoff; execution state and governance remain owned by `06_realizacja`.
- Guardrail:
  - Radar cannot directly set initiative/execution statuses or gate outcomes.

### 5.3 Ownership and artifacts

- Radar owns ranking + recommendation context only.
- Durable business artifacts/records remain in owner modules.
- Handoff must preserve source/evidence context and explicit intent.

### 5.4 E2E workflow + traceability

- Target E2E chain:
  - `Radar load -> triage render -> action handoff -> owner-module review/mutation -> read-back confirmation`.
- Current status:
  - partially evidenced (`Radar load + triage + handoff contract`), but no full E2E regression pack proving owner read-back.
- System-level update need:
  - no mandatory immediate update to global system contracts,
  - proposed follow-up: add dedicated Radar row in `SYSTEM_TRACEABILITY_MATRIX.md` with end-to-end owner read-back evidence once test suite exists.

### 5.5 Dependency map (inputs/outputs/handoff)

| Segment | Inputs | Outputs | Handoff / owner boundary |
| --- | --- | --- | --- |
| `MW_HOME_RADAR` ingestion | `/api/my-work/home/v2`, `/api/my-work/radar`, `/api/v8/radar-triage/signals`, session role/tenant context | ranked radar signals, relevance cards, exploration guidance | no canonical object ownership transfer |
| Radar capture | selected signal + user action (`save note`, `create idea intent`) | capture intent payload | owner lane receives intent; owner canon remains external |
| Radar handoff | signal + handoff endpoint (`/signals/:signalId/handoff`) | target module payload (`targetModule`, `targetPayload`) | owner module (`05`/`06`/`02`) decides and mutates |
| Provenance/security | source pointers, uncertainty boundary, ACL context | visible trust posture | deny-by-default when context uncertain |

## 6. DONE Gate (this packet cycle)

- RADAR contract completeness vs module: `PASS` (doc layer complete for scoped files).
- Evidence links for critical claims: `PASS_WITH_P2` (critical runtime claims linked; full E2E read-back still missing).
- UI/UX global standard alignment: `PASS_WITH_P2` (Menu 3 target locked; current inline AI noted as as-is gap).
- Cross-module impact explicitness: `PASS`.
- Final gate result for this documentation cycle: `REVIEW`.

### 6A. Gate evidence

- rerun gate: `PASS` (`npm run docs:contract:rerun-gate`, 2026-05-10)
- owner acceptance: `accepted_on: 2026-05-10`
- open handoff conflicts: `NONE_CONFIRMED` (doc-level impact only; no ownership mutation introduced)

### 6B. Owner Acceptance

- business_owner_acceptance: `accepted_on: 2026-05-10`
- tech_owner_acceptance: `accepted_on: 2026-05-10`
- packet_approval_scope: `APPROVED_FOR_DOCS_TARGET_DEFERRED`
- approval_condition: fulfilled; owner accepts documentation as complete for this cycle with explicit `DEFER_P2` runtime follow-up items.

## 7. Risks and hard stops

- `BLOCKED_P1` if Radar is documented as PMO/task owner.
- `BLOCKED_P1` if any critical claim lacks route/component/API/test evidence.
- `BLOCKED_P1` if docs imply hidden direct mutation from Radar into owner canon.
- `PASS_WITH_P2` accepted for missing full E2E read-back only when explicitly marked as `code_gap`.

## 8. Open questions (max 3)

1. `OPEN_QUESTION`: Should UI primary label switch from `Home/Start` to `Radar` in Menu 2 for consistency with RAW intent?
   - owner: `user`
   - due: `2026-05-24`
2. `DECISION_CLOSED_DOCS`: Replace inline Radar hero AI buttons with Menu 3 right-slot controls for scan/compare/explain/handoff actions; no duplicate contextual AI toolbar in the Radar canvas.
   - owner: `user`
   - closed_on: `2026-05-11`
   - runtime evidence: `P1_NOT_DONE`
3. `DECISION_CLOSED_DOCS`: Literal radar map v1 uses rings, categories and drill-down behavior as the target interaction model.
   - owner: `user`
   - closed_on: `2026-05-11`
   - runtime evidence: `P2_NOT_DONE`

## 9. Additional deferred items

- `DEFER_P2`: full runtime implementation of portal-style Radar map and readability reset.
  - owner: `user`
  - due: `2026-06-07`
- `DEFER_P2`: approved E2E acceptance owner flow for Radar handoff read-back in `05_inicjatywy` and `06_realizacja`.
   - owner: `user`
   - due: `2026-06-07`

## 11. Compliance audit vs proposed way of work

| Rule / step | Status | Evidence in this module packet |
| --- | --- | --- |
| Work on one module at a time | `PASS` | Scope constrained to `02_moja-praca` Radar only. |
| One work package (`RAW_TARGET_STATE_2_0_PACKET.md`) | `PASS` | This file is canonical packet for cycle. |
| Parallel update in 3 places (`functions`, `04_UI_UX`, `07_ACCEPTANCE`) | `PASS` | Updated files listed in section 4. |
| Critical claims bound to route/component/API/test evidence | `PASS_WITH_P2` | Bound for current as-is; P2 gaps marked as `code_gap`/`DEFER_P2`. |
| Minimal cycle step 1 (RAW extraction must/should/out) | `PASS` | Section `1A`. |
| Minimal cycle step 2 (function map + ownership) | `PASS` | `MW_HOME_RADAR` contract + module function annex + ownership notes. |
| Minimal cycle step 3 (dependency map + handoff) | `PASS` | Section `5.5` dependency map + impact sections. |
| Minimal cycle step 4 (contract updates `00-07` + functions) | `PASS_WITH_P2` | Radar-impact docs updated (`03`, `04`, `07`, function + packet); unaffected docs retained canonical. |
| Minimal cycle step 5 (evidence binding runtime/test) | `PASS_WITH_P2` | Bound where evidence exists; E2E read-back still missing. |
| Minimal cycle step 6 (gate decision approved/cofka) | `PASS` | Rerun gate pass and owner acceptance recorded (`APPROVED_FOR_DOCS_TARGET_DEFERRED`). |
| Anti-chaos: one change = one business goal | `PASS` | Goal locked: Radar readability and contract hardening. |
| Anti-chaos: no new function without owner object linkage | `PASS` | No new runtime function introduced. |
| Anti-chaos: no handoff change without global graph updates | `PASS` | No ownership/handoff mutation introduced, impact doc-only. |
| Anti-chaos: uncertainties in `OPEN_QUESTION` | `PASS` | Section 8 captures unresolved items. |
| Done only when docs + runtime evidence coherent | `IN_PROGRESS` | Coherent docs done; runtime implementation for target UX remains `DEFER_P2`. |

## 10. Plan rozwoju funkcji RADAR (pelna lista, priorytety)

Status planu: `ROADMAP_PROPOSED`.
Zasada nadrzedna: start od `UI/UX_RESET_P0`, dopiero potem kolejne warstwy.

### 10.1 Kolejnosc realizacji (hard order)

1. `P0` — UI/UX reset i czytelnosc (obowiazkowo najpierw).
2. `P0` — trust/safety i granice modulu.
3. `P1` — radar map + soczewki (role/company/pathfinder).
4. `P1` — adoption guidance i briefingi.
5. `P2` — powiazania finance/results/initiative + advanced signal intelligence.
6. `P2` — rozszerzenia i automatyzacje (kanaly, board brief, deeper explainers).

### 10.2 Pelna lista FR-001..FR-120 rozlozona na priorytety

| Fala | Priorytet | Zakres FR (pelna lista) | Cel dostawy |
| --- | --- | --- | --- |
| `Wave 0` | `P0` | `FR-001`, `FR-002`, `FR-005`, `FR-013`, `FR-014`, `FR-015`, `FR-016`, `FR-017`, `FR-018`, `FR-020`, `FR-099`, `FR-101`, `FR-102`, `FR-103`, `FR-104`, `FR-105`, `FR-106`, `FR-107`, `FR-108`, `FR-109`, `FR-117`, `FR-119`, `FR-120` | Czytelny Radar Home, zrodlowosc, explainability, brak PMO/task drift, calm feed. |
| `Wave 1` | `P0/P1` | `FR-003`, `FR-004`, `FR-006`, `FR-007`, `FR-008`, `FR-009`, `FR-010`, `FR-011`, `FR-012`, `FR-019`, `FR-021`, `FR-022`, `FR-023`, `FR-024`, `FR-025`, `FR-026`, `FR-027`, `FR-028`, `FR-029`, `FR-030`, `FR-031`, `FR-032`, `FR-033`, `FR-034`, `FR-036`, `FR-045`, `FR-046`, `FR-047`, `FR-048`, `FR-049`, `FR-050`, `FR-051`, `FR-093`, `FR-094`, `FR-095`, `FR-096`, `FR-097`, `FR-100`, `FR-118` | Docelowy portal technologiczny + literal radar map + personalizacja rola/firma/pathfinder. |
| `Wave 2` | `P1` | `FR-037`, `FR-038`, `FR-039`, `FR-040`, `FR-041`, `FR-042`, `FR-043`, `FR-052`, `FR-053`, `FR-054`, `FR-055`, `FR-056`, `FR-057`, `FR-058`, `FR-059`, `FR-060`, `FR-070`, `FR-071`, `FR-072`, `FR-073`, `FR-074`, `FR-076`, `FR-078`, `FR-079`, `FR-080`, `FR-082`, `FR-083`, `FR-084`, `FR-085`, `FR-112`, `FR-113`, `FR-114`, `FR-115` | Praktyczna warstwa edukacyjno-doradcza: guide, checklisty, porownania, briefingi, rekomendacje. |
| `Wave 3` | `P2` | `FR-035`, `FR-044`, `FR-061`, `FR-062`, `FR-063`, `FR-064`, `FR-065`, `FR-066`, `FR-067`, `FR-068`, `FR-069`, `FR-075`, `FR-077`, `FR-081`, `FR-086`, `FR-087`, `FR-088`, `FR-089`, `FR-090`, `FR-091`, `FR-092`, `FR-098`, `FR-110`, `FR-111`, `FR-116` | Rozszerzenia strategiczne i integracyjne (finance/results/initiative depth, weak signals, advanced channels). |

### 10.3 Pelna lista WF-01..WF-30 rozlozona na priorytety

| Fala | Priorytet | Workflow IDs | Cel |
| --- | --- | --- | --- |
| `WF Wave A` | `P0` | `WF-01`, `WF-05`, `WF-06`, `WF-07`, `WF-09`, `WF-10`, `WF-30` | Fundament UX: briefing, mapa, detail, why-relevant, watchlist, feedback loop, hype warning. |
| `WF Wave B` | `P1` | `WF-02`, `WF-03`, `WF-04`, `WF-08`, `WF-11` | Personalizacja rola/firma/pathfinder + rising signals. |
| `WF Wave C` | `P1` | `WF-12`, `WF-13`, `WF-14`, `WF-15`, `WF-16`, `WF-17`, `WF-18`, `WF-19`, `WF-20` | Briefingi i adoption guidance end-to-end. |
| `WF Wave D` | `P2` | `WF-21`, `WF-22`, `WF-23`, `WF-24`, `WF-25`, `WF-26` | Konwersje i linkowanie do innych modulow (notatki/pomysly/inicjatywy/KPI/Finance). |
| `WF Wave E` | `P2` | `WF-27`, `WF-28`, `WF-29` | Materialy warsztatowo-zarzadcze i vendor enablement. |

### 10.4 Bramy realizacyjne per fala

- `Gate UX-P0` (przed Wave 1):
  - usuniety top hero "co zrobic",
  - reading-first layout aktywny,
  - literal radar map widoczny jako glowny anchor,
  - brak event-management framing na wejsciu.
- `Gate Trust-P0`:
  - source/confidence/freshness widoczne,
  - hallucination guard + assumption labeling aktywne,
  - tenant/permissions szczelne.
- `Gate Enablement-P1`:
  - role/company/pathfinder lens dziala,
  - adoption guide i porownania technologii dzialaja.
- `Gate Expansion-P2`:
  - linkowania cross-module i zaawansowane sygnaly bez naruszenia granic ownership.

### 10.5 Co robimy najpierw (explicit kickoff)

Kickoff implementacyjny = `Wave 0 (P0 UI/UX + trust)`:
- najpierw czytelnosc i kompozycja ekranu,
- potem obligatoryjna warstwa zaufania i granic,
- dopiero potem rozbudowa capability breadth.

## 10. Addendum — IDEA FORMAT: MIND MAP (`MW_IDEAS_MINDMAP`)

### 10.1 Decision

- Scope lock:
  - to jest funkcja rodziny `Idea` w `02_moja-praca`, nie osobny modul.
  - dokumentacja-only cycle (bez runtime edits).
- Change type:
  - `RAW-to-contract conversion` + `function contract hardening`.
- Primary RAW anchors:
  - `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` (mindmap from chat relation),
  - `docs/UI_UX/101_RAW_IDEAS_TABLES_STRUCTURED_THINKING_TABLE_ENGINE_2026-05-09.md` (mindmap jako element przeplywu chaos -> struktura -> decyzja),
  - `docs/UI_UX/97_RAW_IDEA_NOTEBOOK_CONTEXT_ENGINE_2026-05-09.md` (idea-to-initiative context discipline).

### 10.2 UI/UX

- JTBD lock:
  - user wybiera Mind Map do uporzadkowania i powiazania idei, zanim uruchomi handoff do execution/initiative lanes.
- Mandatory runtime states:
  - `loading`, `empty`, `error`, `degraded`, `success` z "co dalej".
- Structure lock:
  - nodes + relations + grouping + explicit transition do downstream actions.
- Governance lock:
  - AI suggestion i approved truth sa jasno rozdzielone.
  - source/provenance/evidence musza byc widoczne przed high-impact handoff.

### 10.3 Build contract update set

- Function contract (core):
  - `docs/modules/02_moja-praca/functions/MW_IDEAS_MINDMAP.md` (egzekwowalna wersja z evidence matrix route/component/API/test).
- Module contract sync:
  - `docs/modules/02_moja-praca/03_BEHAVIOR.md` (behavior boundaries + handoff semantics),
  - `docs/modules/02_moja-praca/04_UI_UX.md` (Mind Map UX addendum + state contract),
  - `docs/modules/02_moja-praca/07_ACCEPTANCE_AND_TESTS.md` (critical claims evidence matrix).

### 10.4 Impact

- `01_czat`:
  - mindmap moze konsumowac input konwersacyjny, ale nie przejmuje ownership conversation canon.
- Pozostale formaty Idea (`table`, `process_flow`, `whiteboard`):
  - utrzymany jawny cross-tool transform, bez utraty provenance.
- Handoff `05_inicjatywy` / `06_realizacja`:
  - wyłącznie explicit conversion + owner review; bez hidden mutation.

### 10.5 Done gate (this addendum cycle)

- Contract completeness for `MW_IDEAS_MINDMAP`: `PASS`.
- Evidence completeness for critical claims (`route/component/API/test`): `PASS_WITH_P2`.
- Residual gap:
  - brak jednego dedykowanego e2e `mindmap proposal -> approval -> owner read-back`.
- Gate result: `APPROVED_FOR_PLANNING_CLOSEOUT`.
- Owner acceptance: `ACCEPTED_FOR_PLANNING_CLOSEOUT`.
- Closeout note:
  - faza projektowa/dokumentacyjna `MW_IDEAS_MINDMAP` jest zamknieta;
  - runtime implementation nie jest czescia tego closeoutu;
  - pozostale braki sa przeniesione do `docs/modules/02_moja-praca/function-cards/MW_IDEAS_MINDMAP_EXECUTION_CARD.md`.

## 12. Addendum — IDEA FORMAT: TABLE (`MW_IDEAS_TABLE`)

### 12.1 Decision

- Scope lock:
  - to jest funkcja rodziny `Idea` w `02_moja-praca`, nie osobny modul.
  - dokumentacja-only cycle (bez runtime edits).
- Change type:
  - `RAW-to-contract conversion` + `function contract hardening`.
- Primary RAW anchors:
  - `docs/UI_UX/101_RAW_IDEAS_TABLES_STRUCTURED_THINKING_TABLE_ENGINE_2026-05-09.md`,
  - `docs/RAW/ideas-tables/101_RAW_IDEAS_TABLES_STRUCTURED_THINKING_TABLE_ENGINE_2026-05-09.md`,
  - `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` (conversation -> artifact -> decision/task/execution relation).
- Decision:
  - `MW_IDEAS_TABLE` is an AI Structured Thinking Table Engine inside Ideas.
  - It is not mini-Excel, not a generic database module, and not an owner-module mutation surface.

### 12.2 UI/UX

- JTBD lock:
  - user wybiera Table, gdy potrzebuje row/field comparison, sorting, filtering, grouping, scoring, statuses, owner assignment, evidence checks i downstream conversion.
- Model lock:
  - records + columns/field types + saved views + sort/filter/group + statuses + validation + provenance.
- Mandatory runtime states:
  - `loading`, `empty`, `error`, `degraded`, `success` z "co dalej".
- Governance lock:
  - critical rows/fields require source/provenance or explicit assumption marker.
  - AI-filled values are proposals until approved.
  - duplicate merge, bulk edit, owner/status changes and conversion require diff/review when high-impact.
- AI placement lock:
  - AI actions for Table live in Menu 3 / command-row right-side slot.
  - No duplicated AI toolbar inside the table canvas/workspace.

### 12.3 Build contract update set

- Function contract (core):
  - `docs/modules/02_moja-praca/functions/MW_IDEAS_TABLE.md` (full 12-section contract with route/component/API/test evidence matrix).
- Module contract sync:
  - `docs/modules/02_moja-praca/03_BEHAVIOR.md` (Table behavior boundaries, model, validation, handoff semantics),
  - `docs/modules/02_moja-praca/04_UI_UX.md` (Table UX addendum, Menu 3 AI placement, states),
  - `docs/modules/02_moja-praca/07_ACCEPTANCE_AND_TESTS.md` (Table critical claims evidence matrix),
  - `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md` (this addendum).

### 12.4 Impact

- Other Idea formats:
  - Mind Map feeds Table when relational chaos needs tabular comparison.
  - Table feeds Process Flow when records become ordered steps/lanes.
  - Table feeds Whiteboard when structured rows need facilitation/review.
  - Cross-tool transforms preserve selected rows, field semantics, source refs and intent.
- `01_czat`:
  - Table may be generated from conversation or chat-derived source packs, but conversation canon remains in `01_czat`.
  - Chat-origin rows must retain source/citation/provenance when visible in Table.
- `05_inicjatywy`:
  - Table can propose initiative candidates from selected rows, but initiative lifecycle and canonical mutation remain owned by `05_inicjatywy`.
- `06_realizacja`:
  - Table can propose task/action candidates from selected rows, but execution status and delivery governance remain owned by `06_realizacja`.
- Ownership and traceability:
  - `MW_IDEAS_TABLE` owns table artifact structure inside My Work Ideas only.
  - Handoff payload must include rows, fields, source/evidence context, validation state and target intent.
  - Requirement traceability follows `requirement -> module -> function -> object/artifact -> route -> component -> API -> test -> owner`.

### 12.5 Done gate (this addendum cycle)

- Contract completeness for `MW_IDEAS_TABLE`: `PASS`.
- Evidence completeness for critical claims (`route/component/API/test`): `PASS_WITH_P2`.
- UI/UX governance alignment:
  - `PASS_WITH_P2` because Menu 3 target is locked, but all runtime Table AI placement still needs audit.
- Residual gaps:
  - brak osobnego template catalog dla Table modes (idea register, risk register, decision table, hypothesis table, prioritization matrix, action list).
  - brak jednego dedykowanego e2e `table proposal -> approval -> convert -> owner-module read-back`.
- Gate result: `REVIEW`.

## 13. Addendum — IDEA FORMAT: WHITEBOARD (`MW_IDEAS_WHITEBOARD`)

### 13.1 Decision

- Scope lock:
  - to jest funkcja rodziny `Idea` w `02_moja-praca`, nie osobny modul.
  - dokumentacja-only cycle (bez runtime edits).
- Change type:
  - `RAW-to-contract conversion` + `function contract hardening`.
- Primary RAW anchors:
  - `docs/UI_UX/95_RAW_WHITEBOARD_AI_COLLABORATIVE_WHITEBOARD_ENGINE_2026-05-09.md`,
  - `docs/RAW/whiteboard/95_RAW_WHITEBOARD_AI_COLLABORATIVE_WHITEBOARD_ENGINE_2026-05-09.md`,
  - `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` (chat -> whiteboard -> artifact/execution handoff).
- Decision:
  - `MW_IDEAS_WHITEBOARD` to AI-governed workshop artifact format w ramach `MW_IDEAS`.
  - Whiteboard nie jest osobnym modulem i nie przejmuje ownership lifecycle z downstream lanes.

### 13.2 UI/UX

- JTBD lock:
  - user wybiera Whiteboard do facylitacji i syntezy wizualnej przy wysokiej niepewnosci, wielu glosach i potrzebie wspolnego kontekstu.
- Object-model lock:
  - elementy: `note`, `cluster`, `theme`, `outcome`, `decision`, `action`, `area/frame`, `metric`, `link/image`;
  - relacje i grupowanie sa jawne;
  - adnotacje zawieraja provenance/evidence/workshop context.
- Collaboration + versioning lock:
  - role model: `facilitator|participant|observer`,
  - phase model: `start -> organize -> converge -> handoff`,
  - timer/voting/follow/spotlight + snapshots/activity/history.
- Governance lock:
  - AI proposals sa explicit i wymagaja akceptacji;
  - high-impact conversion wymaga owner review/read-back.
- AI placement lock:
  - AI actions dla Whiteboard sa w Menu 3 / command-row right-side slot.
  - Brak duplikowania tych samych akcji AI w canvas.

### 13.3 Build contract update set

- Function contract (core):
  - `docs/modules/02_moja-praca/functions/MW_IDEAS_WHITEBOARD.md` (full 12-section contract + evidence matrix route/component/API/test).
- Module contract sync:
  - `docs/modules/02_moja-praca/03_BEHAVIOR.md` (whiteboard boundaries, object model, collaboration/versioning/approval, handoff semantics),
  - `docs/modules/02_moja-praca/04_UI_UX.md` (whiteboard UX addendum, Menu 3 AI placement, states),
  - `docs/modules/02_moja-praca/07_ACCEPTANCE_AND_TESTS.md` (whiteboard critical claims evidence matrix),
  - `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md` (this addendum).

### 13.4 Impact

- Spojnosc 4 formatow Idea:
  - Whiteboard dostaje ten sam poziom kontraktowej precyzji co `Mind Map`, `Table`, `Process Flow`;
  - cross-tool transform ma ten sam wymog zachowania source/provenance i intent.
- Chat -> My Work handoff:
  - Whiteboard moze konsumowac input pochodzacy z rozmowy, ale canon rozmowy pozostaje w `01_czat`;
  - provenance chat-origin musi byc widoczne po transformacji do whiteboard outcomes.
- Downstream execution/initiative lanes:
  - handoff do `05_inicjatywy` i `06_realizacja` pozostaje explicit candidate flow;
  - brak hidden mutation i brak sygnalizowania sukcesu bez owner read-back.
- Ownership and traceability:
  - `MW_IDEAS_WHITEBOARD` owns only board/session/outcome context inside idea workspace;
  - traceability remains `requirement -> module -> function -> object/artifact -> route -> component -> API -> test -> owner`.

### 13.5 Done gate (this addendum cycle)

- Contract completeness for `MW_IDEAS_WHITEBOARD`: `PASS`.
- Evidence completeness for critical claims (`route/component/API/test`): `PASS_WITH_P2`.
- UI/UX governance alignment:
  - `PASS_WITH_P2` because Menu 3 target is locked, but runtime placement audit is still needed.
- Residual gaps:
  - brak jednego dedykowanego e2e `whiteboard facilitation -> outcome approval -> convert -> owner read-back`;
  - brak osobnego mini-katalogu required evidence fields per whiteboard outcome type.
- Gate result: `REVIEW`.

## 14. Addendum — IDEA FORMAT: FLOW (`MW_IDEAS_PROCESS_FLOW`)

### 14.1 Decision

- Scope lock:
  - to jest funkcja rodziny `Idea` w `02_moja-praca`, nie osobny modul;
  - dokumentacja-only cycle (bez runtime edits).
- Change type:
  - `RAW-to-contract conversion` + `function contract hardening`.
- Primary RAW anchors:
  - `docs/UI_UX/98_RAW_PROCESS_FLOW_AI_PROCESS_INTELLIGENCE_2026-05-09.md`,
  - `docs/RAW/process-flow/98_RAW_PROCESS_FLOW_AI_PROCESS_INTELLIGENCE_2026-05-09.md`,
  - `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` (conversation -> artifact -> decision/task/execution relation).
- Decision:
  - `MW_IDEAS_PROCESS_FLOW` is the executable process-logic format inside Ideas.
  - It is not a standalone BPM/workflow module and not an owner-module mutation surface.

### 14.2 UI/UX

- JTBD lock:
  - user wybiera Flow, gdy chce przejsc od idei do logicznej sekwencji krokow, decyzji, warunkow i handoffow.
- Model lock:
  - nodes + edges + conditions + lanes + dependencies + guard rails + recovery paths.
- Mandatory runtime states:
  - `loading`, `empty`, `error`, `degraded`, `success` z "co dalej".
- Governance lock:
  - krytyczne kroki (`decision`, `approval`, `handoff`, `risk`) wymagaja source/evidence posture;
  - AI-generated structure pozostaje proposal do explicit acceptance;
  - high-impact conversion wymaga approval point i owner-module review/read-back.
- AI placement lock:
  - AI actions dla Flow sa w Menu 3 / command-row right-side slot.
  - No duplicated AI toolbar inside flow canvas/workspace.

### 14.3 Build contract update set

- Function contract (core):
  - `docs/modules/02_moja-praca/functions/MW_IDEAS_PROCESS_FLOW.md` (full 12-section contract with nodes/edges/conditions, guard rails, approvals and route/component/API/test evidence matrix).
- Module contract sync:
  - `docs/modules/02_moja-praca/03_BEHAVIOR.md` (Flow behavior boundaries, transition/validation rules, AI governance, handoff semantics),
  - `docs/modules/02_moja-praca/04_UI_UX.md` (Flow UX addendum, Menu 3 AI placement, states and recovery),
  - `docs/modules/02_moja-praca/07_ACCEPTANCE_AND_TESTS.md` (Flow critical claims evidence matrix),
  - `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md` (this addendum).

### 14.4 Impact

- Other Idea formats:
  - Table feeds Flow when structured rows become ordered process steps.
  - Mind Map feeds Flow when relational concepts require executable sequence.
  - Whiteboard feeds Flow when workshop synthesis requires operational step logic.
  - Cross-tool transforms preserve source refs, intent, dependencies and approval posture.
- `01_czat`:
  - Flow may be derived from conversation-derived context, but conversation canon remains in `01_czat`.
  - Chat-origin steps must preserve citation/provenance markers.
- `05_inicjatywy`:
  - Flow can propose initiative candidates from bottlenecks/risks, but initiative lifecycle and canonical mutation remain owned by `05_inicjatywy`.
- `06_realizacja`:
  - Flow can propose task/action chains, but execution statuses and delivery governance remain owned by `06_realizacja`.
- Ownership and traceability:
  - `MW_IDEAS_PROCESS_FLOW` owns only flow artifact structure inside My Work Ideas.
  - Handoff payload must include selected scope, transition conditions, dependencies, source/evidence context, validation/readiness state and intent.
  - Requirement traceability follows `requirement -> module -> function -> object/artifact -> route -> component -> API -> test -> owner`.

### 14.5 Done gate (this addendum cycle)

- Contract completeness for `MW_IDEAS_PROCESS_FLOW`: `PASS`.
- Evidence completeness for critical claims (`route/component/API/test`): `PASS_WITH_P2`.
- UI/UX governance alignment:
  - `PASS_WITH_P2` because Menu 3 target is locked, but runtime audit for full Flow AI placement and approval-chain coverage remains open.
- Residual gaps:
  - brak dedykowanego katalogu archetypow semantyki `nodes/edges/conditions` dla Flow.
  - brak pojedynczego e2e `flow proposal -> approval -> convert -> owner read-back`.
- Gate result: `REVIEW`.

## 14. Implementation handoff package — Flow completion/stabilization

- Canonical implementation plan:
  - `docs/modules/02_moja-praca/FLOW_COMPLETION_AND_STABILIZATION_IMPLEMENTATION_PLAN.md`
- Delivery posture:
  - hard order `P0 -> P1 -> P2`,
  - `P0` must close before starting `P1`,
  - critical claim = mandatory `route/component/API/test` evidence.
- Sprint intent:
  - `S0/S1`: generation + governance + recovery stabilization,
  - `S2`: intelligence + conversion packs,
  - `S3`: optional interop/connectors (`P2` only after `P0/P1` pass).

## 15. IDEA Family Integrator Closeout

### 15.1 Integrator scope

- Mode: Conflict Review -> Contract Unification -> Cross-Module Impact -> Final Gate.
- Scope: documentation-only integration for `MW_IDEAS_MINDMAP`, `MW_IDEAS_TABLE`, `MW_IDEAS_PROCESS_FLOW`, `MW_IDEAS_WHITEBOARD`.
- Updated contracts:
  - `docs/modules/02_moja-praca/functions/MW_IDEAS.md`,
  - `docs/modules/02_moja-praca/03_BEHAVIOR.md`,
  - `docs/modules/02_moja-praca/04_UI_UX.md`,
  - `docs/modules/02_moja-praca/07_ACCEPTANCE_AND_TESTS.md`,
  - `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md`.

### 15.2 Conflict review result

| Conflict ID | Dotyczy formatow | Typ konfliktu | Severity | Decyzja | Status |
| --- | --- | --- | --- | --- | --- |
| `IDEA-C01` | Mind Map vs Table vs Flow vs Whiteboard | ownership | high | Four formats are one `Idea` family inside `02_moja-praca`, not separate modules. | resolved |
| `IDEA-C02` | Table vs Flow | data | high | Table owns row/field/scoring semantics; Flow owns step/condition/lane/readiness semantics. | resolved |
| `IDEA-C03` | Mind Map vs Whiteboard | UX | medium | Mind Map owns relationship topology; Whiteboard owns facilitation/session synthesis. | resolved |
| `IDEA-C04` | All formats | UX | high | Menu 3/right command row is canonical for contextual AI actions; canvas cannot duplicate same AI actions. | resolved |
| `IDEA-C05` | All formats vs owner modules | handoff | high | Downstream handoff is candidate-only until owner review and read-back. | resolved |
| `IDEA-C06` | All formats | evidence | medium | Missing e2e/read-back coverage is tracked as `code_gap`; provenance/evidence remains contractually required. | resolved |

### 15.3 Unified Idea Family contract

- Common goal:
  - convert ambiguous thinking into source-aware, reviewed work candidates.
- Format boundaries:
  - Mind Map = relations and evidence topology,
  - Table = structured comparison and validation,
  - Process Flow = sequence, decisions, lanes and readiness,
  - Whiteboard = facilitation, synthesis, outcomes and session context.
- Switching rule:
  - every cross-format switch is an explicit transform carrying selected scope, source/evidence refs, provenance posture, validation state and intent.
- Shared invariants:
  - `AI suggestion != approved truth`,
  - no hidden mutation,
  - Menu 3 AI placement only,
  - no downstream success claim before owner read-back,
  - tenant/ACL deny-by-default.

### 15.4 Cross-module impact

- `01_czat`:
  - chat/conversation can provide source context for Idea formats, but conversation canon remains owned by `01_czat`;
  - chat-origin rows/nodes/steps/outcomes must retain source/citation/provenance after transform.
- `05_inicjatywy`:
  - Idea formats can create initiative candidates only;
  - initiative lifecycle, approval and canonical mutation remain owned by `05_inicjatywy`.
- `06_realizacja`:
  - Idea formats can create task/action/action-chain candidates only;
  - execution status, delivery governance and canonical task mutation remain owned by `06_realizacja`.
- System traceability:
  - `SYSTEM_TRACEABILITY_MATRIX.md` now includes a dedicated Idea family row tying `MW_IDEAS` formats to route/component/API/test evidence and marking owner read-back e2e as `code_gap`.

### 15.5 Final gate

- High conflicts unresolved: `0`.
- Critical claims evidence:
  - `PASS_WITH_P2`; route/component/API/test evidence is mapped, but all-format Menu 3 runtime audit and owner read-back e2e remain gaps.
- Contract sync:
  - `03_BEHAVIOR`, `04_UI_UX`, `07_ACCEPTANCE_AND_TESTS`, `MW_IDEAS.md` and `SYSTEM_TRACEABILITY_MATRIX.md` are aligned.
- Security/tenant posture:
  - `PASS`; no new hidden writes, no ownership bypass, deny-by-default invariant preserved.
- Testing Canon decision:
  - documentation-only cycle, no runtime tests executed; evidence matrix updated and missing runtime validation remains `code_gap`.
- Final gate result:
  - `PASS_WITH_P2`.

## Normalized Gap Register — 2026-05-11

### P0 must close

| Gap | Evidence location | Required closure | Current status |
| --- | --- | --- | --- |
| Mixed function packet must not be used as one implementation backlog. | scope notice in this packet; `IMPLEMENTATION_TASK_BOARD.md`; `function-cards/*_EXECUTION_CARD.md` | Future agents must dispatch one immutable `scope_anchor` at a time. | `DONE_DOC` |
| Radar target docs must preserve no-PMO, no-task-owner and no-hidden-mutation invariants. | `MW_HOME_RADAR`; module 03/04/07 docs; taskboard rows `MW-RADAR-*` | Keep Radar as pre-initiative intelligence/handoff surface only. | `DONE_DOC` |

### P1 runtime evidence

| Gap | Evidence needed | Blocking reason | Current status |
| --- | --- | --- | --- |
| Full Radar handoff read-back is not proven end-to-end. | Radar load -> triage -> action handoff -> owner-module review/mutation -> read-back confirmation. | Runtime go needs owner-lane confirmation, not just handoff payload. | `NOT_DONE` |
| Menu 3 replacement for inline Radar AI controls is specified for docs. | command-row right-slot controls and no duplicate inline AI action evidence. | UI governance requires contextual AI actions in Menu 3. | `DECISION_CLOSED_DOCS`; runtime `NOT_DONE` |

### P2 premium hardening

| Gap | Evidence needed | Current status |
| --- | --- | --- |
| Literal radar map interaction model is decided for docs. | rings/categories/drill-down follow-up UI evidence. | `DECISION_CLOSED_DOCS`; runtime `NOT_DONE` |
| Portal-style Radar runtime implementation remains deferred. | route/component/API/test bundle for target layout. | `NOT_DONE` |
