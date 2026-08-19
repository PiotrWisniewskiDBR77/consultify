---
module_id: MODULE_INITIATIVES
doc_kind: ENTRYPOINT
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# Inicjatywy

## Purpose

System planowania i decyzji transformacyjnych: inicjatywa jest podstawowym obiektem konsultingowym łączącym źródła, zakres, decyzje, role, bramki i dalszą realizację.

## Contract Layers

- `../INITIATIVES_EXECUTION_FUNCTIONS_CANON.md` — nadrzędny kanon Menu 2, business lifecycle, table-first shell, funkcji `Inicjatywy / Portfel / Plan / Obciążenie` oraz handoffu do Execution. W tym zakresie ma pierwszeństwo przed starszym inventory funkcji i runtime enumem.
- `../initiatives-execution-canon/00_INDEX_AND_AUTHORITY.md` — kompletny pakiet wdrożeniowy: proces, governance, UI/UX, descriptors, data/API/events, migracja, kolejność implementacji, testy i owner decisions.

- `SSOT.md` — priority and source map.
- `RAW_TARGET_STATE_2_0_PACKET.md` — Contract 2.0 packet for RAW extraction, delta, function/dependency/evidence baseline and open questions.
- `INTEGRATION_REPORT.md` — module integration decision, consistency matrix and gate output.
- `IMPLEMENTATION_TASK_BOARD.md` — normalized `P0/P1/P2` rows by immutable scope anchor.
- `function-cards/*_EXECUTION_CARD.md` — function-level execution governance cards for dispatch safety.
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

## Initiative Card System

- `INITIATIVE_CARD_SYSTEM_CONTRACT.md` — canonical UI/UX + behavior + data + permissions + evidence contract for Initiative Card variants across list, kanban, timeline, preview, modal and linked lanes.
- `INITIATIVE_TRANSFER_BACKBONE_GAP_ANALYSIS.md` — full gap analysis for making Initiative the transfer backbone from source evidence through validation, tasks, decisions and results.
- `INITIATIVE_IMPROVEMENT_IDEAS_AND_DEVELOPMENT_ANALYSIS.md` — improvement ideas and target analysis model for developing initiatives from raw source signal into source-backed, execution-ready consulting initiatives.
- `RAW_PROJECT_MANAGEMENT_BENCHMARK_ANALYSIS.md` — RAW/benchmark analysis for 2026-level project/program management patterns and their impact on initiative lifecycle, stages, gates, traction and execution conversion.
- `RAW_TASK_MANAGEMENT_BENCHMARK_ANALYSIS.md` — RAW/benchmark analysis for 2026-level task/workflow management patterns and their impact on task assignment, decision blockers, inbox, calendar, AI proposals and initiative readiness.
- Scope anchor: `05_inicjatywy/INITIATIVE_CARD_SYSTEM`.
- The card contract does not replace backend capabilities; it binds card rendering to `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md` and `docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`.
- The card contract also records transfer-backbone findings: initiatives may originate from tools, assessments, interview findings, conversation/MyWork, finance analysis and KPI/results evidence, but each path must preserve an auditable source envelope.
- Execution after initiative validation is task/decision-led; initiative ownership does not imply that the same person executes every task.
- RAW benchmark analysis confirms the target split: `Inicjatywy` decide what is worth doing and why, `Realizacja` manages how it is delivered, and `My Work`/tasks/decisions carry daily execution.

## Function Inventory (Function-First)

> Target canon: `Inicjatywy -> Portfel -> Plan -> Obciążenie`. Poniższe identyfikatory są historycznym/runtime inventory do mapowania i nie ustanawiają docelowego Menu 2.

| Function | Responsibility | Owner business | Owner tech | Status |
| --- | --- | --- | --- | --- |
| `IN_PORTFOLIO_HUB` | Primary initiative portfolio hub, lifecycle actions, card variants, preview and governed next actions. | user | user | `review/not_done` until UI transition/card tests are bound |
| `IN_ANALYSIS_WORKSPACE` | Feasibility, resources, logic, timeline and completeness analysis inside the initiatives hub. | user | user | `review/not_done` until analysis UI evidence is bound |
| `IN_ROADMAP_VIEW` | Roadmap lane for sequencing and scheduling context without duplicate initiative truth. | user | user | `review/not_done` until lane smoke evidence is bound |
| `IN_PORTFOLIO_VIEW` | Portfolio rollup/prioritization lane referencing initiative truth. | user | user | `review/not_done` until lane smoke evidence is bound |
| `IN_ROI_VIEW` | ROI/value lane linking assumptions and benefits without owning finance/results truth. | user | user | `review/not_done` until lane smoke evidence is bound |

## Current Delivery Gate

- Contract packet: `REVIEW`.
- Documentation baseline: `DONE_DOC`.
- Runtime readiness: `NOT_DONE`.
- Blocking evidence gap: no dedicated initiative UI lifecycle/card regression test evidence is bound to this module.
- Owner acceptance: not recorded for this 2026-05-10 Contract 2.0 cycle.

## Primary Sources

- `DRD/consultify/docs/product/INITIATIVE_GOVERNANCE_MODEL.md`
- `DRD/consultify/docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`
- `DRD/consultify/docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`
- `DRD/consultify/docs/product/GATE_DEFINITION_OF_DONE.md`
- `DRD/consultify/docs/product/SOURCE_TRACEABILITY_SPEC.md`
- `DRD/consultify/docs/product/ROLES_MODEL.md`
- `DRD/consultify/docs/product/PROJECT_AND_INITIATIVE_ROLE_RESOLUTION_V8.md`
- `DRD/consultify/docs/product/TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
