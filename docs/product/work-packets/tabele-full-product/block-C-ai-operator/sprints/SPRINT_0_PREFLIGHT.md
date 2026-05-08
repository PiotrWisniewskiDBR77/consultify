# Sprint 0 — Preflight (Block C)

**Sprint ID:** `C-S0`
**Owner:** Orchestrator + Agent A (telemetry)
**Status:** `PLANNED`
**Estimate:** ~0.5 day

## Goal

- Verify barrier gate from Block A and Block B.
- Token budget calibration: capture baseline daily token usage from existing AI components (chat, schema generator, summarizer) on representative workspace.
- Confirm migration plan for `tp_qa_reports`, `tp_ai_usage`, `tp_proposals.level` extension, `tp_source_packs`.

## Pre-sprint risk check

C-T1 (token budget calibration), PR2 (barrier gate enforcement).

## Deliverables

- `evidence/sprint-0/barrier-gate-verification.md` — confirms A=GO, B=GO.
- `evidence/sprint-0/token-baseline.md` — daily token usage baseline.
- `audit-findings/AI_OPERATOR_BASELINE_2026-05-XX.md` — existing AI components map (chat, schema-gen, summarizer, classification).
- Migration plan signed off.

## Files

### Created
- `evidence/sprint-0/barrier-gate-verification.md`
- `evidence/sprint-0/token-baseline.md`
- `audit-findings/AI_OPERATOR_BASELINE_2026-05-XX.md`

### Untouched
- All source files.

## Sprint Entry Gate

- [ ] Block A `03_BLOCK_CLOSEOUT.md` shows `GO`.
- [ ] Block B `03_BLOCK_CLOSEOUT.md` shows `GO`.

## Sprint Exit Gate

- [ ] Barrier verified.
- [ ] Token baseline captured.
- [ ] Migration plan signed off.
- [ ] Recommendation: `GO` to S1.
