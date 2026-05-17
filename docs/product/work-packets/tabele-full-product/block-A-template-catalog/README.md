# Block A — Template Catalog (+ MELS adoption)

**Block ID:** `TABELE_BLOCK_A_TEMPLATE_CATALOG`
**Program:** `TABELE_FULL_PRODUCT_PROGRAM`
**Status:** `PLANNED`
**Duration:** Days 1–10 (parallel with Block B); +1 day buffer absorbed by parallel sprint sub-streams in S4/S5.
**Lead deliverable:** 30 consulting templates + lifecycle (draft/approved/deprecated) + 5 specialized field types + **Tabele lane adoption of Module Executive Layout Standard (MELS, EPIC-T16)**.

## Files

- `00_TASK_PACKET.md` — scope, DoD, constraints
- `01_VALIDATION_MATRIX.md` — 8-layer validation
- `02_RISK_REGISTER.md` — block-level risks
- `03_BLOCK_CLOSEOUT.md` — closeout skeleton (filled at S7)
- `epics/EPIC-T5_CONSULTING_TEMPLATE_PACK.md`
- `epics/EPIC-T6_TEMPLATE_LIFECYCLE.md`
- `epics/EPIC-T7_SPECIALIZED_FIELD_TYPES.md`
- `epics/EPIC-T16_UNIFIED_EXECUTIVE_LAYOUT.md` — MELS adoption for Tabele
- `sprints/SPRINT_0_PREFLIGHT.md` … `SPRINT_7_CLOSEOUT.md`

## Epics in scope

- **EPIC-T5** Consulting Template Pack — 30 templates, schema_snapshots, seeder.
- **EPIC-T6** Template Lifecycle & Governance — status/version/owner/approval flow.
- **EPIC-T7** Specialized Field Types — `risk_score`, `priority`, `ai_generated_summary`, `ai_classification`, `source_reference`.
- **EPIC-T16** Unified Executive Module Layout (Tabele lane) — `ExecutiveModuleShell` + Tabele top bar / left rail / right rail per `MODULE_EXECUTIVE_LAYOUT_STANDARD.md`.

## Exit criterion

Block exits `GO` when all 7 sprints close green, barrier gate at Day 10 is satisfied, **and EPIC-T16 § 6 MELS acceptance checklist is signed off in S6**.
