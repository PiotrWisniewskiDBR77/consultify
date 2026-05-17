# Block B — Record Provenance

**Block ID:** `TABELE_BLOCK_B_RECORD_PROVENANCE`
**Program:** `TABELE_FULL_PRODUCT_PROGRAM`
**Status:** `PLANNED`
**Duration:** Days 1–10 (parallel with Block A)
**Lead deliverable:** Record-level source provenance, confidence scoring, validation status, and grid UI.

## Files

- `00_TASK_PACKET.md`
- `01_VALIDATION_MATRIX.md`
- `02_RISK_REGISTER.md`
- `03_BLOCK_CLOSEOUT.md`
- `epics/EPIC-T8_SOURCE_PROVENANCE.md`
- `epics/EPIC-T9_CONFIDENCE_VALIDATION.md`
- `sprints/SPRINT_0_PREFLIGHT.md` … `SPRINT_7_CLOSEOUT.md`

## Epics in scope

- **EPIC-T8** Source Provenance — `tp_record_sources` table, source CRUD endpoints, source picker UI.
- **EPIC-T9** Confidence & Validation — `confidence_score`, `validation_status` columns, recompute hook, grid UI badges.

## Exit criterion

Block exits `GO` when all 7 sprints close green and barrier gate at Day 10 satisfies (with Block A also `GO`).
