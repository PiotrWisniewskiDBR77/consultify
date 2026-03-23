# CP-11 Postgres Compatibility Report

> **Packet:** CP-11 — Postgres Dialect Adaptation  
> **Type:** Analysis-only (no code changes)  
> **Date:** 2026-03-23  
> **Scope:** All V8 service files in `server/src/services/v8/*.ts` (excluding `__tests__/`)

---

## Summary

| Metric | Count |
|--------|-------|
| Service files scanned | 36 |
| Service files with issues | 34 |
| Files already Postgres-adapted | 2 (`featureFlagService.ts`, `shadowModeService.ts` — partial) |
| Total DML issues (service code) | ~1 140 |
| P0 (blocks production) | ~1 138 (`?` placeholders across 33 files + 1 `datetime()` + 2 `json_extract()`) |
| P1 (blocks specific feature) | 1 (LIKE case-sensitivity) |
| P2 (cosmetic / DDL-only) | ~180 (`datetime('now')` in migrations — handled by runner) |

### Critical finding: DbPromise does NOT translate placeholders

`server/src/utils/DbPromise.ts` passes SQL strings and param arrays directly to the underlying database driver with **zero transformation**. It does not convert `?` → `$1`. This means every `?` placeholder in service code will fail at runtime against Postgres.

The migration runner (`server/scripts/v8-migrate.ts`) transforms `datetime('now')` → `CURRENT_TIMESTAMP` in DDL only. Runtime queries in service code are **not** covered.

---

## Adapted files (reference)

These files already use `$N` Postgres-style placeholders:

| File | Status | Remaining issues |
|------|--------|-----------------|
| `featureFlagService.ts` | Fully adapted | None — uses `$1`…`$6`, `ON CONFLICT … DO UPDATE` |
| `shadowModeService.ts` | Mostly adapted | **1 × `datetime('now', '-24 hours')`** at ~L146 (P0) |

---

## Issues by file

### server/src/services/v8/shadowModeService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `datetime('now', '-24 hours')` in SELECT WHERE | ~L146 | `NOW() - INTERVAL '24 hours'` | DML | **P0** |

### server/src/services/v8/reportsPresModelService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×92) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |
| 2 | `json_extract(quality_scores, '$.overallScore')` | ~L844 | `(quality_scores::jsonb)->>'overallScore'` or `quality_scores::jsonb #>> '{overallScore}'` | DML | **P0** |
| 3 | `json_extract(quality_scores, '$.overallScore')` in WHERE | ~L848 | Same as above | DML | **P0** |
| 4 | `CAST(… AS REAL)` | ~L844 | `CAST(… AS DOUBLE PRECISION)` or `::float8` — `REAL` works in Postgres but maps to `float4` (lower precision) | DML | **P2** |

### server/src/services/v8/concurrentEditingService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×117) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/resultsROIService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×96) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/toolGovernanceService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×95) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/replayDeadLetterService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×94) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/multiplayerHardeningService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×91) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |
| 2 | `LIKE ?` with JSON pattern | ~L854 | `LIKE $3` — note: Postgres LIKE is case-sensitive by default (SQLite is case-insensitive for ASCII). Consider `ILIKE` if case-insensitive matching is intended. | DML | **P1** |

### server/src/services/v8/versionReplayService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×80) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/pmSyncTruthService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×80) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/financeIntegrationService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×79) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/workspaceAIFacilitationService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×77) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/collaborationRoomService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×78) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/executionSpineService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×76) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/operatorAdminService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×76) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/publishReviewService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×63) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/workspaceCrossModuleService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×62) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/pmSyncAuthService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×61) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/promptOsRuntimeService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×56) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/toolCollaborationService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×57) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/toolsOrgAdminService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×54) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/trustAuditService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×63) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/executionVisibilityService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×51) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/workspaceGovernanceService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×51) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/planningContinuityService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×50) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/workspaceCollaborationService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×49) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/sourceTruthService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×48) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/landingSuperadminService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×48) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/myWorkRoofService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×37) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/contextSnapshotService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×36) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/governedRetrievalService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×34) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/knowledgeRetrievalService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×29) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/platformHealthService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×24) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/chatExecutionService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×23) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/contextConsumerBindingService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×11) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/aiOperatingEnvironmentService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| 1 | `?` placeholders (×9) | throughout | `$1`, `$2`, … `$N` | DML | **P0** |

### server/src/services/v8/featureFlagService.ts
| # | Pattern | Line | Postgres equivalent | Type | Priority |
|---|---------|------|---------------------|------|----------|
| — | No issues | — | Already uses `$1`…`$6` | — | — |

---

## Migration files (DDL)

All 45 migration files in `server/migrations/20260323_v8_*.sql` use `datetime('now')` in `DEFAULT` clauses. The migration runner (`v8-migrate.ts`) transforms these to `CURRENT_TIMESTAMP` at apply time.

| Issue | Affected files | Status |
|-------|---------------|--------|
| `datetime('now')` in DEFAULT clauses | All 45 migration files (~180 occurrences) | **Handled** by `transformSqliteToPostgres()` in `v8-migrate.ts` |
| `INTEGER DEFAULT 0/1` for booleans | 20 migration files (~45 columns) | **Works** in Postgres — `INTEGER` is valid. P2 cosmetic: could use `BOOLEAN DEFAULT FALSE/TRUE` |
| `REAL` type for decimals | 6 migration files (~12 columns) | **Works** in Postgres — maps to `float4`. P2: consider `DOUBLE PRECISION` or `NUMERIC` for financial data |
| `TEXT` for timestamps | All 45 migration files | **Works** in Postgres — but loses native `TIMESTAMPTZ` benefits (indexing, comparison, timezone). P2 cosmetic |
| `TEXT` for JSON columns | ~15 migration files | **Works** in Postgres — but loses native `JSONB` benefits (indexing, operators, validation). P2 cosmetic |
| No `AUTOINCREMENT` usage | 0 files | N/A — all tables use TEXT UUIDs as PKs |

### Migration issues NOT handled by the runner

| Issue | Details | Fix needed |
|-------|---------|-----------|
| No `search_path` in SQL files | Migration runner sets `search_path` programmatically, but SQL files don't include `SET search_path` | None — runner handles this |
| `ALTER TABLE … ADD COLUMN` without `IF NOT EXISTS` | Runner transforms these automatically | None — runner handles this |

---

## Cross-cutting patterns

### 1. `?` placeholder → `$N` (P0 — blocks ALL queries)

**Scope:** 33 service files, ~1,135 total `?` placeholders in SQL queries.

**Root cause:** `DbPromise.ts` wraps the SQLite3 `better-sqlite3` / `sqlite3` driver which uses `?` positional placeholders. Postgres (`pg` / `node-postgres`) requires `$1`, `$2`, etc.

**Impact:** Every `SELECT`, `INSERT`, `UPDATE`, `DELETE` query in these 33 files will throw a syntax error on Postgres.

**Fix approach options:**
- **Option A (per-file):** Manually rewrite each query to use `$1`…`$N`. Safe, explicit, but labor-intensive (~1,135 replacements).
- **Option B (DbPromise adapter):** Add a `?` → `$N` auto-translation layer inside `DbPromise.ts` before passing SQL to the Postgres driver. A single regex replacement `sql.replace(/\?/g, (_, i) => '$' + (i + 1))` with a counter. Risk: `?` inside string literals or `??` (JSON operators in Postgres).
- **Recommended:** Option B as a bridge, then Option A incrementally. The bridge lets all 33 files work immediately.

### 2. `datetime()` SQLite function (P0 — 1 occurrence in DML)

**Scope:** 1 service file (`shadowModeService.ts` ~L146).

**Pattern:** `datetime('now', '-24 hours')` in a WHERE clause.

**Postgres equivalent:** `NOW() - INTERVAL '24 hours'`

### 3. `json_extract()` SQLite function (P0 — 2 occurrences in DML)

**Scope:** 1 service file (`reportsPresModelService.ts` ~L844, ~L848).

**Pattern:** `json_extract(column, '$.path')` — SQLite JSON1 extension function.

**Postgres equivalent:** `column::jsonb->>'path'` or `column::jsonb #>> '{path}'`

### 4. `LIKE` case sensitivity (P1 — 1 occurrence)

**Scope:** 1 service file (`multiplayerHardeningService.ts` ~L854).

**Pattern:** `metadata LIKE ?` with a JSON substring pattern.

**Postgres behavior:** `LIKE` is case-sensitive in Postgres (case-insensitive in SQLite for ASCII). Since this matches JSON content which is typically case-exact, this is likely fine. But if case-insensitive matching is needed, use `ILIKE`.

### 5. `INTEGER` for booleans (P2 — cosmetic)

**Scope:** Service code uses `= 1` / `= 0` comparisons for boolean columns (~50 occurrences across service files). Postgres `INTEGER` accepts these, but native `BOOLEAN` with `= TRUE` / `= FALSE` is idiomatic.

### 6. `ON CONFLICT … DO UPDATE` (OK — compatible)

**Scope:** `featureFlagService.ts`, `myWorkRoofService.ts` (3 occurrences).

**Status:** This is standard SQL (UPSERT) supported by both SQLite 3.24+ and Postgres 9.5+. No change needed.

### 7. `BEGIN TRANSACTION` (OK — compatible with caveat)

**Scope:** `DbPromise.ts` uses `BEGIN TRANSACTION` in its `transaction()` method.

**Status:** Postgres accepts `BEGIN TRANSACTION` but the idiomatic form is just `BEGIN`. Works as-is.

---

## Recommended fix strategy

### Phase 1 — Unblock production (P0)

1. **Add `?` → `$N` translation in DbPromise.ts** — A single function that rewrites `?` placeholders to `$1`, `$2`, etc. before passing to the Postgres driver. This unblocks all 33 service files in one change.

2. **Fix `datetime('now', '-24 hours')` in `shadowModeService.ts`** — Replace with `NOW() - INTERVAL '24 hours'`. Single-line change.

3. **Fix `json_extract()` in `reportsPresModelService.ts`** — Replace with Postgres JSONB operators. Two-line change.

### Phase 2 — Harden (P1)

4. **Audit `LIKE` usage in `multiplayerHardeningService.ts`** — Verify case-sensitivity requirements and switch to `ILIKE` if needed.

5. **Incrementally convert `?` → `$N` per file** — Even with the DbPromise bridge, converting files to native `$N` placeholders removes the translation overhead and makes code Postgres-native. Prioritize high-traffic services first.

### Phase 3 — Polish (P2)

6. **Consider `BOOLEAN` columns** — Migrate `INTEGER DEFAULT 0/1` to `BOOLEAN DEFAULT FALSE/TRUE` in DDL and update service code comparisons.

7. **Consider `TIMESTAMPTZ` columns** — Migrate `TEXT` timestamp columns to `TIMESTAMPTZ` for native date operations and indexing.

8. **Consider `JSONB` columns** — Migrate `TEXT` JSON columns to `JSONB` for native JSON indexing and operators.

9. **Consider `DOUBLE PRECISION` / `NUMERIC`** — Migrate `REAL` columns to appropriate precision types, especially for financial data in `financeIntegrationService.ts` and `resultsROIService.ts`.

---

## File-level summary table

| File | `?` count | `datetime()` | `json_extract()` | `LIKE` | Priority |
|------|-----------|-------------|------------------|--------|----------|
| concurrentEditingService.ts | 117 | — | — | — | P0 |
| resultsROIService.ts | 96 | — | — | — | P0 |
| toolGovernanceService.ts | 95 | — | — | — | P0 |
| replayDeadLetterService.ts | 94 | — | — | — | P0 |
| reportsPresModelService.ts | 92 | — | 2× | — | P0 |
| multiplayerHardeningService.ts | 91 | — | — | 1× | P0+P1 |
| versionReplayService.ts | 80 | — | — | — | P0 |
| pmSyncTruthService.ts | 80 | — | — | — | P0 |
| financeIntegrationService.ts | 79 | — | — | — | P0 |
| collaborationRoomService.ts | 78 | — | — | — | P0 |
| workspaceAIFacilitationService.ts | 77 | — | — | — | P0 |
| executionSpineService.ts | 76 | — | — | — | P0 |
| operatorAdminService.ts | 76 | — | — | — | P0 |
| publishReviewService.ts | 63 | — | — | — | P0 |
| trustAuditService.ts | 63 | — | — | — | P0 |
| workspaceCrossModuleService.ts | 62 | — | — | — | P0 |
| pmSyncAuthService.ts | 61 | — | — | — | P0 |
| toolCollaborationService.ts | 57 | — | — | — | P0 |
| promptOsRuntimeService.ts | 56 | — | — | — | P0 |
| toolsOrgAdminService.ts | 54 | — | — | — | P0 |
| executionVisibilityService.ts | 51 | — | — | — | P0 |
| workspaceGovernanceService.ts | 51 | — | — | — | P0 |
| planningContinuityService.ts | 50 | — | — | — | P0 |
| workspaceCollaborationService.ts | 49 | — | — | — | P0 |
| sourceTruthService.ts | 48 | — | — | — | P0 |
| landingSuperadminService.ts | 48 | — | — | — | P0 |
| myWorkRoofService.ts | 37 | — | — | — | P0 |
| contextSnapshotService.ts | 36 | — | — | — | P0 |
| governedRetrievalService.ts | 34 | — | — | — | P0 |
| knowledgeRetrievalService.ts | 29 | — | — | — | P0 |
| platformHealthService.ts | 24 | — | — | — | P0 |
| chatExecutionService.ts | 23 | — | — | — | P0 |
| contextConsumerBindingService.ts | 11 | — | — | — | P0 |
| aiOperatingEnvironmentService.ts | 9 | — | — | — | P0 |
| shadowModeService.ts | 0 (uses $N) | 1× | — | — | P0 |
| featureFlagService.ts | 0 (uses $N) | — | — | — | ✅ OK |

---

## Appendix: DbPromise placeholder translation proposal

```typescript
function translatePlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}
```

**Caveats:**
- Must not replace `?` inside string literals (e.g., `'what?'`). A simple regex is safe if no service code embeds `?` in SQL string constants — verified: none do.
- Postgres `??` is the JSONB "has key" operator. If future code uses `??`, the translation must skip it. Currently no `??` usage exists.
- The `?` Postgres JSONB "has key" operator (single `?`) would conflict. Currently no JSONB operators are used in service code.
