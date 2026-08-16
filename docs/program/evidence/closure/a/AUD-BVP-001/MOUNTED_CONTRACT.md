# AUD-BVP-001 — Mounted contract: audit-program create/save/reopen

Status: CLOSED (evidence task — Audits kernel code is outside this lane's
lease; this document + the BVP test suite are the deliverable).
Worktree: `codex/closure-claude-a-method-evidence`.
Verified against: `server/src/Gateway.ts`, `server/src/routes/audit-programs.routes.ts`,
`server/src/routes/audits/index.ts`, `server/src/routes/audits/programs.routes.ts`,
`server/src/routes/audits/context.ts`, `server/src/services/audits/programService.ts`,
`server/src/services/audits/permissions.ts`, `server/src/services/audits/lifecycle.ts`,
`src/hooks/useFeatureFlags.tsx`, `src/utils/betaAccess.ts` — all re-read on 2026-08-16,
not taken from prior audits.

## The one sentence a reader needs

**With every UI flag OFF, an authenticated organization member can still
reach the full canonical Audits kernel — create, edit-while-planning, list,
transition lifecycle, add members, submit evidence, raise findings, finalize
outputs, and register initiative proposals for a program — over HTTP at
`/api/audits/*`, because that mount carries no feature-flag gate at all; only
the separate legacy `/api/audit/programs` CRUD trio is blocked (410), and
that block is independent of any UI flag.**

The `auditsFiveSurfacesV1` frontend flag (default OFF) and `MODULE_AUDITS:
'open'` beta-access gate only decide whether a *browser* renders the
`/audit-programs/method` screen. Neither one is consulted anywhere in the
Express route chain for `/api/audits/*` or `/api/audit/*`. A direct HTTP
client (curl, Postman, a compromised or scripted client) with a valid JWT for
an organization member reaches the same kernel the UI would, flags or no
flags — this is confirmed empirically in this task's own test suite (see
`server/src/services/auditProgramBvp/__tests__/programKernelBvp.pg.test.ts`,
which calls `programService.ts` directly and, in its legacy-negative tests,
through the real HTTP stack via `apiGateway.initializeRoutes`).

## Route family inventory

| Route family | Mount point (file:line) | Flag-gated at API layer? | Reachable in production today? | Writer it reaches |
|---|---|---|---|---|
| `/api/audit/programs` (GET/POST/PATCH/DELETE), `/api/audit/programs/:id/generate-surveys` | `server/src/Gateway.ts:1315` → `app.use('/api/audit', auditProgramsRouter)`; router file `server/src/routes/audit-programs.routes.ts` | **No** feature flag. Auth stack only: `apiAuthRateLimiter` → `verifyToken` → `requireOrgAccess()` → `demoContextMiddleware` (routes.ts:42-45). | **Reads: yes.** GET list/read-one/completion work unconditionally. **Writes: no** — POST/PATCH/DELETE/generate-surveys all call `isLegacyProgramWriteEnabled()` first (routes.ts:130,175,241,275) and return `410 {code:'AUDIT_PROGRAM_LEGACY_WRITE_DISABLED'}` unless env var `AUDIT_PROGRAM_LEGACY_WRITES_ENABLED=true` is set (unset by default = OFF = retired). Confirmed empirically by this task's HTTP tests (both pass): a live POST/PATCH/DELETE against this router returns 410 and `audit_programs` is byte-for-byte unchanged (re-`SELECT`-verified). | `server/src/services/auditProgramService.ts` (`createProgram`/`updateProgram`/`deleteProgram`) — but **unreachable while the switch is OFF**, so today this is a dead writer for all practical purposes; only `generateSurveys()`'s internal `updateProgram()` bookkeeping call is *also* retired by the same gate, per the router's own header comment. |
| `/api/audits/*` (`/sources`, `/packs`, `/programs`, `/criteria`, `/evidence`, `/findings`, `/actions`, `/outputs`, `/reports`, `/proposals`, `/ai`, `/trail`) | `server/src/Gateway.ts:1320` → `app.use('/api/audits', auditsMethodRouter)`; aggregator `server/src/routes/audits/index.ts:36-58`, program sub-router `server/src/routes/audits/programs.routes.ts` | **No** feature flag anywhere in the chain. Auth stack only: `apiAuthRateLimiter` → `verifyToken` → `requireOrgAccess()` → `demoContextMiddleware` (index.ts:36-39). Verified by reading the full middleware chain — no `useFeatureFlags`/beta-access/env-flag check exists in `index.ts`, `programs.routes.ts`, or `context.ts`. | **Yes, unconditionally**, for any authenticated org member. `POST /api/audits/programs` (create), `PATCH .../:id` (edit, planning-only), `DELETE .../:id` (planning-only), `POST .../:id/transition` (lifecycle), `POST/PATCH/DELETE .../:id/members`, `GET .../:id/lifecycle`, `GET .../:id/coverage`, `POST .../:id/next-cycle` — all live and reachable today, gated only by the in-service capability matrix (`permissions.ts`), not by any switch. | `server/src/services/audits/programService.ts` — the **sole** canonical writer of `audit_programs`/`audit_program_criteria`/`audit_program_members` for anything created through this path. INSERT `programService.ts:409`, UPDATE `:592`, DELETE `:654`, lifecycle UPDATE `:973`. |
| `/api/audit-logs` | `server/src/Gateway.ts:755` → `mountStub('/api/audit-logs', auditLogRoutes, 'auditLogRoutes')` | No flag (stub-mounted, same auth stack pattern as other stubs). | Platform audit-trail (login/permission events), **not** the audit-program domain — listed here only to avoid conflation with the two families above; out of scope for AUD-BVP-001's create/save/reopen question. | N/A (event log, not `audit_programs`). |
| `/api/audit` (`auditEventsRoutes`, `auditRoutes` stub) | `server/src/Gateway.ts:1329-1330` — mounted on the **same** `/api/audit` prefix as the legacy CRUD router, but a different sub-path/router | No flag. | Also platform audit-trail/event endpoints sharing the `/api/audit` prefix with `audit-programs.routes.ts` — different concern, different router, does not touch `audit_programs`. Called out so "what's mounted at `/api/audit`" isn't read as a single router. | N/A. |

## Frontend visibility flags (UI only — do not gate the API)

| Flag | Location | Default | What it actually controls |
|---|---|---|---|
| `MODULE_AUDITS` | `src/utils/betaAccess.ts:48` | `'open'` — visible to all users (flipped 2026-07-16, not gated to admins) | Whether the Audits module entry shows up in the app's module/menu system at all. |
| `auditsFiveSurfacesV1` | `src/hooks/useFeatureFlags.tsx:263` (id) | `defaultValue: false` (OFF), `allowLocalOverride: true` | Whether the browser renders the parallel Five-Surface Method Hub UI at `/audit-programs/method` (Library/Processes/Outputs/Reports/Initiatives). Purely a client-side render gate — consumed only by React code, never read by any Express route or middleware. |

Neither flag is imported, referenced, or checked anywhere under
`server/src/routes/**` or `server/src/services/audits/**` — verified by
`grep -rn "auditsFiveSurfacesV1\|MODULE_AUDITS" server/src` returning no
matches outside `server/src` frontend-adjacent build artifacts. The backend
has **no feature flag** for this surface, full stop; the task brief's framing
of this as a real risk is correct and is restated here as the load-bearing
finding of this document.

## Legacy retirement (context, verified not re-litigated)

`server/src/routes/audit-programs.routes.ts:47-86` retires the CRUD trio
(`POST/PATCH/DELETE /api/audit/programs[/:id]`) plus
`POST /api/audit/programs/:id/generate-surveys` behind
`isLegacyProgramWriteEnabled()` (`auditProgramService.ts:147-153`), which
reads `AUDIT_PROGRAM_LEGACY_WRITES_ENABLED` — unset/anything-but-`'true'` =
disabled = safe. Reads (`GET /programs`, `GET /programs/:id`,
`GET /programs/:id/completion`) remain live so the legacy AuditsHub list view
keeps working. This task's test suite proves the retirement empirically over
real HTTP against a real PostgreSQL: `POST`, `PATCH`, and `DELETE` all return
`410 {code:'AUDIT_PROGRAM_LEGACY_WRITE_DISABLED'}` and `audit_programs` is
unchanged (row count re-verified by `SELECT`, not by trusting the response).

## Net picture

There are exactly **two** live writer families for `audit_programs` in the
codebase today:

1. `server/src/services/auditProgramService.ts` — **retired** (kill-switched
   OFF by default; unreachable via HTTP while the switch is off).
2. `server/src/services/audits/programService.ts` — **canonical, live,
   unconditionally mounted, and NOT protected by any feature flag.**

The writer inventory is 1-live + 1-retired-but-present-in-code, matching the
task brief's framing. The thing worth over-stating, because it is easy to
miss: **flag state is irrelevant to whether `/api/audits/programs*` can be
written to.** An org member with zero audit-specific role still has baseline
capability `program.create` (`permissions.ts` `ORG_MEMBER_CAPABILITIES`), so
program creation in particular needs no elevated role at all — only
`program.update`, `program.delete`, `program.manage_members`, and
`program.advance_lifecycle` require an assigned audit role or platform-admin
capability. See `INVENTORY_CORRECTIONS` below.

## Inventory corrections found during this task

1. **`programService.ts`'s own header comment (lines 7-15) is stale/misleading
   relative to the code it documents.** It says creating a program "requires
   being an organization administrator" because `program.create` is only
   granted to `program_owner`/`administrator` roles or a platform admin.
   That is not what the code does: `permissions.ts`'s
   `ORG_MEMBER_CAPABILITIES = ['pack.read', 'program.create']` is unioned
   into **every** actor's capability set unconditionally in
   `capabilitiesForRoles()`/`resolveProgramAccess()`, regardless of role or
   platform-admin status. In practice, **any authenticated member of the
   organization can create an audit program**, not just administrators. This
   is very likely intentional per the later, more careful comment above
   `ORG_MEMBER_CAPABILITIES` in `permissions.ts` (explains the chicken-and-egg
   problem of granting a program-scoped role before the program exists), but
   the two comments in the two files contradict each other, and the
   `programService.ts` one is wrong about the actual behavior. Not fixed
   (outside this lane's lease) — flagged as an integrator note below.
2. **Cross-tenant denial for `transitionLifecycle` returns 403
   (`AUDIT_FORBIDDEN`), not 404 (`AUDIT_NOT_FOUND`) like `updateProgram`/
   `deleteProgram` do**, because capability resolution happens before the
   organization-scoped existence check, and `program.advance_lifecycle` is
   not in `PLATFORM_ADMIN_CAPABILITIES` (unlike `program.update`, which is).
   Confirmed empirically by this task's tenant-negative test. Not a security
   gap — cross-tenant access is still denied and no row is modified or
   returned — but the inconsistent status code between sibling write
   operations on the same resource is worth flagging for anyone building a
   client against this API.

## INTEGRATOR_CHANGE_REQUEST (concurrency gap — characterized, not fixed)

**Confirmed empirically**, not just by code inspection: see
"Lifecycle-transition concurrency" in the accompanying test file. Two
concurrent `transitionLifecycle` calls issued from the same `preparation`
state to two different legal target states (`fieldwork` and `planning`) BOTH
resolved successfully (`Promise.allSettled` → both `fulfilled`) in every
observed run. `programService.ts:944-1005` reads the current row, validates
the transition and gate against that read, then issues
`UPDATE audit_programs SET lifecycle_state = $1, ... WHERE id = $7 AND
organization_id = $8` (`:972-987`) with **no `lifecycle_state = <expected>`
guard and no check of the affected-row count**. Both concurrent callers read
`preparation` before either write lands, both pass their independent gate
checks, and both blindly overwrite the row — last commit wins, silently. The
domain-event log (`audit_domain_events`) recorded **both** transitions
(`program.lifecycle_transitioned` × 2 beyond the setup transition), so the
audit trail shows two transitions occurred while the row shows only the
state of whichever write landed last — the log and the row diverge.

Minimal fix (not applied — outside this lane's lease):

```sql
UPDATE audit_programs
   SET lifecycle_state = $1, status = $2, closed_at = $3, closed_by = $4,
       closure_note = $5, updated_at = $6
 WHERE id = $7 AND organization_id = $8 AND lifecycle_state = $9  -- $9 = the state read at the top of the function
```

then check the driver's affected-row count; 0 rows affected → throw
`AuditStateError` (409) with a message such as "the program's state changed
while this request was in flight — reload and try again" instead of
returning success. This is a textbook optimistic-concurrency guard and does
not require a schema change or a version column, since `lifecycle_state`
itself is a sufficient compare-and-swap key here.

## Idempotency on program create

**None exists.** `createProgramFromPack`/`createProgramCore`
(`programService.ts:376-522`) accept no idempotency key, and there is no
unique constraint on `audit_programs` over any combination of
`(organization_id, pack_id, name)` or similar
(`server/migrations/20260813_audits_method_core.sql:46-60,198-219` — only
`idx_audit_programs_org`, `idx_audit_programs_pack`,
`idx_audit_programs_lifecycle`, all non-unique). Confirmed empirically: this
task's replay test calls `createProgramFromPack` twice with byte-identical
input and gets two distinct programs with two distinct ids; a client retry
after a dropped response (e.g. a timeout where the server actually
committed) silently doubles the program.
