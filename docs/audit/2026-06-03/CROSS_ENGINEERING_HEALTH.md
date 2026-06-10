# Engineering Health Audit — Cross-Cutting
**Date:** 2026-06-03 | **Branch:** feat/wave1-foundations | **Baseline:** docs/audit/2026-06-02/CROSS_BUILD_TEST_HEALTH.md

---

## Scorecard

| Risk | Severity | Status vs Baseline |
|---|---|---|
| Schema-bootstrap drift (195 orphan tables) | CRITICAL | Unchanged — 57 of 195 patched by 900_hotfix, ~138 remain |
| SQL dialect portability (NOW/LATERAL/cast) | HIGH | Worsened — 477 NOW() calls, 12+ LATERAL, 58 Pg casts |
| Server tsc --noCheck (type errors ship silently) | HIGH | Unchanged |
| Inbox/my-work sequential N+1 queries | HIGH | Unchanged |
| Frontend @ts-nocheck reduction | MED | Improved: 207→5 files |
| api.test.ts circuit-breaker failures | MED | Fixed: 5 failures→0 (junit 2026-06-03) |
| Component test glob broken (0 tests) | MED | Unchanged |
| 446 non-pattern migration files silently skipped | MED | Unchanged structural issue |

---

## 1. Type Safety

**Server:** `server/package.json` build script remains `tsc --noCheck`. Production build on Railway emits JS without any type validation. The `type-check:backend` script exists but is only invoked in the CI `lint-typecheck` job, not the build path. Server @ts-nocheck count: **127 files** (unchanged from baseline ~127).

**Frontend:** Improved substantially. `src/` @ts-nocheck files dropped from 207→**5** (recent commit: `refactor(types): reduce frontend @ts-nocheck 66→4`). Current `src/services/api.ts` has one uncommitted modification (timeout wrapper, line ~4137) — still clean of @ts-nocheck.

**Fix:** Add `tsc --noEmit` as a pre-build step in `server/package.json` or remove `--noCheck`. Priority: before GA.

---

## 2. CI Lint

ESLint gate (`npm run lint`) remains green per CI. No new error-level suppressions detected in wave1 routes. Server-side `eslint-disable` count: 32 (stable). The 250 server TODO/FIXME markers are unchanged — high debt density in wave services.

**At-risk:** `server/src/routes/rollout.routes.ts` and `benefits.routes.ts` were added in wave1 with Postgres-only SQL; no lint rule catches dialect issues.

---

## 3. Tests

**Unit tests (junit.xml, 2026-06-03):** 17 suites / 53 tests, **0 failures**. The `api.test.ts` mock-contract bug (5 failures in baseline) is resolved — `clearGlobalTransportFailure` now correctly exported.

**E2E smoke:** `e2e-results.xml` is from 2026-06-02 (2 failures: initiative-wizard-modal selector + finance lane timeout). No new run artifact since wave1 commits. The 2 failures remain open.

**Component tests:** `tests/components/junit.xml` still reports 0 suites / 0 tests (`success: false`). Component test CI job is effectively dead. 1,924 component `.tsx` files have ~2.75% direct test coverage.

**New tests from wave1:** 0 new `.spec.ts` files added since baseline (confirmed by `find -newer` check). Modules 02, 04, 05, 06, 10, 13 shipped features without new smoke tests.

**Vitest include globs:** The `tests/` directory has a `/tests/` gitignore entry, but 2,369 test files remain tracked. New integration/unit tests in those dirs are picked up by CI only on `main`/`develop` branch pushes — PRs to `feat/*` branches skip unit/integration/E2E gates entirely.

---

## 4. DB Dialect Portability Bugs

The codebase runs Postgres in production but SQLite in some dev/test paths. Postgres-only constructs found:

| Construct | Count | Hot files |
|---|---|---|
| `NOW()` | **477** total (141 routes, 295 services, rest migrations) | `partners.routes.ts` (13×), `syncHub.routes.ts` (8×), `rollout.routes.ts` (5×, new wave1), `benefits.routes.ts` (0, but via LATERAL) |
| `LEFT JOIN LATERAL` | **12** | `benefits.routes.ts:81,88,96` (3×, new wave1), `resultsROIService.ts:1550,1557,1565`, `kpiReportSnapshotService.ts:122,129`, `virtualWorkerConversationLogger.ts:623,637,650,663` |
| `CROSS JOIN LATERAL` | 4 | `virtualWorkerConversationLogger.ts:623–663` |
| `gen_random_uuid()` | **15 services + routes** | `syncHub.routes.ts:71`, `executionControl.routes.ts:223,628,744,869` |
| `::text / ::int / ::jsonb` cast | **58** | `syncHub.routes.ts:71`, `module-interest.routes.ts:148`, `public-outreach.routes.ts:62,144`, `adminIntegrations.routes.ts:66,67` |
| `ILIKE` | **23** | scattered across search routes |
| `ON CONFLICT DO UPDATE` | **76** | widespread — upsert patterns throughout |

**Fix:** If SQLite is retired, no fix needed — document Postgres-only requirement. If SQLite dev path is still real, introduce a `db.now()` helper and dialect-safe cast wrappers. The `LATERAL` joins in `benefits.routes.ts` (new, wave1) are the highest-risk because benefits data is core to the demo.

---

## 5. Schema-Drift / Migration Runner

**Runner pattern:** `DatabaseInitializer.ts:3103` filters to `/^(7\d{2}|\d{8})_.*\.sql$/`. This means only files with a 3-digit `7xx` prefix or 8-digit date prefix are run on startup.

**Skipped files in flat `server/migrations/`:**
- **61 `.sql.sql` double-extension files** (e.g. `001_upgrade_tasks.sql.sql`) — runner skips all.
- **385 single-SQL files** with `000–699` prefixes (e.g. `052_ab_testing.sql`, `253_mywork_system.sql`) — runner skips all.
- **Non-pattern names** (`add_mywork_tables.sql`, `fix_conversations_table.sql`, `init-pgvector.sql`) — runner skips all.

**Total skip:** ~446 of ~700 flat files are never run by `runTablePlatformMigrations()`.

**Hotfix coverage:** `900_prod_missing_tables_hotfix.sql` (run by the runner, pattern matches) patches **57 tables** with `CREATE TABLE IF NOT EXISTS`. The baseline audit identified **195 orphan tables** — meaning ~138 remain uncovered on a fresh Postgres DB.

**Wave1 new migrations (9 files):** All 9 use `20260602_` / `20260603_` / `20260608_` prefixes — **all match the runner pattern and will be applied correctly**. No placement regression introduced by wave1.

**Fix:** The 900_hotfix pattern is the right model — needs to cover the remaining ~138 orphan tables. The DRAFT consolidation migration (`docs/audit/2026-06-03/` reference) is parked and should be promoted to a `901_consolidation.sql` file.

---

## 6. Performance — N+1 Queries

The `/api/my-work/inbox` route (`my-work.routes.ts:1398`) issues **6+ sequential `await` DB calls** before building the inbox payload — no `Promise.all` wrapping:
- `requireTables` check (1 query)
- `queryAll` triage rows (line ~1412)
- `queryAll` overdue tasks (line ~1445)
- `queryAll` blocked tasks (line ~1465)
- `queryAll` assigned open tasks (line ~1494)
- `getTableColumns('decisions')` (line ~1524)
- `queryAll` pending decisions (line ~1529)
- `getTableColumns('notifications')` (line ~1545)
- `queryAll` notifications (line ~1563)

All 8–9 queries are serial. The dev log baseline (13–42 queries/request, 1.4s) is explained by this pattern plus the per-item loops at lines `1607`, `1646`, `1690`, `1729`, `1760` (no DB query in those loops — just in-memory transforms, so not true N+1, but the serial pre-fetch is the bottleneck).

**True loop-N+1 risk:** `my-work.routes.ts:6963–6996` contains nested `for (const keyword of keywords)` → `for (const p of pages)` / `for (const t of tasks)` patterns (in-memory, not DB calls — lower risk but worth profiling).

**Fix:** Wrap the 6+ inbox pre-fetch queries in `Promise.all([...])` — straightforward parallelization with no ordering dependency. Estimated improvement: 400–700ms on cold paths.

---

## 7. Security

**GDPR deletion-request:** `gdpr.routes.ts:27` applies `router.use(verifyToken)` to all routes including `/deletion-request` (line 534). The route is JWT-gated — the concern from the prior audit (unguarded) is **not confirmed**. No password re-confirmation before deletion request submission remains a UX/business risk but not an auth bypass.

**Admin-data routes:** `admin-data.routes.ts:44` applies `verifyToken` but no role-based guard (`requireAdmin`/`is_admin`) was found. Any authenticated user can hit `PUT /api/admin-data/user-tiers/:orgId/:userId` (line 94). This is an **authorization gap** — authentication without authorization on admin mutation endpoints.

**No hardcoded secrets detected.** No demo backdoors or `SKIP_AUTH` patterns found in routes.

**Redis:** `REDIS_URL` env validation exists (`envValidator.ts:60`). No structural misconfiguration found in code.

---

## Top 5 Fixes Ranked

1. **[CRITICAL] Migrate remaining ~138 orphan tables** — Promote the parked consolidation migration to `server/migrations/901_orphan_consolidation.sql`. Fresh Postgres DB is missing ~138 tables that server code references. Blocks GA on any clean deployment.

2. **[HIGH] Add role check to admin-data mutation routes** — `admin-data.routes.ts`: add `requireAdmin` middleware after `verifyToken` on all `PUT`/`DELETE` routes. Any authenticated user currently has admin write access.

3. **[HIGH] Remove `--noCheck` from server build** — `server/package.json`: change `"build": "tsc --noCheck"` to prepend a `tsc --noEmit` gate. Type errors currently ship silently to Railway.

4. **[HIGH] Parallelize inbox pre-fetch queries** — `my-work.routes.ts:1398–1570`: wrap the 6–9 sequential `await` calls in `Promise.all`. Resolves the documented 1.4s slow path.

5. **[MED] Fix component test glob** — `tests/components/` vitest config is broken (0 tests run). Restore so CI reports real component coverage instead of false-green 0/0.
