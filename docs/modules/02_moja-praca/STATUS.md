---
module_id: MODULE_MY_WORK
doc_kind: STATUS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-18
---

# Status — Moja Praca / My Work

## Status Tags (As-Is)

- `real`: `/my-work/*` route is mounted in `AppRoutes.tsx` and points to `MyWorkView`.
- `real`: sidebar mapping to `AppView.MY_WORK` exists in `menuConfig.ts`.
- `partial`: automated evidence exists mainly for table workspace paths, not for full My Work hub behavior.
- `doc_gap`: previous baseline text did not list concrete route/component/service evidence.
- `code_gap`: no dedicated `MyWorkHub` integration tests found in `src/components/MyWork`.
- `canonical`: Radar v1 rebuild contract locked in `functions/MW_HOME_RADAR.md` as module-level product/UI source of truth.
- `review`: module-level execution plan for stabilization/completion prepared in `IMPLEMENTATION_PLAN_STABILIZATION_AND_COMPLETION.md`.

## Function Coverage Status

- `pass`: function contract coverage complete for My Work (`12/12` functions documented).
- `real`: core functions (`MW_HOME_RADAR`, `MW_IDEAS`, `MW_NOTEBOOK`, `MW_INBOX`, `MW_CALENDAR`, `MW_TASKS`, `MW_DECISIONS`, `MW_MANAGER`) are active runtime surfaces.
- `real`: Ideas subfunctions (`MW_IDEAS_MINDMAP`, `MW_IDEAS_TABLE`, `MW_IDEAS_PROCESS_FLOW`, `MW_IDEAS_WHITEBOARD`) are active workspace tool modes.
- `partial`: automated evidence depth is uneven across functions (table paths stronger than full-hub function journeys).

## Runtime Notes (As-Is)

- Module runtime is broad (home/tasks/decisions/inbox/notebook/calendar/manager) inside one hub component.
- Access and behavior constraints rely on shared app/session permissions and feature flags used in hub code.
- Ideas workspace keeps one shared context with four tool systems and explicit tool switching semantics.

## Current Packet Gate Snapshot (`MW_HOME_RADAR`)

- Work package: `RAW_TARGET_STATE_2_0_PACKET.md`
- Rerun gate: `PASS` (`npm run docs:contract:rerun-gate`, 2026-05-10)
- Owner acceptance: `PENDING_EXPLICIT_ACCEPTANCE`
- Handoff conflict status: `NONE_CONFIRMED` (doc-level impact only)
- Module cycle status: `REBUILD_LOCKED` (Radar v1 contract and roadmap frozen for next implementation wave)

## Active Delivery Plan — My Work Module

- Implementation plan for completion/stabilization:
  - `IMPLEMENTATION_PLAN_STABILIZATION_AND_COMPLETION.md`
- Priority order for module completion:
  - `P0` generation and governance stabilization,
  - `P1` runtime resilience + UX operability + expanded regression,
  - `P2` performance hardening + completion baseline before RAW-gap analysis.
