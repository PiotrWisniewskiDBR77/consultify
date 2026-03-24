# DB Disappearing Data Audit 2026-03-19

## Purpose

Explain why the system can report "data was added" and later appear to show no data, stale data, or different data.

This audit is based on:

- yesterday's readonly environment audits in `docs/operations/DATA_TRUTH_AUDIT_2026-03-18.md`
- yesterday's pre-GO flow audit in `docs/operations/PRE_GO_DB_FLOW_AUDIT_2026-03-18.md`
- today's code-path inspection across backend routing, DB target resolution, demo gating, and UI fallback behavior
- today's repo gate run: `npm run release:gate:data-truth` -> `PASS`

## Executive Conclusion

The current problem is not one bug.

The system still has multiple independent mechanisms that can produce the operator perception that data "disappears":

1. write/read path can land in different data contexts across environments
2. user-visible organization scope can differ from effective query identity
3. some modules synthesize demo/showcase data when real API responses are empty or fail
4. some business data exists, but under the wrong organization, so UI looks empty even when rows are present
5. some DB helper layers still normalize missing-schema or query failures into empty results

So the dominant failure mode is not always "row deleted".
In many cases it is one of these:

- row written to a different org than the one currently visible
- row exists in prod but operator is looking at staging, or vice versa
- row exists but current route remaps identity by email and changes effective owner scope
- row is hidden by default status filters
- row is absent from API but UI backfills demo/showcase content, masking the real empty/error state

## Confirmed Findings

### 1. Environment drift is real and materially changes what the user sees

Confirmed by `docs/operations/DATA_TRUTH_AUDIT_2026-03-18.md`:

- staging and production have materially different task and initiative surfaces
- `atelier` scope is very different between staging and production
- finance tables contain rows that do not belong to the visible business orgs

Impact:

- the same screen can look "correct" in one environment and "empty" in another
- the UI alone is not a reliable indicator of which database truth the operator is currently looking at

Severity: critical

### 2. Finance data can exist while the visible org still looks empty

Confirmed by `docs/operations/DATA_TRUTH_AUDIT_2026-03-18.md`:

- finance rows exist under orphan org UUID `a3e05d4a-5397-419d-b486-8e44366c0063`
- those rows are not under `atelier`
- those rows are not under `dbr77`

Impact:

- system can honestly say "finance data exists"
- finance module can honestly show "nothing here" for the active org
- this is perceived as disappearing data, but the deeper issue is org drift, not missing rows

Severity: critical

### 3. Personal tasks can use a different identity than the session/banner suggests

Confirmed in `server/src/routes/my-work.routes.ts`:

- `/personal-tasks` first resolves the authenticated user
- then `resolveCanonicalPersonalTaskIdentity()` remaps identity by email across matching users
- task scope can then use `assignee_id = userId OR assignee.email = session email`

Impact:

- the user session can belong to one `(userId, orgId)`
- the route can still resolve personal tasks through another canonical match
- this can make tasks appear, disappear, or move after login/account/org changes
- the scope banner in UI is informative, but not guaranteed to equal the final route identity

Severity: high

### 4. Demo mode mutates organization context at request level

Confirmed in:

- `src/services/api.ts`
- `server/src/middleware/demoGuard.middleware.ts`

Behavior:

- frontend sends `X-Demo-Mode: true` when local demo mode is enabled
- backend middleware overwrites request org context to `DEMO_ORG_ID`
- write protection blocks writes in demo mode, but reads are intentionally redirected to demo org

Impact:

- if demo mode is active, the user is no longer looking at their own org data
- "I added data and now I cannot see it" can happen simply because the session moved into demo overlay context

Severity: high

### 5. Several critical modules still replace empty/error API results with demo/showcase content

Confirmed in:

- `src/components/Economics/hooks/useFinanceData.ts`
- `src/components/Initiatives/InitiativesHub.tsx`
- `src/components/ReportsAndPresentations/useRapData.ts`
- `src/components/Interview/InterviewHub.tsx`

Behavior:

- if real API returns zero rows, or request fails, and demo is allowed, the UI shows demo data instead
- initiatives can also be padded with showcase rows to a minimum surface

Impact:

- operator may not realize real API returned empty/error
- synthetic/demo rows can hide the fact that real data is missing, mis-scoped, or failing to load
- this creates false confidence after writes and weakens diagnosis

Severity: high

### 6. Some views intentionally hide records by default

Confirmed in:

- `server/src/routes/my-work.routes.ts`
- `src/components/MyWork/MyTasksListContent.tsx`

Behavior:

- `/api/my-work/personal-tasks` hides `done/completed/validated` by default unless `includeDone=true`
- UI explicitly states that behavior in its scope summary

Impact:

- a task may look like it disappeared immediately after completion or validation
- in this case the row still exists, but is filtered out by design

Severity: medium

### 7. DB helper behavior can collapse some failures into empty results

Confirmed in `server/src/utils/DbPromise.ts`:

- `all()` and `get()` default to `fallback: true`
- missing table / missing relation / timeout conditions can resolve to `[]` or `null`

Impact:

- not every schema/query failure becomes a loud application error
- some failures degrade into "no data"
- this is especially dangerous for diagnosis during migrations or partial schema rollout

Severity: medium

### 8. Legacy compatibility layers still increase ambiguity in the codebase

Confirmed in:

- `server/src/utils/queryHelpers.ts`
- `server/src/database/Database.ts`
- comments and helper names that still reference SQLite-era compatibility

Impact:

- the runtime is now Postgres-only, but parts of the helper layer still encode older compatibility assumptions
- this increases the chance that a new route or script handles DB absence/failure as if "empty" were acceptable

Severity: medium

## Root Cause Map

The disappearing-data symptom is produced by three root-cause classes:

### A. Wrong target

- staging vs production mismatch
- demo org vs real org mismatch
- script/import targeting wrong DB or wrong tenant

### B. Wrong scope

- effective org differs from visible org
- personal task identity remapped by canonical email matching
- data exists under orphan or unintended organization_id

### C. Wrong presentation of truth

- UI fallback to demo/showcase rows
- default hidden statuses
- DB/helper failures returning empty sets instead of loud failures

## Program Zaradczy

### Phase 0 - Immediate containment (today)

1. Make `GET /api/health/data-context` a mandatory visible diagnostic on every critical data screen before write actions.
2. Freeze all finance repair/import scripts unless `FINANCE_IMPORT_ORG_ID` and explicit DB target are provided.
3. Stop treating demo/showcase fallback as a silent normal path in business-critical modules.
4. Add operator rule: every "missing data" report must capture:
   - active DB host/name
   - active org id
   - user id
   - demo flag
   - endpoint used

### Phase 1 - Remove silent ambiguity (1-3 days)

1. Replace silent demo fallback in critical modules with explicit states:
   - `real_empty`
   - `real_error`
   - `demo_surface`
2. Remove showcase padding for initiatives in normal real-data mode.
3. Change personal task route so it does not remap identity by email unless explicitly enabled for a repair/debug mode.
4. Log all personal-task route resolutions where `(sessionUserId, sessionOrgId) != (resolvedUserId, resolvedOrgId)`.
5. Add visible UI chip on every critical module:
   - DB host
   - org id
   - demo/real
   - source endpoint

### Phase 2 - Repair data truth (2-5 days)

1. Reassign orphan finance rows from `a3e05d4a-5397-419d-b486-8e44366c0063` to the intended target org after dry-run review.
2. Audit all seed/import scripts for explicit org targeting:
   - `ORG_ID`
   - `SEED_ORG_ID`
   - `TARGET_ORG_ID`
   - `FINANCE_IMPORT_ORG_ID`
3. Add database constraints/checks where possible so finance/business rows cannot land under nonexistent org ids.
4. Produce a tenant-by-tenant inventory report for tasks, initiatives, finance, interviews, and reports before any release.

### Phase 3 - Make failures loud (within 1 week)

1. For business-critical read paths, stop defaulting to `fallback: true`.
2. Treat missing schema / missing relation / timeout as observable errors, not empty datasets.
3. Add structured audit events for create/update/delete with:
   - actor user id
   - org id
   - target table
   - target row id
   - DB host/database
   - correlation id
4. Add write-after-read verification for critical create flows:
   - create row
   - re-read same row in same request context
   - return both row id and effective org context

### Phase 4 - Release governance (ongoing)

1. Keep `npm run release:gate:data-truth` mandatory before GO.
2. Make readonly truth audit mandatory on staging and production before release.
3. Block release when:
   - orphan org-owned finance rows exist
   - demo fallback is active in critical modules without explicit user indication
   - personal-task route still remaps identity silently
   - critical modules cannot expose active data context

## Recommended Implementation Backlog

### Highest priority

- remove silent demo fallback from Finance, Initiatives, Reports, Interview
- remove or gate canonical email remap in personal tasks
- repair orphan finance org rows
- surface active DB/org/demo context in all critical views

### Next priority

- convert critical read paths from silent empty fallback to explicit error states
- add write audit log and correlation tracing
- add data-truth smoke tests per module and per tenant

### Hardening

- DB constraints for required organization ownership
- standard "post-write verification" response contract
- admin-only truth dashboard for environment/org/tenant diffs

## What To Verify After Remediation

For each critical module:

- create a record in real mode
- confirm returned row id and org id
- reload the screen
- verify the same row is returned by the same endpoint
- verify the same row is visible with demo mode off
- verify completed/archived filters are explicit, not silent

For each environment:

- compare staging vs production row counts by org
- compare active tenant surfaces
- compare orphan-row counts

## Final Assessment

Current state: `NOT DATA-TRUTH SAFE`

Reason:

- DB target resolution has improved materially
- release gate passes
- but runtime truth is still vulnerable to org drift, identity remap, and demo/showcase masking

The main remediation goal is not "add more retries".
The goal is:

- one visible data context
- one effective org scope
- no silent synthetic fallback
- loud failures instead of empty ambiguity
