# AP-07 — Saved views (personal/team) + shareable URL

**Program:** `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`
**Source requirement:** `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` section 3
point 7 ("Filtry i saved views: category, quality, missing, changed, materiality, source, owner,
downstream use, entity, period; personal/team views i shareable URL") — one of the items section 3's
"Krytyczna zmiana priorytetow" moved from P2 to P0/P1.
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Date:** 2026-08-10
**Base commit:** `cbd0934ae7` (AP-05 Compare service — the last commit on this branch before this work
package started)

---

## 1. What was read before touching anything

1. `FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` section 3 point 7 — the requirement list this work
   package implements (see title above).
2. `server/src/services/finance/grid/GridViewState.ts` (AP-01) — its own header states, verbatim, that it
   is in-memory-only today and names AP-07 as the future consumer: *"nothing in this file is persisted to
   any database or `finance_*` table by this package ... this class's `toJSON`/`fromJSON` exist to make
   that future integration a plain pass-through, not to declare it in scope now"*. This work package's job
   is exactly that pass-through — persist `GridViewStateSnapshot`, not redesign freeze/pin/hide/group.
3. `server/src/types/finance/WorkspaceState.ts` (AP-00) — filters are stored there as an intentionally
   OPAQUE `{ raw: Record<string, unknown> }` bag, with a comment saying *"AP-07 (Filters/saved views, P1,
   not yet designed) owns that shape"*. This work package is where that shape gets designed for real.
4. `server/src/types/finance/financeValueSemantics.ts` (AP-00) — the `quality` filter's task instruction
   ("quality (z financeValueSemantics)") points here explicitly: `FinanceValueStatusValues`
   (`PRESENT_ZERO`/`PRESENT_NONZERO`/`MISSING`/`NA`/`NOT_APPLICABLE`), reused verbatim, not a new enum.
5. `server/src/types/finance/ArtifactRef.ts` (AP-00) — `FinanceArtifactTypeValues` (the six real
   `finance_artifacts.artifact_type` values), reused for both the saved view's own `artifact_type` column
   and the `downstream_use` filter's value domain.
6. `server/src/services/finance/canonical/commentService.ts` + its migration
   (`20260809_finance_v3_d_ap06_comments_01_tables.sql`) — the closest existing precedent for a
   tenant-scoped, JSONB-payload-carrying table with a defensive JSONB-string-vs-parsed-object read guard
   (`normalizeCommentRow`) this work package's own `normalizeSavedViewRow` copies.
7. `server/migrations/20260809_finance_v3_d03_analysis_01_tables.sql` /
   `..._02_integrity.sql` — `finance_analysis_kpi_catalog`'s `status` lifecycle (`DRAFT`/`ACTIVE`/
   `DEPRECATED`) and its maker-checker write-gate trigger, needed both for the `category` filter's value
   domain and for the column-schema-migration requirement (task point 4).
8. `server/src/services/finance/canonical/artifactVersionService.ts` — `getArtifact()`/`createArtifact()`,
   reused as-is (this work package derives `artifact_type` from the real `finance_artifacts` row, never
   trusts a caller-supplied value).

## 2. What was built

### 2.1 Migration — `server/migrations/20260809_finance_v3_d_ap07_saved_views_01_tables.sql`

Additive only, one new table, no change to any existing table or trigger:

- **`finance_saved_views`** — `organization_id` (FK), `artifact_id` + `artifact_type` (composite FK to
  `finance_artifacts`, `artifact_type` denormalized from that same row at write time), `scope`
  (`PERSONAL`/`TEAM`), `owner_user_id`, `name`, `view_state JSONB` (the `GridViewStateSnapshot` +
  structured filters, see 2.2), `share_token` (globally unique, opaque), `created_by/at`, `updated_at`
  (auto-touched by trigger, same pattern as `finance_comments`).
- `artifact_id` is **not** in the task brief's literal column list, but was added deliberately: the task's
  own acceptance scenario saves a view "dla GoldCo Analysis" — one concrete artifact, not every
  `HISTORICAL_ANALYSIS` artifact an org will ever have — and the shareable-URL requirement needs a concrete
  artifact to authorize against when a token is resolved. See the migration file's own header for the full
  reasoning.
- Three indexes: personal-views listing (`organization_id, artifact_id, owner_user_id WHERE scope =
  'PERSONAL'`), team-views listing (`organization_id, artifact_id WHERE scope = 'TEAM'`), and an
  owner-wide index for management/cleanup UIs.

Verified against the real migrated schema (ephemeral Postgres, see section 4): applies cleanly on top of
every prior migration, including every other Finance v3 Gate B/C/D migration and the full non-finance
schema (full `migrate.postgres.ts` run against a fresh database — every migration file in
`server/migrations/`, `init-pgvector.sql` included — exits `✅ Postgres migrations complete`, no `--safe`
skip-on-error flag used).

### 2.2 `server/src/services/finance/canonical/savedViewService.ts`

**Structured filters (task requirement 3 — "nie wolna forma").** A zod discriminated union on `type`, one
branch per task-listed filter, each with a range-validated value domain:

| Filter `type` | Value domain |
|---|---|
| `category` | `FinanceKpiCategoryValues` — mirrors `finance_analysis_kpi_catalog.category`'s CHECK (8 values) |
| `quality` | `FinanceValueStatusValues` (AP-00 `financeValueSemantics.ts`, reused verbatim) |
| `missing` | `{ onlyMissing: boolean }` |
| `changed` | `{ changedOnly: boolean }` — a flag a consumer reads before calling AP-06's `getChangedCellsForStatementPack` |
| `materiality` | `{ minAbsValueDecimal: string \| null }` — decimal string, never a JS `number` (same precision discipline as `FinanceValue.valueDecimal`) |
| `source` | non-empty string array |
| `owner` | non-empty string array (user ids) |
| `downstream_use` | `FinanceArtifactTypeValues` (AP-00 `ArtifactRef.ts`, reused verbatim) |
| `entity` | non-empty string array (entity ids — no entity catalog table exists yet to validate membership against, so this validates shape only) |
| `period` | non-empty string array (period ids) |

`SavedViewFilterSetSchema.safeParse` runs on every create/update — an out-of-range value (e.g.
`quality: ['WARNING']`, which is a `finance_exceptions` severity, not a value-status) is rejected with
`INVALID_FILTERS`, never silently accepted or coerced (see the negative test in section 3).

**`view_state` shape:** `{ schemaVersion: 1, gridViewState: GridViewStateSnapshot, filters:
SavedViewFilter[] }`. `gridViewState` is validated at the DB boundary by `GridViewStateSnapshotSchema` (a
zod mirror of `GridViewState.ts`'s plain TS interfaces — that class has no zod schema of its own).
`createSavedView`/`updateSavedView` accept either a live `GridViewState` instance (calling `.toJSON()`
itself) or an already-serialized snapshot, so a caller holding the real AP-01 grid object never has to
reach into its internals.

**CRUD + permissions** (decision, not fully specified by the task brief — resolved per `DEC-FIN-012`,
documented in the file header):

- `createSavedView` / `updateSavedView` / `deleteSavedView` / `listSavedViews` / `getSavedView`.
- **PERSONAL**: visible to, and writable only by, `owner_user_id`.
- **TEAM**: visible to every member of `organization_id` (trusted from the caller, same convention
  `finance_comments`/`finance_exceptions` already use — no separate org-membership table queried here);
  still writable only by `owner_user_id`. Scope changes WHO CAN READ, never who can edit.
- `getSavedView` returns the **same** `NOT_FOUND` code for "row doesn't exist" and "row exists but this
  requester cannot see it" (a personal view owned by someone else) — deliberate, so a non-owner can never
  learn a given personal view id exists.

**Shareable URL (task requirement — "sam token widoku nie omija authorization na dane"):**
`resolveSharedView({ shareToken, organizationId, requesterUserId })` looks a row up by `share_token`
alone (the only function in this file allowed to query without `organization_id` in the first WHERE
clause), then applies two structural guards before returning anything: the row's `organization_id` must
equal the **caller's own authenticated** `organizationId` (never taken from the token), and a
PERSONAL-scoped row's `owner_user_id` must equal the caller. Both failures return the same `NOT_FOUND` (no
tenant/scope enumeration via the token). The returned payload is the view **definition** only — filters
and grid layout — never any of the artifact's actual statement/KPI/model content; a caller resolving a
shared URL must still separately run the artifact's own normal organization-scoped authorization (e.g.
`artifactVersionService.getArtifact` against the requester's real org) before serving any grid data. This
is proven structurally in the test suite (section 3), not just asserted in a comment.

**Column schema migration (task requirement 4):** `resolveColumnAvailability()` cross-references every
`gridViewState.columns[].columnId` against `finance_analysis_kpi_catalog` (`organization_id IS NULL OR
organization_id = ?`, covering both UNIVERSAL and ORG_CUSTOM tiers). Every read path (`getSavedView`,
`listSavedViews`, `resolveSharedView`) attaches a `columnAvailability: { columnId, available, reason }[]`
array to the returned view. A `columnId` matching a catalog `kpi_code` whose current `status != 'ACTIVE'`
is reported `available:false, reason:'KPI_DEPRECATED'` — the stored `view_state` itself is **never**
pruned or rewritten, so a later re-activation of the same `kpi_code` makes the column reappear with zero
data loss. A `columnId` with no matching catalog row at all (e.g. a period column) is assumed available —
this file has no other source of truth to check such columns against.

## 3. Tests

New file: `server/src/services/finance/canonical/__tests__/savedViewService.pg.test.ts` (20 tests, real
PostgreSQL, `describe.skipIf`-gated on `RUN_DB_TESTS=1`/`MOCK_DB=false`/a real `DATABASE_URL`, same
convention as every other `.pg.test.ts` in this directory).

Note on the task's literal filter example ("quality=WARNING, entity=PARENT"): `WARNING` is a
`finance_exceptions`/comment SEVERITY value (a different axis), not one of `financeValueSemantics.ts`'s
`FinanceValueStatus` values the task itself says this filter must reuse. The test uses `MISSING` instead —
the literal match to "quality (z financeValueSemantics)".

| Test | Result |
|---|---|
| Create a personal view on "GoldCo Analysis" with structured filters (`quality=['MISSING']`, `entity=['PARENT']`); filters + `gridViewState` (freeze/pin/hide) round-trip exactly; `share_token` is generated | PASS |
| The owner can load it (`getSavedView`) | PASS |
| A second user in the SAME organization gets `NOT_FOUND` for the same personal view | PASS |
| `listSavedViews`: owner sees it, teammate does not | PASS |
| `updateSavedView`: a non-owner gets `FORBIDDEN`; the owner can rename it, filters/gridViewState untouched by a name-only patch | PASS |
| `deleteSavedView`: a non-owner gets `FORBIDDEN`; the owner can delete it, then `getSavedView` returns not-ok | PASS |
| Create a **team** view | PASS |
| A teammate in the SAME organization (not the owner) CAN load the team view | PASS |
| A user in a **DIFFERENT** organization gets `NOT_FOUND` for the same team view — tenant isolation | PASS |
| `listSavedViews` scoped to the other organization never returns it | PASS |
| **Shareable URL**: resolves by token for a teammate in the same org; returned payload keys are exactly the view-definition fields (no statement/KPI content present at all) | PASS |
| **Shareable URL**: the SAME token resolves to `NOT_FOUND` for a requester in a different organization — token does not bypass tenant isolation | PASS |
| **Shareable URL still requires separate artifact authorization**: `artifactVersionService.getArtifact` under the correct org succeeds; under a foreign org returns `null`, independent of the view-token check | PASS |
| **Shareable URL for a PERSONAL view**: only the owner can resolve it, even with a valid token; a teammate gets `NOT_FOUND` | PASS |
| Structured filter validation: an out-of-range `quality` value (`'WARNING'`) is rejected with `INVALID_FILTERS`, not silently accepted | PASS |
| An unknown `artifactId` is rejected with `ARTIFACT_NOT_FOUND` | PASS |
| **Column schema migration**: save a view referencing a currently-ACTIVE custom KPI catalog column | PASS |
| While ACTIVE, the column loads `{available:true, reason:null}` | PASS |
| **After the KPI is deprecated**, the saved view still loads WITHOUT crashing (`ok:true`), the column is explicitly `{available:false, reason:'KPI_DEPRECATED'}`, and the stored `view_state` still contains the column id (not silently dropped) | PASS |
| `listSavedViews` carries the same column-availability annotation, not just `getSavedView` | PASS |

```
Test Files  1 passed (1)
     Tests  20 passed (20)
```

## 4. Regression pack

Ran the two most relevant existing `.pg.test.ts` suites against the same ephemeral cluster this work
package's own migration was applied to (own `initdb --locale=C`, port 57231 in the 55000-59999 range, data
dir under `/private/tmp/`, never port 5432/PID 911 — full `migrate.postgres.ts` run applied first,
including `init-pgvector.sql`, then this work package's own AP-07 migration; `pg_ctl stop -m fast` + data
dir `rm -rf` at the end of the session):

```
exceptionInboxService.pg.test.ts + commentReviewService.pg.test.ts -> Test Files 2 passed (2)  Tests 12 passed (12)
```

0 regressions. This work package did not modify any existing service, migration, or shared type — the new
migration is purely additive (one new table) and the new service imports but does not alter
`GridViewState.ts`, `ArtifactRef.ts`, `financeValueSemantics.ts`, or `artifactVersionService.ts` — so a
narrower regression pack than AP-06's (which touched `approveVersion()` directly) is appropriate here; the
two suites above were chosen because they are the other recent Gate D work packages exercising the same
`finance_artifacts`/`organizations` fixture pattern this work package's own test reuses.

Type-checking: `esbuild` syntax/bundle check on both new TypeScript files (clean) plus a scoped `tsc
--noEmit` pass (temporary tsconfig extending `server/tsconfig.json`, `include` limited to the two new
files) against the real project compiler options — clean, no errors.

## 5. Known scope limitations / follow-on work

1. **`entity`/`source` filters validate shape only, not existence** — no entity catalog or source-registry
   table exists yet in this codebase to check membership against (documented in the zod schema comments).
   Adding that validation is additive once such a table exists.
2. **No "unassign a team view back to personal" / scope-change verb.** The task brief's CRUD list was
   "create/update/delete/list" with `scope` as a create-time field; `updateSavedView`'s patch does not
   currently allow changing `scope` after creation (an update patch changes `name`/`gridViewState`/
   `filters` only). A caller wanting to change scope today deletes and re-creates. Adding a scope-change
   verb is a reasonable, additive follow-on but was not asked for explicitly.
3. **`downstream_use` and `changed` filters validate their own shape but do not themselves execute the
   underlying query** (checking which cells actually feed a downstream artifact, or diffing against the
   previous approved version via AP-06). This file defines the filter contract; wiring it into the actual
   grid query/rendering layer is AP-01's consumption of this contract, not this work package's own scope
   (mirrors how `WorkspaceState.ts`'s header describes its own filters field: "AP-07 owns that shape",
   i.e. the shape, not the query execution).

## 6. Commits

- `server/migrations/20260809_finance_v3_d_ap07_saved_views_01_tables.sql` (new)
- `server/src/services/finance/canonical/savedViewService.ts` (new)
- `server/src/services/finance/canonical/__tests__/savedViewService.pg.test.ts` (new)
- `docs/validation/finance-v3/generated/gate-d/AP-07_saved_views_report.md` (this file)

See the branch's own `git log` for the exact commit SHA(s) this report was committed alongside.
