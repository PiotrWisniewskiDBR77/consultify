# Sprint 1 — Template Lifecycle Backend (Block A)

**Sprint ID:** `A-S1`
**Owner:** Agent A (backend)
**Status:** `BACKEND COMPLETE — 2026-05-08` (migration + service + routes + tests shipped; staging deploy pending)
**Estimate:** ~1 day
**Epic:** EPIC-T6

## Goal

Ship migration adding 5 columns to `tp_base_templates`, the `TemplateLifecycleService`, three new endpoints (approve / deprecate / list-by-status) with super-admin gate and cross-tenant tests.

## Pre-sprint risk check

A-T1 (migration lock) — mitigation: NULL-default columns. A-S1 (cross-tenant) — mitigation: integration test in this sprint.

## Deliverables

- [x] **Migration `20260508_block_a_template_lifecycle.sql` shipped to `consultify/server/migrations/`.** Adds `status / version / owner_user_id / approval_history / governance_rules`, CHECK constraint, indexes; promotes legacy `is_featured=true` rows to `status='approved'` with audit entry.
- [x] **Rollback `rollback/20260508_block_a_template_lifecycle.down.sql` shipped** alongside.
- [x] `TemplateLifecycleService.ts` with `approveTemplate`, `deprecateTemplate`, `revertToDraft`, `listTemplates({status})`, `getTemplate`, `getTemplateGovernance`.
- [x] Routes added to `table-platform.routes.ts`: `POST /templates/:id/approve`, `POST /templates/:id/deprecate`, `GET /templates/lifecycle?status=...`. All three behind `requireSuperAdmin` for mutations; `GET /templates/lifecycle` is read-only and open to all authenticated users.
- [x] Unit test `TemplateLifecycleService.test.ts` — 20 tests covering filters, governance projection, every transition (draft↔approved, draft→deprecated, approved→deprecated, approved/deprecated→draft), idempotency, invalid transitions, audit emit shape, audit-failure resilience, race-disappear handling.
- [x] Integration test `template-lifecycle-acl.test.ts` — 9 tests covering 403 for non-super-admin, 200 for super-admin, 401 for unauthenticated, 400 for invalid status, 404/409 error mapping.
- [x] Audit log entry written on every state change via `AuditService.logEvent` (`template_approved | template_deprecated | template_reverted_to_draft`).

## Files

### Created — shipped (2026-05-08)
- `consultify/server/migrations/20260508_block_a_template_lifecycle.sql`
- `consultify/server/migrations/rollback/20260508_block_a_template_lifecycle.down.sql`
- `consultify/server/src/services/tablePlatform/TemplateLifecycleService.ts`
- `consultify/server/src/services/tablePlatform/__tests__/TemplateLifecycleService.test.ts`
- `consultify/server/src/routes/__tests__/template-lifecycle-acl.test.ts`

### Updated — shipped (2026-05-08)
- `consultify/server/src/routes/table-platform.routes.ts` — added 3 lifecycle routes (`GET /templates/lifecycle`, `POST /templates/:templateId/approve`, `POST /templates/:templateId/deprecate`); imported `requireSuperAdmin`.
- `consultify/server/src/services/tablePlatform/index.ts` — exported `TemplateLifecycleService` + 5 type re-exports.
- `consultify/server/src/routes/__tests__/table-platform.routes.test.ts` — extended `auth.middleware.js` mock with `requireSuperAdmin` (non-functional regression fix).
- `consultify/server/src/routes/__tests__/table-platform.schema-proposals-acl-audit.test.ts` — same mock extension.
- `consultify/server/src/routes/__tests__/table-platform.relations-explain.test.ts` — same mock extension.

### Untouched
- All Foundation Block files.
- `RelationExplainabilityService.ts`, `table-platform.relations-explain.routes.ts`.

## Sprint Entry Gate

- [ ] S0 closed `GO`.
- [ ] Migration plan signed off.

## Sprint Exit Gate

- [ ] Migration runs on staging and rolls back cleanly. **(staging deploy is the remaining gate item)**
- [x] Unit tests green — 20 tests passing.
- [x] Integration tests green — 9 ACL tests passing; 403 for non-super-admin verified; 401/404/409 error paths verified.
- [x] Backend typecheck clean (`npx tsc --noEmit`).
- [x] No regressions in existing routes / proposals / relations test suites — 22 + 9 + 9 + 20 + 9 = 69/69 passing across the related test files.
- [x] Audit log entry shape verified: `event_type ∈ {template_approved, template_deprecated, template_reverted_to_draft}`, `entity_type='template'`, `before/after = {status: ...}`, metadata carries name + category + version + note.
- [ ] Recommendation: `GO` to S2 once staging migration deploy is confirmed.

## Realized risks

- **A-S0-F4 partial:** The new ACL surface required updating `auth.middleware.js` mocks in 3 pre-existing tests. Caught immediately by running the broader test suite; no production code change was needed. Documented for B-S2 to apply same pattern proactively.

## Realized risks

(filled at exit)

## Daily evidence

(filled per day)
