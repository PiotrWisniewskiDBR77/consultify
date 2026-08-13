/**
 * CLOSEOUT-CO7 — the `organizations` fixture precondition for the KPI realdb
 * suites, as ONE implementation shared with ROI.
 *
 * WHY THIS EXISTS. On a fully-migrated Postgres, `initiatives.organization_id`
 * carries a real FK (`initiatives_organization_id_fkey`) to `organizations(id)`.
 * The KPI realdb suites open their `beforeAll` with a defensive
 * `CREATE TABLE IF NOT EXISTS initiatives (...)` — a three-column stub for the
 * resultsVnext-slice-only schema. Against the real schema that statement is a
 * silent no-op: the table already exists, WITH the FK. A suite that then
 * inserts an initiative without first creating its organization row fails with
 * a 23503, and the stub in its own `beforeAll` makes the failure look like a
 * schema problem rather than the missing precondition it is.
 *
 * WHY A RE-EXPORT AND NOT A SECOND COPY. CLOSEOUT-CO5 already solved exactly
 * this for eighteen ROI suites and put the INSERT in one place
 * (`../roi/roiRealdbOrgFixture.ts`). The behaviour KPI needs is identical to the
 * character — an `INSERT INTO organizations … ON CONFLICT (id) DO NOTHING` — so
 * duplicating it here would recreate the very duplication CO5 removed and give
 * the next `organizations` schema change two places to find instead of one.
 * What KPI does NOT want is the name: importing `ensureRoiFixtureOrganization`
 * into suites that have nothing to do with ROI would be the same readability
 * lie CO5 rejected when it declined to import the "…Pir…" module into non-PIR
 * suites. So the implementation stays single and the alias is local: this file
 * is the only place in `kpi/` that names `roi/`, and every KPI call site reads
 * `ensureKpiFixtureOrganization`.
 *
 * The genuinely clean end state is one fixture at the `tests/resultsVnext/`
 * level that both `roi/` and `kpi/` re-export; that move touches `roi/` and is
 * out of this task's allowlist, so it is left as a follow-up.
 *
 * NOT a `.test.ts` file — vitest never collects it.
 */
export { ensureRoiFixtureOrganization as ensureKpiFixtureOrganization } from '../roi/roiRealdbOrgFixture.js';
