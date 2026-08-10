/**
 * ROI-E007 — Evidence-link freshness (AC-05: a freshness/supersession event
 * that does NOT auto-propagate values), against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E007_DESIGN.md §4, Decision D7.
 *
 * Proves TWO independent things:
 * (1) `isStale` (the read-time-only D14-hydration extension on
 *     `listBenefitEvidenceLinks`) is computed correctly — `false` while the
 *     pinned KPI definition version is still the KPI's current version,
 *     `true` after the KPI's `current_definition_version_id` moves to a NEW
 *     version, WITHOUT the evidence link's own `pinned_kpi_definition
 *     _version_id` ever being touched (that column is frozen at link-add
 *     time — nothing in this epic writes to it again).
 * (2) `flagEvidenceLinkFreshnessCheck` sets `freshness_checked_at` and
 *     NOTHING else on the KPI side — proved BOTH behaviorally (the command
 *     runs, `isStale` is UNCHANGED by it — acknowledging staleness never
 *     "fixes" it) AND via a STATIC source-text check of the command's own
 *     function body: zero `UPDATE rvn_kpi_*` occurrences (design §7's
 *     literal DoD item).
 *
 * DEVIATION FROM ADDING A SECOND KPI VERSION VIA THE REAL COMMAND CHAIN:
 * getting a KPI to a second `current_definition_version_id` through the real
 * `createKpiDraft` -> `submitDefinition` -> `approveDefinitionVersion` chain
 * pulls in KPI-E001's full approval machinery, which is unrelated to what
 * this test needs to prove (only that `isStale` correctly compares two
 * version ids). This file raw-inserts a second
 * `rvn_kpi_definition_versions` row and raw-UPDATEs `rvn_kpi_definitions
 * .current_definition_version_id` directly — the same "insertRaw*" fixture
 * shortcut ROI-E006's `roiPirRealdbFixtures.ts` documents and uses for
 * out-of-scope setup, not a deviation in what's being proved.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
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
const ORG_ID = `roi-e007-freshness-org-${tag}`;
const USER_MAKER = `roi-e007-freshness-maker-${tag}`;
const INITIATIVE_ID = `roi-e007-freshness-init-${tag}`;

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
let flagEvidenceLinkFreshnessCheck: EvidenceLinkCommandsModule['flagEvidenceLinkFreshnessCheck'];
let listBenefitEvidenceLinks: RepositoryModule['listBenefitEvidenceLinks'];
let closePgPool: (() => Promise<void>) | undefined;
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
    [ORG_ID, 'Freshness fixture org']
  );
}

async function insertKpiFixture(kpiId: string, v1Id: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, status, created_by)
     VALUES ($1, $2, $3, 'active', $4)`,
    [kpiId, ORG_ID, `KPI-${kpiId.slice(0, 8)}`, USER_MAKER]
  );
  await client.query(
    `INSERT INTO rvn_kpi_definition_versions
       (definition_version_id, kpi_id, organization_id, version_number, name, target_geometry, created_by)
     VALUES ($1, $2, $3, 1, 'Freshness fixture KPI v1', 'threshold_min', $4)`,
    [v1Id, kpiId, ORG_ID, USER_MAKER]
  );
  await client.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`, [
    v1Id,
    kpiId,
  ]);
  await client.query(
    `INSERT INTO rvn_platform_resource_visibility (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
     VALUES ('kpi', $1, $2, 'OPEN_ORG', $3, $4)`,
    [kpiId, ORG_ID, kpiPolicyId, USER_MAKER]
  );
}

/** Test-only shortcut (documented in the file header) — publishes a SECOND
 * KPI definition version and flips `current_definition_version_id` to it,
 * without going through the full submit/approve command chain. */
async function supersedeKpiVersion(kpiId: string, v2Id: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_definition_versions
       (definition_version_id, kpi_id, organization_id, version_number, name, target_geometry, created_by)
     VALUES ($1, $2, $3, 2, 'Freshness fixture KPI v2', 'threshold_min', $4)`,
    [v2Id, kpiId, ORG_ID, USER_MAKER]
  );
  await client.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`, [
    v2Id,
    kpiId,
  ]);
}

interface CaseWithEvidenceLinkFixture {
  caseId: string;
  benefitLineId: string;
  linkId: string;
  kpiId: string;
  v1Id: string;
  v2Id: string;
}

async function buildCaseWithEvidenceLink(suffix: string): Promise<CaseWithEvidenceLinkFixture> {
  const initiativeId = `${INITIATIVE_ID}-${suffix}`;
  await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
    initiativeId,
    ORG_ID,
    'Freshness fixture initiative',
  ]);
  const createOutcome = await createRoiCase({
    organizationId: ORG_ID,
    initiativeId,
    title: 'Freshness fixture case',
    ownerUserId: USER_MAKER,
    currency: 'USD',
    analysisStart: '2026-01-01',
    analysisEnd: '2026-12-31',
    createdBy: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `create-${randomUUID()}`,
  });
  const caseId = createOutcome.result.case.caseId;

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
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `benefit-${randomUUID()}`,
  });
  const benefitLineId = benefitLineOutcome.result.benefitLineId;

  const kpiId = randomUUID();
  const v1Id = randomUUID();
  const v2Id = randomUUID();
  await insertKpiFixture(kpiId, v1Id);

  const linkOutcome = await addBenefitEvidenceLink({
    benefitLineId,
    caseId,
    organizationId: ORG_ID,
    kpiId,
    pinnedKpiDefinitionVersionId: v1Id,
    purpose: 'primary_evidence',
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `evidence-link-${randomUUID()}`,
  });

  return { caseId, benefitLineId, linkId: linkOutcome.result.linkId, kpiId, v1Id, v2Id };
}

describe('ROI-E007 Evidence-link freshness (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E007 evidence-link-freshness realdb tests did NOT run. This run is not evidence.');
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
    flagEvidenceLinkFreshnessCheck = evidenceLinkCommands.flagEvidenceLinkFreshnessCheck;
    const repo: RepositoryModule = await import('../../../server/src/services/resultsVnext/roi/roiEconomicModelRepository.js');
    listBenefitEvidenceLinks = repo.listBenefitEvidenceLinks;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    await insertOrganization();
    await insertVisibilityPolicy('roi', 'OPEN_ORG', USER_MAKER);
    kpiPolicyId = await insertVisibilityPolicy('kpi', 'OPEN_ORG', USER_MAKER);
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

  itDB('Decision D7: isStale is false while the pinned version is still current', async () => {
    const fixture = await buildCaseWithEvidenceLink('1');
    const links = await listBenefitEvidenceLinks({
      userId: USER_MAKER,
      organizationId: ORG_ID,
      caseId: fixture.caseId,
      benefitLineId: fixture.benefitLineId,
      hydrateKpiDetails: true,
    });
    expect(links).toHaveLength(1);
    expect(links[0]!.kpiDetails).not.toBeNull();
    expect(links[0]!.isStale).toBe(false);
  });

  itDB('Decision D7: isStale becomes true after the KPI definition supersedes the pinned version, WITHOUT the link itself changing', async () => {
    const fixture = await buildCaseWithEvidenceLink('2');
    await supersedeKpiVersion(fixture.kpiId, fixture.v2Id);

    const links = await listBenefitEvidenceLinks({
      userId: USER_MAKER,
      organizationId: ORG_ID,
      caseId: fixture.caseId,
      benefitLineId: fixture.benefitLineId,
      hydrateKpiDetails: true,
    });
    expect(links).toHaveLength(1);
    expect(links[0]!.isStale).toBe(true);
    // The link's OWN pinned version is untouched — staleness is a read-time
    // comparison, never a value written back onto the link.
    expect(links[0]!.pinnedKpiDefinitionVersionId).toBe(fixture.v1Id);
  });

  itDB('isStale resolves to null (not false) when hydrateKpiDetails is false', async () => {
    const fixture = await buildCaseWithEvidenceLink('3');
    await supersedeKpiVersion(fixture.kpiId, fixture.v2Id);
    const links = await listBenefitEvidenceLinks({
      userId: USER_MAKER,
      organizationId: ORG_ID,
      caseId: fixture.caseId,
      benefitLineId: fixture.benefitLineId,
      hydrateKpiDetails: false,
    });
    expect(links).toHaveLength(1);
    expect(links[0]!.kpiDetails).toBeNull();
    expect(links[0]!.isStale).toBeNull();
  });

  itDB(
    'AC-05: flagEvidenceLinkFreshnessCheck sets freshness_checked_at and NEVER changes isStale (acknowledging staleness does not fix it)',
    async () => {
      const fixture = await buildCaseWithEvidenceLink('4');
      await supersedeKpiVersion(fixture.kpiId, fixture.v2Id);

      const beforeCheck = await client.query<{ freshness_checked_at: string | null }>(
        `SELECT freshness_checked_at FROM rvn_roi_benefit_evidence_links WHERE link_id = $1`,
        [fixture.linkId]
      );
      expect(beforeCheck.rows[0]!.freshness_checked_at).toBeNull();

      const checkOutcome = await flagEvidenceLinkFreshnessCheck({
        linkId: fixture.linkId,
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `freshness-check-${randomUUID()}`,
      });
      expect(checkOutcome.outcome).toBe('applied');
      expect(checkOutcome.result.freshnessCheckedAt).not.toBeNull();
      // Untouched by this command.
      expect(checkOutcome.result.disputeStatus).toBe('none');
      expect(checkOutcome.result.notes).toBeNull();

      // isStale is STILL true — the acknowledgment did not "fix" staleness,
      // exactly AC-05's "does not auto-propagate values" requirement.
      const linksAfter = await listBenefitEvidenceLinks({
        userId: USER_MAKER,
        organizationId: ORG_ID,
        caseId: fixture.caseId,
        benefitLineId: fixture.benefitLineId,
        hydrateKpiDetails: true,
      });
      expect(linksAfter[0]!.isStale).toBe(true);
      expect(linksAfter[0]!.freshnessCheckedAt).not.toBeNull();

      // The KPI's own current_definition_version_id is untouched by the
      // freshness-check command.
      const kpiRow = await client.query<{ current_definition_version_id: string }>(
        `SELECT current_definition_version_id FROM rvn_kpi_definitions WHERE kpi_id = $1`,
        [fixture.kpiId]
      );
      expect(kpiRow.rows[0]!.current_definition_version_id).toBe(fixture.v2Id);
    }
  );

  it('AC-05 static source-text check: flagEvidenceLinkFreshnessCheck\'s own function body contains ZERO `UPDATE rvn_kpi_*` statements', () => {
    const currentFilePath = fileURLToPath(import.meta.url);
    const currentDir = path.dirname(currentFilePath);
    const commandFilePath = path.resolve(
      currentDir,
      '../../../server/src/services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.ts'
    );
    const source = fs.readFileSync(commandFilePath, 'utf8');

    const startMarker = 'export async function flagEvidenceLinkFreshnessCheck';
    const startIndex = source.indexOf(startMarker);
    expect(startIndex).toBeGreaterThan(-1);

    // The function is the LAST export in the file (verified by reading the
    // file — design §4 appends it after flagBenefitEvidenceLinkDisputed) —
    // slice to EOF is safe; if a future function is appended AFTER it, this
    // assertion would still only be checking a SUPERSET of the intended
    // body, never a subset, so it stays a valid (if slightly broader) proof.
    const functionBody = source.slice(startIndex);

    const kpiTableWriteMatches = functionBody.match(/UPDATE\s+rvn_kpi_\w*/gi) ?? [];
    expect(kpiTableWriteMatches).toEqual([]);
  });
});
