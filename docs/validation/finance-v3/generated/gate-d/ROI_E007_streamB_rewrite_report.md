# ROI-E007 Stream B rewrite — Finance-side adapter over the canonical ROI/Finance seam

Status: implemented, esbuild-clean, **not executed against a live Postgres**
(see "Test execution" below for why, and how to run it).

Base commit: `c2ff92ac8b9bf522c7d19a54ef2a3fbf58da4599`
(`codex/finance-v3-roi-e007-integration`, worktree
`codex/finance-v3-roi-e007-streamB-rewrite`).

## Scope

A Finance-side adapter over the **canonical** Results vNext ROI/Finance seam.
It does not redefine or duplicate the seam's tables/SQL — `rvn_roi_finance_links`
and its repository/command layer are owned by Results vNext (ROI-E007) and
already exist:

- Schema: `server/migrations/20260820_rvn_roi_finance_seam.sql`
  (`rvn_roi_finance_links`: `link_id` UUID PK, `case_id` FK → `rvn_roi_cases`,
  `organization_id`, `finance_artifact_type`/`finance_artifact_id`/
  `finance_version_id` as plain TEXT with **no FK** — Decision D4 — plus
  `mapping_version`, `source`, `as_of`, `semantic_unit`, `currency`,
  `link_purpose`, `linked_by`/`linked_at`, `row_version`, `created_by`/
  `created_at`/`updated_at`). No freeze/append-only trigger — rows are
  DELETEable by design.
- Canonical write: `server/src/services/resultsVnext/roi/roiFinanceLinkCommands.ts`
  (`createRoiFinanceLink`, `removeRoiFinanceLink`).
- Canonical read: `server/src/services/resultsVnext/roi/roiFinanceLinkRepository.ts`
  (`listRoiFinanceLinks`, `getRoiFinanceLink`, plus the reconciliation-table
  siblings).
- Shared types: `server/src/services/resultsVnext/roi/roiFinanceSeamTypes.ts`
  (`RoiFinanceLink`/`RoiFinanceLinkRow`, `toRoiFinanceLink`).

None of the above were modified. Finance-side reads use the existing Gate C
canonical services (`server/src/services/finance/canonical/artifactVersionService.ts`
— `getArtifact`, `getBusinessVersion`), also unmodified.

## Files delivered (allowlist)

1. `server/src/services/finance/canonical/roiFinanceLinkAdapter.ts` (NEW)
2. `server/src/services/finance/canonical/__tests__/roiFinanceLinkAdapter.pg.test.ts` (NEW)
3. `docs/validation/finance-v3/generated/gate-d/ROI_E007_streamB_rewrite_report.md` (this file, NEW)

No other files touched — `server/migrations/`, `server/src/services/resultsVnext/**`,
`server/src/routes/**` are all untouched (verified via `git status`/`git diff`
against the allowlist below).

## Exported functions (exact signatures)

All in `server/src/services/finance/canonical/roiFinanceLinkAdapter.ts`.

### `linkFinanceArtifactToRoiCase(params: LinkFinanceArtifactToRoiCaseParams): Promise<RoiFinanceLink>`

```ts
export interface LinkFinanceArtifactToRoiCaseParams {
  organizationId: string;
  caseId: string;
  financeBusinessVersionId: string;      // finance_business_versions.business_version_id
  mappingVersion?: number;
  source: string;
  semanticUnit?: string | null;
  currency?: string | null;
  linkPurpose: string;
  linkedBy: string;
  asOf?: string;                          // defaults to now()
  // Additive beyond the task's literal param list — required by the
  // canonical command's AtomicEventInput envelope; optional here with
  // safe defaults (see file header comment for the full rationale):
  actorEffectiveRole?: string;            // default: 'finance_adapter'
  idempotencyKey?: string;                // default: randomUUID()
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}
```

Behavior, in order:
1. **(a)** `artifactVersionService.getBusinessVersion(organizationId, financeBusinessVersionId)`
   — an application-layer existence check, never a DB FK (Decision D4). Throws
   `FinanceBusinessVersionNotFoundError` (`code: 'FINANCE_BUSINESS_VERSION_NOT_FOUND'`)
   **before** the canonical command is ever called if the row does not exist.
2. **(b)** `artifactVersionService.getArtifact(organizationId, businessVersion.artifact_id)`
   to resolve Finance's own `artifact_type`. Throws
   `FinanceArtifactNotFoundError` (`code: 'FINANCE_ARTIFACT_NOT_FOUND'`) in the
   defensive/should-be-unreachable case where that also fails to resolve.
3. **(c)** Delegates the actual write to
   `roiFinanceLinkCommands.createRoiFinanceLink({ ..., financeArtifactType:
   artifact.artifact_type, financeArtifactId: artifact.artifact_id,
   financeVersionId: financeBusinessVersionId, ... })` — no local INSERT.
   Returns `outcome.result` (the canonical `RoiFinanceLink` DTO).

### `getFinanceContextForLink(linkId: string): Promise<FinanceContextForLink>`

```ts
export type FinanceContextForLink =
  | { status: 'OK'; link: RoiFinanceLink; businessVersion: BusinessVersionRow; artifact: ArtifactRow | null }
  | { status: 'FINANCE_VERSION_NOT_FOUND'; link: RoiFinanceLink }
  | { status: 'LINK_NOT_FOUND' };
```

Reverse direction: loads the `rvn_roi_finance_links` row by `link_id` (a
direct primary-key `SELECT`, not a duplicate of the visibility-scoped
`getRoiFinanceLink` — see the in-file comment on `loadRoiFinanceLinkById` for
why: that repository function needs `{userId, caseId}` for its ABAC join,
which this function's task signature — `linkId` alone — does not have), then
resolves `link.financeVersionId` fresh via `getBusinessVersion`. If Finance
no longer has that exact row, returns `'FINANCE_VERSION_NOT_FOUND'` — never
throws, never crashes, never silently follows to a newer/"current" version.
`'LINK_NOT_FOUND'` covers the case where the `link_id` itself does not exist.

### `listFinanceLinksForCase(organizationId: string, caseId: string, userId: string): Promise<RoiFinanceLink[]>`

Thin wrapper over `roiFinanceLinkRepository.listRoiFinanceLinks({ userId,
organizationId, caseId })`. **Deviation from the task's literal 2-arg
signature**: `userId` was added as a required third parameter. The canonical
repository this wraps enforces visibility (§B.4 CTE over
`rvn_visible_resources`, `resource_type='roi_case'`) by `(userId,
organizationId)`, not by `(organizationId, caseId)` alone — dropping `userId`
here would force either a visibility bypass (an unscoped list) or a second,
divergent hand-rolled SQL query duplicating the canonical repository's own
CTE, both explicitly disallowed by the task brief ("nie duplikuje ich SQL").
A caller with no real end-user context should pass a service-account id that
carries an RBAC-override capability.

### Errors

- `FinanceBusinessVersionNotFoundError` — `code: 'FINANCE_BUSINESS_VERSION_NOT_FOUND'`, `details: {organizationId, financeBusinessVersionId}`
- `FinanceArtifactNotFoundError` — `code: 'FINANCE_ARTIFACT_NOT_FOUND'`, `details: {organizationId, artifactId}`

## Test coverage (`roiFinanceLinkAdapter.pg.test.ts`)

Real-Postgres suite, gated identically to every other `.pg.test.ts` in this
repo (`RUN_DB_TESTS=1`, `MOCK_DB=false`, `DATABASE_URL=postgresql://...`,
`describe.skipIf`). Fixture setup per run: one organization, one
`initiatives` row, one `domain='roi'` `OPEN_ORG` visibility policy (required
by `createRoiCase`'s fail-closed guard), one `rvn_roi_cases` row via the
canonical `roiCaseCommands.createRoiCase`.

4 `it()` blocks:

1. **Happy path** — creates a Finance `HISTORICAL_ANALYSIS` artifact, drives
   its `finance_business_versions` row DRAFT → READY_FOR_REVIEW → IN_REVIEW →
   APPROVED (same T2→T4→approve sequence `canonicalServices.pg.test.ts`
   already proves), calls `linkFinanceArtifactToRoiCase`, asserts the
   returned `RoiFinanceLink`'s `financeArtifactType`/`financeArtifactId`/
   `financeVersionId` match what Finance actually has.
2. **Validation-before-command** — calls `linkFinanceArtifactToRoiCase` with
   a random, nonexistent `financeBusinessVersionId`; asserts it rejects with
   `FinanceBusinessVersionNotFoundError`/`FINANCE_BUSINESS_VERSION_NOT_FOUND`
   and that **no** `rvn_roi_finance_links` row was created for that id (the
   canonical command was never reached).
3. **`getFinanceContextForLink` on an unknown id** — asserts
   `{status: 'LINK_NOT_FOUND'}`.
4. **The core Decision-D4 survival test** (the scenario the task explicitly
   asked for): creates a second `HISTORICAL_ANALYSIS` artifact, approves v1,
   links it, confirms `getFinanceContextForLink` resolves to v1/`APPROVED`.
   Then calls `artifactVersionService.reopenVersion(v1)` → v2 (`DRAFT`,
   `parent_version_id=v1`) and drives v2 to `APPROVED` too (which triggers T9:
   v1 flips from `APPROVED` to `SUPERSEDED`). Asserts:
   - the link's `financeVersionId` is **still v1** (never rewritten to v2 —
     no coupling, no trigger, exactly Decision D4's claim);
   - `getFinanceContextForLink` **still resolves to v1**, not v2;
   - the resolved `businessVersion.status` is now `SUPERSEDED` — a **fresh**
     read reflecting v1's real current state, not a cached/stale snapshot
     taken at link-creation time.
   - `listFinanceLinksForCase` includes the link.

## Test execution

**Not executed against a live Postgres in this session.** The task brief's
own "TWARDY ZAKAZ" explicitly forbids spinning up an own ephemeral Postgres
for this work (`initdb`/`pg_ctl`/port allocation/teardown sequence), and this
repo's `CLAUDE.md` "HIGIENA WYKONANIA" separately bans a robotnik session
from running full `vitest`/`tsc` (esbuild-per-file only). Several *other*
concurrent sessions' ephemeral Postgres clusters were found still running
locally (ports 52824/28711/55391/28933, under other sessions' scratchpad/
worktree paths) — these were deliberately left untouched: writing this
suite's fixtures into a cluster another concurrent agent owns and may tear
down mid-run would be exactly the "shared mutable state" failure class
Decision D4 itself exists to avoid, one level up.

What WAS verified in this session:

- `npx esbuild server/src/services/finance/canonical/roiFinanceLinkAdapter.ts --bundle --platform=node --format=esm --outfile=/dev/null --external:pg --external:uuid`
  → bundles clean (`⚡ Done`, no resolution/syntax errors) — confirms every
  relative import path (`../../resultsVnext/roi/...`, `./artifactVersionService.js`,
  `../../../database/PostgresDatabase.js`) resolves correctly and the file is
  syntactically valid ESM/TS.
- Same esbuild check on `roiFinanceLinkAdapter.pg.test.ts` → bundles clean.
- No Postgres process, data directory, or socket was created by this session
  (`ps aux | grep -i 'initdb\|pg_ctl'` → empty at both start and end of the
  session).

**To actually run the suite** against a real, isolated Postgres (per this
repo's own documented procedure — see any sibling `.pg.test.ts` file's
header, e.g. `canonicalServices.pg.test.ts`):

```bash
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
npx vitest run --config server/vitest.config.ts \
  server/src/services/finance/canonical/__tests__/roiFinanceLinkAdapter.pg.test.ts \
  --no-file-parallelism
```

against a cluster with both the Finance v3 (`20260809_finance_v3_b0*.sql`)
and ROI (`20260815_rvn_roi_core.sql`, `20260820_rvn_roi_finance_seam.sql`,
`20260809_rvn_platform_*.sql`) migrations applied.

## Commit

Files committed on `codex/finance-v3-roi-e007-streamB-rewrite`:
- `server/src/services/finance/canonical/roiFinanceLinkAdapter.ts`
- `server/src/services/finance/canonical/__tests__/roiFinanceLinkAdapter.pg.test.ts`
- `docs/validation/finance-v3/generated/gate-d/ROI_E007_streamB_rewrite_report.md`

See the git log on this branch for the commit SHA (created after this report
was written, so it is not self-referential here — read it with
`git log --oneline -1` on this branch).
