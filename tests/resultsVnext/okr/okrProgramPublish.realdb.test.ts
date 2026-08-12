/**
 * OKR-E001 — `publishProgram` policy-version immutability + visibility-
 * policy authoring, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E001_DESIGN.md §6.3/§10. THE
 * critical test of this epic — literal OKR-F-001-AC-01 proof: a Program
 * republish must never silently reinterpret a Cycle created under a prior
 * `policy_version_id`.
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
// Decision P7 (one active Program per org): each `it` block gets its OWN
// fresh organization_id, generated at test-run time — a SHARED org id
// across blocks would make a later block's `publishProgram` collide with
// an earlier block's still-active Program (exactly `ux_okr_vnext_
// programs_one_active_per_org` working correctly, but it silently breaks
// test isolation). Same lesson `roiCaseLifecycle.realdb.test.ts`'s own
// per-case-initiative comment documents for AC-02's uniqueness index.
const ORG_PREFIX = `okr-e001-publish-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e001-publish-admin-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type RepositoryModule = typeof import('../../../server/src/services/resultsVnext/okr/okrRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let editProgramDraft: ProgramCommandsModule['editProgramDraft'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let getProgram: RepositoryModule['getProgram'];
let getCycle: RepositoryModule['getCycle'];
let closePgPool: (() => Promise<void>) | undefined;

function baseCycleTimes(): {
  startDate: string;
  endDate: string;
  draftOpenAt: string;
  submissionDueAt: string;
  activeStartAt: string;
  finalUpdateDueAt: string;
  reviewOpenAt: string;
  reflectionDueAt: string;
  closeAt: string;
} {
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

describe('OKR-E001 publishProgram — policy-version immutability + visibility-policy authoring (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — OKR publishProgram realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_programs LIMIT 0');
      await client.query('SELECT 1 FROM okr_vnext_program_policy_versions LIMIT 0');
      await client.query('SELECT 1 FROM okr_vnext_cycles LIMIT 0');
      await client.query('SELECT 1 FROM rvn_platform_visibility_policies LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const programCommands: ProgramCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrProgramCommands.js'
    );
    createProgram = programCommands.createProgram;
    editProgramDraft = programCommands.editProgramDraft;
    publishProgram = programCommands.publishProgram;

    const cycleCommands: CycleCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrCycleCommands.js'
    );
    createCycle = cycleCommands.createCycle;

    const repository: RepositoryModule = await import('../../../server/src/services/resultsVnext/okr/okrRepository.js');
    getProgram = repository.getProgram;
    getCycle = repository.getCycle;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    const orgLike = `${ORG_PREFIX}%`;
    await client.query(`DELETE FROM okr_vnext_checkin_occurrences WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_cycles WHERE organization_id LIKE $1`, [orgLike]);
    // Circular FK (okr_vnext_programs.active_policy_version_id <->
    // okr_vnext_program_policy_versions.program_id) — NULL the pointer
    // column FIRST so the policy-versions DELETE below does not violate
    // fk_okr_vnext_programs_active_policy_version.
    await client.query(
      `UPDATE okr_vnext_programs SET active_policy_version_id = NULL WHERE organization_id LIKE $1`,
      [orgLike]
    );
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

  itDB(
    'publish (v1) pins Cycle A to v1; edit + republish (v2) leaves Cycle A pointing at v1, ' +
      'and v1\'s stored snapshot stays byte-identical (OKR-F-001-AC-01 literal proof)',
    async () => {
      const ORG_ID = freshOrgId();
      const created = await createProgram({
        organizationId: ORG_ID,
        name: 'Immutability fixture Program',
        krMinRequired: 2,
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(created.outcome).toBe('applied');
      const programId = created.result.programId;
      expect(created.result.status).toBe('draft');
      expect(created.result.activePolicyVersionId).toBeNull();

      // First publish -> v1, draft -> active.
      const firstPublish = await publishProgram({
        programId,
        organizationId: ORG_ID,
        expectedVersion: created.result.rowVersion,
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `publish-v1-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(firstPublish.outcome).toBe('applied');
      expect(firstPublish.result.program.status).toBe('active');
      expect(firstPublish.result.policyVersion.versionNumber).toBe(1);
      const v1PolicyVersionId = firstPublish.result.policyVersion.policyVersionId;
      const v1SnapshotBeforeV2 = JSON.stringify(firstPublish.result.policyVersion.snapshot);
      expect(firstPublish.result.policyVersion.snapshot.krMinRequired).toBe(2);
      expect(firstPublish.result.program.activePolicyVersionId).toBe(v1PolicyVersionId);

      // Create Cycle A under the now-active Program — pins policy_version_id = v1.
      const cycleTimes = baseCycleTimes();
      const cycleCreated = await createCycle({
        organizationId: ORG_ID,
        programId,
        name: 'Cycle A — pinned to v1',
        ...cycleTimes,
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-cycle-a-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(cycleCreated.outcome).toBe('applied');
      expect(cycleCreated.result.policyVersionId).toBe(v1PolicyVersionId);
      const cycleAId = cycleCreated.result.cycleId;

      // Edit the draft (Program is 'active' — editing while active is
      // explicitly allowed, design §6.2) and republish -> v2.
      const edited = await editProgramDraft({
        programId,
        organizationId: ORG_ID,
        expectedVersion: firstPublish.result.program.rowVersion,
        krMinRequired: 4,
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `edit-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(edited.outcome).toBe('applied');
      expect(edited.result.krMinRequired).toBe(4);

      const secondPublish = await publishProgram({
        programId,
        organizationId: ORG_ID,
        expectedVersion: edited.result.rowVersion,
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `publish-v2-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(secondPublish.outcome).toBe('applied');
      expect(secondPublish.result.policyVersion.versionNumber).toBe(2);
      expect(secondPublish.result.policyVersion.snapshot.krMinRequired).toBe(4);
      const v2PolicyVersionId = secondPublish.result.policyVersion.policyVersionId;
      expect(v2PolicyVersionId).not.toBe(v1PolicyVersionId);

      // Program now points at v2.
      const programAfterV2 = await getProgram({ organizationId: ORG_ID, programId });
      expect(programAfterV2?.activePolicyVersionId).toBe(v2PolicyVersionId);
      expect(programAfterV2?.status).toBe('active');

      // *** THE literal AC-01 proof ***
      // Cycle A's policy_version_id must STILL point at v1 — a republish
      // never reinterprets an already-created Cycle.
      const cycleAAfterV2 = await getCycle({ organizationId: ORG_ID, cycleId: cycleAId });
      expect(cycleAAfterV2?.policyVersionId).toBe(v1PolicyVersionId);

      // v1's own stored row is untouched — snapshot byte-identical to what
      // it was immediately after the FIRST publish, before v2 ever existed.
      const v1Result = await client.query<{ snapshot: unknown; version_number: number }>(
        `SELECT snapshot, version_number FROM okr_vnext_program_policy_versions WHERE policy_version_id = $1`,
        [v1PolicyVersionId]
      );
      expect(v1Result.rows[0]).toBeDefined();
      expect(v1Result.rows[0].version_number).toBe(1);
      expect(JSON.stringify(v1Result.rows[0].snapshot)).toBe(v1SnapshotBeforeV2);
      expect((v1Result.rows[0].snapshot as { krMinRequired: number }).krMinRequired).toBe(2);
    }
  );

  itDB(
    'publishVisibilityPolicy: first publish opens the active domain=\'okr\' row; ' +
      'second publish (republish) closes the OLD row (effective_to set) under the real EXCLUDE constraint ' +
      'and opens a new active one — never two simultaneously-open rows',
    async () => {
      const ORG_ID = freshOrgId();
      const created = await createProgram({
        organizationId: ORG_ID,
        name: 'Visibility-policy fixture Program',
        visibilityDefault: 'OPEN_ORG',
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-program-vis-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const programId = created.result.programId;

      const firstPublish = await publishProgram({
        programId,
        organizationId: ORG_ID,
        expectedVersion: created.result.rowVersion,
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `publish-vis-v1-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(firstPublish.outcome).toBe('applied');

      const activeAfterFirst = await client.query<{
        policy_id: string;
        policy_version: number;
        visibility_mode: string;
        is_active: boolean;
        effective_to: string | null;
      }>(
        `SELECT policy_id, policy_version, visibility_mode, is_active, effective_to
           FROM rvn_platform_visibility_policies
          WHERE organization_id = $1 AND domain = 'okr'
          ORDER BY policy_version ASC`,
        [ORG_ID]
      );
      expect(activeAfterFirst.rows).toHaveLength(1);
      expect(activeAfterFirst.rows[0].policy_version).toBe(1);
      expect(activeAfterFirst.rows[0].visibility_mode).toBe('OPEN_ORG');
      expect(activeAfterFirst.rows[0].is_active).toBe(true);
      expect(activeAfterFirst.rows[0].effective_to).toBeNull();
      const v1RowPolicyId = activeAfterFirst.rows[0].policy_id;

      // Republish with a DIFFERENT visibility_default — proves the mode
      // itself, not just the version counter, is re-authored.
      const edited = await editProgramDraft({
        programId,
        organizationId: ORG_ID,
        expectedVersion: firstPublish.result.program.rowVersion,
        visibilityDefault: 'RESTRICTED_ACL',
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `edit-vis-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      const secondPublish = await publishProgram({
        programId,
        organizationId: ORG_ID,
        expectedVersion: edited.result.rowVersion,
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `publish-vis-v2-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(secondPublish.outcome).toBe('applied');

      const afterSecond = await client.query<{
        policy_id: string;
        policy_version: number;
        visibility_mode: string;
        is_active: boolean;
        effective_to: string | null;
      }>(
        `SELECT policy_id, policy_version, visibility_mode, is_active, effective_to
           FROM rvn_platform_visibility_policies
          WHERE organization_id = $1 AND domain = 'okr'
          ORDER BY policy_version ASC`,
        [ORG_ID]
      );
      // Exactly 2 rows now: the closed v1 and the newly-active v2. If the
      // UPDATE-then-INSERT ordering were wrong, the INSERT itself would have
      // thrown (EXCLUDE USING gist violation) and this whole publishProgram
      // call would have rejected instead of reaching this assertion.
      expect(afterSecond.rows).toHaveLength(2);
      const oldRow = afterSecond.rows.find((r) => r.policy_id === v1RowPolicyId);
      const newRow = afterSecond.rows.find((r) => r.policy_id !== v1RowPolicyId);
      expect(oldRow).toBeDefined();
      expect(oldRow?.effective_to).not.toBeNull();
      expect(newRow).toBeDefined();
      expect(newRow?.policy_version).toBe(2);
      expect(newRow?.visibility_mode).toBe('RESTRICTED_ACL');
      expect(newRow?.is_active).toBe(true);
      expect(newRow?.effective_to).toBeNull();
    }
  );

  itDB(
    'one-active-Program-per-org: publishing a second draft Program while one is already active ' +
      'is rejected by the real partial unique index',
    async () => {
      const ORG_ID = freshOrgId();
      const first = await createProgram({
        organizationId: ORG_ID,
        name: 'Single-active fixture Program A',
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-single-active-a-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const firstPublish = await publishProgram({
        programId: first.result.programId,
        organizationId: ORG_ID,
        expectedVersion: first.result.rowVersion,
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `publish-single-active-a-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(firstPublish.result.program.status).toBe('active');

      const second = await createProgram({
        organizationId: ORG_ID,
        name: 'Single-active fixture Program B',
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-single-active-b-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(second.result.status).toBe('draft');

      let rejection: unknown;
      try {
        await publishProgram({
          programId: second.result.programId,
          organizationId: ORG_ID,
          expectedVersion: second.result.rowVersion,
          actorUserId: USER_ADMIN,
          actorEffectiveRole: 'admin',
          idempotencyKey: `publish-single-active-b-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      } catch (err) {
        rejection = err;
      }
      expect(rejection).toBeDefined();
      expect((rejection as { code?: string }).code).toBe('23505');

      // Program B must still be 'draft' — the rejected publish must not
      // have left it half-transitioned.
      const programBAfter = await getProgram({ organizationId: ORG_ID, programId: second.result.programId });
      expect(programBAfter?.status).toBe('draft');
      expect(programBAfter?.activePolicyVersionId).toBeNull();
    }
  );
});
