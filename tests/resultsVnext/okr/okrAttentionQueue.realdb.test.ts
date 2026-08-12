/**
 * OKR-E006 — `listOrganizationOkrAttention`: all 5 signal types (stale
 * check-ins, low-confidence Objectives/KRs, open support requests, open
 * blockers, escalated Sets), scoped by manager, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E006_DESIGN.md §9/§15 DoD
 * ("AC-020 proven: listOrganizationOkrAttention returns all 5 signal types
 * correctly, scoped by manager; management-chain gap restated explicitly").
 *
 * Uses lightweight direct-SQL fixture rows for the signal conditions
 * (mirrors every other `*VisibilityJoin.realdb.test.ts` file's own
 * approach) — command-layer lifecycle correctness for check-ins/support
 * requests is covered elsewhere; this file tests the read-model's signal
 * detection and manager-scoping only.
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
const ORG_ID = `okr-e006-attention-org-${tag}`;
const USER_ADMIN = `okr-e006-attention-admin-${tag}`;
const USER_MANAGER = `okr-e006-attention-manager-${tag}`;
const USER_OTHER_MANAGER = `okr-e006-attention-other-manager-${tag}`;

let client: Client;
let reachable = false;
let programId: string;
let cycleId: string;
let policyId: string;
let policyVersionId: string;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type AttentionRepositoryModule = typeof import('../../../server/src/services/resultsVnext/okr/okrAttentionRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let listOrganizationOkrAttention: AttentionRepositoryModule['listOrganizationOkrAttention'];
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

/** Direct-SQL fixture: a Set owned by `ownerUserId` with visibility OPEN_ORG
 * (so the manager's own visibility CTE branch never blocks the signal —
 * this file tests SIGNAL detection + management-chain scoping, not ABAC). */
async function insertFixtureSet(ownerUserId: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const setId = randomUUID();
  const attentionState = (overrides.attentionState as string) ?? 'none';
  const nextCheckinDueAt = (overrides.nextCheckinDueAt as string | null) ?? null;
  await client.query(
    `INSERT INTO okr_vnext_sets
       (set_id, organization_id, program_id, cycle_id, scope_type, scope_id, owner_user_id, title, created_by,
        attention_state, next_checkin_due_at)
     VALUES ($1, $2, $3, $4, 'individual', $8, $5, 'Attention fixture Set', $5, $6, $7)`,
    [setId, ORG_ID, programId, cycleId, ownerUserId, attentionState, nextCheckinDueAt, setId]
  );
  await client.query(
    `INSERT INTO rvn_platform_resource_visibility
       (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
     VALUES ('okr_set', $1, $2, 'OPEN_ORG', $3, $4)`,
    [setId, ORG_ID, policyId, ownerUserId]
  );
  return setId;
}

async function insertFixtureObjectiveAndKr(
  setId: string,
  ownerUserId: string,
  confidence: string | null
): Promise<{ objectiveId: string; keyResultId: string }> {
  const objectiveId = randomUUID();
  const keyResultId = randomUUID();
  await client.query(
    `INSERT INTO okr_vnext_objectives (objective_id, set_id, organization_id, owner_user_id, title, created_by)
     VALUES ($1, $2, $3, $4, 'Attention fixture Objective', $4)`,
    [objectiveId, setId, ORG_ID, ownerUserId]
  );
  await client.query(
    `INSERT INTO okr_vnext_key_results
       (key_result_id, objective_id, set_id, organization_id, owner_user_id, title,
        measurement_type, direction, target_value, current_value, confidence, progress_calc_policy_version_id, created_by)
     VALUES ($1, $2, $3, $4, $5, 'Attention fixture KR', 'numeric', 'increase', 10, 5, $6, $7, $5)`,
    [keyResultId, objectiveId, setId, ORG_ID, ownerUserId, confidence, policyVersionId]
  );
  return { objectiveId, keyResultId };
}

describe('OKR-E006 listOrganizationOkrAttention — 5 signal types, manager-scoped (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E006 attention-queue tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_support_requests LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR-E006 schema); refusing to report a green run. ' + String(error)
      );
    }
    reachable = true;

    const programCommands: ProgramCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
    createProgram = programCommands.createProgram;
    publishProgram = programCommands.publishProgram;
    const cycleCommands: CycleCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
    createCycle = cycleCommands.createCycle;
    const attentionRepository: AttentionRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrAttentionRepository.js'
    );
    listOrganizationOkrAttention = attentionRepository.listOrganizationOkrAttention;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    const created = await createProgram({
      organizationId: ORG_ID,
      name: 'Attention-queue fixture Program',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    await publishProgram({
      programId: created.result.programId,
      organizationId: ORG_ID,
      expectedVersion: created.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `publish-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    programId = created.result.programId;
    const cycle = await createCycle({
      organizationId: ORG_ID,
      programId,
      name: 'Attention-queue fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    cycleId = cycle.result.cycleId;

    const policyRow = await client.query<{ policy_id: string }>(
      `SELECT policy_id FROM rvn_platform_visibility_policies WHERE organization_id = $1 AND domain = 'okr' AND is_active = true`,
      [ORG_ID]
    );
    policyId = policyRow.rows[0]!.policy_id;

    const policyVersionRow = await client.query<{ policy_version_id: string }>(
      `SELECT policy_version_id FROM okr_vnext_program_policy_versions WHERE program_id = $1`,
      [programId]
    );
    policyVersionId = policyVersionRow.rows[0]!.policy_version_id;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM okr_vnext_support_requests WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_checkins WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_checkin_occurrences WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_key_results WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_objectives WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1 AND resource_type = 'okr_set'`, [
      ORG_ID,
    ]);
    await client.query(`DELETE FROM okr_vnext_sets WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_cycles WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`UPDATE okr_vnext_programs SET active_policy_version_id = NULL WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_program_policy_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_programs WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
      [ORG_ID]
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

  itDB('staleCheckins: a Set owned by the manager with next_checkin_due_at in the past is flagged', async () => {
    const setId = await insertFixtureSet(USER_MANAGER, { nextCheckinDueAt: '2020-01-01T00:00:00.000Z' });
    const attention = await listOrganizationOkrAttention({ managerId: USER_MANAGER, organizationId: ORG_ID });
    expect(attention.staleCheckins.map((s) => s.setId)).toContain(setId);
  });

  itDB('lowConfidenceObjectives: a KR with confidence=low is flagged regardless of progress', async () => {
    const setId = await insertFixtureSet(USER_MANAGER);
    const { keyResultId } = await insertFixtureObjectiveAndKr(setId, USER_MANAGER, 'low');
    const attention = await listOrganizationOkrAttention({ managerId: USER_MANAGER, organizationId: ORG_ID });
    expect(attention.lowConfidenceObjectives.map((o) => o.keyResultId)).toContain(keyResultId);
  });

  itDB('lowConfidenceObjectives: a KR with confidence=high is NOT flagged', async () => {
    const setId = await insertFixtureSet(USER_MANAGER);
    const { keyResultId } = await insertFixtureObjectiveAndKr(setId, USER_MANAGER, 'high');
    const attention = await listOrganizationOkrAttention({ managerId: USER_MANAGER, organizationId: ORG_ID });
    expect(attention.lowConfidenceObjectives.map((o) => o.keyResultId)).not.toContain(keyResultId);
  });

  itDB('openSupportRequests: an open support_request under the manager\'s Set is flagged', async () => {
    const setId = await insertFixtureSet(USER_MANAGER);
    const { objectiveId } = await insertFixtureObjectiveAndKr(setId, USER_MANAGER, null);
    const requestId = randomUUID();
    await client.query(
      `INSERT INTO okr_vnext_support_requests (request_id, organization_id, set_id, objective_id, kind, body, status, assigned_to_user_id, created_by)
       VALUES ($1, $2, $3, $4, 'support_request', 'blocked', 'open', $5, $5)`,
      [requestId, ORG_ID, setId, objectiveId, USER_MANAGER]
    );
    const attention = await listOrganizationOkrAttention({ managerId: USER_MANAGER, organizationId: ORG_ID });
    expect(attention.openSupportRequests.map((r) => r.requestId)).toContain(requestId);
  });

  itDB('openBlockers: a current check-in with a blocker and no linked support_request is flagged', async () => {
    const setId = await insertFixtureSet(USER_MANAGER);
    const { objectiveId, keyResultId } = await insertFixtureObjectiveAndKr(setId, USER_MANAGER, null);
    const occurrenceId = randomUUID();
    const checkInId = randomUUID();
    await client.query(
      `INSERT INTO okr_vnext_checkin_occurrences (cadence_occurrence_id, organization_id, cycle_id, window_start, window_end)
       VALUES ($1, $2, $3, '2026-01-01', '2026-01-14')`,
      [occurrenceId, ORG_ID, cycleId]
    );
    await client.query(
      `INSERT INTO okr_vnext_checkins
         (checkin_id, organization_id, key_result_id, objective_id, set_id, cadence_occurrence_id, new_value, note, blocker, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, 5, 'blocked check-in', 'vendor unresponsive', $7)`,
      [checkInId, ORG_ID, keyResultId, objectiveId, setId, occurrenceId, USER_MANAGER]
    );
    const attention = await listOrganizationOkrAttention({ managerId: USER_MANAGER, organizationId: ORG_ID });
    expect(attention.openBlockers.map((b) => b.checkInId)).toContain(checkInId);
  });

  itDB('escalatedSets: a Set with attention_state=escalated is flagged', async () => {
    const setId = await insertFixtureSet(USER_MANAGER, { attentionState: 'escalated' });
    const attention = await listOrganizationOkrAttention({ managerId: USER_MANAGER, organizationId: ORG_ID });
    expect(attention.escalatedSets.map((s) => s.setId)).toContain(setId);
  });

  itDB('manager-scoping: a Set owned by a DIFFERENT manager (no chain relationship) is excluded', async () => {
    const setId = await insertFixtureSet(USER_OTHER_MANAGER, { attentionState: 'escalated' });
    const attention = await listOrganizationOkrAttention({ managerId: USER_MANAGER, organizationId: ORG_ID });
    expect(attention.escalatedSets.map((s) => s.setId)).not.toContain(setId);

    // But the OTHER manager sees their own Set.
    const otherAttention = await listOrganizationOkrAttention({ managerId: USER_OTHER_MANAGER, organizationId: ORG_ID });
    expect(otherAttention.escalatedSets.map((s) => s.setId)).toContain(setId);
  });
});
