---
module_id: MODULE_MY_WORK
doc_kind: ENTRYPOINT
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-18
---

# Moja Praca / My Work

## Purpose

Osobiste centrum pracy użytkownika: home, inbox/radar, bieżące artefakty, zadania, powroty do pracy i dzienny rytm bez przejmowania odpowiedzialności modułów źródłowych.

## Current Module Priority

- `MW_HOME_RADAR` is currently under canonical rebuild direction.
- The dominant source for Radar decisions is `functions/MW_HOME_RADAR.md`.
- Development sequence is locked as `R0 -> R1 -> R2 -> R3` (documented in that function contract).

## Contract Layers

- `SSOT.md` — priority and source map.
- `00_META.md` — identity, route, owner and canonicality.
- `01_PURPOSE.md` — why this module exists.
- `02_SCOPE.md` — in-scope and out-of-scope boundaries.
- `03_BEHAVIOR.md` — required runtime behavior.
- `04_UI_UX.md` — required user experience and visual/interaction rules.
- `05_DATA_AND_INTEGRATIONS.md` — objects, integrations and lineage.
- `06_PERMISSIONS_AND_SECURITY.md` — roles, tenant boundaries and security.
- `07_ACCEPTANCE_AND_TESTS.md` — verification canon.
- `RAW_INPUT.md` — raw author notes before normalization.
- `CHANGELOG.md` — contract changes.
- `IMPLEMENTATION_PLAN_STABILIZATION_AND_COMPLETION.md` — execution plan for module stabilization and completion by priority.
- `WHITEBOARD_RAW_GAP_ANALYSIS_AND_ROADMAP.md` — RAW-to-roadmap gap analysis for Whiteboard (`P0-P2`).
- `IMPLEMENTATION_TASK_BOARD.md` — module-level task index; detailed deployable scope remains in `function-cards/*_EXECUTION_CARD.md`.
- `function-cards/` — function-level execution cards with immutable `scope_anchor`, P0/P1/P2 backlog, evidence plan and impact.

## Function Coverage (Current)

Core functions:

- `MW_HOME_RADAR`
- `MW_IDEAS`
- `MW_NOTEBOOK`
- `MW_INBOX`
- `MW_CALENDAR`
- `MW_TASKS`
- `MW_DECISIONS`
- `MW_MANAGER`

Ideas subfunctions:

- `MW_IDEAS_MINDMAP`
- `MW_IDEAS_TABLE`
- `MW_IDEAS_PROCESS_FLOW`
- `MW_IDEAS_WHITEBOARD`

Function contracts live in `functions/` and are mandatory for gate completeness.

## Primary Sources

- `DRD/consultify/docs/product/MYWORK_HOME_V1_SSOT.md`
- `DRD/consultify/docs/product/MYWORK_RADAR_V8_SSOT.md`
- `DRD/consultify/docs/product/MYWORK_RADAR_SIGNAL_PIPELINE_AND_RUNTIME_V8.md`
- `DRD/consultify/docs/product/MYWORK_RADAR_SOURCE_TRUST_AND_GOVERNANCE_V8.md`
- `DRD/consultify/docs/product/MY_WORK_INBOX_AND_SLA.md`
- `DRD/consultify/docs/product/NOTATKA_V8_SSOT.md`
- `DRD/consultify/docs/product/MYWORK_CALENDAR_V8_SSOT.md`
- `DRD/consultify/docs/UI_UX/108_RAW_RADAR_TECHNOLOGY_TRANSFORMATION_INTELLIGENCE_2026-05-09.md`
- `DRD/consultify/docs/UI_UX/109_RAW_CALENDAR_AI_WORKDAY_PROJECT_ENGINE_2026-05-09.md`
