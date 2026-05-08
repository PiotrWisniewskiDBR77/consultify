# Sprint 0 — Preflight (Block D)

**Sprint ID:** `D-S0`
**Owner:** Orchestrator
**Status:** `PLANNED`
**Estimate:** ~0.5 day

## Goal

- Verify Block C closed `GO`.
- Audit existing intent-routing pipeline to ensure Tabele → Doc/Deck conversion does not collide with Foundation Block lane mapping.
- Confirm V8 snapshot contracts between Block C `SourcePackService` and `WordyArtifactService` / `PrezentacjeArtifactService`.
- Confirm public forms architecture (route, JWT, rate limit) does not collide with existing `/public/*` routes.

## Pre-sprint risk check

D-T1 (V8 drift), D-S1 (public form data leak).

## Deliverables

- `evidence/sprint-0/block-c-gate-verification.md`.
- `audit-findings/INTENT_ROUTING_AUDIT_2026-05-XX.md`.
- `audit-findings/V8_CONTRACT_AUDIT_2026-05-XX.md`.
- Migration plan signed off.

## Files

### Created
- `evidence/sprint-0/*`
- `audit-findings/*`

### Untouched
- All source files.

## Sprint Entry Gate

- [ ] Block C `03_BLOCK_CLOSEOUT.md` shows `GO`.

## Sprint Exit Gate

- [ ] Audits complete.
- [ ] Recommendation: `GO` to S1.
