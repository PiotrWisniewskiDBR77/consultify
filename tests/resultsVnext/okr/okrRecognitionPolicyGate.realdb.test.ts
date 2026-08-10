/**
 * OKR-E006 — `postRecognition`'s fail-closed `program.recognition_enabled`
 * gate, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E006_DESIGN.md §8.2: "Fail-closed
 * on program.recognition_enabled = false... throws
 * OkrRecognitionDisabledError (409) before any write" — mirrors
 * `createOkrSet`'s fail-closed-on-no-active-visibility-policy pattern
 * (OKR-E002 §4.1).
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
const ORG_ID = `okr-e006-recognition-gate-org-${tag}`;
const USER_ADMIN = `okr-e006-recognition-gate-admin-${tag}`;
const USER_OWNER = `okr-e006-recognition-gate-owner-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type SupportCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSupportCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let postRecognition: SupportCommandsModule['postRecognition'];
let OkrRecognitionDisabledError: SupportCommandsModule['OkrRecognitionDisabledError'];
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

async function makeSetWithObjective(
  organizationId: string,
  recognitionEnabled: boolean
): Promise<{ setId: string; objectiveId: string }> {
  const created = await createProgram({
    organizationId,
    name: 'Recognition-gate fixture Program',
    recognitionEnabled,
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-program-${randomUUID()}`,
  });
  await publishProgram({
    programId: created.result.programId,
    organizationId,
    expectedVersion: created.result.rowVersion,
    actorUserId: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `publish-program-${randomUUID()}`,
  });
  const cycle = await createCycle({
    organizationId,
    programId: created.result.programId,
    name: 'Recognition-gate fixture Cycle',
    ...baseCycleTimes(),
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-cycle-${randomUUID()}`,
  });
  const set = await createOkrSet({
    organizationId,
    programId: created.result.programId,
    cycleId: cycle.result.cycleId,
    scopeType: 'individual',
    scopeId: USER_OWNER,
    ownerUserId: USER_OWNER,
    title: 'Recognition-gate fixture Set',
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-set-${randomUUID()}`,
  });
  const objective = await createObjective({
    setId: set.result.set.setId,
    organizationId,
    ownerUserId: USER_OWNER,
    title: 'Recognition-gate fixture Objective',
    createdBy: USER_OWNER,
    actorEffectiveRole: 'member',
    idempotencyKey: `create-objective-${randomUUID()}`,
  });
  return { setId: set.result.set.setId, objectiveId: objective.result.objectiveId };
}

describe('OKR-E006 postRecognition — program.recognition_enabled fail-closed gate (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E006 recognition-gate tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_support_requests LIMIT 0');
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
    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    createOkrSet = setCommands.createOkrSet;
    const objectiveCommands: ObjectiveCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js'
    );
    createObjective = objectiveCommands.createObjective;
    const supportCommands: SupportCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSupportCommands.js');
    postRecognition = supportCommands.postRecognition;
    OkrRecognitionDisabledError = supportCommands.OkrRecognitionDisabledError;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    const orgLike = `${ORG_ID}%`;
    await client.query(`DELETE FROM okr_vnext_support_requests WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_objectives WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id LIKE $1 AND resource_type = 'okr_set'`, [
      orgLike,
    ]);
    await client.query(`DELETE FROM okr_vnext_sets WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_cycles WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`UPDATE okr_vnext_programs SET active_policy_version_id = NULL WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_program_policy_versions WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_programs WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id LIKE $1)`,
      [orgLike]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id LIKE $1`, [orgLike]);
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

  itDB('recognition_enabled=true (default): postRecognition succeeds', async () => {
    const orgId = `${ORG_ID}-enabled`;
    const fx = await makeSetWithObjective(orgId, true);
    const outcome = await postRecognition({
      setId: fx.setId,
      objectiveId: fx.objectiveId,
      organizationId: orgId,
      body: 'Great work closing this out!',
      recognitionVisibility: 'team',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `post-recognition-enabled-${randomUUID()}`,
    });
    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.kind).toBe('recognition');
    expect(outcome.result.recognitionVisibility).toBe('team');
  });

  itDB('recognition_enabled=false: postRecognition throws OkrRecognitionDisabledError BEFORE any write', async () => {
    const orgId = `${ORG_ID}-disabled`;
    const fx = await makeSetWithObjective(orgId, false);

    await expect(
      postRecognition({
        setId: fx.setId,
        objectiveId: fx.objectiveId,
        organizationId: orgId,
        body: 'Great work — should be blocked',
        recognitionVisibility: 'team',
        createdBy: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `post-recognition-disabled-${randomUUID()}`,
      })
    ).rejects.toBeInstanceOf(OkrRecognitionDisabledError);

    // Fail-CLOSED, not fail-open: no row was written.
    const rows = await client.query(
      `SELECT 1 FROM okr_vnext_support_requests WHERE organization_id = $1 AND kind = 'recognition'`,
      [orgId]
    );
    expect(rows.rows).toHaveLength(0);
  });
});
