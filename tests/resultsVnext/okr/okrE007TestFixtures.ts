/**
 * OKR-E007 — shared test-only fixture helpers.
 *
 * Not a production file — a private convenience shared across this epic's
 * own `*.realdb.test.ts` files (okrFinalScore/okrReflectionLifecycle/
 * okrManagerReview/okrSetClose/okrCycleCloseGuard/okrCarryForward/
 * okrSetHistory) so each one does not re-derive the identical
 * Program->Cycle->Set->Objective->KeyResult->submit->approve->activate
 * boilerplate every other OKR realdb test file duplicates per-file. Every
 * OTHER OKR epic's realdb tests duplicate that boilerplate per-file
 * (no shared fixture module existed before this one) — this file is a
 * deliberate, scoped exception for E007 only, whose 7 test files all need
 * the SAME "Set already active with sufficient KR coverage" starting point
 * before diverging into final-score/reflection/review/close/carry-forward/
 * history scenarios.
 */
import { randomUUID } from 'node:crypto';

import type { Client as PgClient, ClientConfig } from 'pg';

export function buildClientConfig(): ClientConfig | null {
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

export const DB_CONFIGURED = buildClientConfig() !== null;

export function baseCycleTimes() {
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

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type KeyResultCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js');

export interface OkrE007KrSpec {
  currentValue: number;
  targetValue: number;
}

export interface OkrE007ObjectiveSpec {
  title: string;
  keyResults: OkrE007KrSpec[];
}

export interface OkrE007FixtureOptions {
  organizationId: string;
  adminUserId: string;
  ownerUserId: string;
  reviewerUserId: string;
  /** Program policy overrides — passed straight through to `createProgram`. */
  programPolicyOverrides?: Record<string, unknown>;
  /** Defaults to two Objectives, each with two KRs at 50%/100% progress —
   * satisfies E003's `kr_min_required=2` (the Program default) submission
   * gate out of the box. */
  objectives?: OkrE007ObjectiveSpec[];
}

export interface OkrE007Fixture {
  organizationId: string;
  programId: string;
  cycleId: string;
  setId: string;
  objectiveIds: string[];
  ownerUserId: string;
  reviewerUserId: string;
  adminUserId: string;
}

function defaultObjectives(): OkrE007ObjectiveSpec[] {
  return [
    {
      title: 'E007 fixture Objective A',
      keyResults: [
        { currentValue: 5, targetValue: 10 },
        { currentValue: 10, targetValue: 10 },
      ],
    },
    {
      title: 'E007 fixture Objective B',
      keyResults: [
        { currentValue: 2, targetValue: 10 },
        { currentValue: 10, targetValue: 10 },
      ],
    },
  ];
}

/**
 * Builds Program (published) -> Cycle -> Set (draft, owner/reviewer set) ->
 * N Objectives x M KRs -> submit -> approve -> activate. Returns the Set in
 * `status='active'` — callers that need `'review'` call
 * `runOkrSetLifecycleTransition(OKR_SET_OPEN_REVIEW_SPEC, ...)` themselves
 * (re-reading the Set's current `row_version` first via direct SQL, since
 * this fixture does not track version numbers across every step).
 */
export async function buildActiveOkrSetFixture(opts: OkrE007FixtureOptions): Promise<OkrE007Fixture> {
  const { organizationId, adminUserId, ownerUserId, reviewerUserId, programPolicyOverrides = {} } = opts;
  const objectives = opts.objectives ?? defaultObjectives();

  const programCommands: ProgramCommandsModule = await import(
    '../../../server/src/services/resultsVnext/okr/okrProgramCommands.js'
  );
  const cycleCommands: CycleCommandsModule = await import(
    '../../../server/src/services/resultsVnext/okr/okrCycleCommands.js'
  );
  const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
  const objectiveCommands: ObjectiveCommandsModule = await import(
    '../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js'
  );
  const keyResultCommands: KeyResultCommandsModule = await import(
    '../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js'
  );

  const program = await programCommands.createProgram({
    organizationId,
    name: 'E007 fixture Program',
    createdBy: adminUserId,
    actorEffectiveRole: 'admin',
    idempotencyKey: `e007-create-program-${randomUUID()}`,
    ...programPolicyOverrides,
        access: { capabilities: ['*'], platformRole: null },
});
  await programCommands.publishProgram({
    programId: program.result.programId,
    organizationId,
    expectedVersion: program.result.rowVersion,
    actorUserId: adminUserId,
    actorEffectiveRole: 'admin',
    idempotencyKey: `e007-publish-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

  const cycle = await cycleCommands.createCycle({
    organizationId,
    programId: program.result.programId,
    name: 'E007 fixture Cycle',
    ...baseCycleTimes(),
    createdBy: adminUserId,
    actorEffectiveRole: 'admin',
    idempotencyKey: `e007-create-cycle-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

  const set = await setCommands.createOkrSet({
    organizationId,
    programId: program.result.programId,
    cycleId: cycle.result.cycleId,
    scopeType: 'individual',
    scopeId: ownerUserId,
    ownerUserId,
    reviewerUserId,
    title: 'E007 fixture Set',
    createdBy: ownerUserId,
    actorEffectiveRole: 'member',
    idempotencyKey: `e007-create-set-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  const setId = set.result.set.setId;

  const objectiveIds: string[] = [];
  for (const objectiveSpec of objectives) {
    const objective = await objectiveCommands.createObjective({
      setId,
      organizationId,
      ownerUserId,
      title: objectiveSpec.title,
      createdBy: ownerUserId,
      actorEffectiveRole: 'member',
      idempotencyKey: `e007-create-obj-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    objectiveIds.push(objective.result.objectiveId);
    for (const kr of objectiveSpec.keyResults) {
      await keyResultCommands.createKeyResult({
        objectiveId: objective.result.objectiveId,
        organizationId,
        ownerUserId,
        title: `${objectiveSpec.title} KR`,
        measurementType: 'numeric',
        direction: 'reach',
        targetValue: kr.targetValue,
        currentValue: kr.currentValue,
        createdBy: ownerUserId,
        actorEffectiveRole: 'member',
        idempotencyKey: `e007-create-kr-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    }
  }

  const submitted = await setCommands.submitOkrSetForApproval({
    setId,
    organizationId,
    expectedVersion: set.result.set.rowVersion,
    actorUserId: ownerUserId,
    actorEffectiveRole: 'member',
    idempotencyKey: `e007-submit-set-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  const approved = await setCommands.approveOkrSet({
    setId,
    organizationId,
    expectedVersion: submitted.resultingVersion,
    approverId: adminUserId,
    actorEffectiveRole: 'admin',
    idempotencyKey: `e007-approve-set-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  await setCommands.runOkrSetLifecycleTransition(setCommands.OKR_SET_ACTIVATE_SPEC, {
    setId,
    organizationId,
    expectedVersion: approved.resultingVersion,
    actorUserId: ownerUserId,
    actorEffectiveRole: 'member',
    idempotencyKey: `e007-activate-set-${randomUUID()}`,
  });

  return {
    organizationId,
    programId: program.result.programId,
    cycleId: cycle.result.cycleId,
    setId,
    objectiveIds,
    ownerUserId,
    reviewerUserId,
    adminUserId,
  };
}

/** Re-reads the Set's current `row_version`/`status` via direct SQL —
 * every E007 test file needs this repeatedly between fixture steps since
 * the fixture helper above does not thread version numbers back out. */
export async function readSetVersionAndStatus(
  client: PgClient,
  setId: string
): Promise<{ rowVersion: number; status: string }> {
  const result = await client.query<{ row_version: number; status: string }>(
    `SELECT row_version, status FROM okr_vnext_sets WHERE set_id = $1`,
    [setId]
  );
  const row = result.rows[0];
  if (!row) throw new Error(`[readSetVersionAndStatus] Set ${setId} not found`);
  return { rowVersion: row.row_version, status: row.status };
}

/** Deletes every row this fixture family can have created for one
 * `organizationId`, in FK-safe order — shared `afterAll` body for every
 * E007 realdb test file. */
export async function cleanupOkrE007Fixture(client: PgClient, organizationId: string): Promise<void> {
  const orgLike = `${organizationId}%`;
  await client.query(`DELETE FROM okr_vnext_reviews WHERE organization_id LIKE $1`, [orgLike]);
  await client.query(`DELETE FROM okr_vnext_reflections WHERE organization_id LIKE $1`, [orgLike]);
  await client.query(`DELETE FROM okr_vnext_key_results WHERE organization_id LIKE $1`, [orgLike]);
  await client.query(`DELETE FROM okr_vnext_objectives WHERE organization_id LIKE $1`, [orgLike]);
  await client.query(
    `DELETE FROM rvn_platform_obligations WHERE organization_id LIKE $1`,
    [orgLike]
  );
  await client.query(
    `DELETE FROM rvn_platform_resource_acl
      WHERE resource_type = 'okr_set'
        AND resource_id IN (SELECT set_id::text FROM okr_vnext_sets WHERE organization_id LIKE $1)`,
    [orgLike]
  );
  await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id LIKE $1 AND resource_type = 'okr_set'`, [
    orgLike,
  ]);
  await client.query(`DELETE FROM okr_vnext_set_versions WHERE organization_id LIKE $1`, [orgLike]);
  await client.query(`UPDATE okr_vnext_sets SET latest_approved_snapshot_id = NULL WHERE organization_id LIKE $1`, [orgLike]);
  await client.query(`DELETE FROM okr_vnext_approved_snapshots WHERE organization_id LIKE $1`, [orgLike]);
  await client.query(`DELETE FROM okr_vnext_sets WHERE organization_id LIKE $1`, [orgLike]);
  await client.query(`DELETE FROM okr_vnext_checkin_occurrences WHERE organization_id LIKE $1`, [orgLike]);
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
}
