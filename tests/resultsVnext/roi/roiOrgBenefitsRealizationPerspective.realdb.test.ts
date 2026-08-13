/**
 * ROI-E005 — `listOrganizationRoiBenefitsRealization` (AC-05: org
 * perspective only from governed data), against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E005_DESIGN.md §2, Decisions
 * D15/D16. Structural precedent: `tests/resultsVnext/kpi/
 * organizationKpiAttention.realdb.test.ts` (same chain-scoping + visibility
 * non-leak shape, `buildScopedKpisBase`'s direct sibling).
 *
 * Proves: (1) management-chain scoping — a manager sees only cases owned by
 * users in their chain (a case owned by an OUTSIDER never appears,
 * regardless of visibility mode); (2) visibility non-leak — a subordinate's
 * PRIVATE case stays invisible to the manager even though the owner IS
 * chain-reachable (T3 non-leak wins over completeness, same precedent
 * KPI-E005's own decision #2 established); (3) **AC-05** — confirmed by
 * READING `roiOrgPerspectiveRepository.ts`'s own source text and asserting
 * it never references any of the legacy tables ROI-E001 §2 permanently
 * excluded (`roi_realized_values`, `initiative_benefits`,
 * `benefits_register`, `v8_roi_realization_entries`, `analysis_financials`,
 * `digitization_analyses`).
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (url) {
    return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `roi-e005-orgperspective-org-${tag}`;
const MANAGER = `roi-e005-orgperspective-manager-${tag}`;
const SUBORDINATE = `roi-e005-orgperspective-subordinate-${tag}`; // reports to MANAGER
const OUTSIDER = `roi-e005-orgperspective-outsider-${tag}`; // NOT in MANAGER's chain
const INITIATIVE_ID = `roi-e005-orgperspective-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type OrgPerspectiveRepositoryModule =
  typeof import('../../../server/src/services/resultsVnext/roi/roiOrgPerspectiveRepository.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let listOrganizationRoiBenefitsRealization: OrgPerspectiveRepositoryModule['listOrganizationRoiBenefitsRealization'];
let closePgPool: (() => Promise<void>) | undefined;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)`,
    [ORG_ID, domain, mode, createdBy]
  );
}

async function insertChainEdge(ancestor: string, descendant: string, depth: number): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_management_chain_closure (organization_id, ancestor_user_id, descendant_user_id, depth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [ORG_ID, ancestor, descendant, depth]
  );
}

/** Creates a case owned by `ownerUserId` (via the real command, so its
 * visibility row is created the normal way), stamps its status directly to
 * 'tracking' (a member of ROI_TRACKING_ACTIVE_STATUSES — the transition
 * MECHANICS are proven elsewhere, not this test's concern), and optionally
 * downgrades its visibility_mode to 'PRIVATE'. */
async function buildScopedCaseFixture(
  suffix: string,
  ownerUserId: string,
  visibilityMode: 'OPEN_ORG' | 'PRIVATE'
): Promise<string> {
  const initiativeId = `${INITIATIVE_ID}-${suffix}`;
  await client.query(`INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)`, [
    initiativeId,
    ORG_ID,
    'Org perspective fixture initiative',
    'EXECUTING',
  ]);

  const createOutcome = await createRoiCase({
    organizationId: ORG_ID,
    initiativeId,
    title: `Org perspective fixture case (${suffix})`,
    ownerUserId,
    currency: 'USD',
    createdBy: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `create-${randomUUID()}`,
  });
  const caseId = createOutcome.result.case.caseId;

  await client.query(`UPDATE rvn_roi_cases SET status = 'tracking' WHERE case_id = $1`, [caseId]);
  if (visibilityMode === 'PRIVATE') {
    await client.query(
      `UPDATE rvn_platform_resource_visibility SET visibility_mode = 'PRIVATE'
        WHERE resource_type = 'roi_case' AND resource_id = $1 AND organization_id = $2`,
      [caseId, ORG_ID]
    );
  }
  return caseId;
}

describe('ROI-E005 listOrganizationRoiBenefitsRealization (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E005 org benefits-realization perspective realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_platform_management_chain_closure LIMIT 0');
      await client.query('SELECT 1 FROM rvn_roi_cases LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the required schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const caseCommands: CaseCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
    createRoiCase = caseCommands.createRoiCase;
    const orgPerspectiveRepository: OrgPerspectiveRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiOrgPerspectiveRepository.js'
    );
    listOrganizationRoiBenefitsRealization = orgPerspectiveRepository.listOrganizationRoiBenefitsRealization;

    const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    await client.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'ROI-E005 Org Perspective RealDB Org', 'enterprise', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [ORG_ID]
    );
    await insertVisibilityPolicy('roi', 'OPEN_ORG', MANAGER);

    // MANAGER -> SUBORDINATE (direct report). OUTSIDER is never in
    // MANAGER's chain (no closure row).
    await insertChainEdge(MANAGER, MANAGER, 0);
    await insertChainEdge(SUBORDINATE, SUBORDINATE, 0);
    await insertChainEdge(MANAGER, SUBORDINATE, 1);
    await insertChainEdge(OUTSIDER, OUTSIDER, 0);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_resource_acl
        WHERE resource_type = 'roi_case'
          AND resource_id IN (SELECT case_id::text FROM rvn_roi_cases WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_management_chain_closure WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
    await client.end();
    if (closePgPool) await closePgPool();
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
    "a manager sees only subordinates' ROI cases (chain-scoped), and a subordinate's PRIVATE case stays " +
      "invisible even though its owner IS in the chain (T3 non-leak wins over completeness, D16's per-case " +
      'visibility layer)',
    async () => {
      // VISIBLE: OPEN_ORG, owner = SUBORDINATE (in MANAGER's chain) — MUST appear.
      const visibleCaseId = await buildScopedCaseFixture('visible', SUBORDINATE, 'OPEN_ORG');
      // PRIVATE: owner = SUBORDINATE (chain-reachable), but PRIVATE
      // visibility and MANAGER has no ACL grant/RBAC override — MUST NOT
      // appear.
      const privateCaseId = await buildScopedCaseFixture('private', SUBORDINATE, 'PRIVATE');
      // OUTSIDER: OPEN_ORG, owner = OUTSIDER (NOT in MANAGER's chain) — MUST
      // NOT appear (chain gate, independent of visibility).
      const outsiderCaseId = await buildScopedCaseFixture('outsider', OUTSIDER, 'OPEN_ORG');

      const result = await listOrganizationRoiBenefitsRealization({
        managerId: MANAGER,
        organizationId: ORG_ID,
      });

      const caseIds = result.cases.map((c) => c.caseId);
      expect(caseIds).toContain(visibleCaseId);
      expect(caseIds).not.toContain(privateCaseId);
      expect(caseIds).not.toContain(outsiderCaseId);
      expect(result.portfolioTotals.caseCountTotal).toBe(1);

      // The manager's own chain-membership (depth 0) does not itself
      // fabricate a case — only the SUBORDINATE's own visible case counts.
      const visibleRow = result.cases.find((c) => c.caseId === visibleCaseId);
      expect(visibleRow).toBeDefined();
      expect(visibleRow!.status).toBe('tracking');
      // No approved/actual snapshot pinned yet for this fixture — both
      // sides null, pct null (same D10 "either side missing" rule).
      expect(visibleRow!.approvedFinancialBenefits).toBeNull();
      expect(visibleRow!.actualFinancialBenefits).toBeNull();
      expect(visibleRow!.benefitsRealizationPct).toBeNull();
    }
  );

  itDB(
    'AC-05: roiOrgPerspectiveRepository.ts never references any legacy table (roi_realized_values, initiative_benefits, benefits_register, v8_roi_realization_entries, analysis_financials, digitization_analyses)',
    async () => {
      const here = path.dirname(fileURLToPath(import.meta.url));
      const repositorySourcePath = path.resolve(
        here,
        '../../../server/src/services/resultsVnext/roi/roiOrgPerspectiveRepository.ts'
      );
      const fullSource = readFileSync(repositorySourcePath, 'utf8');
      // Strip block (/* ... */) and line (// ...) comments first — the
      // file's OWN doc comments legitimately name these excluded legacy
      // tables in prose (documenting what is NOT referenced), which would
      // otherwise make a naive substring check on the raw file trivially
      // fail. The proof this test needs is about the CODE (SQL/identifiers),
      // not the documentation.
      const source = fullSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

      const legacyTables = [
        'roi_realized_values',
        'initiative_benefits',
        'benefits_register',
        'v8_roi_realization_entries',
        'analysis_financials',
        'digitization_analyses',
      ];
      for (const legacyTable of legacyTables) {
        expect(source.includes(legacyTable)).toBe(false);
      }

      // Positive confirmation: the file DOES reference only the governed
      // rvn_roi_* tables it is supposed to.
      expect(source).toContain('rvn_roi_cases');
      expect(source).toContain('rvn_roi_approval_snapshots');
      expect(source).toContain('rvn_roi_actual_snapshots');
    }
  );
});
