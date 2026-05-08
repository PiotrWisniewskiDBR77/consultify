# Sprint 3 — AI Editor Levels 5–8 (Block C)

**Sprint ID:** `C-S3`
**Owner:** Agent A
**Status:** `PLANNED`
**Estimate:** ~1.5 days
**Epic:** EPIC-T10

## Goal

Full implementation of view, relational, methodological, source level handlers. Methodological + source require super-admin.

## Pre-sprint risk check

C-S4 (admin role check), C-XB1/2/3 (cross-block dependencies).

## Deliverables

- `view.ts` — view config suggestion.
- `relational.ts` — proposes new relations; proxies through existing relations service.
- `methodological.ts` — reads `template.governance_rules` (Block A); flags deviations.
- `source.ts` — calls `SourcePackService` (S6) to suggest sources for records missing them.
- Unit tests + integration tests + admin-role 403 test.

## Files

### Updated
- The 4 handler files (full impl).

### Created
- Tests (additions).

## Sprint Exit Gate

- [ ] 4 handlers ship full impl + tests.
- [ ] Admin-role guard verified (L4.7).
- [ ] Cross-tenant verified.
- [ ] Recommendation: `GO` to S4.
