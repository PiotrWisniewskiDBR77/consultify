---
doc_kind: MODULE_DELIVERY_CONTRACT
owner: user
status: approved_for_execution
last_updated: 2026-05-12
scope_anchor: W2-CORE-01_02_03-RUNTIME-20260512
wave: Wave2
work_type: runtime-implementation-and-evidence
---

# Module Delivery Contract - W2 Core 01/02/03 Runtime

## 1) Module / Block Name

`W2 Teresa Core Execution OS (01/02/03)`

## 2) Goal

Deliver production-truth runtime and evidence for Teresa core execution across `01_czat`, `02_moja-praca`, and `03_wywiad` with strict scope isolation from Wave 1 and gate-closable proof.

## 3) Non-Goals

- No runtime implementation in modules `09/10/11/12`.
- No cross-module refactor outside explicit file map below.
- No governance-board rewrites beyond minimal execution report/evidence references.
- No new UI pattern outside approved UI freeze registry.

## 4) Source Of Truth

Mandatory:

- `README.md`
- `.cursor/SOURCE_OF_TRUTH_INDEX.md`
- `.cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md`
- `.cursor/MODULE_DELIVERY_CONTRACT_TEMPLATE.md`

Program and gate governance:

- `DRD/consultify/docs/modules/_PROGRAM_BOARD_FULL_ROLLOUT_2026-05-11.md`
- `DRD/consultify/docs/modules/_PROGRAM_GATE_BOARD_G1_G7_2026-05-11.md`
- `DRD/consultify/docs/modules/_AGENT_DISPATCH_AND_MEMORY_PLAYBOOK_2026-05-12.md`
- `DRD/consultify/docs/modules/_MODEL_ROUTING_MATRIX_2026-05-12.md`
- `DRD/consultify/docs/modules/_GATE_TEST_BLUEPRINT_2026-05-12.md`

Domain-specific:

- `DRD/consultify/docs/modules/01_czat/RAW_TARGET_STATE_2_0_PACKET.md`
- `DRD/consultify/docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md`
- `DRD/consultify/docs/modules/03_wywiad/RAW_TARGET_STATE_2_0_PACKET.md`

UI/UX canon (required):

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/modules/_UI_COMPONENT_FREEZE_REGISTRY_2026-05-12.md`
- `DRD/consultify/docs/modules/UI_UX_CONTRACT_INDEX.md`

Testing canon:

- `DRD/testy_antygravity/TESTING_OPERATING_SYSTEM.md`
- `DRD/testy_antygravity/_TESTING_COMMAND_CANON_2026-05-11.md`
- `DRD/testy_antygravity/_ANYGRAVITY_COMMUNICATION_PROTOCOL_2026-05-12.md`
- `DRD/manual_Tests/README_TEST_PROCESS.md`

## 5) Decisions Locked Before Start

- Wave 1 remains closed as `W1_CLOSED_PASS_WITH_P2`; W2 must not mutate Wave 1 scope anchors.
- `GB-P1-005` is the only active runtime priority for Wave 2 and starts from `READY_W2_ENTRY`.
- Dispatcher model is fixed: `WIP=2`, no third parallel stream.
- Runtime execution model for this card: `codex 5.3` (`L1_STANDARD` baseline).
- Any unresolved security/tenancy/ownership ambiguity is a hard stop.
- Gate closure requires both technical evidence and manual Anygravity verdict intake.

## 6) Open Questions (max 3)

1. None at contract start.
2. If a required runtime change falls outside file map, should we extend map or split to separate scope anchor? (default: split).
3. If manual test is `PASS_WITH_P2`, should Gate #1 close immediately or require one focused follow-up pack? (default: close with tracked P2).

## 7) Scope In

### Files To Create

- `DRD/consultify/docs/modules/_W2_CORE_01_02_03_RUNTIME_EXECUTION_REPORT_2026-05-12.md` - runtime evidence report for this scope.

### Files To Update

- `DRD/consultify/src/components/AIChat/UnifiedChatPanel.tsx` - Teresa core chat execution flow for W2 paths when needed.
- `DRD/consultify/src/components/MyWork/MyWorkHub.tsx` - W2 core operating loop behavior and route/state consistency.
- `DRD/consultify/src/components/Interview/InterviewHub.tsx` - Teresa-executed interview runtime behavior in W2 chain.
- `DRD/consultify/src/utils/artifactLinks.ts` - route truth alignment only if required by W2 core path.
- `DRD/consultify/tests/components/AIChat/UnifiedChatPanel.test.tsx` - targeted chat runtime assertions.
- `DRD/consultify/tests/components/MyWork/MyWorkHub.test.tsx` - targeted my-work runtime assertions.
- `DRD/consultify/tests/integration/MyWorkWorkflow.test.tsx` - integration proof for operating loop continuity.
- `DRD/consultify/tests/integration/interview/interview-routes.test.ts` - interview route/runtime consistency checks.

### Routes / APIs

- `/chat`
- `/my-work`
- `/interview`
- `/portfolio`
- `/benefits`
- Runtime APIs touched by these flows only (no new endpoint creation in this scope).

### UI Surfaces

- Teresa chat surface (module `01`).
- My Work operating loop surface (module `02`).
- Interview runtime surface (module `03`).

### Data / Migration Scope

- No database migration.
- No schema mutation.

## 8) Scope Out / Untouched

Files explicitly untouched:

- `DRD/consultify/src/components/ReportsAndPresentations/artifactNavigation.ts`
- `DRD/consultify/src/components/ReportsAndPresentations/**`
- `DRD/consultify/src/components/Documents/**`
- `DRD/consultify/src/components/Tables/**`
- `DRD/consultify/src/components/Presentations/**`

Out of scope:

- Modules `09/10/11/12` runtime changes.
- New component pattern introduction without mini-RFC.
- Security model redesign.

## 9) Acceptance Criteria

- Teresa core execution chain (`converse -> clarify -> execute -> review -> read-back`) is demonstrably consistent in modules `01/02/03`.
- Route and state persistence for `/chat` and `/my-work` hold under navigation and refresh.
- Interview runtime path remains executable and tenant-safe without silent failures.
- No scope-anchor collision with Wave 1 files or claims.
- Evidence pack exists with targeted tests, smoke coverage, lint result, and explicit `NOT_DONE` list (if any).
- Final verdict recorded as one of: `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`.

## 10) Validation Matrix

| Layer | What | Where | Command / Method | Evidence |
| --- | --- | --- | --- | --- |
| Unit | runtime utility and mapping checks for touched paths | `tests/unit/**` | `npx vitest run <targeted unit files>` | targeted unit pass output |
| Integration | cross-route/session consistency (`/chat`, `/my-work`, `/interview`) | `tests/integration/**` | `npx vitest run tests/integration/MyWorkWorkflow.test.tsx tests/integration/interview/interview-routes.test.ts` | integration pass output |
| Component/UI | Teresa chat + MyWork runtime behavior | `tests/components/**` | `npx vitest run tests/components/AIChat/UnifiedChatPanel.test.tsx tests/components/MyWork/MyWorkHub.test.tsx` | component test pass output |
| E2E/Smoke | touched-flow smoke for route load and key action continuity | staging/local smoke scripts | `npm run smoke:b02-chat-actions` plus scope-specific smoke command if available | smoke log with pass/fail |
| Manual/Anygravity | gate scenario execution on `demo.consultify.ai` | `testy_antygravity/reports/*W2*` | protocol-driven manual run + structured report | manual report with verdict and evidence |
| Security/Tenant | ownership/tenant boundaries and deny-by-default confirmation | runtime + report checklist | checklist verification in report + no boundary violation evidence | explicit `PASS` or blocker row |

## 10.1 UI/UX Gate Matrix (required for UI work)

| Gate | Expected Evidence |
| --- | --- |
| Loading | route/surface loading shown in test/manual evidence |
| Success | successful Teresa execution step with expected output/state |
| Error | controlled error handling on at least one failure path |
| Empty | empty-state behavior captured where relevant |
| Degraded | degraded/network limitation behavior documented |
| Toast/Banner | no misleading success messaging; proper status cue evidence |
| Refresh/Read-back | pre/post refresh state parity evidence |
| Menu 3 AI Actions | unchanged placement and no duplicate toolbar |
| DBR77/Semantic Colors | `n/a` for this runtime scope unless list/status chips modified |

## 10.2 Testing Canon Mapping

| Phase | Required? | Evidence |
| --- | --- | --- |
| Automated / technical checks | yes | targeted vitest output + lint result |
| API Gate | yes | network/log proof in smoke/manual evidence |
| DB-Compat Gate | no | `n/a` (no migration/schema changes) |
| UI Smoke Gate | yes | smoke command output + route render evidence |
| Manual Anygravity | yes | report file under `testy_antygravity/reports/` |

## 11) Risk Register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Scope drift into Wave 1 files | med | high | strict file-map enforcement + hard stop on collision |
| False-positive runtime claim without evidence | med | high | mandatory evidence pack and `NOT_DONE` discipline |
| UI divergence from approved registry | low | high | enforce UI freeze registry before merge |
| Hidden security/tenant regression in W2 chain | low | critical | explicit security checklist and blocker escalation |
| Async manual loop delays gate closure | med | med | allow async progression only with `LAUNCH_ALLOWED` and no `BLOCKED_P1` |

## 12) Rollback Strategy

- Revert only files changed under this scope anchor.
- Preserve W1 closure artifacts untouched.
- If blocker appears after merge attempt, roll back W2 runtime commits for affected module and keep evidence report with blocker note.

## 13) Sprint Plan

### Sprint 1 - Runtime Core Alignment

- Objective: implement/fix W2 runtime behavior in `01/02/03` with strict file map.
- Files: runtime files listed in Scope In.
- Validation: targeted unit/component/integration tests.
- Gate criteria: no `BLOCKED_P1`, file scope respected, tests green.

### Sprint 2 - Evidence and Gate Pack

- Objective: complete smoke/manual evidence and finalize execution report.
- Files: test updates + execution report.
- Validation: smoke + lint + manual Anygravity intake.
- Gate criteria: final verdict recorded and unresolved items explicitly tracked.

## 14) Agent Instructions

Start in planning mode only.

The agent must:

1. read all source-of-truth files listed above,
2. produce a short plan confirming exact touched files (no extras),
3. wait for approval before editing,
4. execute sprint by sprint,
5. report gate status after every sprint (`PASS`, `PASS_WITH_P2`, `BLOCKED_P1`),
6. stop immediately on hard-stop conditions:
   - scope collision,
   - ownership/security uncertainty,
   - need to edit out-of-scope files.

## 15) Final Report Required

Return:

1. changes made,
2. validation performed,
3. gate result,
4. remaining risks,
5. next step.
