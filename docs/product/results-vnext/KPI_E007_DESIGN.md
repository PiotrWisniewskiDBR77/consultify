# KPI-E007 — Legacy Archive / Ops Exclusion — FROZEN DESIGN

Status: FROZEN. Integration Owner: Claude (orchestrator session, 2026-08-09).
Epic ledger rows: KPI-F-032..037 (`EPIC_LEDGER_LIVE.md`).
Scope: **backend only**. UI Registry (Menu 1/2/3) for KPI is RN-G2, not this epic.

This is the last epic needed to close the KPI domain backend (E001–E007).

---

## 0. Source draft

Drafted by a read-only design agent against the codebase as of this branch's HEAD
(`codex/results-vnext-g0-20260809`, 64 commits ahead of `origin/demo`). The draft's
factual findings (§0 "realny writer/reader per tabela") were grep-verified, not
assumed, and are accepted as-is. This document resolves every open question the
draft left open and is the complete, self-contained spec for implementation — no
reference to "see conversation" anywhere below.

### 0.1 Accepted facts (do not re-derive, cite this table in the PR)

| Legacy table | Live write path today | Live read path today | Client-facing HTTP surface? |
|---|---|---|---|
| `kpis` | none found | AI context builders (`ideaAIGeneratorService.ts`, `aiOperatorService.ts`, `contextPackBuilder.ts`, `ai/contextPackService.ts`) | no |
| `kpi_definitions` | none found | `results-kpi-reports.routes.ts:125` (1 SELECT) | yes (read-only report) |
| `v8_kpi_definitions` | `resultsROIService.ts` (`createKPI`/`updateKPIStatus`), called only by Health Panel probes (`healthProbeService.ts` → `admin/health-panel.routes.ts`, admin-gated, self-cleaning) | same | no (probe only, not a normal client route) |
| `tp_kpi_definitions` | `GovernedModelService.addKpi/removeKpi/computeKpi`, called from `table-platform.routes.ts` (`/api/table-platform/governed-models/:modelId/kpis`, etc.) | same | **yes — live, active client surface** |

Consequence: T5 ("new UI accidentally hits an old endpoint") is a real, live concern
only for `tp_kpi_definitions`, and that table isn't KPI-Results legacy debt at all —
it's a different product ("Table Platform / Governed Models") that happens to share
the word "KPI". For the other three tables T5 is prevention against a future
regression, not a fix for an active leak. Both facts must be stated plainly in the
PR description so nobody files a false P0 "legacy writes into KPI vNext" — it
doesn't, today.

### 0.2 Verified isolation of rvn_* read models (proves §B before writing the test)

`kpiRepository.ts` and `kpiPerspectivesRepository.ts` were grepped for every
`FROM`/`JOIN` clause: 100% of table references are `rvn_kpi_*` / `rvn_platform_*`.
Zero occurrences of `kpis`, `kpi_definitions`, `v8_kpi_definitions`, or
`tp_kpi_definitions` in any file under `server/src/services/resultsVnext/`.

---

## 1. Decisions (resolving the draft's 5 open questions)

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | `v8_kpi_definitions` — is the live copy `public.v8_kpi_definitions` or `v8.v8_kpi_definitions`? Baseline dump has both. | **Do not hardcode a schema prefix.** Query it exactly the way `resultsROIService.ts` already does — unqualified `FROM v8_kpi_definitions`, relying on the connection's existing `search_path`, using the **same pooled client acquisition path** as the rest of the legacy archive repository. Whatever table `resultsROIService.ts` resolves to in production is by definition the "live" one; matching its query shape guarantees the archive reads the same table the health probe already exercises, with zero risk of guessing the wrong schema. | Sidesteps a runtime fact I cannot verify from a git worktree without live demo DB access, by making the new code behaviorally identical to the code whose behavior is already trusted (the health probe passes today). No new fact needs to be established. |
| D2 | Scorecard legacy (3 implementations: `kpi_scorecards`/`kpi_scorecard_items`, `balancedScorecardService.ts`, `transformationScorecardService.ts`) — in scope? | **Out of scope for KPI-E007.** These are structurally different (item-per-KPI, not flat definitions) and were never part of the 4-table inventory this epic was scoped against (EXECUTION_LEDGER §3.8, EPIC_LEDGER_LIVE KPI-F-032..037). File a follow-up note in EXECUTION_LEDGER under RN-G7 backlog: "KPI-E007b: legacy scorecard archive adapter (not built, not blocking KPI domain completion)." | Keeps this epic bounded to what was actually inventoried; scorecards already have a *live* vNext replacement (KPI-E004) with its own two-layer visibility defense — the legacy scorecard tables are a separate, lower-priority cleanup. |
| D3 | Include `tp_kpi_definitions` endpoint at all, given it's someone else's live product? | **Include it**, per the original 4-table scope, but with the draft's `origin_domain: "table_platform_live"` distinction preserved exactly as proposed — this is a read-only cross-reference, not an archive-of-the-dead claim. Response `meta.label` for this one table only reads `"Table Platform — live, external to Results"` instead of `"Legacy archive — read-only"`. | The epic ledger explicitly lists all 4 tables under KPI-F-032..037; excluding one silently would under-deliver against the epic's own AC rows without a documented reason. Labeling correctly (per draft's own recommendation) avoids the mislabeling risk the draft raised. |
| D4 | Pagination shape for `ListLegacyQuerySchema`? | Match `ListKpisQuerySchema` exactly (`server/src/validators/resultsVnextKpi.validators.ts:108-112`): `{ limit: z.coerce.number().int().positive().max(500).optional(), offset: z.coerce.number().int().nonnegative().optional() }`. No `status` field (legacy tables have no unified status concept across all 4). | Confirmed by direct read of the file — verbatim shape, not a paraphrase. |
| D5 | Where does `denyMutations` live — existing `demoGuard.middleware.ts` or a new file? | **New file**: `server/src/middleware/readOnlyGuard.middleware.ts`. Structurally copies the `isWrite = !['GET','HEAD','OPTIONS'].includes(method)` gate shape from `demoWriteProtection` (`demoGuard.middleware.ts:233-319`), but is a distinct, generically-named export — nothing about "read-only archive" should live under a file named `demoGuard`, which is about demo-mode write suppression, a different concept that happens to share a coincidentally similar shape. | Avoids a maintainer reading `demoGuard.middleware.ts` in six months and reasonably (but wrongly) concluding `denyMutations` only applies in demo mode. |

---

## 2. Endpoints (9 total: 1 index + 4 tables × 2)

Router file: `server/src/routes/resultsVnext/kpiLegacyArchive.routes.ts`.

```
GET /api/vnext/results/kpi/legacy                          -- index
GET /api/vnext/results/kpi/legacy/kpis
GET /api/vnext/results/kpi/legacy/kpis/:legacyId
GET /api/vnext/results/kpi/legacy/kpi-definitions
GET /api/vnext/results/kpi/legacy/kpi-definitions/:legacyId
GET /api/vnext/results/kpi/legacy/v8-kpi-definitions
GET /api/vnext/results/kpi/legacy/v8-kpi-definitions/:legacyId
GET /api/vnext/results/kpi/legacy/tp-kpi-definitions
GET /api/vnext/results/kpi/legacy/tp-kpi-definitions/:legacyId
```

Middleware chain, in this exact order (the order is the entire security property —
`denyMutations` must be first, before auth, so a misconfigured auth layer can never
create a write hole):

```ts
import { Router } from 'express';
import { denyMutations } from '../../middleware/readOnlyGuard.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js'; // match existing kpi.routes.ts import
import { verifyToken } from '../../middleware/auth.middleware.js';
import { requireOrgAccess } from '../../middleware/orgAccess.middleware.js'; // match existing import used by kpi.routes.ts
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';

const router = Router();

router.all('*', denyMutations);
router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

// ... route handlers below (§2.1)

export default router;
```

Note: use the **exact same** middleware imports/names already used at the top of
`kpi.routes.ts` for `apiAuthRateLimiter`/`verifyToken`/`requireOrgAccess`/
`demoContextMiddleware` — read that file first to copy the real import paths and
names verbatim; do not guess names. This design intentionally does not re-derive
them since they are one `Read` away and copying wrong names would just be a typo
risk this doc can't prevent anyway.

### 2.1 Response envelope

Every response (list and single) wraps `data` in `meta`:

```ts
interface LegacyArchiveMeta {
  label: string;              // "Legacy archive — read-only" | "Table Platform — live, external to Results"
  originDomain: 'results_legacy' | 'table_platform_live';
  sourceTable: string;        // e.g. "kpis", "kpi_definitions", "v8_kpi_definitions" (unqualified per D1), "tp_kpi_definitions"
  readOnly: true;
  organizationId: string;
  fetchedAt: string;          // ISO 8601, new Date().toISOString()
  total?: number;             // list responses only
  limit?: number;             // list responses only
  offset?: number;            // list responses only
}

interface LegacyArchiveListResponse<T> {
  data: T[];
  meta: LegacyArchiveMeta;
}

interface LegacyArchiveItemResponse<T> {
  data: T | null;
  meta: LegacyArchiveMeta;
}
```

`origin_domain`/`label` values per table:

| Route segment | sourceTable | originDomain | label |
|---|---|---|---|
| `kpis` | `kpis` | `results_legacy` | `Legacy archive — read-only` |
| `kpi-definitions` | `kpi_definitions` | `results_legacy` | `Legacy archive — read-only` |
| `v8-kpi-definitions` | `v8_kpi_definitions` | `results_legacy` | `Legacy archive — read-only` |
| `tp-kpi-definitions` | `tp_kpi_definitions` | `table_platform_live` | `Table Platform — live, external to Results` |

Single-item 404 (row not found, or not in caller's `organization_id`): `{ data: null, meta: {...} }` with HTTP 404, not `data: null` on HTTP 200 — treat "not found" as a real 404 exactly like `kpi.routes.ts`'s `GET /:kpiId` does today (read that handler to match the exact 404 shape/status).

### 2.2 Route handlers (all 9, GET-only)

Each handler: validate params/query with Zod (throw → existing global error middleware
handles it, matching the pattern every other `resultsVnext` route file already uses)
→ call the matching repository function → wrap in envelope → `res.json(...)`.

```ts
router.get('/', async (req, res, next) => {
  // index: one row per legacy source with a COUNT(*) for that org, no pagination
  try {
    const organizationId = (req as AuthRequest).user!.organization_id;
    const counts = await getLegacyArchiveIndex(organizationId);
    res.json({ data: counts, meta: { label: 'Legacy archive index', readOnly: true, organizationId, fetchedAt: new Date().toISOString() } });
  } catch (err) { next(err); }
});

router.get('/kpis', async (req, res, next) => {
  try {
    const organizationId = (req as AuthRequest).user!.organization_id;
    const query = ListLegacyQuerySchema.parse(req.query);
    const { rows, total } = await listLegacyKpis(organizationId, query.limit ?? 50, query.offset ?? 0);
    res.json({ data: rows, meta: legacyMeta('kpis', 'results_legacy', organizationId, total, query.limit ?? 50, query.offset ?? 0) });
  } catch (err) { next(err); }
});

router.get('/kpis/:legacyId', async (req, res, next) => {
  try {
    const organizationId = (req as AuthRequest).user!.organization_id;
    const { legacyId } = LegacyIdParamsSchema.parse(req.params);
    const row = await getLegacyKpi(organizationId, legacyId);
    if (!row) return res.status(404).json({ data: null, meta: legacyMeta('kpis', 'results_legacy', organizationId) });
    res.json({ data: row, meta: legacyMeta('kpis', 'results_legacy', organizationId) });
  } catch (err) { next(err); }
});

// identical pattern × 3 more pairs for kpi-definitions / v8-kpi-definitions / tp-kpi-definitions,
// swapping only the route segment, sourceTable string, originDomain, and repository function names.
```

`legacyMeta(sourceTable, originDomain, organizationId, total?, limit?, offset?)` is a
small local helper in the route file building the `LegacyArchiveMeta` object per
§2.1's table (picks `label` from `originDomain`), avoiding repeating the label
string 8 times.

### 2.3 Index endpoint shape (`GET /legacy`)

```ts
type LegacyArchiveIndexRow = {
  sourceTable: string;
  originDomain: 'results_legacy' | 'table_platform_live';
  label: string;
  count: number;   // COUNT(*) WHERE organization_id = $1 for that table
};
// data: LegacyArchiveIndexRow[], always exactly 4 rows, one per legacy table, in the
// fixed order kpis, kpi_definitions, v8_kpi_definitions, tp_kpi_definitions.
```

---

## 3. Repository (`server/src/services/resultsVnext/kpi/kpiLegacyArchiveRepository.ts`)

Zero imports from any `*Commands.ts` file in the KPI domain — this file only ever
imports the shared pooled-client acquisition helper already used by
`kpiRepository.ts` (read that file's top imports and copy the exact same
acquisition function name/import path — do not invent a new one).

8 functions, one pair per table. Full SQL below (parametrized, `organization_id`
always the first bound param — every query is tenant-scoped, no exceptions):

```ts
export async function listLegacyKpis(organizationId: string, limit: number, offset: number) {
  const client = await acquirePgClient(); // same helper kpiRepository.ts uses
  try {
    const { rows } = await client.query(
      `SELECT * FROM kpis WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int AS total FROM kpis WHERE organization_id = $1`,
      [organizationId]
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  } finally { client.release(); }
}

export async function getLegacyKpi(organizationId: string, legacyId: string) {
  const client = await acquirePgClient();
  try {
    const { rows } = await client.query(
      `SELECT * FROM kpis WHERE organization_id = $1 AND id = $2`,
      [organizationId, legacyId]
    );
    return rows[0] ?? null;
  } finally { client.release(); }
}

// listLegacyKpiDefinitions / getLegacyKpiDefinition — identical shape, table `kpi_definitions`.

// listLegacyV8KpiDefinitions / getLegacyV8KpiDefinition — identical shape, table
// `v8_kpi_definitions`, UNQUALIFIED per Decision D1 (no `public.`/`v8.` prefix —
// copy the exact unqualified query style from resultsROIService.ts's createKPI/
// updateKPIStatus, read that file first to match column names for the SELECT list
// if selecting specific columns; `SELECT *` is fine and avoids the column-name
// coupling entirely).

// listLegacyTpKpiDefinitions / getLegacyTpKpiDefinition — identical shape, table
// `tp_kpi_definitions`. Read GovernedModelService.ts's addKpi/removeKpi/computeKpi
// to confirm the actual column name used for organization scoping on this table —
// it may not be literally `organization_id` (Table Platform is a different
// subsystem with its own conventions); verify before writing the WHERE clause,
// do not assume.
```

```ts
export async function getLegacyArchiveIndex(organizationId: string) {
  const client = await acquirePgClient();
  try {
    const tables = [
      { sourceTable: 'kpis', originDomain: 'results_legacy' as const, label: 'Legacy archive — read-only' },
      { sourceTable: 'kpi_definitions', originDomain: 'results_legacy' as const, label: 'Legacy archive — read-only' },
      { sourceTable: 'v8_kpi_definitions', originDomain: 'results_legacy' as const, label: 'Legacy archive — read-only' },
      { sourceTable: 'tp_kpi_definitions', originDomain: 'table_platform_live' as const, label: 'Table Platform — live, external to Results' },
    ];
    const results = [];
    for (const t of tables) {
      // table name is from the fixed literal list above, never user input — safe to interpolate
      const orgColumn = t.sourceTable === 'tp_kpi_definitions' ? /* verified column name */ 'organization_id' : 'organization_id';
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS count FROM ${t.sourceTable} WHERE ${orgColumn} = $1`,
        [organizationId]
      );
      results.push({ ...t, count: rows[0]?.count ?? 0 });
    }
    return results;
  } finally { client.release(); }
}
```

Table names interpolated directly into SQL above are safe **only** because they come
from the fixed 4-entry literal array, never from `req.params`/`req.query` — the
per-table functions (`listLegacyKpis` etc.) never interpolate a table name at all,
they hardcode it per function. Do not generalize this into a single
`listLegacyTable(tableName: string, ...)` helper that accepts a table name as a
runtime argument — that would reopen a SQL-injection surface for no benefit.

---

## 4. Validators (`server/src/validators/resultsVnextKpiLegacy.validators.ts`)

```ts
import { z } from 'zod';

export const ListLegacyQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export const LegacyIdParamsSchema = z.object({
  legacyId: z.string().min(1).max(200), // legacy tables may use non-UUID PKs (e.g. tp_kpi_definitions) — do not assume UUID format
});
```

Do not reuse `KpiIdParamsSchema` from `resultsVnextKpi.validators.ts` — that one
almost certainly enforces UUID shape (matching vNext `rvn_kpi_definitions.id`),
which would wrongly 400 a legacy row whose PK isn't a UUID. Verify this assumption
by reading `KpiIdParamsSchema`'s definition before deciding whether a shared or
separate schema is correct; the separate schema above is deliberately more
permissive and is safe regardless.

---

## 5. `denyMutations` middleware (`server/src/middleware/readOnlyGuard.middleware.ts`, new file)

```ts
import type { NextFunction, Request, Response } from 'express';

/**
 * Generic method gate: any request whose method is not GET/HEAD/OPTIONS is
 * rejected before it reaches auth or a route handler. Intended for routers that
 * must be structurally incapable of mutation (e.g. read-only legacy archives),
 * independent of what handlers happen to be registered on the router.
 */
export const denyMutations = (req: Request, res: Response, next: NextFunction): void => {
  const method = String(req.method || '').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    next();
    return;
  }
  res.status(405).json({
    error: 'Legacy archive is read-only',
    code: 'LEGACY_ARCHIVE_READ_ONLY',
  });
};
```

Deliberately simpler than `demoWriteProtection` — no allowlist, no demo-org
detection, no header parsing. It has exactly one job: any non-GET/HEAD/OPTIONS verb
gets a 405, unconditionally, for every route behind it. This is correct precisely
because it protects a router that should never have write semantics under any
condition (unlike `demoWriteProtection`, which conditionally allows writes outside
demo mode).

---

## 6. Contract test — B.2, proving read-model isolation

New file: `tests/resultsVnext/kpi/legacyIsolation.realdb.test.ts`. Same skeleton as
the existing `tests/resultsVnext/kpi/kpiIdentityAcrossSurfaces.realdb.test.ts` —
copy its `DB_CONFIGURED` skip-gate, raw `pg.Client` setup/teardown, and
`ORG_ID`/tagging conventions verbatim (read that file first).

Test body:

1. **Setup**: create one real, `OPEN_ORG`-visible KPI definition through the normal
   `rvn_kpi_*` path (same helper `kpiIdentityAcrossSurfaces.realdb.test.ts` already
   uses to seed a control KPI) — this is the "real" row every assertion below must
   still see.
2. **Poison**: using the raw `pg.Client` directly (bypassing all services), `INSERT`
   one row into each of the 4 legacy tables, same `organization_id` as the control
   KPI, with `name`/id-like fields deliberately similar to the control row's (to
   catch accidental collision-by-name in aggregation, not just missing rows).
3. **Negative assertion**: call `listKpis()`, `listMyKpis()`, `listOrganizationKpiAttention()`
   for that `organizationId`/`userId` — assert none of the returned records' `kpiId`
   or `name` matches any poisoned row, and assert the returned count is exactly 1
   (the control row) wherever the function's contract makes that deterministic.
4. **Positive assertion** (guards against the test passing vacuously on an empty
   result): the control KPI **must** appear in all three read models — if it
   doesn't, fail the test with a message distinguishing "isolation broken" from
   "setup broken," so a future maintainer isn't misled by a false green.
5. **Static assertion, same file, no DB needed**: `readFileSync` on
   `kpiRepository.ts` and `kpiPerspectivesRepository.ts`, regex
   `/\b(kpis|kpi_definitions|v8_kpi_definitions|tp_kpi_definitions)\b/` with word
   boundaries (so it does not match `rvn_kpi_definitions`) — assert zero matches.
   This is the cheap, always-run half of the proof; the realDB half is the
   expensive, authoritative half. Both must pass.
6. **Cleanup**: `finally` block deletes all 5 inserted rows (1 control + 4
   poisoned) regardless of pass/fail — no residue in the test database, per
   CLAUDE.md's "probes clean up after themselves" rule.

---

## 7. Contract test — A.4, proving physical write-denial

New file: `tests/resultsVnext/kpi/kpiLegacyArchive.routes.test.ts`. No database
needed (denyMutations rejects before any DB call).

1. **Behavioral**: mount `kpiLegacyArchive.routes.ts` in an isolated Express app
   (supertest), and for each of the 9 route paths from §2, send `POST`, `PUT`,
   `PATCH`, `DELETE` — assert `405` and `body.code === 'LEGACY_ARCHIVE_READ_ONLY'`
   for every combination (36 assertions total).
2. **Static**: `readFileSync` on `kpiLegacyArchive.routes.ts`, regex
   `/router\.(post|put|patch|delete)\(/i` — assert zero matches. If someone later
   adds a write handler "just for debugging," this line fails immediately in CI
   before the behavioral test even needs to catch it.

---

## 8. Gateway mount (`server/src/Gateway.ts`)

Add alongside the existing KPI vNext mount block (near the existing
`kpiDeviation`/`kpiScorecard`/`kpiPerspectives` mounts — read the current mount
order there first, since line numbers will have shifted since the draft's grep):

```ts
import resultsVnextKpiLegacyArchiveRoutes from './routes/resultsVnext/kpiLegacyArchive.routes.js';
// ...
app.use('/api/vnext/results/kpi/legacy', resultsVnextKpiLegacyArchiveRoutes);
app.use('/api/vnext/results/kpi', resultsVnextKpiRoutes); // existing — must stay AFTER /legacy since /legacy is the more specific prefix
```

Mount-order rule (same class of bug fixed twice already in this epic sequence):
`/legacy` is a literal path segment, not a param, so Express matches it
unambiguously regardless of order in this specific case — but mount it before the
generic `/api/vnext/results/kpi` router anyway, for consistency with every other
sub-router in this domain and to avoid relying on a subtlety a future edit could
break.

---

## 9. Monitoring (§C, minimal)

No new dashboard. Add one label to the existing `metricsService.ts` counter
infrastructure (read that file to find the existing `httpRequestDurationSeconds`
or equivalent counter definition and follow its exact registration pattern) OR add
a single new counter:

```ts
export const resultsVnextLegacyArchiveHitsTotal = new Counter({
  name: 'results_vnext_legacy_archive_hits_total',
  help: 'Requests served by the KPI legacy archive read-only adapter, by source table',
  labelNames: ['source_table'],
});
```

Incremented once per successful response in each route handler
(`resultsVnextLegacyArchiveHitsTotal.inc({ source_table: 'kpis' })` etc.). This is
the entire monitoring scope — no dashboard, no alerting rule. If usage ever
warrants a dashboard, that's a separate, later ticket.

---

## 10. RN-G2 note (not implemented here, informational only)

`/kpi-okr` (`routeConfig.ts:123`) is a permanent, intentional redirect alias to
`/results` (`AppRoutes.tsx`, `RedirectPreservingQuery`) — this is deliberate,
documented in its own inline comment, and **not to be touched** by this epic. When
RN-G2 builds the Registry shell and registers `/results/kpi`, it should decide
then whether `/kpi-okr` should redirect to `/results/kpi` instead of `/results` —
a UI-layer product decision, out of scope here. `src/components/ResultsVNext/`
does not exist yet (confirmed empty) — RN-G2 is fully greenfield for the frontend.

---

## 11. File list (backend only)

**New:**
- `server/src/routes/resultsVnext/kpiLegacyArchive.routes.ts`
- `server/src/services/resultsVnext/kpi/kpiLegacyArchiveRepository.ts`
- `server/src/validators/resultsVnextKpiLegacy.validators.ts`
- `server/src/middleware/readOnlyGuard.middleware.ts`
- `tests/resultsVnext/kpi/kpiLegacyArchive.routes.test.ts`
- `tests/resultsVnext/kpi/legacyIsolation.realdb.test.ts`

**Changed:**
- `server/src/Gateway.ts` (import + mount)
- `server/src/services/metricsService.ts` (one new counter, §9)
- `docs/product/results-vnext/EXECUTION_LEDGER.md` (append closure entry + KPI-E007b backlog note per D2)
- `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` (update KPI-F-032..037 rows from `NOT_IMPLEMENTED`)

**Read-only reference (do not modify):**
- `server/src/routes/resultsVnext/kpi.routes.ts`, `kpiPerspectives.routes.ts` — pattern source (imports, envelope shape, 404 shape)
- `server/src/services/resultsVnext/kpi/kpiRepository.ts` — pooled-client acquisition helper, isolation proof
- `server/src/services/v8/resultsROIService.ts` — query-shape source for D1
- `server/src/services/tablePlatform/GovernedModelService.ts` — org-scoping column verification for `tp_kpi_definitions`
- `tests/resultsVnext/kpi/kpiIdentityAcrossSurfaces.realdb.test.ts` — test skeleton source
- `server/src/middleware/demoGuard.middleware.ts` — pattern source only, not modified

---

## 12. Mandatory testing discipline (standing rule, repeated per package)

Every new repository function in `kpiLegacyArchiveRepository.ts` must be exercised
by the real-DB test in §6, not only indirectly through a mocked route test. Do not
`vi.mock` the repository module in `kpiLegacyArchive.routes.test.ts` and call that
sufficient — §7's route test intentionally needs no DB (it only proves the 405
gate), and §6's realDB test is what proves the actual queries work and the actual
isolation holds. Both files are required; neither substitutes for the other.

## 13. Definition of done

- [ ] All 9 endpoints return correctly-shaped envelopes for a real org with real rows in each of the 4 legacy tables (including a real check of which `v8_kpi_definitions` schema resolves per D1 — evidenced with a `psql \d` or `information_schema.tables` query pasted into the ledger entry, not assumed)
- [ ] `tsc --noEmit` clean on the whole repo (not just the new files)
- [ ] §6 and §7 tests both pass on real ephemeral Postgres (`RUN_DB_TESTS=1`)
- [ ] Full existing KPI test suite (215 tests as of KPI-E006) still green — before/after diff evidence per the standing regression-proof discipline
- [ ] EXECUTION_LEDGER.md closure entry written (design → build → verify, honest about any deviation from this doc, same as every prior KPI epic)
- [ ] EPIC_LEDGER_LIVE.md KPI-F-032..037 rows updated
- [ ] No `router.post/put/patch/delete` anywhere in `kpiLegacyArchive.routes.ts` (statically enforced by §7)
