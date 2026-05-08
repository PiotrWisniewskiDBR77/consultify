# Sprint 7 — Closeout (Block A)

**Sprint ID:** `A-S7`
**Owner:** Orchestrator
**Status:** `PLANNED`
**Estimate:** ~0.5 day

## Goal

Fill `03_BLOCK_CLOSEOUT.md`, file follow-ups, update `02_DEPENDENCIES_GRAPH.md` if any cross-block surface changed, deliver block exit recommendation.

## Deliverables

- `03_BLOCK_CLOSEOUT.md` filled per `.cursor/BLOCK_CLOSEOUT_TEMPLATE.md`.
- Follow-ups filed: `TBL-FU-A1`, `TBL-FU-A2`, … in `DRD/consultify/docs/product/follow-ups/`.
- Dependency graph updated if A-XB1/A-XB2/A-XB3 surfaces shifted.
- Status reported to user via summary message.

## Files

### Created / Updated
- `03_BLOCK_CLOSEOUT.md` (filled)
- `evidence/sprint-7/exit-recommendation.md`
- Follow-up cards as needed.

## Sprint Entry Gate

- [ ] S6 closed (any of `GO` / `GO_WITH_CONSTRAINTS`).

## Sprint Exit Gate

- [ ] Closeout filled and signed.
- [ ] Follow-ups filed.
- [ ] Dependency surface stable for Block C.
- [ ] Barrier-gate inputs ready (waits for B-S7 to close as well).

## Block Barrier Gate

- This sprint provides the A side of the Day-10 barrier.
- Waits for `block-B-record-provenance/sprints/SPRINT_7_CLOSEOUT.md` to close before Block C may start.
- If A=GO and B=GO → barrier passes.
- If either is `GO_WITH_CONSTRAINTS` → run focused fix-up sprint (≤2 days) before opening C.

## Realized risks

(filled at exit)
