/**
 * OKR-E005 — general graph-reachability cycle detection (OKR-F-016-AC-01),
 * against a REAL Postgres: direct 2-node cycle, transitive 3-node cycle,
 * and the race between two concurrently-proposed edges that only closes a
 * cycle once BOTH are accepted (design §D's own stated addition — the
 * accept-time re-check, not just the propose-time check).
 *
 * Design: docs/product/results-vnext/OKR_E005_DESIGN.md §D.
 *
 * Uses a single Objective Owner for every fixture Objective — self-accept
 * (source Owner === target Owner) is this design's own considered default
 * (§J item 4: "alignment never touches score, so it isn't 'material' in
 * D11's sense") — this keeps the fixture focused purely on the cycle-graph
 * mechanics, not ownership plumbing already covered by
 * `okrAlignmentCreate.realdb.test.ts`.
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
const ORG_PREFIX = `okr-e005-cycle-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e005-cycle-admin-${tag}`;
const USER_OWNER = `okr-e005-cycle-owner-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type AlignmentCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrAlignmentCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let proposeAlignment: AlignmentCommandsModule['proposeAlignment'];
let acceptAlignment: AlignmentCommandsModule['acceptAlignment'];
let OkrAlignmentCycleDetectedError: AlignmentCommandsModule['OkrAlignmentCycleDetectedError'];
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

describe('OKR-E005 — graph-reachability cycle detection (real Postgres)', () => {
  let organizationId: string;
  let setId: string;

  async function makeObjective(title: string): Promise<string> {
    const objective = await createObjective({
      setId,
      organizationId,
      ownerUserId: USER_OWNER,
      title,
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    return objective.result.objectiveId;
  }

  async function proposeAndAccept(sourceObjectiveId: string, targetObjectiveId: string) {
    const propose = await proposeAlignment({
      organizationId,
      sourceObjectiveId,
      targetObjectiveId,
      proposedBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `propose-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    return acceptAlignment({
      alignmentId: propose.result.alignment.alignmentId,
      organizationId,
      expectedVersion: propose.result.alignment.rowVersion,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `accept-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  }

  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR Alignment cycle-detection realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_alignments LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR Alignment schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const programCommands: ProgramCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrProgramCommands.js'
    );
    createProgram = programCommands.createProgram;
    publishProgram = programCommands.publishProgram;

    const cycleCommands: CycleCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrCycleCommands.js'
    );
    createCycle = cycleCommands.createCycle;

    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    createOkrSet = setCommands.createOkrSet;

    const objectiveCommands: ObjectiveCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js'
    );
    createObjective = objectiveCommands.createObjective;

    const alignmentCommands: AlignmentCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrAlignmentCommands.js'
    );
    proposeAlignment = alignmentCommands.proposeAlignment;
    acceptAlignment = alignmentCommands.acceptAlignment;
    OkrAlignmentCycleDetectedError = alignmentCommands.OkrAlignmentCycleDetectedError;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    if (!reachable) return;

    organizationId = freshOrgId();
    const program = await createProgram({
      organizationId,
      name: 'Cycle-detection fixture Program',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    await publishProgram({
      programId: program.result.programId,
      organizationId,
      expectedVersion: program.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `publish-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const cycle = await createCycle({
      organizationId,
      programId: program.result.programId,
      name: 'Cycle-detection fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const set = await createOkrSet({
      organizationId,
      programId: program.result.programId,
      cycleId: cycle.result.cycleId,
      scopeType: 'company',
      scopeId: organizationId,
      ownerUserId: USER_OWNER,
      title: 'Cycle-detection fixture Set',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-set-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    setId = set.result.set.setId;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    const orgLike = `${ORG_PREFIX}%`;
    await client.query(`DELETE FROM okr_vnext_alignments WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_objectives WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(
      `DELETE FROM rvn_platform_resource_acl WHERE resource_id IN (SELECT set_id::text FROM okr_vnext_sets WHERE organization_id LIKE $1)`,
      [orgLike]
    );
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id LIKE $1 AND resource_type = 'okr_set'`, [
      orgLike,
    ]);
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id LIKE $1`, [orgLike]);
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

  itDB('direct 2-node cycle: A->B accepted, then proposing B->A is rejected with OkrAlignmentCycleDetectedError', async () => {
    const a = await makeObjective('Direct-cycle A');
    const b = await makeObjective('Direct-cycle B');

    await proposeAndAccept(a, b);

    await expect(
      proposeAlignment({
        organizationId,
        sourceObjectiveId: b,
        targetObjectiveId: a,
        proposedBy: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `propose-back-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toThrow(OkrAlignmentCycleDetectedError);
  });

  itDB(
    'transitive 3-node cycle: A->B and B->C accepted, then proposing C->A is rejected with OkrAlignmentCycleDetectedError',
    async () => {
      const a = await makeObjective('Transitive-cycle A');
      const b = await makeObjective('Transitive-cycle B');
      const c = await makeObjective('Transitive-cycle C');

      await proposeAndAccept(a, b);
      await proposeAndAccept(b, c);

      await expect(
        proposeAlignment({
          organizationId,
          sourceObjectiveId: c,
          targetObjectiveId: a,
          proposedBy: USER_OWNER,
          actorEffectiveRole: 'member',
          idempotencyKey: `propose-close-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
      ).rejects.toThrow(OkrAlignmentCycleDetectedError);
    }
  );

  itDB(
    'unrelated edges do not falsely trip cycle detection: a disjoint D->E proposal succeeds even with an existing accepted A->B/B->C chain elsewhere',
    async () => {
      const a = await makeObjective('Disjoint-check A');
      const b = await makeObjective('Disjoint-check B');
      const d = await makeObjective('Disjoint-check D');
      const e = await makeObjective('Disjoint-check E');

      await proposeAndAccept(a, b);

      const outcome = await proposeAlignment({
        organizationId,
        sourceObjectiveId: d,
        targetObjectiveId: e,
        proposedBy: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `propose-disjoint-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(outcome.result.created).toBe(true);
    }
  );

  itDB(
    'race defense (design §D): two independently-acyclic proposed edges (B->C, C->A) jointly close a cycle only once BOTH are accepted — the SECOND acceptance is rejected by the accept-time re-check',
    async () => {
      const a = await makeObjective('Race A');
      const b = await makeObjective('Race B');
      const c = await makeObjective('Race C');

      // 1. A->B proposed and accepted first.
      await proposeAndAccept(a, b);

      // 2. B->C proposed — acyclic at THIS moment (only A->B is accepted).
      const proposeBC = await proposeAlignment({
        organizationId,
        sourceObjectiveId: b,
        targetObjectiveId: c,
        proposedBy: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `propose-bc-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(proposeBC.result.created).toBe(true);

      // 3. C->A proposed — ALSO acyclic at this moment (B->C is still only
      // 'proposed', not yet 'accepted', so it does not count as a graph
      // edge for cycle-detection purposes).
      const proposeCA = await proposeAlignment({
        organizationId,
        sourceObjectiveId: c,
        targetObjectiveId: a,
        proposedBy: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `propose-ca-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(proposeCA.result.created).toBe(true);

      // 4. Accept B->C — still acyclic (C's only accepted outgoing edge
      // would be C->A, but that is still 'proposed', not yet accepted).
      const acceptBC = await acceptAlignment({
        alignmentId: proposeBC.result.alignment.alignmentId,
        organizationId,
        expectedVersion: proposeBC.result.alignment.rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `accept-bc-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(acceptBC.result.status).toBe('accepted');

      // 5. NOW accept C->A — the accepted graph is A->B->C, and accepting
      // C->A would close A->B->C->A. The propose-time check for C->A (step
      // 3) could not have seen this, because B->C was not yet accepted at
      // that time — only the ACCEPT-time re-check catches it.
      await expect(
        acceptAlignment({
          alignmentId: proposeCA.result.alignment.alignmentId,
          organizationId,
          expectedVersion: proposeCA.result.alignment.rowVersion,
          actorUserId: USER_OWNER,
          actorEffectiveRole: 'member',
          idempotencyKey: `accept-ca-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
      ).rejects.toThrow(OkrAlignmentCycleDetectedError);

      // Sanity: C->A is still 'proposed' (the rejected accept must not have
      // mutated it).
      const row = await client.query(`SELECT status FROM okr_vnext_alignments WHERE alignment_id = $1`, [
        proposeCA.result.alignment.alignmentId,
      ]);
      expect(row.rows[0]?.status).toBe('proposed');
    }
  );
});
