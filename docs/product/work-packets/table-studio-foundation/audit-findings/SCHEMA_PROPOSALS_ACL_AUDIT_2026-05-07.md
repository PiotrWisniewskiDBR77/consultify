# Schema Proposals ACL Audit — 2026-05-07

**Audit ID:** `TBL-AUDIT-2026-05-07-SCHEMA-PROPOSALS`
**Block:** `TABLE_STUDIO_FOUNDATION_BLOCK`
**Sprint:** Sprint 1 (Agent A backend)
**Validation row:** L4.4 — ACL audit on existing `/schema/proposals/*` (READ-ONLY; report only)
**Acceptance criterion:** AC-3.5.1, AC-3.5.2, AC-3.5.3, AC-3.5.4
**Auditor:** Agent A (backend specialist)
**Mode:** READ-ONLY (per D3 working assumption — STOP-and-file P0 if leak found)
**Test evidence:** `consultify/server/src/routes/__tests__/table-platform.schema-proposals-acl-audit.test.ts`

---

## 1) Scope

This audit covers the eight existing schema-governance routes mounted in
`consultify/server/src/routes/table-platform.routes.ts` (out of edit scope per
packet §4 — `00_TASK_PACKET.md`):

| # | Method + Path                                       | Source line | Route-level middleware           |
|---|-----------------------------------------------------|-------------|----------------------------------|
| 1 | `POST /schema/propose`                              | 1457        | _none beyond_ `verifyToken`      |
| 2 | `POST /schema/proposals/:proposalId/execute`        | 1528        | `requireRoles(...SCHEMA_ROLES)`  |
| 3 | `POST /schema/proposals/:proposalId/reject`         | 1552        | _none beyond_ `verifyToken`      |
| 4 | `POST /schema/proposals/:proposalId/refine`         | 1567        | _none beyond_ `verifyToken`      |
| 5 | `POST /schema/proposals/:proposalId/undo`           | 1586        | _none beyond_ `verifyToken`      |
| 6 | `POST /schema/proposals/:proposalId/redo`           | 1606        | _none beyond_ `verifyToken`      |
| 7 | `GET  /schema/proposals/:proposalId`                | 1643        | _none beyond_ `verifyToken`      |
| 8 | `GET  /workspaces/:workspaceId/schema/proposals`    | 1657        | _none beyond_ `verifyToken`      |

> The router itself applies `verifyToken`, `requireTablePlatform`, and a rate
> limiter (lines 194–196). All endpoints inherit those gates. The audit asks
> only about **tenant boundary** (cross-org leak), not authentication.

The packet originally enumerates 8 endpoints with `POST /schema/proposals` as
endpoint #1; the actual implementation uses the path `POST /schema/propose`
(creating a proposal). The audit covers the same surface area.

## 2) Method

For each endpoint we constructed a synthetic request where:
- the actor (`req.user`, `req.userId`, `req.organizationId`) belongs to **`org-A`**;
- the targeted proposal / workspace / base belongs to **`org-B`**.

We exercised the actual route handler (with mocks for DB, ChatToSchemaService,
and PermissionsService that simulate authentic cross-tenant semantics) and
recorded the HTTP status code returned. Security-correct behavior is `403`.
Anything else (200, 201, 204, 400, 500) constitutes a tenant-boundary leak.

The complete audit harness lives in
`consultify/server/src/routes/__tests__/table-platform.schema-proposals-acl-audit.test.ts`.
That file is also the canonical evidence artifact for AC-3.5.1.

## 3) Findings (per endpoint)

| #  | Endpoint                                              | Route-level tenant guard?                  | Cross-tenant 403? | Severity | Status        |
|----|-------------------------------------------------------|---------------------------------------------|--------------------|----------|----------------|
| 1  | `POST /schema/propose`                                | NO (workspaceId read from BODY)             | **NO — leak**      | **P0**   | **OPEN**       |
| 2  | `POST /schema/proposals/:proposalId/execute`          | YES — `requireRoles(...SCHEMA_ROLES)`       | YES                | —        | OK             |
| 3  | `POST /schema/proposals/:proposalId/reject`           | NO                                          | **NO — leak**      | **P0**   | **OPEN**       |
| 4  | `POST /schema/proposals/:proposalId/refine`           | NO                                          | **NO — leak**      | **P0**   | **OPEN**       |
| 5  | `POST /schema/proposals/:proposalId/undo`             | NO (baseId read from BODY)                  | **NO — leak**      | **P0**   | **OPEN**       |
| 6  | `POST /schema/proposals/:proposalId/redo`             | NO (baseId read from BODY)                  | **NO — leak**      | **P0**   | **OPEN**       |
| 7  | `GET  /schema/proposals/:proposalId`                  | NO                                          | **NO — leak**      | **P0**   | **OPEN**       |
| 8  | `GET  /workspaces/:workspaceId/schema/proposals`      | NO                                          | **NO — leak**      | **P0**   | **OPEN**       |

**Result: 7 of 8 endpoints lack a tenant boundary check at the route layer.**

The single guarded endpoint (`/execute`) inherits its protection from
`PermissionsService.requireRoles(...)`, which:
1. resolves `baseId` from `proposalId` via `tp_schema_proposals.operations[0].target.base_id`,
2. then runs `requireRole(baseId, userId, orgId, allowedRoles)`,
3. which falls back to `canAccessBase(userId, orgId, baseId)` validating
   `tp_bases.organization_id === actor.organizationId`.

That same pattern is **not** applied to the seven other endpoints.

## 4) Detailed evidence per finding

### 4.1 `POST /schema/propose` (Finding #1, P0)

- Reads `workspaceId` directly from `req.body`.
- Falls back to `orgId = authReq.organizationId ?? workspaceId` for rate
  limiting (line 1469) — the body-supplied `workspaceId` masquerading as an
  org id is a defense-in-depth concern.
- Calls `ChatToSchemaService.generateProposal(workspaceId, ...)` — that
  service does **not** validate that `workspaceId` belongs to
  `authReq.organizationId`.
- Threat model: an authenticated actor in `org-A` can request proposal
  generation against any `workspaceId` they can guess in `org-B`. The
  generated proposal is then persisted under the body-supplied workspace id,
  exposing it to org-B users via `GET /workspaces/:workspaceId/schema/proposals`.

**Recommended fix (filed as P0 follow-up — DO NOT apply in this block):**
add a workspace-tenant resolver middleware (or inline check) that fetches
`workspace.organization_id` and rejects when it differs from
`authReq.organizationId`.

### 4.2 `POST /schema/proposals/:proposalId/execute` (Finding #2, OK)

- Has `requireRoles(...SCHEMA_ROLES)`. ✅
- Cross-tenant request returns 403 via the standard `requireRole → canAccessBase`
  chain.
- This is the model the other endpoints SHOULD follow.

### 4.3 `POST /schema/proposals/:proposalId/reject` (Finding #3, P0)

- No middleware beyond `verifyToken` + rate limiter.
- Handler calls `ChatToSchemaService.rejectProposal(proposalId, ...)`. That
  method does `getProposal(proposalId)` (no org filter) then
  `UPDATE tp_schema_proposals SET status='rejected' WHERE id=$1`.
- Threat model: any authenticated user can reject a proposal in any other
  tenant. Causes denial-of-governance and silent state changes.

### 4.4 `POST /schema/proposals/:proposalId/refine` (Finding #4, P0)

- No middleware beyond `verifyToken`.
- Handler calls `ChatToSchemaService.refineProposal(proposalId, msg, ...)`.
- Allows cross-tenant actors to inject prompts into refinement of another
  tenant's proposal — which is **also** an S3 prompt-injection risk in
  addition to the tenant boundary leak.

### 4.5 `POST /schema/proposals/:proposalId/undo` (Finding #5, P0)

- No middleware beyond `verifyToken`.
- `baseId` is read from `req.body` — the actor is fully in control of the
  parameter the audit pivot is supposed to cross-check.
- Threat model: actor in `org-A` issues `POST /undo` with `proposalId` from
  `org-B` and `baseId` they discovered → undoes a tenant-B mutation.

### 4.6 `POST /schema/proposals/:proposalId/redo` (Finding #6, P0)

- Identical pattern to #5 (`baseId` from body, no guard).

### 4.7 `GET /schema/proposals/:proposalId` (Finding #7, P0)

- No middleware beyond `verifyToken`.
- `getProposal` returns the row from `tp_schema_proposals WHERE id = $1`.
- Threat model: actor in `org-A` reads any proposal in any tenant by id.
  Proposals contain operations, target object ids, and AI rationale — all
  potentially confidential.

### 4.8 `GET /workspaces/:workspaceId/schema/proposals` (Finding #8, P0)

- No middleware beyond `verifyToken`.
- `workspaceId` from URL param.
- `listProposals(workspaceId)` queries `WHERE workspace_id = $1` — no
  `actor.organizationId` join.
- Threat model: actor in `org-A` enumerates all proposals in any workspace
  they can name. This is the most directly exploitable leak.

## 5) Severity classification

Per `02_RISK_REGISTER.md` row **S1** (cross-tenant proposal listing) and
**T4** (governance routes leak proposals across tenants), severity = **P0**.

Per **D3** working assumption (confirmed by user 2026-05-07): if any leak is
found, **STOP-and-file**. We do **not** patch in this block. Findings are
filed as P0 follow-up `TBL-SEC-1`.

## 6) Decision

- **Sprint Exit Gate (Sprint 1):** `BLOCKED_P1`
- **L4.4 status:** `FAIL — 7 of 8 endpoints lack route-level tenant guard`
- **Block-level recommendation:** the Tabele lane Sprint 2/3/4 may continue,
  but block closeout (`03_BLOCK_CLOSEOUT.md`) MUST record `BLOCKED_P1` until
  P0 follow-up is resolved.
- **In-block patch:** declined per D3.

## 7) Recommended P0 follow-up (`TBL-SEC-1`)

A separate, focused PR should:

1. Add a `requireProposalAccess` middleware in
   `consultify/server/src/middleware/` (or extend `PermissionsService`):
   - Resolve `proposal.workspace_id` (or `operations[0].target.base_id`).
   - Resolve `workspace.organization_id` (or `base.organization_id`).
   - 403 when `actor.organizationId` differs.
2. Apply the middleware to endpoints **#1, #3, #4, #5, #6, #7**.
3. Replace the `workspaceId from URL` pattern in **#8** with a guard that
   joins `tp_workspaces.organization_id` (or equivalent) to actor org.
4. Where `baseId` is read from request body (#5, #6), require it to be
   resolved server-side from the proposal — never accept it from the client.
5. Add cross-tenant 403 integration tests for all eight endpoints.
6. Re-run this audit; expect all rows to flip to `OK`.

## 8) References

- Packet: `DRD/consultify/docs/product/work-packets/table-studio-foundation/00_TASK_PACKET.md`
- Risks: `02_RISK_REGISTER.md` (T4, S1, S2, S3, S7)
- Validation: `01_VALIDATION_MATRIX.md` (L4.4, L7.1, L7.2)
- Epic: `epics/EPIC-3_BACKEND_RELATION_EXPLAINABILITY.md` (US-3.5)
- Sprint card: `sprints/SPRINT_1_BACKEND_RELATION_EXPLAIN.md`
- Test file: `consultify/server/src/routes/__tests__/table-platform.schema-proposals-acl-audit.test.ts`
- Source under audit: `consultify/server/src/routes/table-platform.routes.ts`
  (lines 1457–1669)

---

**Audit closed:** 2026-05-07
**Audit decision:** `PASS AFTER HOTFIX → P0 TBL-SEC-1 resolved in approved follow-up`

## 9) P0 follow-up resolution — 2026-05-07

User approved follow-up execution with `dzialaj` after the hard-stop report.

Implemented hotfix:

- Added `requireWorkspaceTenantAccess` to:
  - `POST /schema/propose`
  - `GET /workspaces/:workspaceId/schema/proposals`
- Added `requireSchemaProposalAccess` to:
  - `POST /schema/proposals/:proposalId/reject`
  - `POST /schema/proposals/:proposalId/refine`
  - `POST /schema/proposals/:proposalId/undo`
  - `POST /schema/proposals/:proposalId/redo`
  - `GET /schema/proposals/:proposalId`
- `undo` / `redo` now use server-resolved `resolvedBaseId`; they no longer trust `baseId` from request body.

Validation:

```bash
cd DRD/consultify/server && npx vitest run src/routes/__tests__/table-platform.schema-proposals-acl-audit.test.ts --maxWorkers=1 --maxConcurrency=1
# PASS — 1 file, 9 tests passed.
```

```bash
cd DRD/consultify/server && npx vitest run src/routes/__tests__/table-platform.schema-proposals-acl-audit.test.ts src/routes/__tests__/table-platform.relations-explain.test.ts src/services/tablePlatform/__tests__/RelationExplainabilityService.test.ts --maxWorkers=1 --maxConcurrency=1
# PASS — 3 files, 32 tests passed.
```

Scoped lints:

```text
ReadLints(table-platform.routes.ts, table-platform.schema-proposals-acl-audit.test.ts)
# PASS — no linter errors.
```
