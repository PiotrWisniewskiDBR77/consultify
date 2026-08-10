/**
 * OKR-E006 — Support-request visibility-join regression, against a REAL
 * Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E006_DESIGN.md §12: "Mandatory
 * `::text` cast on every join... the single most-repeated real bug in this
 * program." `rvn_platform_resource_visibility.resource_id` is TEXT;
 * `okr_vnext_support_requests.set_id` is UUID —
 * `okrSupportRepository.ts`'s `listSupportRequestsForSet`/`getSupportRequest`
 * join `vr.resource_id = sr.set_id::text`. This test proves that cast
 * executes against real rows (Postgres 42883 "operator does not exist: text
 * = uuid" would fire on the very first row otherwise) AND that visibility
 * is genuinely enforced.
 *
 * Uses lightweight direct-SQL fixture rows (mirrors
 * `okrCheckInVisibilityJoin.realdb.test.ts`'s own shape) rather than driving
 * the full command chain — visibility inheritance via `set_id` is what this
 * file tests, not command-layer lifecycle correctness (covered by
 * okrSupportRequestLifecycle.realdb.test.ts).
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
const ORG_ID = `okr-e006-vis-join-org-${tag}`;
const USER_GRANTEE = `okr-e006-vis-join-grantee-${tag}`;
const USER_OUTSIDER = `okr-e006-vis-join-outsider-${tag}`;
const USER_ADMIN = `okr-e006-vis-join-admin-${tag}`;

let client: Client;
let reachable = false;
let programId: string;
let cycleId: string;
let policyId: string;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SupportRepositoryModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSupportRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let listSupportRequestsForSet: SupportRepositoryModule['listSupportRequestsForSet'];
let getSupportRequest: SupportRepositoryModule['getSupportRequest'];
let closePgPool: (() => Promise<void>) | undefined;

function baseCycleTimes() {
  return {
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    draftOpenAt: '2025-12-15T00:00:00.000Z',
    submissionDueAt: '2025-12-28T00:00:00.000Z',
    activeStartAt: '2026-01-01T00:00:00.000Z',
    finalUpdateDueAt: '2026-03-20T00:00:00.000Z',
    reviewOpenAt: '2026-03-21T00:00:00.000Z',
    reflectionDueAt: '2026-03-25T00:00:00.000Z',
    closeAt: '2026-03-31T00:00:00.000Z',
  };
}

interface SupportRequestFixtureIds {
  setId: string;
  objectiveId: string;
  requestId: string;
}

/** Direct-SQL fixture: one Set/Objective/support-request row, bypassing the
 * command layer. */
async function insertFixtureSupportRequest(ownerUserId: string): Promise<SupportRequestFixtureIds> {
  const setId = randomUUID();
  const objectiveId = randomUUID();
  const requestId = randomUUID();

  await client.query(
    `INSERT INTO okr_vnext_sets
       (set_id, organization_id, program_id, cycle_id, scope_type, scope_id, owner_user_id, title, created_by)
     VALUES ($1, $2, $3, $4, 'individual', $5, $6, 'Visibility-join fixture Set', $6)`,
    [setId, ORG_ID, programId, cycleId, setId, ownerUserId]
  );
  await client.query(
    `INSERT INTO okr_vnext_objectives (objective_id, set_id, organization_id, owner_user_id, title, created_by)
     VALUES ($1, $2, $3, $4, 'Visibility-join fixture Objective', $4)`,
    [objectiveId, setId, ORG_ID, ownerUserId]
  );
  await client.query(
    `INSERT INTO okr_vnext_support_requests (request_id, organization_id, set_id, objective_id, kind, body, created_by)
     VALUES ($1, $2, $3, $4, 'comment', 'Visibility-join fixture comment', $5)`,
    [requestId, ORG_ID, setId, objectiveId, ownerUserId]
  );

  return { setId, objectiveId, requestId };
}

async function insertSetVisibility(setId: string, mode: string, ownerUserId: string | null): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_visibility
       (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
     VALUES ('okr_set', $1, $2, $3, $4, $5)`,
    [setId, ORG_ID, mode, policyId, ownerUserId]
  );
}

async function grantAcl(setId: string, granteeUserId: string, grantedBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_acl
       (resource_type, resource_id, grantee_type, grantee_id, access_level, granted_by)
     VALUES ('okr_set', $1, 'user', $2, 'contribute', $3)`,
    [setId, granteeUserId, grantedBy]
  );
}

describe('OKR-E006 Support-request visibility-join regression — TEXT/UUID cast forces real join execution (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E006 support-request visibility-join tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_support_requests LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id))`
      );
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR-E006 support schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const programCommands: ProgramCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
    createProgram = programCommands.createProgram;
    publishProgram = programCommands.publishProgram;
    const cycleCommands: CycleCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
    createCycle = cycleCommands.createCycle;
    const supportRepository: SupportRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrSupportRepository.js'
    );
    listSupportRequestsForSet = supportRepository.listSupportRequestsForSet;
    getSupportRequest = supportRepository.getSupportRequest;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    const created = await createProgram({
      organizationId: ORG_ID,
      name: 'Support-request visibility-join fixture Program',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-program-${randomUUID()}`,
    });
    await publishProgram({
      programId: created.result.programId,
      organizationId: ORG_ID,
      expectedVersion: created.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `publish-program-${randomUUID()}`,
    });
    programId = created.result.programId;
    const cycle = await createCycle({
      organizationId: ORG_ID,
      programId,
      name: 'Support-request visibility-join fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-${randomUUID()}`,
    });
    cycleId = cycle.result.cycleId;

    const policyRow = await client.query<{ policy_id: string }>(
      `SELECT policy_id FROM rvn_platform_visibility_policies WHERE organization_id = $1 AND domain = 'okr' AND is_active = true`,
      [ORG_ID]
    );
    policyId = policyRow.rows[0]!.policy_id;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM okr_vnext_support_requests WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_objectives WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_resource_acl
        WHERE resource_type = 'okr_set'
          AND resource_id IN (SELECT set_id::text FROM okr_vnext_sets WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1 AND resource_type = 'okr_set'`, [
      ORG_ID,
    ]);
    await client.query(`DELETE FROM okr_vnext_sets WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_cycles WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`UPDATE okr_vnext_programs SET active_policy_version_id = NULL WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_program_policy_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_programs WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id LIKE $1)`,
      [`${ORG_ID}%`]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
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

  itDB('OPEN_ORG: every org member sees the support request via listSupportRequestsForSet/getSupportRequest', async () => {
    const fx = await insertFixtureSupportRequest(USER_GRANTEE);
    await insertSetVisibility(fx.setId, 'OPEN_ORG', USER_GRANTEE);

    const outsiderList = await listSupportRequestsForSet({ userId: USER_OUTSIDER, organizationId: ORG_ID, setId: fx.setId });
    expect(outsiderList.map((r) => r.requestId)).toContain(fx.requestId);

    const outsiderGet = await getSupportRequest({ userId: USER_OUTSIDER, organizationId: ORG_ID, requestId: fx.requestId });
    expect(outsiderGet).not.toBeNull();
    expect(outsiderGet?.requestId).toBe(fx.requestId);
  });

  itDB(
    'RESTRICTED_ACL: visible to its ACL grantee, invisible to an outsider — proves the ' +
      '`vr.resource_id = sr.set_id::text` join executes against real rows instead of throwing 42883 ' +
      '(text = uuid) or silently matching nothing',
    async () => {
      const fx = await insertFixtureSupportRequest(USER_GRANTEE);
      await insertSetVisibility(fx.setId, 'RESTRICTED_ACL', USER_GRANTEE);
      await grantAcl(fx.setId, USER_GRANTEE, USER_GRANTEE);

      const granteeList = await listSupportRequestsForSet({ userId: USER_GRANTEE, organizationId: ORG_ID, setId: fx.setId });
      expect(granteeList.map((r) => r.requestId)).toContain(fx.requestId);

      const granteeGet = await getSupportRequest({ userId: USER_GRANTEE, organizationId: ORG_ID, requestId: fx.requestId });
      expect(granteeGet).not.toBeNull();

      const outsiderList = await listSupportRequestsForSet({ userId: USER_OUTSIDER, organizationId: ORG_ID, setId: fx.setId });
      expect(outsiderList.map((r) => r.requestId)).not.toContain(fx.requestId);

      const outsiderGet = await getSupportRequest({ userId: USER_OUTSIDER, organizationId: ORG_ID, requestId: fx.requestId });
      expect(outsiderGet).toBeNull();
    }
  );

  itDB('PRIVATE: visible only to the owner, invisible to a grantee-less outsider', async () => {
    const fx = await insertFixtureSupportRequest(USER_GRANTEE);
    await insertSetVisibility(fx.setId, 'PRIVATE', USER_GRANTEE);

    const ownerGet = await getSupportRequest({ userId: USER_GRANTEE, organizationId: ORG_ID, requestId: fx.requestId });
    expect(ownerGet).not.toBeNull();

    const outsiderGet = await getSupportRequest({ userId: USER_OUTSIDER, organizationId: ORG_ID, requestId: fx.requestId });
    expect(outsiderGet).toBeNull();
  });

  itDB('listSupportRequestsForSet kind filter narrows results', async () => {
    const fx = await insertFixtureSupportRequest(USER_GRANTEE);
    await insertSetVisibility(fx.setId, 'OPEN_ORG', USER_GRANTEE);

    const commentsOnly = await listSupportRequestsForSet({
      userId: USER_GRANTEE,
      organizationId: ORG_ID,
      setId: fx.setId,
      kind: 'comment',
    });
    expect(commentsOnly.map((r) => r.requestId)).toContain(fx.requestId);

    const recognitionOnly = await listSupportRequestsForSet({
      userId: USER_GRANTEE,
      organizationId: ORG_ID,
      setId: fx.setId,
      kind: 'recognition',
    });
    expect(recognitionOnly.map((r) => r.requestId)).not.toContain(fx.requestId);
  });
});
