# Sprint 2 — Source Provenance API (Block B)

**Sprint ID:** `B-S2`
**Owner:** Agent A
**Status:** `BACKEND COMPLETE`
**Estimate:** ~1.5 days
**Epic:** EPIC-T8

## Goal

Ship `RecordSourcesService` with full CRUD, ACL filter via `PermissionsService`, audit trail, cap enforcement, and route module mounted before wildcards. Cross-tenant 403 verified.

## Pre-sprint risk check

B-S1 (cross-tenant), B-S5 (cross-tenant listing), B-T3 (unbounded growth).

## Deliverables

- [x] `RecordSourcesService.ts` — full CRUD + soft-delete + cap (50 sources / record).
  - Public surface: `resolveRecordOrganizationId`, `listSourcesForRecord`,
    `getSource`, `countActiveSourcesForRecord`, `createSource`, `updateSource`,
    `markVerified`, `deleteSource` (soft).
  - Tenant invariants enforced inside the service: every read/write filters on
    `organization_id`; cross-tenant lookups silently return null / `RECORD_NOT_FOUND`
    so we never leak existence.
  - Audit emit via `AuditService.logEvent` with `entity_type='record_source'`
    and event types `record_source_created|updated|verified|archived`. Audit
    failures are logged but DO NOT roll back state mutation (pattern matches
    `TemplateLifecycleService`).
- [x] `table-platform.record-sources.routes.ts` — `GET/POST` on
  `/records/:recordId/sources`, `PATCH/DELETE` on `/sources/:sourceId`, and
  `POST /sources/:sourceId/verify`. Record-scoped routes use
  `PermissionsService.requireRecordAccess`. Source-scoped routes resolve the
  source via `getSource(sourceId, orgId)` (404 hides cross-tenant existence)
  and then chain through `requireRecordAccess`.
- [x] Unit test `RecordSourcesService.test.ts` — 26 tests covering happy paths,
  cap enforcement, cross-tenant rejection, archived rejection, idempotent
  delete, audit emit failure tolerance.
- [x] Integration test `record-sources-acl.test.ts` — 15 tests covering
  record-scoped happy paths, source-scoped cross-tenant 404, error-code → HTTP
  status mapping (`CAP_EXCEEDED` → 409, `RECORD_NOT_FOUND` → 404, invalid
  payloads → 400, missing org → 403).
- [x] Mount registered in `Gateway.ts` after `tablePlatformRelationsExplainRoutes`
  and before `publicFormRouter` (the wildcard is in `tablePlatformRoutes`
  itself; our new paths do not collide).
- [x] Service exports added to `tablePlatform/index.ts`.

## Files

### Created

- `consultify/server/src/services/tablePlatform/RecordSourcesService.ts`
- `consultify/server/src/routes/table-platform.record-sources.routes.ts`
- `consultify/server/src/services/tablePlatform/__tests__/RecordSourcesService.test.ts`
- `consultify/server/src/routes/__tests__/record-sources-acl.test.ts`

### Updated

- `consultify/server/src/services/tablePlatform/index.ts` — re-export.
- `consultify/server/src/Gateway.ts` — import + mount the new router.

## Test results

```
RUN vitest in DRD/consultify/server (2026-05-08)
✓ src/services/tablePlatform/__tests__/RecordSourcesService.test.ts  (26)
✓ src/routes/__tests__/record-sources-acl.test.ts                    (15)
Tests  41 passed (41)
```

Combined Block A · A-S1 + Block B · B-S1/B-S2 suite (template lifecycle +
record provenance):

```
✓ migrations.block-a-b.test.ts                  (21)
✓ RecordSourcesService.test.ts                  (26)
✓ TemplateLifecycleService.test.ts              (20)
✓ record-sources-acl.test.ts                    (15)
✓ template-lifecycle-acl.test.ts                 (9)
Tests  91 passed (91)
```

`npx tsc --noEmit` for the whole `consultify/server` workspace exits 0.

## Realised risks

- **Tracked-file edits regressed between sessions** (Gateway.ts /
  tablePlatform/index.ts / table-platform.routes.ts re-applied during this
  sprint). Mitigation logged in `00_BLOCK_STATUS.md`; root cause is the
  drive-sync backup overlay clobbering the working tree of the nested
  `DRD/consultify` git repo. Going forward, sprint exit gates require
  `git status` evidence in addition to test green.
- **`requireSuperAdmin` import in `table-platform.routes.ts`** breaks any
  legacy ACL test that mocks `auth.middleware.js` with only `verifyToken`.
  Three such suites were patched in A-S1 and again in B-S2: `table-platform.routes.test.ts`,
  `table-platform.relations-explain.test.ts`, `table-platform.schema-proposals-acl-audit.test.ts`.

## Sprint Entry Gate

- [x] S1 closed `BACKEND COMPLETE` (static verification).

## Sprint Exit Gate

- [x] All endpoints work locally (driven via vitest harness).
- [x] Cross-tenant 404 on every source-scoped endpoint (existence hidden).
- [x] ACL filter via `PermissionsService.requireRecordAccess` for record-scoped
  routes; org guard returns 403 when organization context is missing.
- [x] Audit log entries verified (test asserts `record_source_created/updated/
  verified/archived` event types).
- [x] Cap enforcement (50 sources/record) — `RECORD_SOURCES_CAP_EXCEEDED` →
  409.
- [x] Backend typecheck clean (`tsc --noEmit` exit 0).
- [ ] Staging deploy + manual smoke (external; remains open for QA gate).
- [x] Recommendation: `GO` to S3.
