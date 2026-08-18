/**
 * ROI-E007 — Finance Reconciliation commands (AC-03: a reconciliation record
 * instead of silent sync; Decision D1: PATCH resolution path with CAS on the
 * reconciliation's own row_version; event fan-out differs by terminal vs.
 * non-terminal status transition), against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E007_DESIGN.md §4, Decision D1.
 *
 * Proves: `openRoiFinanceReconciliation` creates a durable record (never a
 * value overwrite anywhere) and validates `financeLinkId` belongs to the
 * case; `listRoiFinanceReconciliations`'s `::text` visibility join;
 * `updateRoiFinanceReconciliationStatus`'s CAS on the reconciliation's OWN
 * row_version (stale `expectedVersion` rejected); `resolvedBy`/`resolvedAt`
 * set ONLY on a transition into a terminal status; and — the literal
 * Decision D1 fact — the event fan-out DIFFERS: a transition into
 * 'investigating' fans ONLY to 'mywork_projection', while a transition into
 * 'resolved'/'accepted_divergence' additionally fans to 'finance_projection'.
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
const ORG_ID = `roi-e007-fin-recon-org-${tag}`;
const SECOND_ORG_ID = `roi-e007-fin-recon-org-second-${tag}`;
const USER_MAKER = `roi-e007-fin-recon-maker-${tag}`;
const USER_RESOLVER = `roi-e007-fin-recon-resolver-${tag}`;
const USER_RESOLVER_2 = `roi-e007-fin-recon-resolver-2-${tag}`;
const USER_GRANTEE = `roi-e007-fin-recon-grantee-${tag}`;
const INITIATIVE_ID = `roi-e007-fin-recon-init-${tag}`;

let client: Client;
let reachable = false;
let connected = false;
let suiteLockHeld = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type FinanceLinkCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiFinanceLinkCommands.js');
type FinanceReconciliationCommandsModule =
  typeof import('../../../server/src/services/resultsVnext/roi/roiFinanceReconciliationCommands.js');
type FinanceLinkRepositoryModule = typeof import('../../../server/src/services/resultsVnext/roi/roiFinanceLinkRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let createRoiFinanceLink: FinanceLinkCommandsModule['createRoiFinanceLink'];
let openRoiFinanceReconciliation: FinanceReconciliationCommandsModule['openRoiFinanceReconciliation'];
let openRoiFinanceReconciliationFromProjection: FinanceReconciliationCommandsModule['openRoiFinanceReconciliationFromProjection'];
let updateRoiFinanceReconciliationStatus: FinanceReconciliationCommandsModule['updateRoiFinanceReconciliationStatus'];
let recordFinanceOwnerGrantEvent: FinanceReconciliationCommandsModule['recordFinanceOwnerGrantEvent'];
let RoiFinanceLinkNotFoundError: FinanceReconciliationCommandsModule['RoiFinanceLinkNotFoundError'];
let listRoiFinanceReconciliations: FinanceLinkRepositoryModule['listRoiFinanceReconciliations'];
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
    [ORG_ID, 'Finance-reconciliation fixture org']
  );
}

interface CaseWithLinkFixture {
  caseId: string;
  linkId: string;
  linkRowVersion: number;
}

async function buildCaseWithFinanceLink(suffix: string): Promise<CaseWithLinkFixture> {
  const initiativeId = `${INITIATIVE_ID}-${suffix}`;
  await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
    initiativeId,
    ORG_ID,
    'Finance-reconciliation fixture initiative',
  ]);
  const createOutcome = await createRoiCase({
    organizationId: ORG_ID,
    initiativeId,
    title: 'Finance-reconciliation fixture case',
    ownerUserId: USER_MAKER,
    currency: 'USD',
    analysisStart: '2026-01-01',
    analysisEnd: '2026-12-31',
    createdBy: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `create-${randomUUID()}`,
  });
  const caseId = createOutcome.result.case.caseId;

  const linkOutcome = await createRoiFinanceLink({
    caseId,
    organizationId: ORG_ID,
    financeArtifactType: 'financial_roi_link',
    financeArtifactId: `fin-artifact-${suffix}`,
    financeVersionId: `fin-version-${suffix}`,
    source: 'finance_enterprise_service',
    asOf: '2026-06-01T00:00:00.000Z',
    linkPurpose: 'npv_reference',
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `fin-link-${suffix}-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

  return { caseId, linkId: linkOutcome.result.linkId, linkRowVersion: linkOutcome.result.rowVersion };
}

async function outboxConsumerGroups(eventType: string, aggregateId: string): Promise<string[]> {
  const result = await client.query<{ consumer_group: string }>(
    `SELECT o.consumer_group
       FROM rvn_platform_outbox o
       JOIN rvn_platform_events e ON e.event_id = o.event_id
      WHERE e.event_type = $1 AND e.aggregate_id = $2 AND e.organization_id = $3
      ORDER BY o.consumer_group`,
    [eventType, aggregateId, ORG_ID]
  );
  return result.rows.map((r) => r.consumer_group);
}

describe('ROI-E007 Finance Reconciliation commands (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — ROI-E007 finance-reconciliation realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      connected = true;
      const database = await client.query<{ current_database: string }>('SELECT current_database()');
      const actualDatabase = String(database.rows[0]?.current_database ?? '');
      const callerDatabase = new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
      const requiredPrefix = process.env.ROI_E007_DISPOSABLE_DB_PREFIX ?? '';
      if (process.env.ROI_E007_ALLOW_IMMUTABLE_FIXTURE_CLEANUP !== '1' || !requiredPrefix ||
          callerDatabase !== actualDatabase || !actualDatabase.startsWith(requiredPrefix)) {
        throw new Error('ROI-E007 requires explicit cleanup opt-in and an exact disposable database prefix');
      }
      await client.query(`SELECT pg_advisory_lock(hashtext('roi-e007-finance-reconciliation-suite'))`);
      suiteLockHeld = true;
      const initialSafety = await client.query<{ role: string; triggers_enabled: string }>(
        `SELECT current_setting('session_replication_role') role,
          (SELECT count(*)::text FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O'
            AND tgname=ANY($1::text[])) triggers_enabled`,
        [[
          'trg_rvn_fin_reconciliation_grant_insert_guard',
          'trg_rvn_fin_reconciliation_decision_append_only',
          'trg_rvn_fin_reconciliation_grant_append_only',
        ]]
      );
      if (initialSafety.rows[0]?.role !== 'origin' || initialSafety.rows[0]?.triggers_enabled !== '3')
        throw new Error('ROI-E007 fixture requires all named production triggers enabled at origin');
      await client.query('SELECT 1 FROM rvn_roi_finance_reconciliations LIMIT 0');
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
      let cleanupError: unknown;
      try {
        if (suiteLockHeld) {
          const unlocked = await client.query<{ unlocked: boolean }>(
            `SELECT pg_advisory_unlock(hashtext('roi-e007-finance-reconciliation-suite')) unlocked`
          );
          if (!unlocked.rows[0]?.unlocked) throw new Error('ROI-E007 setup advisory unlock returned false');
          suiteLockHeld = false;
        }
      } catch (releaseError) {
        cleanupError = releaseError;
      } finally {
        try {
          if (connected) {
            await client.end();
            connected = false;
          }
        } catch (endError) {
          cleanupError ??= endError;
        } finally {
          try {
            if (closePgPool) await closePgPool();
          } catch (poolError) {
            cleanupError ??= poolError;
          }
        }
      }
      if (cleanupError) throw new AggregateError([error, cleanupError], 'ROI-E007 setup and cleanup both failed');
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
    const financeReconciliationCommands: FinanceReconciliationCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiFinanceReconciliationCommands.js'
    );
    openRoiFinanceReconciliation = financeReconciliationCommands.openRoiFinanceReconciliation;
    openRoiFinanceReconciliationFromProjection = financeReconciliationCommands.openRoiFinanceReconciliationFromProjection;
    updateRoiFinanceReconciliationStatus = financeReconciliationCommands.updateRoiFinanceReconciliationStatus;
    recordFinanceOwnerGrantEvent = financeReconciliationCommands.recordFinanceOwnerGrantEvent;
    RoiFinanceLinkNotFoundError = financeReconciliationCommands.RoiFinanceLinkNotFoundError;
    const financeLinkRepo: FinanceLinkRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiFinanceLinkRepository.js'
    );
    listRoiFinanceReconciliations = financeLinkRepo.listRoiFinanceReconciliations;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    await insertOrganization();
    for (const userId of [USER_MAKER, USER_RESOLVER, USER_RESOLVER_2, USER_GRANTEE]) {
      await client.query(
        `INSERT INTO users (id,organization_id,email,password,role,status,first_name,last_name,created_at)
         VALUES ($1,$2,$3,'x','USER','active','Fin','Recon',now())`,
        [userId, ORG_ID, `${userId}@test.local`]
      );
      await client.query(
        `INSERT INTO organization_members (id,organization_id,user_id,role,status,created_at)
         VALUES ($1,$2,$3,'MEMBER','ACTIVE',now())`,
        [`${userId}-membership`, ORG_ID, userId]
      );
    }
    for (const resolverId of [USER_RESOLVER, USER_RESOLVER_2]) await client.query(
      `INSERT INTO rvn_finance_reconciliation_grant_events
       (organization_id,user_id,grant_version,action,acted_by,policy_version,policy_digest)
       VALUES ($1,$2,1,'granted',$3,$4,$5)`,
      [ORG_ID, resolverId, USER_MAKER,
        'DEC-FIN-RESULTS-RECONCILIATION-001/v1',
        'sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d']
    );
    await insertVisibilityPolicy('roi', 'OPEN_ORG', USER_MAKER);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    let inTransaction = false;
    try {
      const ownedCaseIds = (await client.query<{ case_id: string }>(
        `SELECT case_id::text case_id FROM rvn_roi_cases WHERE organization_id=$1`, [ORG_ID]
      )).rows.map((row) => row.case_id);
      const ownedEventIds = (await client.query<{ event_id: string }>(
        `SELECT event_id::text event_id FROM rvn_platform_events WHERE organization_id=$1`, [ORG_ID]
      )).rows.map((row) => row.event_id);
      await client.query('BEGIN');
      inTransaction = true;
      await client.query(`SET LOCAL session_replication_role = replica`);
      await client.query(`DELETE FROM rvn_finance_reconciliation_grant_events WHERE organization_id = ANY($1::text[])`, [[ORG_ID, SECOND_ORG_ID]]);
      await client.query(`DELETE FROM rvn_finance_reconciliation_decisions WHERE organization_id = $1`, [ORG_ID]);
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
      await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [[ORG_ID, SECOND_ORG_ID]]);
      await client.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[USER_MAKER, USER_RESOLVER, USER_RESOLVER_2, USER_GRANTEE]]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [[ORG_ID, SECOND_ORG_ID]]);
      await client.query('COMMIT');
      inTransaction = false;

      const postCommit = await client.query<{ residue: string; role: string; triggers_enabled: string }>(
        `SELECT (
           (SELECT count(*) FROM organizations WHERE id=ANY($1::text[])) +
           (SELECT count(*) FROM users WHERE id=ANY($2::text[])) +
           (SELECT count(*) FROM organization_members WHERE organization_id=ANY($1::text[])) +
           (SELECT count(*) FROM initiatives WHERE organization_id=ANY($1::text[])) +
           (SELECT count(*) FROM rvn_roi_cases WHERE organization_id=ANY($1::text[])) +
           (SELECT count(*) FROM rvn_roi_finance_links WHERE organization_id=ANY($1::text[])) +
           (SELECT count(*) FROM rvn_roi_finance_reconciliations WHERE organization_id=ANY($1::text[])) +
           (SELECT count(*) FROM rvn_finance_reconciliation_decisions WHERE organization_id=ANY($1::text[])) +
           (SELECT count(*) FROM rvn_finance_reconciliation_grant_events WHERE organization_id=ANY($1::text[])) +
           (SELECT count(*) FROM rvn_platform_events WHERE organization_id=ANY($1::text[])) +
           (SELECT count(*) FROM audit_events WHERE org_id=ANY($1::text[])) +
           (SELECT count(*) FROM rvn_platform_obligations WHERE organization_id=ANY($1::text[])) +
           (SELECT count(*) FROM rvn_platform_resource_visibility WHERE organization_id=ANY($1::text[])) +
           (SELECT count(*) FROM rvn_platform_visibility_policies WHERE organization_id=ANY($1::text[])) +
           (SELECT count(*) FROM rvn_roi_baselines WHERE organization_id=ANY($1::text[])) +
           (SELECT count(*) FROM rvn_roi_calculation_policy WHERE organization_id=ANY($1::text[])) +
           (SELECT count(*) FROM rvn_platform_resource_acl WHERE resource_id=ANY($4::text[])) +
           (SELECT count(*) FROM rvn_platform_outbox WHERE event_id::text=ANY($5::text[]))
         )::text residue,
         current_setting('session_replication_role') role,
         (SELECT count(*)::text FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O'
           AND tgname=ANY($3::text[])) triggers_enabled`,
        [
          [ORG_ID, SECOND_ORG_ID],
          [USER_MAKER, USER_RESOLVER, USER_RESOLVER_2, USER_GRANTEE],
          [
            'trg_rvn_fin_reconciliation_grant_insert_guard',
            'trg_rvn_fin_reconciliation_decision_append_only',
            'trg_rvn_fin_reconciliation_grant_append_only',
          ],
          ownedCaseIds,
          ownedEventIds,
        ]
      );
      expect(postCommit.rows[0]).toEqual({ residue: '0', role: 'origin', triggers_enabled: '3' });
    } catch (error) {
      if (inTransaction) await client.query('ROLLBACK');
      throw error;
    } finally {
      try {
        if (suiteLockHeld) {
          const unlocked = await client.query<{ unlocked: boolean }>(
            `SELECT pg_advisory_unlock(hashtext('roi-e007-finance-reconciliation-suite')) unlocked`
          );
          expect(unlocked.rows[0]?.unlocked).toBe(true);
          suiteLockHeld = false;
        }
        const locks = await client.query<{ count: string }>(
          `SELECT count(*)::text count FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()`
        );
        expect(locks.rows[0]?.count).toBe('0');
      } finally {
        try {
          if (connected) {
            await client.end();
            connected = false;
          }
        } finally {
          if (closePgPool) await closePgPool();
        }
      }
    }
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

  itDB('AC-03: openRoiFinanceReconciliation creates a durable record with status=open', async () => {
    const fixture = await buildCaseWithFinanceLink('1');
    const outcome = await openRoiFinanceReconciliation({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      financeLinkId: fixture.linkId,
      roiValue: 15000,
      financeValue: 14200,
      divergenceReason: 'Finance excludes one-time onboarding fee',
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `recon-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(outcome.outcome).toBe('applied');
    const reconciliation = outcome.result;
    expect(reconciliation.caseId).toBe(fixture.caseId);
    expect(reconciliation.financeLinkId).toBe(fixture.linkId);
    expect(reconciliation.roiValue).toBe(15000);
    expect(reconciliation.financeValue).toBe(14200);
    expect(reconciliation.status).toBe('open');
    expect(reconciliation.openedBy).toBe(USER_MAKER);
    expect(reconciliation.resolvedBy).toBeNull();
    expect(reconciliation.resolvedAt).toBeNull();
    expect(reconciliation.rowVersion).toBe(1);
  });

  itDB('public open requires ACTIVE membership; projection entrypoint accepts only an exact persisted tenant event and replays idempotently', async () => {
    const fixture = await buildCaseWithFinanceLink('system-authority');
    await client.query(
      `UPDATE organization_members SET status='REVOKED'
        WHERE organization_id=$1 AND user_id=$2`,
      [ORG_ID, USER_MAKER]
    );
    await expect(openRoiFinanceReconciliation({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      financeLinkId: fixture.linkId,
      roiValue: 100,
      financeValue: 120,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'member',
      idempotencyKey: `human-revoked-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    })).rejects.toMatchObject({ code: 'ACTIVE_TENANT_MEMBERSHIP_REQUIRED' });
    await client.query(
      `UPDATE organization_members SET status='ACTIVE'
        WHERE organization_id=$1 AND user_id=$2`,
      [ORG_ID, USER_MAKER]
    );

    const source = await client.query<{ event_id: string }>(
      `SELECT event_id FROM rvn_platform_events
        WHERE organization_id=$1 AND aggregate_id=$2 AND event_type='roi.finance_link_created'
        ORDER BY sequence DESC LIMIT 1`,
      [ORG_ID, fixture.caseId]
    );
    const sourceEventId = source.rows[0]!.event_id;
    const idempotencyKey = `system-reconciliation-${randomUUID()}`;
    const input = {
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      financeLinkId: fixture.linkId,
      roiValue: 100,
      financeValue: 120,
      divergenceReason: 'event_derived_value_mismatch',
      idempotencyKey,
      sourceEventId,
    };
    const opened = await openRoiFinanceReconciliationFromProjection(input);
    const replayed = await openRoiFinanceReconciliationFromProjection(input);
    expect(replayed.outcome).toBe('duplicate');
    expect(replayed.result.reconciliationId).toBe(opened.result.reconciliationId);

    await expect(openRoiFinanceReconciliationFromProjection({
      ...input,
      idempotencyKey: `spoof-${randomUUID()}`,
      sourceEventId: randomUUID(),
    })).rejects.toMatchObject({ code: 'FINANCE_PROJECTION_SOURCE_EVENT_REQUIRED' });
    await expect(openRoiFinanceReconciliationFromProjection({
      ...input,
      idempotencyKey: `tenant-spoof-${randomUUID()}`,
      organizationId: `${ORG_ID}-foreign`,
    })).rejects.toMatchObject({ code: 'FINANCE_PROJECTION_SOURCE_EVENT_REQUIRED' });

    const audit = await client.query<{ actor_user_id: string; source: string; payload: Record<string, unknown> }>(
      `SELECT actor_user_id,source,payload FROM rvn_platform_events
        WHERE organization_id=$1 AND idempotency_key=$2`,
      [ORG_ID, idempotencyKey]
    );
    expect(audit.rows[0]).toMatchObject({
      actor_user_id: 'system:finance_projection_consumer',
      source: 'results.finance_projection_consumer',
      payload: { authorityKind: 'finance_projection', sourceEventId },
    });
  });

  itDB('materiality policy accepts equal-value currency mismatch, rejects same-currency <=5%, and accepts >5%', async () => {
    const currencyFixture = await buildCaseWithFinanceLink('currency-hard-divergence');
    const currencyOutcome = await openRoiFinanceReconciliation({
      caseId: currencyFixture.caseId,
      organizationId: ORG_ID,
      financeLinkId: currencyFixture.linkId,
      roiValue: 100,
      financeValue: 100,
      divergenceReason: 'currency_mismatch',
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'member',
      idempotencyKey: `currency-hard-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    expect(currencyOutcome.result.divergenceReason).toBe('currency_mismatch');

    const thresholdFixture = await buildCaseWithFinanceLink('numeric-threshold');
    await expect(openRoiFinanceReconciliation({
      caseId: thresholdFixture.caseId,
      organizationId: ORG_ID,
      financeLinkId: thresholdFixture.linkId,
      roiValue: 100,
      financeValue: 105,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'member',
      idempotencyKey: `within-threshold-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    })).rejects.toMatchObject({ code: 'FINANCE_RECONCILIATION_WITHIN_TOLERANCE' });
    const aboveThreshold = await openRoiFinanceReconciliation({
      caseId: thresholdFixture.caseId,
      organizationId: ORG_ID,
      financeLinkId: thresholdFixture.linkId,
      roiValue: 100,
      financeValue: 105.01,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'member',
      idempotencyKey: `above-threshold-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    expect(aboveThreshold.result.status).toBe('open');
  });

  itDB('openRoiFinanceReconciliation validates financeLinkId belongs to the case', async () => {
    const fixture = await buildCaseWithFinanceLink('2');
    await expect(
      openRoiFinanceReconciliation({
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        financeLinkId: randomUUID(), // fabricated — does not belong to this case
        roiValue: 100,
        financeValue: 90,
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `recon-bad-link-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toThrow(RoiFinanceLinkNotFoundError);
  });

  itDB('listRoiFinanceReconciliations: `::text` visibility join executes against real rows', async () => {
    const fixture = await buildCaseWithFinanceLink('3');
    await openRoiFinanceReconciliation({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      financeLinkId: fixture.linkId,
      roiValue: 500,
      financeValue: 469,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `recon-list-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const reconciliations = await listRoiFinanceReconciliations({
      userId: USER_MAKER,
      organizationId: ORG_ID,
      caseId: fixture.caseId,
    });
    expect(reconciliations).toHaveLength(1);
    expect(reconciliations[0]!.financeLinkId).toBe(fixture.linkId);
  });

  itDB('updateRoiFinanceReconciliationStatus: CAS on the reconciliation\'s OWN row_version; stale expectedVersion rejected', async () => {
    const fixture = await buildCaseWithFinanceLink('4');
    const openOutcome = await openRoiFinanceReconciliation({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      financeLinkId: fixture.linkId,
      roiValue: 1000,
      financeValue: 900,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `recon-cas-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const reconciliationId = openOutcome.result.reconciliationId;

    const updateOutcome = await updateRoiFinanceReconciliationStatus({
      reconciliationId,
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: openOutcome.result.rowVersion,
      status: 'investigating',
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `recon-cas-update-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(updateOutcome.result.status).toBe('investigating');
    // Not terminal — resolvedBy/resolvedAt stay unset.
    expect(updateOutcome.result.resolvedBy).toBeNull();
    expect(updateOutcome.result.resolvedAt).toBeNull();
    // Facts unchanged by the status update.
    expect(updateOutcome.result.roiValue).toBe(1000);
    expect(updateOutcome.result.financeValue).toBe(900);

    const { AtomicWriteConflictError } = await import('../../../server/src/services/resultsVnext/platform/atomicWrite.js');
    await expect(
      updateRoiFinanceReconciliationStatus({
        reconciliationId,
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        expectedVersion: openOutcome.result.rowVersion, // stale — already moved to updateOutcome.resultingVersion
        status: 'resolved',
        actorUserId: USER_RESOLVER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `recon-cas-stale-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toThrow(AtomicWriteConflictError);
  });

  itDB('Decision D1: transitioning to a TERMINAL status sets resolvedBy/resolvedAt', async () => {
    const fixture = await buildCaseWithFinanceLink('5');
    const openOutcome = await openRoiFinanceReconciliation({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      financeLinkId: fixture.linkId,
      roiValue: 2000,
      financeValue: 1800,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `recon-terminal-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    const resolvedOutcome = await updateRoiFinanceReconciliationStatus({
      reconciliationId: openOutcome.result.reconciliationId,
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: openOutcome.result.rowVersion,
      status: 'resolved',
      resolutionNotes: 'Confirmed timing difference, both figures correct',
      actorUserId: USER_RESOLVER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `recon-resolve-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(resolvedOutcome.result.status).toBe('resolved');
    expect(resolvedOutcome.result.resolvedBy).toBe(USER_RESOLVER);
    expect(resolvedOutcome.result.resolvedAt).not.toBeNull();
    expect(resolvedOutcome.result.resolutionNotes).toBe('Confirmed timing difference, both figures correct');
  });

  itDB(
    'Decision D1 — event fan-out DIFFERS by terminal vs. non-terminal transition: ' +
      "'investigating' fans ONLY to mywork_projection; 'resolved' ALSO fans to finance_projection",
    async () => {
      const fixture = await buildCaseWithFinanceLink('6');

      // roi.finance_reconciliation_opened — always dual-fans (design §4).
      const openOutcome = await openRoiFinanceReconciliation({
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        financeLinkId: fixture.linkId,
        roiValue: 300,
        financeValue: 250,
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `recon-fanout-open-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const openedGroups = await outboxConsumerGroups('roi.finance_reconciliation_opened', fixture.caseId);
      expect(openedGroups).toEqual(['finance_projection', 'mywork_projection']);

      // Non-terminal transition -> lighter event, mywork_projection ONLY.
      const investigatingOutcome = await updateRoiFinanceReconciliationStatus({
        reconciliationId: openOutcome.result.reconciliationId,
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        expectedVersion: openOutcome.result.rowVersion,
        status: 'investigating',
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `recon-fanout-investigating-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const investigatingGroups = await outboxConsumerGroups(
        'roi.finance_reconciliation_status_updated',
        fixture.caseId
      );
      expect(investigatingGroups).toEqual(['mywork_projection']);
      const investigatingResolvedGroups = await outboxConsumerGroups(
        'roi.finance_reconciliation_resolved',
        fixture.caseId
      );
      expect(investigatingResolvedGroups).toEqual([]);

      // Terminal transition -> heavier event, dual-fans.
      await updateRoiFinanceReconciliationStatus({
        reconciliationId: openOutcome.result.reconciliationId,
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        expectedVersion: investigatingOutcome.resultingVersion,
        status: 'accepted_divergence',
        resolutionNotes: 'Client accepted residual variance',
        actorUserId: USER_RESOLVER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `recon-fanout-accepted-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const resolvedGroups = await outboxConsumerGroups('roi.finance_reconciliation_resolved', fixture.caseId);
      expect(resolvedGroups).toEqual(['finance_projection', 'mywork_projection']);
    }
  );

  itDB('DEC-FIN: terminal resolution is capability-only, forbids responsible/self bypass, and CAS has one winner', async () => {
    const fixture = await buildCaseWithFinanceLink('7');
    const idempotencyKey = `recon-policy-${randomUUID()}`;
    const openInput = {
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      financeLinkId: fixture.linkId,
      reconciliationKind: 'proposal' as const,
      roiValue: -100,
      financeValue: -105.0001,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'member',
      idempotencyKey,
      access: { capabilities: ['results.roi.finance_reconciliation.open'], platformRole: null },
    };
    const opened = await openRoiFinanceReconciliation(openInput);
    const replayed = await openRoiFinanceReconciliation(openInput);
    expect(replayed.outcome).toBe('duplicate');
    expect(replayed.result.reconciliationId).toBe(opened.result.reconciliationId);
    await expect(openRoiFinanceReconciliation({
      ...openInput,
      financeValue: -106,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_FINGERPRINT_CONFLICT' });
    expect(opened.result).toMatchObject({
      reconciliationKind: 'proposal',
      decisionPolicyVersion: 'DEC-FIN-RESULTS-RECONCILIATION-001/v1',
      decisionPolicyDigest: 'sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d',
    });

    const common = {
      reconciliationId: opened.result.reconciliationId,
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: opened.result.rowVersion,
      status: 'resolved' as const,
      actorEffectiveRole: 'member',
    };
    await expect(updateRoiFinanceReconciliationStatus({
      ...common,
      actorUserId: USER_MAKER,
      idempotencyKey: `self-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    })).rejects.toMatchObject({ code: 'FINANCE_OWNER_GRANT_REQUIRED' });
    await expect(updateRoiFinanceReconciliationStatus({
      ...common,
      actorUserId: USER_MAKER,
      idempotencyKey: `unauthorized-${randomUUID()}`,
      access: { capabilities: [], platformRole: null },
    })).rejects.toMatchObject({ code: 'FINANCE_OWNER_GRANT_REQUIRED' });

    const attempts = await Promise.allSettled([
      updateRoiFinanceReconciliationStatus({
        ...common,
        actorUserId: USER_RESOLVER,
        idempotencyKey: `winner-a-${randomUUID()}`,
        access: { capabilities: ['results.roi.finance_reconciliation.resolve'], platformRole: null },
      }),
      updateRoiFinanceReconciliationStatus({
        ...common,
        actorUserId: USER_RESOLVER_2,
        idempotencyKey: `winner-b-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
      }),
    ]);
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const decision = await client.query<{
      decision_id: string;
      decision_version: number;
      decision_policy_digest: string;
    }>(
      `SELECT decision_id, decision_version, decision_policy_digest
         FROM rvn_finance_reconciliation_decisions
        WHERE reconciliation_id = $1`,
      [opened.result.reconciliationId]
    );
    expect(decision.rows).toHaveLength(1);
    expect(decision.rows[0]).toMatchObject({
      decision_version: 2,
      decision_policy_digest: 'sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d',
    });
    await expect(
      client.query(
        `UPDATE rvn_finance_reconciliation_decisions SET resolution_notes='tampered'
          WHERE decision_id=$1`,
        [decision.rows[0]!.decision_id]
      )
    ).rejects.toThrow(/append-only/i);

    const event = await client.query<{ policy_version: string; payload: Record<string, unknown> }>(
      `SELECT policy_version, payload FROM rvn_platform_events
        WHERE organization_id = $1 AND event_type = 'roi.finance_reconciliation_resolved'
          AND aggregate_id = $2 ORDER BY occurred_at DESC LIMIT 1`,
      [ORG_ID, fixture.caseId]
    );
    expect(event.rows[0]?.policy_version).toBe(
      'DEC-FIN-RESULTS-RECONCILIATION-001/v1@sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d'
    );
    expect(event.rows[0]?.payload).toMatchObject({
      decisionPolicyVersion: 'DEC-FIN-RESULTS-RECONCILIATION-001/v1',
    });
  });

  it('records one durable Finance-owner grant under 8-way concurrency and rejects fingerprint collisions', async () => {
    if (!reachable) return;
    const input = {
      organizationId: ORG_ID,
      userId: USER_GRANTEE,
      action: 'granted' as const,
      actorUserId: USER_MAKER,
      idempotencyKey: `grant-${tag}`,
      access: { capabilities: ['*'], platformRole: null },
    };
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => recordFinanceOwnerGrantEvent(input)));
    expect(outcomes.filter((row) => row.outcome === 'applied')).toHaveLength(1);
    expect(outcomes.filter((row) => row.outcome === 'replayed')).toHaveLength(7);
    expect(new Set(outcomes.map((row) => `${row.receiptId}:${row.grantVersion}`)).size).toBe(1);
    await client.query(
      `INSERT INTO organizations (id,name,plan,status) VALUES($1,$2,'enterprise','active')`,
      [SECOND_ORG_ID, 'Finance grant second-tenant fixture']
    );
    for (const userId of [USER_MAKER, USER_GRANTEE]) {
      await client.query(
        `INSERT INTO organization_members (id,organization_id,user_id,role,status,created_at)
         VALUES($1,$2,$3,'MEMBER','ACTIVE',now())`,
        [`${SECOND_ORG_ID}-${userId}`, SECOND_ORG_ID, userId]
      );
    }
    const sameRawKeyOtherTenant = await recordFinanceOwnerGrantEvent({ ...input, organizationId: SECOND_ORG_ID });
    expect(sameRawKeyOtherTenant.outcome).toBe('applied');
    expect(sameRawKeyOtherTenant.receiptId).not.toBe(outcomes[0]!.receiptId);
    await expect(recordFinanceOwnerGrantEvent({ ...input, action: 'revoked' })).rejects.toMatchObject({
      code: 'FINANCE_OWNER_GRANT_IDEMPOTENCY_COLLISION',
    });
    await expect(recordFinanceOwnerGrantEvent({ ...input, userId: USER_MAKER })).rejects.toMatchObject({
      code: 'FINANCE_OWNER_GRANT_SELF_DENIED',
    });
    expect((await client.query(
      `SELECT count(*)::int n FROM rvn_finance_reconciliation_grant_events WHERE organization_id=$1 AND user_id=$2`,
      [ORG_ID, USER_GRANTEE]
    )).rows[0]?.n).toBe(1);
  });
});
