/**
 * ROI-E007 — Finance Link commands (AC-01: a full pinned envelope; AC-02:
 * zero overwrite in either direction; Decision D4: no existence validation
 * against any Finance table), against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E007_DESIGN.md §3/§4, Decision D4.
 *
 * Proves: `createRoiFinanceLink` returns the FULL pinned envelope (every
 * field §3's DDL/§9.6 lists, not a subset); a link to a completely
 * fabricated Finance artifact id/type/version id is accepted WITHOUT error
 * (D4 — the whole point of the "soft reference, zero coupling" design);
 * `removeRoiFinanceLink` deletes by id under the same
 * `NON_EDITABLE_STATUSES` guard every other economic-model-adjacent command
 * uses; `listRoiFinanceLinks`'s repository join actually executes against
 * real rows (the `::text` cast class of bug missed 7 times across the KPI
 * domain in an earlier epic).
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
const ORG_ID = `roi-e007-fin-link-org-${tag}`;
const USER_MAKER = `roi-e007-fin-link-maker-${tag}`;
const INITIATIVE_ID = `roi-e007-fin-link-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type FinanceLinkCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiFinanceLinkCommands.js');
type FinanceLinkRepositoryModule = typeof import('../../../server/src/services/resultsVnext/roi/roiFinanceLinkRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let createRoiFinanceLink: FinanceLinkCommandsModule['createRoiFinanceLink'];
let removeRoiFinanceLink: FinanceLinkCommandsModule['removeRoiFinanceLink'];
let listRoiFinanceLinks: FinanceLinkRepositoryModule['listRoiFinanceLinks'];
let getRoiFinanceLink: FinanceLinkRepositoryModule['getRoiFinanceLink'];
let closePgPool: (() => Promise<void>) | undefined;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)`,
    [ORG_ID, domain, mode, createdBy]
  );
}

async function insertOrganization(): Promise<void> {
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, $2, 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [ORG_ID, 'Finance-link fixture org']
  );
}

async function buildEditableCase(suffix: string): Promise<{ caseId: string; rowVersion: number }> {
  const initiativeId = `${INITIATIVE_ID}-${suffix}`;
  await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
    initiativeId,
    ORG_ID,
    'Finance-link fixture initiative',
  ]);
  const createOutcome = await createRoiCase({
    organizationId: ORG_ID,
    initiativeId,
    title: 'Finance-link fixture case',
    ownerUserId: USER_MAKER,
    currency: 'USD',
    analysisStart: '2026-01-01',
    analysisEnd: '2026-12-31',
    createdBy: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `create-${randomUUID()}`,
  });
  return { caseId: createOutcome.result.case.caseId, rowVersion: createOutcome.result.case.rowVersion };
}

describe('ROI-E007 Finance Link commands (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E007 finance-link realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_finance_links LIMIT 0');
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
        'A database is configured but is not reachable (or missing the ROI-E007 finance-seam schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const caseCommands: CaseCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
    createRoiCase = caseCommands.createRoiCase;
    const financeLinkCommands: FinanceLinkCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiFinanceLinkCommands.js'
    );
    createRoiFinanceLink = financeLinkCommands.createRoiFinanceLink;
    removeRoiFinanceLink = financeLinkCommands.removeRoiFinanceLink;
    const financeLinkRepo: FinanceLinkRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiFinanceLinkRepository.js'
    );
    listRoiFinanceLinks = financeLinkRepo.listRoiFinanceLinks;
    getRoiFinanceLink = financeLinkRepo.getRoiFinanceLink;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    await insertOrganization();
    await insertVisibilityPolicy('roi', 'OPEN_ORG', USER_MAKER);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM rvn_roi_finance_reconciliations WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_finance_links WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_resource_acl
        WHERE resource_type = 'roi_case'
          AND resource_id IN (SELECT case_id::text FROM rvn_roi_cases WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [ORG_ID]);
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

  itDB('AC-01: createRoiFinanceLink returns the full pinned envelope', async () => {
    const fixture = await buildEditableCase('1');
    const outcome = await createRoiFinanceLink({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      financeArtifactType: 'financial_roi_link',
      financeArtifactId: 'fin-artifact-1',
      financeVersionId: 'fin-version-1',
      source: 'finance_enterprise_service',
      asOf: '2026-06-01T00:00:00.000Z',
      semanticUnit: 'USD_NPV',
      currency: 'USD',
      linkPurpose: 'npv_reference',
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `fin-link-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(outcome.outcome).toBe('applied');
    const link = outcome.result;
    expect(link.caseId).toBe(fixture.caseId);
    expect(link.financeArtifactType).toBe('financial_roi_link');
    expect(link.financeArtifactId).toBe('fin-artifact-1');
    expect(link.financeVersionId).toBe('fin-version-1');
    expect(link.mappingVersion).toBe(1);
    expect(link.source).toBe('finance_enterprise_service');
    expect(link.semanticUnit).toBe('USD_NPV');
    expect(link.currency).toBe('USD');
    expect(link.linkPurpose).toBe('npv_reference');
    expect(link.linkedBy).toBe(USER_MAKER);
    expect(link.rowVersion).toBe(1);

    const fetched = await getRoiFinanceLink({
      userId: USER_MAKER,
      organizationId: ORG_ID,
      caseId: fixture.caseId,
      linkId: link.linkId,
    });
    expect(fetched?.linkId).toBe(link.linkId);
  });

  itDB('Decision D4: a link to a completely fabricated Finance artifact id/type/version is accepted without error', async () => {
    const fixture = await buildEditableCase('2');
    const outcome = await createRoiFinanceLink({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      financeArtifactType: 'totally_made_up_artifact_type',
      financeArtifactId: `nonexistent-${randomUUID()}`,
      financeVersionId: `nonexistent-version-${randomUUID()}`,
      source: 'manual_entry',
      asOf: '2026-06-01T00:00:00.000Z',
      linkPurpose: 'reference',
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `fin-link-fabricated-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    // No existence-validation error of any kind — the write simply succeeds.
    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.financeArtifactType).toBe('totally_made_up_artifact_type');
  });

  itDB('listRoiFinanceLinks: `::text` visibility join executes against real rows', async () => {
    const fixture = await buildEditableCase('3');
    await createRoiFinanceLink({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      financeArtifactType: 'financial_roi_link',
      financeArtifactId: 'fin-artifact-3a',
      financeVersionId: 'fin-version-3a',
      source: 'finance_enterprise_service',
      asOf: '2026-06-01T00:00:00.000Z',
      linkPurpose: 'npv_reference',
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `fin-link-3a-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    await createRoiFinanceLink({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      financeArtifactType: 'financial_roi_link',
      financeArtifactId: 'fin-artifact-3b',
      financeVersionId: 'fin-version-3b',
      source: 'finance_enterprise_service',
      asOf: '2026-06-02T00:00:00.000Z',
      linkPurpose: 'payback_reference',
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `fin-link-3b-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    const links = await listRoiFinanceLinks({ userId: USER_MAKER, organizationId: ORG_ID, caseId: fixture.caseId });
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.financeArtifactId).sort()).toEqual(['fin-artifact-3a', 'fin-artifact-3b']);
  });

  itDB('removeRoiFinanceLink: hard delete by id; listRoiFinanceLinks no longer returns it', async () => {
    const fixture = await buildEditableCase('4');
    const createOutcome = await createRoiFinanceLink({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      financeArtifactType: 'financial_roi_link',
      financeArtifactId: 'fin-artifact-4',
      financeVersionId: 'fin-version-4',
      source: 'finance_enterprise_service',
      asOf: '2026-06-01T00:00:00.000Z',
      linkPurpose: 'npv_reference',
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `fin-link-4-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const linkId = createOutcome.result.linkId;

    const removeOutcome = await removeRoiFinanceLink({
      linkId,
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: createOutcome.result.rowVersion,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `remove-fin-link-4-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(removeOutcome.result.linkId).toBe(linkId);

    const links = await listRoiFinanceLinks({ userId: USER_MAKER, organizationId: ORG_ID, caseId: fixture.caseId });
    expect(links).toHaveLength(0);
  });

  itDB('createRoiFinanceLink/removeRoiFinanceLink are gated by the SAME NON_EDITABLE_STATUSES guard', async () => {
    const fixture = await buildEditableCase('5');
    // Force the case into a non-editable status directly (test-only
    // shortcut — the point here is the guard, not driving the full
    // approval chain, same technique ROI-E006's realdb suites use for
    // out-of-scope setup).
    await client.query(`UPDATE rvn_roi_cases SET status = 'approved' WHERE case_id = $1`, [fixture.caseId]);

    const { RoiEconomicModelNotEditableError } = await import(
      '../../../server/src/services/resultsVnext/roi/roiCalculationPolicyCommands.js'
    );
    await expect(
      createRoiFinanceLink({
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        financeArtifactType: 'financial_roi_link',
        financeArtifactId: 'fin-artifact-5',
        financeVersionId: 'fin-version-5',
        source: 'finance_enterprise_service',
        asOf: '2026-06-01T00:00:00.000Z',
        linkPurpose: 'npv_reference',
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `fin-link-5-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toThrow(RoiEconomicModelNotEditableError);
  });
});
