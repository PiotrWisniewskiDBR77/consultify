# Table Studio Foundation — Work Packet Index

**Block ID:** `TABLE_STUDIO_FOUNDATION_BLOCK`
**Phase:** 1 of N (Foundation)
**Created:** 2026-05-07
**Status:** `APPROVED — Wave 1 IN PROGRESS (Agent A backend ‖ Agent B frontend); D1/D2/D3 confirmed 2026-05-07`
**Owner (delivery):** Planning & Delivery Agent (orchestrator) + 4 parallel subagents (A/B/C/D)

## Purpose

This folder is the canonical work packet for the Tabele (Table Studio) artifact lane foundation block. Every artifact required by `.cursor/CONSULTIFY_AI_DELIVERY_OS.md` and `.cursor/OPUS47_DELIVERY_PROCEDURE.md` lives here so the block is reviewable, auditable, and reversible without reading the codebase.

## Source-of-truth crosslinks (mandatory read order before edits)

1. `README.md` (repo root)
2. `.cursor/SOURCE_OF_TRUTH_INDEX.md`
3. `.cursor/REPO_STRUCTURE_AND_CLASSIFICATION.md`
4. `.cursor/CONSULTIFY_AI_DELIVERY_OS.md`
5. `.cursor/OPUS47_DELIVERY_PROCEDURE.md`
6. `.cursor/TASK_PACKET_TEMPLATE.md`
7. `.cursor/SPRINT_GATE_CHECKLIST.md`
8. `.cursor/BLOCK_CLOSEOUT_TEMPLATE.md`
9. Domain SoT:
   - `DRD/consultify/docs/product/TABLE_V8_SSOT.md`
   - `DRD/consultify/docs/product/TABLE_RELATIONAL_SCHEMA_AND_DOCS_WORKFLOW_V8.md`
   - `DRD/consultify/docs/product/CANVAS_SOURCE_OF_TRUTH.md`
   - `DRD/consultify/docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`
   - `DRD/consultify/docs/ui-standards/00-foundation/color-system.md`
   - `DRD/ROLE_PERMISSIONS_WORKFLOW_SOURCE_OF_TRUTH.md`
   - `DRD/UI_UX_SOURCE_OF_TRUTH.md`
10. Lane SSOT (this block): `DRD/consultify/docs/product/FINAL_IMPLEMENTATION_PLAN_24_TABELE_2026-05-07.md`

## Files in this packet

| # | File | Purpose |
|---|---|---|
| — | `README.md` | This index |
| 00 | `00_TASK_PACKET.md` | Canonical task packet (goal/non-goals/scope/DoD) |
| 01 | `01_VALIDATION_MATRIX.md` | Test types × scopes × commands |
| 02 | `02_RISK_REGISTER.md` | Technical / product / security risks + rollback |
| 03 | `03_BLOCK_CLOSEOUT.md` | Placeholder for end-of-block report |
| — | `epics/EPIC-1_FRONTEND_LANE_PARITY.md` | Tabele lane parity with Wordy/Excele/Prezentacje |
| — | `epics/EPIC-2_WORD_CANVAS_PREVIEW.md` | Word-canvas preview components |
| — | `epics/EPIC-3_BACKEND_RELATION_EXPLAINABILITY.md` | New service + route (only genuinely missing backend piece) |
| — | `epics/EPIC-4_INTEGRATION_INTENT_ROUTING_I18N.md` | Orchestrator + intent routing + i18n + a11y |
| — | `sprints/SPRINT_0_PREFLIGHT.md` | Preflight (DONE) |
| — | `sprints/SPRINT_1_BACKEND_RELATION_EXPLAIN.md` | Agent A workstream |
| — | `sprints/SPRINT_2_FRONTEND_SCAFFOLD_TYPES.md` | Agent B workstream |
| — | `sprints/SPRINT_3_WORD_CANVAS_COMPONENTS.md` | Agent C workstream |
| — | `sprints/SPRINT_4_TABELE_VIEW_ORCHESTRATOR.md` | Agent D workstream |
| — | `sprints/SPRINT_5_INTENT_ROUTING_I18N.md` | Integration sprint |
| — | `sprints/SPRINT_6_VALIDATION_MATRIX_RUN.md` | QA gate sprint |
| — | `sprints/SPRINT_7_CLOSEOUT.md` | Closeout sprint |

## Decisions (CONFIRMED 2026-05-07)

- **D1.** `/tabele` route target → **`<TabeleView />` direct (visible)**.
- **D2.** Backend scope → **REUSE existing `ChatToSchemaService` + `AuditService`**; build only `RelationExplainabilityService` + its route as the genuinely missing piece.
- **D3.** ACL audit handling → **STOP-and-file P0** if any leak found; do NOT patch in this block.

Closeout (`03_BLOCK_CLOSEOUT.md`) records the final outcome.

## Topology

| Wave | Agents in parallel | Workstreams |
|---|---|---|
| 0 | orchestrator | Sprint 0 (preflight) — DONE |
| 0.5 | orchestrator | Sprint 0.5 (this docs sprint) |
| 1 | A ‖ B | Sprint 1 (backend) ‖ Sprint 2 (frontend scaffold) |
| 2 | C ‖ D | Sprint 3 (preview components) ‖ Sprint 4 (orchestrator) |
| 3 | orchestrator | Sprint 5 (intent routing + i18n) |
| 4 | orchestrator | Sprint 6 (QA gate) |
| 5 | orchestrator | Sprint 7 (closeout) |

Each wave has a binary gate: PASS / PASS_WITH_P2 / BLOCKED_P1. No wave starts until previous wave is GREEN.

## Execution contract (binding for all 4 subagents)

1. Follow approved plan exactly; no scope expansion.
2. Do not touch files listed as "explicitly untouched" in `00_TASK_PACKET.md` §4.
3. No unrelated refactors.
4. Apply governance invariant: `proposal → approval → execution → audit`.
5. Enforce tenant/ACL boundaries on every endpoint and read path.
6. Menu 3 placement and DBR77 constraints are hard.
7. Run validation matrix per sprint card before claiming PASS.
8. If a hard-stop condition appears (architecture change, scope expansion, security ambiguity, SoT conflict): STOP and request approval.
