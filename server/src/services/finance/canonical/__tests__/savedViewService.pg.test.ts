/**
 * AP-07 — Saved views (personal/team) + shareable URL, real PostgreSQL
 * integration test.
 *
 * Exercises `savedViewService.ts` against the ACTUAL migrated schema
 * (`finance_saved_views` from this work package, `finance_artifacts` from
 * WP-B01, `finance_analysis_kpi_catalog` from WP-D03), not a hand-rolled
 * schema.
 *
 * Scenario (task brief): a "GoldCo Analysis" (`HISTORICAL_ANALYSIS`)
 * artifact in one organization. Covers:
 *   1. personal view — visible to its owner, invisible to a second user in
 *      the SAME organization;
 *   2. team view — visible to a second user in the SAME organization,
 *      invisible to a user in a DIFFERENT organization (tenant isolation);
 *   3. shareable URL — resolves by opaque token, still gated by the same
 *      org/scope rules as a direct lookup, and never bypasses the
 *      artifact's own organization-scoped authorization;
 *   4. schema migration — a saved view referencing a KPI catalog column
 *      that later gets deprecated still loads (no crash), with the column
 *      explicitly marked unavailable.
 *
 * NOTE on the task brief's literal filter example ("quality=WARNING,
 * entity=PARENT"): this file's `quality` filter reuses AP-00's
 * `financeValueSemantics.ts` vocabulary verbatim, per the task's own
 * instruction ("quality (z financeValueSemantics)") — that vocabulary is
 * `PRESENT_ZERO`/`PRESENT_NONZERO`/`MISSING`/`NA`/`NOT_APPLICABLE`, not
 * `WARNING` (which is a `finance_exceptions`/comment SEVERITY value, a
 * different axis entirely — see `exceptionLedgerService.ts`). This test uses
 * `MISSING` instead, the closest literal match to the brief's intent ("find
 * the cells with a data-quality problem").
 *
 * Same env-var contract as this repo's other `.pg.test.ts` suites
 * (`RUN_DB_TESTS=1`, `MOCK_DB=false`, `DATABASE_URL=postgresql://...`) —
 * `describe.skipIf`-gated so a run with no real database reachable reports
 * SKIPPED, never a false green.
 *
 * HOW TO RUN (against your own throwaway/ephemeral cluster — NEVER against
 * the shared local Postgres or any demo/staging/prod host):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config server/vitest.config.ts \
 *     server/src/services/finance/canonical/__tests__/savedViewService.pg.test.ts \
 *     --no-file-parallelism
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('AP-07 saved views — real PostgreSQL', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let artifactVersionService: typeof import('../artifactVersionService.js');
  let savedViewService: typeof import('../savedViewService.js');
  let GridViewStateCtor: typeof import('../../grid/GridViewState.js').GridViewState;

  const orgId = `org-finv3-ap07-goldco-${randomUUID()}`;
  const otherOrgId = `org-finv3-ap07-other-${randomUUID()}`;

  const ownerUserId = `user-owner-${randomUUID()}`;
  const teammateUserId = `user-teammate-${randomUUID()}`;
  const outsiderUserId = `user-outsider-${randomUUID()}`;

  let goldcoAnalysisArtifactId = '';

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    artifactVersionService = await import('../artifactVersionService.js');
    savedViewService = await import('../savedViewService.js');
    ({ GridViewState: GridViewStateCtor } = await import('../../grid/GridViewState.js'));

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?), (?, ?)`, [
        orgId,
        'GoldCo AP-07 Test Org',
        otherOrgId,
        'Other AP-07 Test Org',
      ])
    );

    const analysis = await artifactVersionService.createArtifact({
      organizationId: orgId,
      artifactType: 'HISTORICAL_ANALYSIS',
      naturalKey: 'goldco-analysis-2026q2',
      createdBy: ownerUserId,
    });
    goldcoAnalysisArtifactId = analysis.artifact.artifact_id;
  });

  afterAll(async () => {
    // Best-effort cleanup, same convention as exceptionInboxService.pg.test.ts /
    // commentReviewService.pg.test.ts — finance_artifacts/finance_business_versions are
    // transitively undeletable once child rows exist (schema guarantee, not a test bug).
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(`DELETE FROM finance_saved_views WHERE organization_id IN (?, ?)`, [orgId, otherOrgId]);
      await tx.queryRun(`DELETE FROM finance_analysis_kpi_catalog WHERE organization_id = ?`, [orgId]);
    });
  });

  function buildGridViewState(): InstanceType<typeof GridViewStateCtor> {
    const state = new GridViewStateCtor();
    state.setFreeze(0, 1);
    state.setColumnPinned('2026-Q1', 'LEFT');
    state.setColumnHidden('2026-Q4', true);
    return state;
  }

  // ---------------------------------------------------------------------------
  // 1. personal view — owner sees it, a second user in the SAME org does not
  // ---------------------------------------------------------------------------

  describe('personal view visibility', () => {
    let personalViewId = '';

    it('create: personal view with structured filters (quality=MISSING, entity=PARENT)', async () => {
      const result = await savedViewService.createSavedView({
        organizationId: orgId,
        artifactId: goldcoAnalysisArtifactId,
        scope: 'PERSONAL',
        ownerUserId,
        createdBy: ownerUserId,
        name: 'My GoldCo missing-data view',
        gridViewState: buildGridViewState(),
        filters: [
          { type: 'quality', values: ['MISSING'] },
          { type: 'entity', values: ['PARENT'] },
        ],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      personalViewId = result.view.id;
      expect(result.view.scope).toBe('PERSONAL');
      expect(result.view.artifact_type).toBe('HISTORICAL_ANALYSIS');
      expect(result.view.view_state.filters).toEqual([
        { type: 'quality', values: ['MISSING'] },
        { type: 'entity', values: ['PARENT'] },
      ]);
      expect(result.view.view_state.gridViewState.columns.find((c) => c.columnId === '2026-Q1')?.pinned).toBe('LEFT');
      expect(result.view.share_token).toBeTruthy();
    });

    it('the owner CAN load it', async () => {
      const loaded = await savedViewService.getSavedView(orgId, personalViewId, ownerUserId);
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) throw new Error('unreachable');
      expect(loaded.view.id).toBe(personalViewId);
    });

    it('a second user in the SAME organization CANNOT load it', async () => {
      const loaded = await savedViewService.getSavedView(orgId, personalViewId, teammateUserId);
      expect(loaded).toEqual({ ok: false, code: 'NOT_FOUND', message: 'Saved view not found' });
    });

    it('listSavedViews: owner sees it, teammate does not', async () => {
      const ownerList = await savedViewService.listSavedViews({ organizationId: orgId, artifactId: goldcoAnalysisArtifactId, requesterUserId: ownerUserId });
      expect(ownerList.map((v) => v.id)).toContain(personalViewId);

      const teammateList = await savedViewService.listSavedViews({
        organizationId: orgId,
        artifactId: goldcoAnalysisArtifactId,
        requesterUserId: teammateUserId,
      });
      expect(teammateList.map((v) => v.id)).not.toContain(personalViewId);
    });

    it('update: only the owner may rename it', async () => {
      const forbidden = await savedViewService.updateSavedView({
        organizationId: orgId,
        viewId: personalViewId,
        requesterUserId: teammateUserId,
        patch: { name: 'Hijacked name' },
      });
      expect(forbidden).toEqual({ ok: false, code: 'FORBIDDEN', message: expect.any(String) });

      const renamed = await savedViewService.updateSavedView({
        organizationId: orgId,
        viewId: personalViewId,
        requesterUserId: ownerUserId,
        patch: { name: 'My GoldCo missing-data view (renamed)' },
      });
      expect(renamed.ok).toBe(true);
      if (!renamed.ok) throw new Error('unreachable');
      expect(renamed.view.name).toBe('My GoldCo missing-data view (renamed)');
      // filters/gridViewState untouched by a name-only patch.
      expect(renamed.view.view_state.filters).toHaveLength(2);
    });

    it('delete: a non-owner cannot delete; the owner can', async () => {
      const forbidden = await savedViewService.deleteSavedView(orgId, personalViewId, teammateUserId);
      expect(forbidden).toEqual({ ok: false, code: 'FORBIDDEN', message: expect.any(String) });

      const deleted = await savedViewService.deleteSavedView(orgId, personalViewId, ownerUserId);
      expect(deleted).toEqual({ ok: true });

      const afterDelete = await savedViewService.getSavedView(orgId, personalViewId, ownerUserId);
      expect(afterDelete.ok).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. team view — teammate (same org) sees it, outsider (different org) does not
  // ---------------------------------------------------------------------------

  describe('team view visibility + tenant isolation', () => {
    let teamViewId = '';
    let teamShareToken = '';

    it('create: team view', async () => {
      const result = await savedViewService.createSavedView({
        organizationId: orgId,
        artifactId: goldcoAnalysisArtifactId,
        scope: 'TEAM',
        ownerUserId,
        createdBy: ownerUserId,
        name: 'Team GoldCo review view',
        gridViewState: buildGridViewState(),
        filters: [{ type: 'changed', changedOnly: true }],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      teamViewId = result.view.id;
      teamShareToken = result.view.share_token;
    });

    it('a teammate in the SAME organization CAN load it (even though they are not the owner)', async () => {
      const loaded = await savedViewService.getSavedView(orgId, teamViewId, teammateUserId);
      expect(loaded.ok).toBe(true);
    });

    it('a user in a DIFFERENT organization CANNOT load it — tenant isolation', async () => {
      const loaded = await savedViewService.getSavedView(otherOrgId, teamViewId, outsiderUserId);
      expect(loaded).toEqual({ ok: false, code: 'NOT_FOUND', message: 'Saved view not found' });
    });

    it('listSavedViews scoped to the other organization never returns it', async () => {
      const otherOrgList = await savedViewService.listSavedViews({
        organizationId: otherOrgId,
        artifactId: goldcoAnalysisArtifactId,
        requesterUserId: outsiderUserId,
      });
      expect(otherOrgList.map((v) => v.id)).not.toContain(teamViewId);
    });

    // ---------------------------------------------------------------------------
    // 3. shareable URL
    // ---------------------------------------------------------------------------

    it('shareable URL: resolves by token for a teammate in the same org', async () => {
      const resolved = await savedViewService.resolveSharedView({
        shareToken: teamShareToken,
        organizationId: orgId,
        requesterUserId: teammateUserId,
      });
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) throw new Error('unreachable');
      expect(resolved.view.id).toBe(teamViewId);
      expect(resolved.view.artifact_id).toBe(goldcoAnalysisArtifactId);
      // Structural proof the resolved payload is the VIEW DEFINITION only — no statement-line/
      // KPI-value business content is present on the row at all (there is no column that could
      // carry it), so a caller physically cannot render grid data from this response alone.
      expect(Object.keys(resolved.view).sort()).toEqual(
        ['artifact_id', 'artifact_type', 'columnAvailability', 'created_at', 'created_by', 'id', 'name', 'organization_id', 'owner_user_id', 'scope', 'share_token', 'updated_at', 'view_state'].sort()
      );
    });

    it('shareable URL: the SAME token resolves to NOT_FOUND for a requester in a different organization — the token does not bypass tenant isolation', async () => {
      const resolved = await savedViewService.resolveSharedView({
        shareToken: teamShareToken,
        organizationId: otherOrgId,
        requesterUserId: outsiderUserId,
      });
      expect(resolved).toEqual({ ok: false, code: 'NOT_FOUND', message: 'Saved view not found' });
    });

    it('shareable URL still requires separate authorization to the artifact itself: fetching the artifact under the correct org succeeds, under a foreign org fails', async () => {
      // A caller who resolved the shared view (previous test) knows goldcoAnalysisArtifactId, but
      // that alone is not authorization to read the artifact's data — the artifact's own org-scoped
      // lookup is a SEPARATE check this service never short-circuits.
      const ownArtifact = await artifactVersionService.getArtifact(orgId, goldcoAnalysisArtifactId);
      expect(ownArtifact).toBeTruthy();

      const foreignLookup = await artifactVersionService.getArtifact(otherOrgId, goldcoAnalysisArtifactId);
      expect(foreignLookup).toBeNull();
    });

    it('shareable URL for a PERSONAL view: only the owner can resolve it, even with a valid token', async () => {
      const personal = await savedViewService.createSavedView({
        organizationId: orgId,
        artifactId: goldcoAnalysisArtifactId,
        scope: 'PERSONAL',
        ownerUserId,
        createdBy: ownerUserId,
        name: 'Personal share-token probe view',
        gridViewState: buildGridViewState(),
      });
      expect(personal.ok).toBe(true);
      if (!personal.ok) throw new Error('unreachable');

      const byOwner = await savedViewService.resolveSharedView({
        shareToken: personal.view.share_token,
        organizationId: orgId,
        requesterUserId: ownerUserId,
      });
      expect(byOwner.ok).toBe(true);

      const byTeammate = await savedViewService.resolveSharedView({
        shareToken: personal.view.share_token,
        organizationId: orgId,
        requesterUserId: teammateUserId,
      });
      expect(byTeammate).toEqual({ ok: false, code: 'NOT_FOUND', message: 'Saved view not found' });
    });
  });

  // ---------------------------------------------------------------------------
  // structured filter validation — "walidowany zakres wartości"
  // ---------------------------------------------------------------------------

  describe('structured filter + artifact validation', () => {
    it('rejects a filter value outside its enum range instead of silently accepting it', async () => {
      const result = await savedViewService.createSavedView({
        organizationId: orgId,
        artifactId: goldcoAnalysisArtifactId,
        scope: 'PERSONAL',
        ownerUserId,
        createdBy: ownerUserId,
        name: 'Bad filter probe',
        gridViewState: buildGridViewState(),
        // @ts-expect-error — deliberately invalid quality value, proving the zod range check fires.
        filters: [{ type: 'quality', values: ['WARNING'] }],
      });
      expect(result).toMatchObject({ ok: false, code: 'INVALID_FILTERS' });
    });

    it('rejects an unknown artifactId', async () => {
      const result = await savedViewService.createSavedView({
        organizationId: orgId,
        artifactId: 'does-not-exist',
        scope: 'PERSONAL',
        ownerUserId,
        createdBy: ownerUserId,
        name: 'Ghost artifact probe',
        gridViewState: buildGridViewState(),
      });
      expect(result).toMatchObject({ ok: false, code: 'ARTIFACT_NOT_FOUND' });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. column schema migration — a saved view surviving a KPI catalog removal
  // ---------------------------------------------------------------------------

  describe('column schema migration (KPI removed from catalog)', () => {
    const kpiCode = `GOLDCO_CUSTOM_RATIO_${randomUUID().slice(0, 8)}`;
    let schemaViewId = '';

    // Same formula shape as the seeded UNIVERSAL CURRENT_RATIO KPI (WP-D03
    // 20260809_finance_v3_d03_analysis_03_kpi_p0_catalog.sql) — reused verbatim so the formula
    // compiler (finance_analysis_kpi_catalog_before_write trigger) accepts it as COMPILED_OK
    // without this test needing to design its own valid AST.
    const ratioFormulaAst = {
      node: 'operator',
      op: 'ratio',
      left: { node: 'operand', kind: 'cell_ref', cellRef: { canonicalLineCode: 'CURRENT_ASSETS', consolidationScope: 'CONSOLIDATED', entityScope: 'ANALYSIS_DEFAULT', periodOffset: 'CURRENT' } },
      right: { node: 'operand', kind: 'cell_ref', cellRef: { canonicalLineCode: 'CURRENT_LIABILITIES', consolidationScope: 'CONSOLIDATED', entityScope: 'ANALYSIS_DEFAULT', periodOffset: 'CURRENT' } },
    };

    beforeAll(async () => {
      // Org-scoped custom KPI, inserted DRAFT first (bypasses the maker-checker gate, which only
      // fires on tier=ORG_CUSTOM AND status=ACTIVE), then activated with a distinct approver —
      // deliberately NOT touching any UNIVERSAL/shared catalog row other test suites might depend
      // on (this test's ephemeral database is dedicated to this run, but scoping to a fresh
      // ORG_CUSTOM row is the correct pattern regardless).
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_analysis_kpi_catalog (
             kpi_code, status, tier, organization_id, category, kpi_name, unit_type, formula_ast,
             period_convention, negative_denominator_policy, required_canonical_line_codes, created_by
           ) VALUES (?, 'DRAFT', 'ORG_CUSTOM', ?, 'LIQUIDITY', ?, 'RATIO', ?, 'POINT_IN_TIME', 'SHOW_WITH_FLAG', ?, ?)`,
          [kpiCode, orgId, `GoldCo Custom Ratio ${kpiCode}`, JSON.stringify(ratioFormulaAst), ['CURRENT_ASSETS', 'CURRENT_LIABILITIES'], ownerUserId]
        )
      );
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE finance_analysis_kpi_catalog SET status = 'ACTIVE', approved_by = ? WHERE kpi_code = ? AND organization_id = ?`, [
          teammateUserId,
          kpiCode,
          orgId,
        ])
      );
    });

    it('save a view whose grid references the (currently ACTIVE) custom KPI column', async () => {
      const gvs = new GridViewStateCtor();
      gvs.setColumnPinned(kpiCode, 'LEFT');
      const result = await savedViewService.createSavedView({
        organizationId: orgId,
        artifactId: goldcoAnalysisArtifactId,
        scope: 'PERSONAL',
        ownerUserId,
        createdBy: ownerUserId,
        name: 'View with a custom KPI column',
        gridViewState: gvs,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      schemaViewId = result.view.id;
      expect(result.view.view_state.gridViewState.columns.map((c) => c.columnId)).toContain(kpiCode);
    });

    it('while the KPI is ACTIVE, the column loads as available', async () => {
      const loaded = await savedViewService.getSavedView(orgId, schemaViewId, ownerUserId);
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) throw new Error('unreachable');
      const columnEntry = loaded.view.columnAvailability.find((c) => c.columnId === kpiCode);
      expect(columnEntry).toEqual({ columnId: kpiCode, available: true, reason: null });
    });

    it('after the KPI is deprecated (removed from the catalog), the saved view still loads WITHOUT crashing, with the column explicitly marked unavailable', async () => {
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE finance_analysis_kpi_catalog SET status = 'DEPRECATED' WHERE kpi_code = ? AND organization_id = ?`, [kpiCode, orgId])
      );

      const loaded = await savedViewService.getSavedView(orgId, schemaViewId, ownerUserId);
      expect(loaded.ok).toBe(true); // no crash
      if (!loaded.ok) throw new Error('unreachable');

      const columnEntry = loaded.view.columnAvailability.find((c) => c.columnId === kpiCode);
      expect(columnEntry).toEqual({ columnId: kpiCode, available: false, reason: 'KPI_DEPRECATED' });

      // The stored view_state itself is untouched — the column is NOT silently dropped, only
      // annotated, so a future re-activation of the same kpi_code needs no data migration.
      expect(loaded.view.view_state.gridViewState.columns.map((c) => c.columnId)).toContain(kpiCode);
    });

    it('listSavedViews also carries the same column-availability annotation (not just getSavedView)', async () => {
      const list = await savedViewService.listSavedViews({ organizationId: orgId, artifactId: goldcoAnalysisArtifactId, requesterUserId: ownerUserId });
      const entry = list.find((v) => v.id === schemaViewId);
      expect(entry).toBeTruthy();
      expect(entry?.columnAvailability.find((c) => c.columnId === kpiCode)).toEqual({ columnId: kpiCode, available: false, reason: 'KPI_DEPRECATED' });
    });
  });
});
