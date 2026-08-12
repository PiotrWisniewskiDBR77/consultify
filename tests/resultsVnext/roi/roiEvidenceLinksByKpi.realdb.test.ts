/**
 * ROI-E007 — `listRoiEvidenceLinksByKpi`, the reverse KPI->ROI read
 * (Decision D2), against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E007_DESIGN.md §4, Decision D2/D14.
 *
 * Proves the TWO-LAYER visibility split (same shape as
 * `roiEconomicModelVisibilityJoin.realdb.test.ts`'s ROI-E002 proof, applied
 * to the REVERSE direction this time):
 * - OUTER layer (roi_case scope): decides which LINK ROWS are visible at
 *   all. A viewer with NO ACL grant on the roi_case sees ZERO rows for that
 *   case's link, even though the link objectively exists and references a
 *   KPI the viewer CAN see.
 * - INNER layer (kpi scope): decides whether `kpiDetails`/`isStale` are
 *   populated for a link row the viewer CAN see (via the outer layer). A
 *   viewer who can see the roi_case but has NO ACL grant on the KPI itself
 *   gets the link's own fields (pinned id/version/purpose) but
 *   `kpiDetails: null`/`isStale: null` — never the KPI's content.
 * - The grantee (both layers) sees the full row INCLUDING `isStale`.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';

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
const ORG_ID = `roi-e007-links-by-kpi-org-${tag}`;
const USER_GRANTEE = `roi-e007-links-by-kpi-grantee-${tag}`; // ACL on BOTH the case and the KPI
const USER_CASE_ONLY = `roi-e007-links-by-kpi-case-only-${tag}`; // ACL on the case, NOT the KPI
const USER_OUTSIDER = `roi-e007-links-by-kpi-outsider-${tag}`; // ACL on NEITHER
const INITIATIVE_ID = `roi-e007-links-by-kpi-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BenefitLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type EvidenceLinkCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.js');
type RepositoryModule = typeof import('../../../server/src/services/resultsVnext/roi/roiEconomicModelRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let addBenefitLine: BenefitLineCommandsModule['addBenefitLine'];
let addBenefitEvidenceLink: EvidenceLinkCommandsModule['addBenefitEvidenceLink'];
let listRoiEvidenceLinksByKpi: RepositoryModule['listRoiEvidenceLinksByKpi'];
let closePgPool: (() => Promise<void>) | undefined;

let roiPolicyId: string;
let kpiPolicyId: string;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<string> {
  const result = await client.query<{ policy_id: string }>(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)
     RETURNING policy_id`,
    [ORG_ID, domain, mode, createdBy]
  );
  return result.rows[0]!.policy_id;
}

async function insertOrganization(): Promise<void> {
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, $2, 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [ORG_ID, 'Links-by-KPI fixture org']
  );
}

async function grantAcl(resourceType: string, resourceId: string, granteeUserId: string, grantedBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_acl
       (resource_type, resource_id, grantee_type, grantee_id, access_level, granted_by)
     VALUES ($1, $2, 'user', $3, 'contribute', $4)`,
    [resourceType, resourceId, granteeUserId, grantedBy]
  );
}

async function insertKpiFixture(kpiId: string, versionId: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, status, created_by)
     VALUES ($1, $2, $3, 'active', $4)`,
    [kpiId, ORG_ID, `KPI-${kpiId.slice(0, 8)}`, USER_GRANTEE]
  );
  await client.query(
    `INSERT INTO rvn_kpi_definition_versions
       (definition_version_id, kpi_id, organization_id, version_number, name, target_geometry, created_by)
     VALUES ($1, $2, $3, 1, 'Links-by-KPI fixture KPI', 'threshold_min', $4)`,
    [versionId, kpiId, ORG_ID, USER_GRANTEE]
  );
  await client.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`, [
    versionId,
    kpiId,
  ]);
  await client.query(
    `INSERT INTO rvn_platform_resource_visibility (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
     VALUES ('kpi', $1, $2, 'RESTRICTED_ACL', $3, $4)`,
    [kpiId, ORG_ID, kpiPolicyId, USER_GRANTEE]
  );
  // Only USER_GRANTEE is ACL-granted on the KPI itself.
  await grantAcl('kpi', kpiId, USER_GRANTEE, USER_GRANTEE);
}

describe('ROI-E007 listRoiEvidenceLinksByKpi — reverse KPI->ROI read, two-layer visibility (real Postgres)', () => {
  let caseId: string;
  let benefitLineId: string;
  let kpiId: string;
  let versionId: string;
  let linkId: string;

  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E007 links-by-kpi realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_benefit_evidence_links LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id))`
      );
      await client.query(
        `CREATE TABLE IF NOT EXISTS initiatives (
           id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL)`
      );
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the ROI-E002/ROI-E007 schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const caseCommands: CaseCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
    createRoiCase = caseCommands.createRoiCase;
    const benefitLineCommands: BenefitLineCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js'
    );
    addBenefitLine = benefitLineCommands.addBenefitLine;
    const evidenceLinkCommands: EvidenceLinkCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.js'
    );
    addBenefitEvidenceLink = evidenceLinkCommands.addBenefitEvidenceLink;
    const repo: RepositoryModule = await import('../../../server/src/services/resultsVnext/roi/roiEconomicModelRepository.js');
    listRoiEvidenceLinksByKpi = repo.listRoiEvidenceLinksByKpi;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    await insertOrganization();
    roiPolicyId = await insertVisibilityPolicy('roi', 'RESTRICTED_ACL', USER_GRANTEE);
    kpiPolicyId = await insertVisibilityPolicy('kpi', 'RESTRICTED_ACL', USER_GRANTEE);

    await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
      INITIATIVE_ID,
      ORG_ID,
      'Links-by-KPI fixture initiative',
    ]);
    const createOutcome = await createRoiCase({
      organizationId: ORG_ID,
      initiativeId: INITIATIVE_ID,
      title: 'Links-by-KPI fixture case',
      ownerUserId: USER_GRANTEE,
      currency: 'USD',
      analysisStart: '2026-01-01',
      analysisEnd: '2026-12-31',
      createdBy: USER_GRANTEE,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `create-${randomUUID()}`,
    });
    caseId = createOutcome.result.case.caseId;
    // createRoiCase already grants USER_GRANTEE (createdBy/ownerUserId) a
    // 'contribute' ACL row on the case — additionally grant USER_CASE_ONLY
    // so it can see the case (but NOT the KPI).
    await grantAcl('roi_case', caseId, USER_CASE_ONLY, USER_GRANTEE);

    const benefitLineOutcome = await addBenefitLine({
      caseId,
      organizationId: ORG_ID,
      category: 'revenue',
      label: 'New revenue',
      isFinancial: true,
      amount: 1000,
      currency: 'USD',
      timingType: 'one_time',
      oneTimePeriodDate: '2026-02-15',
      actorUserId: USER_GRANTEE,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `benefit-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    benefitLineId = benefitLineOutcome.result.benefitLineId;

    kpiId = randomUUID();
    versionId = randomUUID();
    await insertKpiFixture(kpiId, versionId);

    const linkOutcome = await addBenefitEvidenceLink({
      benefitLineId,
      caseId,
      organizationId: ORG_ID,
      kpiId,
      pinnedKpiDefinitionVersionId: versionId,
      purpose: 'primary_evidence',
      actorUserId: USER_GRANTEE,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `evidence-link-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    linkId = linkOutcome.result.linkId;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(
      `DELETE FROM rvn_platform_resource_acl
        WHERE resource_type IN ('roi_case', 'kpi')
          AND (resource_id IN (SELECT case_id::text FROM rvn_roi_cases WHERE organization_id = $1)
               OR resource_id IN (SELECT kpi_id::text FROM rvn_kpi_definitions WHERE organization_id = $1))`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_benefit_evidence_links WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_benefit_lines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`, [
      ORG_ID,
    ]);
    await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
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

  itDB('grantee (case ACL + KPI ACL): sees the link row WITH kpiDetails/isStale populated', async () => {
    const links = await listRoiEvidenceLinksByKpi({ userId: USER_GRANTEE, organizationId: ORG_ID, kpiId });
    expect(links).toHaveLength(1);
    expect(links[0]!.linkId).toBe(linkId);
    expect(links[0]!.caseId).toBe(caseId);
    expect(links[0]!.kpiDetails).not.toBeNull();
    expect(links[0]!.kpiDetails?.kpiId).toBe(kpiId);
    expect(links[0]!.isStale).toBe(false);
  });

  itDB('case-only viewer (case ACL, NO KPI ACL): sees the link ROW but kpiDetails/isStale are null', async () => {
    const links = await listRoiEvidenceLinksByKpi({ userId: USER_CASE_ONLY, organizationId: ORG_ID, kpiId });
    expect(links).toHaveLength(1);
    expect(links[0]!.linkId).toBe(linkId);
    // Link's own metadata is always visible once the case itself is visible.
    expect(links[0]!.purpose).toBe('primary_evidence');
    expect(links[0]!.pinnedKpiDefinitionVersionId).toBe(versionId);
    // KPI content is NOT leaked.
    expect(links[0]!.kpiDetails).toBeNull();
    expect(links[0]!.isStale).toBeNull();
  });

  itDB('outsider (NO case ACL, NO KPI ACL): sees ZERO link rows, not even the link\'s own metadata', async () => {
    const links = await listRoiEvidenceLinksByKpi({ userId: USER_OUTSIDER, organizationId: ORG_ID, kpiId });
    expect(links).toHaveLength(0);
  });

  itDB('a nonexistent kpiId returns an empty list, not an error', async () => {
    const links = await listRoiEvidenceLinksByKpi({ userId: USER_GRANTEE, organizationId: ORG_ID, kpiId: randomUUID() });
    expect(links).toHaveLength(0);
  });
});
