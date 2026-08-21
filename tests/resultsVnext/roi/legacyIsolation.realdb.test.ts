/**
 * ROI-E008 — Legacy Archive isolation contract test (design §3/B2).
 *
 * Proves the vNext read models (`roiRepository.listRoiCases`,
 * `roiOrgPerspectiveRepository.listOrganizationRoiPirOutcomes`) NEVER
 * surface a row from any of the 7 legacy/parallel ROI tables (design §B0's
 * inventory: `analysis_financials`, `digitization_analyses`,
 * `initiative_benefits`, `roi_assumptions`, `roi_realized_values`,
 * `benefits_register`, `v8_roi_realization_entries`), even when a poisoned
 * row in each of those tables shares the same `organization_id`.
 *
 * Skeleton mirrors `tests/resultsVnext/kpi/legacyIsolation.realdb.test.ts`
 * (KPI-E007) — `DB_CONFIGURED` skip-gate, raw `pg.Client`, control+poison+
 * assert+cleanup — with the control-fixture half delegated to ROI-E006's
 * own `roiPirRealdbFixtures.ts` (`buildCaseThroughTracking` etc.) rather
 * than duplicated inline.
 *
 * -- DEVIATION FOUND ON REAL POSTGRES (not in the design doc, not
 * guessable from a git worktree — same class of gap KPI-E007 found for the
 * `kpis` view): `analysis_financials` (one of the 7 legacy tables in scope,
 * defined in `server/migrations/068_economics_analysis_financials.sql`)
 * does NOT exist on a fresh, strictly-migrated Postgres database at all.
 * `server/scripts/migrate.postgres.ts`'s `isSqliteOnlyMigration()` blanket-
 * excludes every NUMBERED migration with version < 500 unless it is
 * explicitly listed in `PROMOTED_LEGACY_PRODUCERS` (the same mechanism that
 * promotes `081_studio_tables.sql`/`073_conversations.sql`/etc. back into
 * the strict run) — `068_economics_analysis_financials.sql` (version 68) is
 * NOT on that list, so it is silently skipped, not even attempted, on every
 * strict/fresh Postgres build. `digitization_analyses` (design's
 * `analysis_financials.analysis_id` FK target) is unaffected — despite
 * ALSO being defined by a <500 numbered file (`060_digitization_analyses
 * .sql`, also excluded), it is separately, fully created by the DATED
 * `20260628_ensure_digitization_analyses.sql` migration (with a genuine
 * TEXT `organization_id`, confirmed against the live catalog — a second,
 * independent correction to what a naive read of the numbered file alone
 * would suggest). This is a genuine, pre-existing schema-migration gap,
 * unrelated to ROI-E008 and out of scope to fix here (changing
 * `PROMOTED_LEGACY_PRODUCERS` is migration-infra surface, not this epic's
 * backend feature surface) — flagged for separate follow-up. To still prove
 * `roiLegacyArchiveRepository.ts`'s `analysis_financials` functions work
 * correctly against the table's REAL column layout (not a guessed one),
 * this suite creates the table itself in `beforeAll`, using the ACTUAL
 * `CREATE TABLE`/`CREATE INDEX` statements sliced verbatim out of
 * `068_economics_analysis_financials.sql`, through the SAME narrow
 * `DATETIME` → `TIMESTAMPTZ` shim `migrate.postgres.ts`'s own `applySql()`
 * applies — not a hand-written approximation. On any database where this
 * migration gap is later fixed upstream, `CREATE TABLE IF NOT EXISTS` here
 * is a harmless no-op.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * directory.
 */
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildCaseThroughTracking,
  buildClientConfig,
  DB_CONFIGURED,
  insertInitiative,
  insertOrganization,
  loadRoiPirTestModules,
  type RoiPirTestModules,
} from './roiPirRealdbFixtures.js';
import {
  ensureRoiFixtureMembership,
  ensureRoiGovernedVisibility,
} from './roiRealdbOrgFixture.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `roi-e008-legacy-iso-org-${tag}`;
const USER = `roi-e008-legacy-iso-user-${tag}`;
const APPROVER = `roi-e008-legacy-iso-approver-${tag}`;
const CONTROL_INITIATIVE_ID = `roi-e008-legacy-iso-control-init-${tag}`;
const POISON_INITIATIVE_ID = `roi-e008-legacy-iso-poison-init-${tag}`;

let client: Client;
let reachable = false;
let modules: RoiPirTestModules;

type LegacyRepoModule = typeof import('../../../server/src/services/resultsVnext/roi/roiLegacyArchiveRepository.js');
type RoiRepoModule = typeof import('../../../server/src/services/resultsVnext/roi/roiRepository.js');
type OrgPerspectiveModule =
  typeof import('../../../server/src/services/resultsVnext/roi/roiOrgPerspectiveRepository.js');

let legacyRepo: LegacyRepoModule;
let listRoiCases: RoiRepoModule['listRoiCases'];
let listOrganizationRoiPirOutcomes: OrgPerspectiveModule['listOrganizationRoiPirOutcomes'];

// Poisoned-row identifiers — inserted directly via raw pg.Client, bypassing
// every service in this repo.
const poisonedAnalysisFinancialId = `legacy-af-${tag}`;
const poisonedDigitizationAnalysisId = `legacy-da-${tag}`;
const poisonedInitiativeBenefitId = `legacy-ib-${tag}`;
const poisonedRoiAssumptionId = `legacy-ra-${tag}`;
const poisonedRoiRealizedValueId = `legacy-rv-${tag}`;
const poisonedBenefitsRegisterId = `legacy-br-${tag}`;
const poisonedV8KpiId = `legacy-v8kpi-${tag}`;
const poisonedV8EntryId = `legacy-v8entry-${tag}`;
// analysis_financials.organization_id is INTEGER (see file header DEVIATION
// note) — an arbitrary integer, never equal to any real TEXT organizationId
// when cast, which is exactly the point of this poison row.
const POISON_INT_ORG_ID = 88123456;

/** Slices the real CREATE TABLE/CREATE INDEX statements for
 * `analysis_financials` out of `068_economics_analysis_financials.sql`,
 * applying the SAME narrow DATETIME shim `migrate.postgres.ts`'s own
 * `applySql()` uses — see file header DEVIATION note. */
function ensureAnalysisFinancialsDdl(): string {
  const migrationPath = path.join(REPO_ROOT, 'server/migrations/068_economics_analysis_financials.sql');
  const source = readFileSync(migrationPath, 'utf8');
  const startMarker = 'CREATE TABLE IF NOT EXISTS analysis_financials (';
  const endMarker = '-- Analysis Financial Scenarios';
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error('Could not slice analysis_financials DDL out of 068_economics_analysis_financials.sql');
  }
  let ddl = source.slice(startIdx, endIdx);
  // Identical shim to migrate.postgres.ts's applySql().
  ddl = ddl.replace(/\bDATETIME\b/gi, 'TIMESTAMPTZ');
  return ddl;
}

describe('ROI-E008 legacy isolation (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — ROI-E008 legacyIsolation realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      const database = await client.query<{ current_database: string }>('SELECT current_database()');
      if (!database.rows[0]?.current_database.startsWith('consultify_results_')) {
        throw new Error('ROI legacy-isolation requires an owned consultify_results_* disposable database');
      }
      await client.query('SELECT 1 FROM rvn_roi_cases LIMIT 0');
      await client.query('SELECT 1 FROM digitization_analyses LIMIT 0');
      await client.query('SELECT 1 FROM initiative_benefits LIMIT 0');
      await client.query('SELECT 1 FROM roi_assumptions LIMIT 0');
      await client.query('SELECT 1 FROM roi_realized_values LIMIT 0');
      await client.query('SELECT 1 FROM benefits_register LIMIT 0');
      await client.query('SELECT 1 FROM v8_roi_realization_entries LIMIT 0');
      // analysis_financials — see file header DEVIATION note.
      await client.query(ensureAnalysisFinancialsDdl());
      await client.query('SELECT 1 FROM analysis_financials LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing required schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    modules = await loadRoiPirTestModules();
    legacyRepo = await import('../../../server/src/services/resultsVnext/roi/roiLegacyArchiveRepository.js');
    const roiRepo: RoiRepoModule = await import('../../../server/src/services/resultsVnext/roi/roiRepository.js');
    listRoiCases = roiRepo.listRoiCases;
    const orgPerspective: OrgPerspectiveModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiOrgPerspectiveRepository.js'
    );
    listOrganizationRoiPirOutcomes = orgPerspective.listOrganizationRoiPirOutcomes;

    await insertOrganization(client, ORG_ID, 'ROI-E008 Legacy Isolation Org');
    await ensureRoiFixtureMembership(client, { organizationId: ORG_ID, userId: USER, role: 'OWNER' });
    await ensureRoiFixtureMembership(client, { organizationId: ORG_ID, userId: APPROVER, role: 'ADMIN' });
    await ensureRoiGovernedVisibility({
      organizationId: ORG_ID,
      actorUserId: USER,
      idempotencyKey: `roi-e008-governance-${tag}`,
    });
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    // The fixture deliberately writes an append-only realization entry. Its
    // dependency graph cannot be deleted without defeating the production
    // immutability trigger, so unique test rows live until the mandatory
    // disposable database is destroyed after the evidence run.
    await client.end();
    if (modules.closePgPool) await modules.closePgPool();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB(
    'one real control ROI Case + 7 poisoned legacy rows (same org) — vNext read models see ONLY the control case, never a legacy row',
    async () => {
      // ---- 1. Setup: one real, OPEN_ORG-visible ROI Case through the
      // normal rvn_roi_* command path, driven all the way to 'tracking'. ----
      await insertInitiative(client, CONTROL_INITIATIVE_ID, ORG_ID, 'Legacy isolation control initiative');
      const control = await buildCaseThroughTracking(client, modules, {
        organizationId: ORG_ID,
        initiativeId: CONTROL_INITIATIVE_ID,
        ownerUserId: USER,
        approverId: APPROVER,
        title: 'Legacy isolation control case',
      });

      // ---- 2. Poison: raw pg.Client, bypassing every service, one row per
      // legacy table, same organization_id (or, for analysis_financials,
      // an arbitrary INTEGER — see file header DEVIATION note). ----
      await insertInitiative(client, POISON_INITIATIVE_ID, ORG_ID, 'Legacy isolation poisoned initiative');

      await client.query(
        `INSERT INTO digitization_analyses (id, name, organization_id, initiative_id)
         VALUES ($1, $2, $3, $4)`,
        [poisonedDigitizationAnalysisId, 'Legacy isolation poisoned analysis', ORG_ID, POISON_INITIATIVE_ID]
      );
      await client.query(
        `INSERT INTO analysis_financials (id, analysis_id, organization_id)
         VALUES ($1, $2, $3)`,
        [poisonedAnalysisFinancialId, poisonedDigitizationAnalysisId, POISON_INT_ORG_ID]
      );
      await client.query(
        `INSERT INTO initiative_benefits (id, initiative_id, organization_id, name)
         VALUES ($1, $2, $3, $4)`,
        [poisonedInitiativeBenefitId, POISON_INITIATIVE_ID, ORG_ID, 'Legacy isolation poisoned benefit']
      );
      await client.query(
        `INSERT INTO roi_assumptions (id, initiative_id, organization_id)
         VALUES ($1, $2, $3)`,
        [poisonedRoiAssumptionId, POISON_INITIATIVE_ID, ORG_ID]
      );
      await client.query(
        `INSERT INTO roi_realized_values (id, initiative_id, organization_id, period_month)
         VALUES ($1, $2, $3, $4)`,
        [poisonedRoiRealizedValueId, POISON_INITIATIVE_ID, ORG_ID, '2026-01-01']
      );
      const nowIso = new Date().toISOString();
      await client.query(
        `INSERT INTO benefits_register (id, organization_id, initiative_id, name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [poisonedBenefitsRegisterId, ORG_ID, POISON_INITIATIVE_ID, 'Legacy isolation poisoned register entry', nowIso]
      );
      await client.query(
        `INSERT INTO v8_kpi_definitions (kpi_id, organization_id, name, mode, metric_type, measurement_cadence, status)
         VALUES ($1, $2, $3, 'standalone', 'count', 'monthly', 'active')`,
        [poisonedV8KpiId, ORG_ID, 'Legacy isolation poisoned v8 KPI']
      );
      await client.query(
        `INSERT INTO v8_roi_realization_entries
           (entry_id, organization_id, kpi_id, initiative_id, realized_value, period, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [poisonedV8EntryId, ORG_ID, poisonedV8KpiId, POISON_INITIATIVE_ID, 100, '2026-01', nowIso]
      );

      // ---- 3. Negative assertion: neither vNext read model ever surfaces
      // a poisoned row, by id. ----
      const cases = await listRoiCases({ userId: USER, organizationId: ORG_ID });
      expect(
        cases.length,
        'listRoiCases returned more than the 1 control row — ORG_ID is a fresh unique tag for this test run, ' +
          'so any extra row is either leaked legacy data or a fixture-setup bug'
      ).toBe(1);
      expect(cases[0]!.caseId).toBe(control.caseId);

      const pirOutcomes = await listOrganizationRoiPirOutcomes({ organizationId: ORG_ID, managerId: USER });
      // Scoped to cases with status IN ('post_investment_review','closed')
      // — the control case is still 'tracking', so `.cases` is legitimately
      // empty here; the real assertion is that it is NEVER populated from a
      // legacy row (none of the 7 poisoned tables can produce a
      // `rvn_roi_cases` row for this function to find in the first place).
      expect(Array.isArray(pirOutcomes.cases)).toBe(true);
      expect(pirOutcomes.cases).toHaveLength(0);

      // ---- 4. Positive assertion: the control case MUST appear via
      // listRoiCases (guards against a vacuous pass) — already checked
      // above (cases[0].caseId === control.caseId).

      // ---- 5. Direct correctness proof for roiLegacyArchiveRepository.ts
      // itself (MANDATORY TESTING DISCIPLINE — every new repository
      // function gets a direct real-Postgres assertion, not just an
      // isolation negative). Each function must find exactly the poisoned
      // row it owns, proving the SQL (including the analysis_financials/
      // digitization_analyses ::text cast) is correct against the real
      // column layout. ----
      const afList = await legacyRepo.listLegacyAnalysisFinancials(String(POISON_INT_ORG_ID), 50, 0);
      expect(afList.rows.some((r) => (r as any).id === poisonedAnalysisFinancialId)).toBe(true);
      const afGet = await legacyRepo.getLegacyAnalysisFinancial(String(POISON_INT_ORG_ID), poisonedAnalysisFinancialId);
      expect(afGet).not.toBeNull();

      const daList = await legacyRepo.listLegacyDigitizationAnalyses(ORG_ID, 50, 0);
      expect(daList.rows.some((r) => (r as any).id === poisonedDigitizationAnalysisId)).toBe(true);
      const daGet = await legacyRepo.getLegacyDigitizationAnalysis(ORG_ID, poisonedDigitizationAnalysisId);
      expect(daGet).not.toBeNull();

      const ibList = await legacyRepo.listLegacyInitiativeBenefits(ORG_ID, 50, 0);
      expect(ibList.rows.some((r) => (r as any).id === poisonedInitiativeBenefitId)).toBe(true);
      const ibGet = await legacyRepo.getLegacyInitiativeBenefit(ORG_ID, poisonedInitiativeBenefitId);
      expect(ibGet).not.toBeNull();

      const raList = await legacyRepo.listLegacyRoiAssumptions(ORG_ID, 50, 0);
      expect(raList.rows.some((r) => (r as any).id === poisonedRoiAssumptionId)).toBe(true);
      const raGet = await legacyRepo.getLegacyRoiAssumption(ORG_ID, poisonedRoiAssumptionId);
      expect(raGet).not.toBeNull();

      const rvList = await legacyRepo.listLegacyRoiRealizedValues(ORG_ID, 50, 0);
      expect(rvList.rows.some((r) => (r as any).id === poisonedRoiRealizedValueId)).toBe(true);
      const rvGet = await legacyRepo.getLegacyRoiRealizedValue(ORG_ID, poisonedRoiRealizedValueId);
      expect(rvGet).not.toBeNull();

      const brList = await legacyRepo.listLegacyBenefitsRegister(ORG_ID, 50, 0);
      expect(brList.rows.some((r) => (r as any).id === poisonedBenefitsRegisterId)).toBe(true);
      const brGet = await legacyRepo.getLegacyBenefitsRegisterEntry(ORG_ID, poisonedBenefitsRegisterId);
      expect(brGet).not.toBeNull();

      const v8List = await legacyRepo.listLegacyV8RoiRealizationEntries(ORG_ID, 50, 0);
      expect(v8List.rows.some((r) => (r as any).entry_id === poisonedV8EntryId)).toBe(true);
      const v8Get = await legacyRepo.getLegacyV8RoiRealizationEntry(ORG_ID, poisonedV8EntryId);
      expect(v8Get).not.toBeNull();

      const index = await legacyRepo.getRoiLegacyArchiveIndex(ORG_ID);
      expect(index).toHaveLength(7);
      const bySource = new Map(index.map((row) => [row.sourceTable, row]));
      expect(bySource.get('digitization_analyses')?.count).toBeGreaterThanOrEqual(1);
      expect(bySource.get('initiative_benefits')?.count).toBeGreaterThanOrEqual(1);
      expect(bySource.get('roi_assumptions')?.count).toBeGreaterThanOrEqual(1);
      expect(bySource.get('roi_realized_values')?.count).toBeGreaterThanOrEqual(1);
      expect(bySource.get('benefits_register')?.count).toBeGreaterThanOrEqual(1);
      expect(bySource.get('v8_roi_realization_entries')?.count).toBeGreaterThanOrEqual(1);
      // analysis_financials counted under POISON_INT_ORG_ID, not ORG_ID —
      // its own index row for ORG_ID is legitimately 0 (see DEVIATION note).
      expect(bySource.get('analysis_financials')?.count).toBe(0);
      const afIndex = await legacyRepo.getRoiLegacyArchiveIndex(String(POISON_INT_ORG_ID));
      expect(afIndex.find((row) => row.sourceTable === 'analysis_financials')?.count).toBeGreaterThanOrEqual(1);
    }
  );

  describe('Static — zero legacy-table references in roi *Repository.ts files (excluding roiLegacyArchiveRepository.ts itself)', () => {
    it('no roi/*Repository.ts file (other than roiLegacyArchiveRepository.ts) references any of the 7 legacy table names', () => {
      const roiDir = path.resolve(__dirname, '../../../server/src/services/resultsVnext/roi');
      const files = readdirSync(roiDir).filter(
        (f) => f.endsWith('Repository.ts') && f !== 'roiLegacyArchiveRepository.ts'
      );
      expect(files.length).toBeGreaterThan(0);

      // Word-boundary regex: does NOT match `rvn_roi_*` tables (preceded by
      // `_`, a word character, so `\b` fails right before the legacy name
      // there) — only matches a bare, standalone legacy table name.
      const legacyTableRef =
        /\b(analysis_financials|digitization_analyses|initiative_benefits|roi_assumptions|roi_realized_values|benefits_register|v8_roi_realization_entries)\b/;

      for (const file of files) {
        const fullPath = path.join(roiDir, file);
        const source = readFileSync(fullPath, 'utf8');
        // Exclude comment lines — e.g. roiOrgPerspectiveRepository.ts's own
        // header explicitly DOCUMENTS this same legacy-table-exclusion
        // (ROI-E001 §2's "permanently-excluded set"), which is the intended
        // architectural fact this test proves, not a violation of it. Real
        // reachable-code references (a `FROM`/`JOIN` clause) are never
        // inside a `//`/`*`-prefixed comment line.
        const codeLines = source
          .split('\n')
          .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'));
        const matches = codeLines.join('\n').match(new RegExp(legacyTableRef, 'g')) ?? [];
        expect(matches, `${file} references a legacy table by name: ${JSON.stringify(matches)}`).toEqual([]);
      }
    });
  });
});
