/**
 * OKR-E002 — `recordOkrSetMaterialChange`: active-only guard, version
 * increment, and THE LITERAL F-005-AC-02 PROOF — the approved snapshot is
 * provably untouched by a material change on an Active Set — against a
 * REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E002_DESIGN.md §4.8, D5/D6
 * (OKR-F-005-AC-02: "Material edits to an Active Set create an
 * OKRMaterialChange, they do NOT overwrite the approved snapshot").
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
const ORG_PREFIX = `okr-e002-matchange-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e002-matchange-admin-${tag}`;
const USER_OWNER = `okr-e002-matchange-owner-${tag}`;
const USER_REVIEWER = `okr-e002-matchange-reviewer-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type MaterialChangeCommandsModule =
  typeof import('../../../server/src/services/resultsVnext/okr/okrSetMaterialChangeCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let submitOkrSetForApproval: SetCommandsModule['submitOkrSetForApproval'];
let approveOkrSet: SetCommandsModule['approveOkrSet'];
let runOkrSetLifecycleTransition: SetCommandsModule['runOkrSetLifecycleTransition'];
let OKR_SET_ACTIVATE_SPEC: SetCommandsModule['OKR_SET_ACTIVATE_SPEC'];
let OkrSetValidationError: SetCommandsModule['OkrSetValidationError'];
let recordOkrSetMaterialChange: MaterialChangeCommandsModule['recordOkrSetMaterialChange'];
let closePgPool: (() => Promise<void>) | undefined;

type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type KeyResultCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js');
let createObjective: ObjectiveCommandsModule['createObjective'];
let createKeyResult: KeyResultCommandsModule['createKeyResult'];

/**
 * OKR-E003: `submitOkrSetForApproval` now also requires
 * `hasSufficientKeyResultCoverage` (>=2 non-cancelled KRs per non-cancelled
 * Objective) — this fixture helper gives a draft Set exactly that minimum
 * before `createActiveSetWithApproval` below submits it.
 */
async function addSufficientKeyResultCoverage(setId: string, organizationId: string, ownerUserId: string): Promise<void> {
  const objective = await createObjective({
    setId,
    organizationId,
    ownerUserId,
    title: 'Material-change fixture Objective',
    createdBy: ownerUserId,
    actorEffectiveRole: 'member',
    idempotencyKey: `fixture-objective-${randomUUID()}`,
  });
  for (let i = 0; i < 2; i += 1) {
    await createKeyResult({
      objectiveId: objective.result.objectiveId,
      organizationId,
      ownerUserId,
      title: `Material-change fixture KR ${i + 1}`,
      measurementType: 'numeric',
      direction: 'reach',
      targetValue: 10,
      currentValue: 5,
      createdBy: ownerUserId,
      actorEffectiveRole: 'member',
      idempotencyKey: `fixture-kr-${i}-${randomUUID()}`,
    });
  }
}

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

async function createProgramAndCycle(): Promise<{ organizationId: string; programId: string; cycleId: string }> {
  const organizationId = freshOrgId();
  const created = await createProgram({
    organizationId,
    name: 'Material-change fixture Program',
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
    name: 'Material-change fixture Cycle',
    ...baseCycleTimes(),
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-cycle-${randomUUID()}`,
  });
  return { organizationId, programId: created.result.programId, cycleId: cycle.result.cycleId };
}

/** Drives a fresh Set through draft -> submitted -> approved -> active, with
 * a fresh unique owner/scope per call. Returns the active Set plus the
 * approval snapshot the ACTIVE Set was frozen from. */
async function createActiveSetWithApproval(suffix: string): Promise<{
  organizationId: string;
  setId: string;
  rowVersion: number;
  snapshotId: string;
}> {
  const { organizationId, programId, cycleId } = await createProgramAndCycle();
  const ownerId = `${USER_OWNER}-${suffix}`;
  const created = await createOkrSet({
    organizationId,
    programId,
    cycleId,
    scopeType: 'individual',
    scopeId: ownerId,
    ownerUserId: ownerId,
    reviewerUserId: USER_REVIEWER,
    title: `Material-change fixture Set (${suffix}) — original title`,
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-set-${suffix}-${randomUUID()}`,
  });
  await addSufficientKeyResultCoverage(created.result.set.setId, organizationId, ownerId);
  const submitted = await submitOkrSetForApproval({
    setId: created.result.set.setId,
    organizationId,
    expectedVersion: created.result.set.rowVersion,
    actorUserId: ownerId,
    actorEffectiveRole: 'member',
    idempotencyKey: `submit-${suffix}-${randomUUID()}`,
  });
  const approved = await approveOkrSet({
    setId: created.result.set.setId,
    organizationId,
    expectedVersion: submitted.result.rowVersion,
    approverId: USER_REVIEWER,
    actorEffectiveRole: 'member',
    idempotencyKey: `approve-${suffix}-${randomUUID()}`,
  });
  const activated = await runOkrSetLifecycleTransition(OKR_SET_ACTIVATE_SPEC, {
    setId: created.result.set.setId,
    organizationId,
    expectedVersion: approved.result.set.rowVersion,
    actorUserId: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `activate-${suffix}-${randomUUID()}`,
  });
  return {
    organizationId,
    setId: created.result.set.setId,
    rowVersion: activated.result.rowVersion,
    snapshotId: approved.result.snapshot.snapshotId,
  };
}

describe('OKR-E002 recordOkrSetMaterialChange — active-only guard, version increment, F-005-AC-02 proof (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — OKR Set material-change realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_set_versions LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR Set schema); refusing to report a green run. ' +
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
    submitOkrSetForApproval = setCommands.submitOkrSetForApproval;
    approveOkrSet = setCommands.approveOkrSet;
    runOkrSetLifecycleTransition = setCommands.runOkrSetLifecycleTransition;
    OKR_SET_ACTIVATE_SPEC = setCommands.OKR_SET_ACTIVATE_SPEC;
    OkrSetValidationError = setCommands.OkrSetValidationError;

    const materialChangeCommands: MaterialChangeCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrSetMaterialChangeCommands.js'
    );
    recordOkrSetMaterialChange = materialChangeCommands.recordOkrSetMaterialChange;

    const objectiveCommands: ObjectiveCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js'
    );
    createObjective = objectiveCommands.createObjective;

    const keyResultCommands: KeyResultCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js'
    );
    createKeyResult = keyResultCommands.createKeyResult;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    const orgLike = `${ORG_PREFIX}%`;
    await client.query(
      `DELETE FROM okr_vnext_set_versions WHERE set_id IN (SELECT set_id FROM okr_vnext_sets WHERE organization_id LIKE $1)`,
      [orgLike]
    );
    await client.query(
      `UPDATE okr_vnext_sets SET latest_approved_snapshot_id = NULL WHERE organization_id LIKE $1`,
      [orgLike]
    );
    // OKR-E003: okr_vnext_key_results/okr_vnext_objectives REFERENCE
    // okr_vnext_sets — must be deleted before the Set rows below, or the
    // FK constraint blocks the DELETE.
    await client.query(`DELETE FROM okr_vnext_key_results WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_objectives WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_approved_snapshots WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(
      `DELETE FROM rvn_platform_resource_acl WHERE resource_id IN (SELECT set_id::text FROM okr_vnext_sets WHERE organization_id LIKE $1)`,
      [orgLike]
    );
    await client.query(
      `DELETE FROM rvn_platform_resource_visibility WHERE organization_id LIKE $1 AND resource_type = 'okr_set'`,
      [orgLike]
    );
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_sets WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_checkin_occurrences WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_cycles WHERE organization_id LIKE $1`, [orgLike]);
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

  // ==========================================
  // Active-only guard
  // ==========================================

  itDB('rejects with OkrSetValidationError(NOT_ACTIVE) when the Set is still "draft"', async () => {
    const { organizationId, programId, cycleId } = await createProgramAndCycle();
    const ownerId = `${USER_OWNER}-draft-guard`;
    const created = await createOkrSet({
      organizationId,
      programId,
      cycleId,
      scopeType: 'individual',
      scopeId: ownerId,
      ownerUserId: ownerId,
      title: 'Draft-guard fixture Set',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-set-draft-guard-${randomUUID()}`,
    });

    let caught: unknown;
    try {
      await recordOkrSetMaterialChange({
        setId: created.result.set.setId,
        organizationId,
        expectedVersion: created.result.set.rowVersion,
        fieldName: 'title',
        afterValue: 'Attempted change while draft',
        reason: 'should be rejected',
        requestedBy: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `matchange-draft-guard-${randomUUID()}`,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OkrSetValidationError);
    expect((caught as InstanceType<typeof OkrSetValidationError>).code).toBe('NOT_ACTIVE');

    // No version row written by the rejected attempt.
    const versions = await client.query(`SELECT version_id FROM okr_vnext_set_versions WHERE set_id = $1`, [
      created.result.set.setId,
    ]);
    expect(versions.rowCount).toBe(0);
  });

  itDB('rejects with OkrSetValidationError(NOT_ACTIVE) when the Set is "approved" (not yet activated)', async () => {
    const { organizationId, programId, cycleId } = await createProgramAndCycle();
    const ownerId = `${USER_OWNER}-approved-guard`;
    const created = await createOkrSet({
      organizationId,
      programId,
      cycleId,
      scopeType: 'individual',
      scopeId: ownerId,
      ownerUserId: ownerId,
      reviewerUserId: USER_REVIEWER,
      title: 'Approved-guard fixture Set',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-set-approved-guard-${randomUUID()}`,
    });
    await addSufficientKeyResultCoverage(created.result.set.setId, organizationId, ownerId);
    const submitted = await submitOkrSetForApproval({
      setId: created.result.set.setId,
      organizationId,
      expectedVersion: created.result.set.rowVersion,
      actorUserId: ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-approved-guard-${randomUUID()}`,
    });
    const approved = await approveOkrSet({
      setId: created.result.set.setId,
      organizationId,
      expectedVersion: submitted.result.rowVersion,
      approverId: USER_REVIEWER,
      actorEffectiveRole: 'member',
      idempotencyKey: `approve-approved-guard-${randomUUID()}`,
    });

    await expect(
      recordOkrSetMaterialChange({
        setId: created.result.set.setId,
        organizationId,
        expectedVersion: approved.result.set.rowVersion,
        fieldName: 'title',
        afterValue: 'Attempted change while only approved, not active',
        reason: 'should be rejected',
        requestedBy: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `matchange-approved-guard-${randomUUID()}`,
      })
    ).rejects.toBeInstanceOf(OkrSetValidationError);
  });

  // ==========================================
  // Version increment + THE literal F-005-AC-02 proof
  // ==========================================

  itDB(
    'records a title change on an active Set: version_number=2, current_version bumps, ' +
      'and the approved snapshot (frozen with the OLD title) is provably byte-identical afterward',
    async () => {
      const { organizationId, setId, rowVersion, snapshotId } = await createActiveSetWithApproval('title-change');

      const snapshotBefore = await client.query<{ content_hash: string; snapshot_payload: { set: { title: string } } }>(
        `SELECT content_hash, snapshot_payload FROM okr_vnext_approved_snapshots WHERE snapshot_id = $1`,
        [snapshotId]
      );
      const originalTitle = snapshotBefore.rows[0].snapshot_payload.set.title;
      expect(originalTitle).toContain('original title');

      const outcome = await recordOkrSetMaterialChange({
        setId,
        organizationId,
        expectedVersion: rowVersion,
        fieldName: 'title',
        afterValue: 'Revised title after activation',
        reason: 'stakeholder feedback',
        requestedBy: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `matchange-title-${randomUUID()}`,
      });

      expect(outcome.outcome).toBe('applied');
      expect(outcome.result.set.title).toBe('Revised title after activation');
      expect(outcome.result.set.currentVersion).toBe(2);
      expect(outcome.result.version.versionNumber).toBe(2);
      expect(outcome.result.version.fieldName).toBe('title');
      expect(outcome.result.version.beforeValue).toBe(originalTitle);
      expect(outcome.result.version.afterValue).toBe('Revised title after activation');
      expect(outcome.result.version.reason).toBe('stakeholder feedback');
      expect(outcome.result.version.requestedBy).toBe(USER_OWNER);

      // Version row persisted with the exact same values.
      const versionRow = await client.query(
        `SELECT version_number, field_name, before_value, after_value, reason, requested_by
           FROM okr_vnext_set_versions WHERE version_id = $1`,
        [outcome.result.version.versionId]
      );
      expect(versionRow.rows[0]).toMatchObject({
        version_number: 2,
        field_name: 'title',
        before_value: originalTitle,
        after_value: 'Revised title after activation',
        reason: 'stakeholder feedback',
        requested_by: USER_OWNER,
      });

      // *** THE literal F-005-AC-02 proof ***
      // The approved snapshot row must be COMPLETELY untouched — same
      // content_hash, same snapshot_payload bytes, still showing the OLD
      // title, even though the live Set now shows the NEW title.
      const snapshotAfter = await client.query<{ content_hash: string; snapshot_payload: { set: { title: string } } }>(
        `SELECT content_hash, snapshot_payload FROM okr_vnext_approved_snapshots WHERE snapshot_id = $1`,
        [snapshotId]
      );
      expect(snapshotAfter.rows[0].content_hash).toBe(snapshotBefore.rows[0].content_hash);
      expect(JSON.stringify(snapshotAfter.rows[0].snapshot_payload)).toBe(
        JSON.stringify(snapshotBefore.rows[0].snapshot_payload)
      );
      expect(snapshotAfter.rows[0].snapshot_payload.set.title).toBe(originalTitle);
      expect(snapshotAfter.rows[0].snapshot_payload.set.title).not.toBe('Revised title after activation');

      // Exactly one snapshot row exists for this Set — the material change
      // did not insert a second one.
      const allSnapshots = await client.query(`SELECT snapshot_id FROM okr_vnext_approved_snapshots WHERE set_id = $1`, [
        setId,
      ]);
      expect(allSnapshots.rowCount).toBe(1);
    }
  );

  itDB('records owner_user_id and reviewer_user_id changes, version_number incrementing sequentially', async () => {
    const { organizationId, setId, rowVersion } = await createActiveSetWithApproval('multi-field');
    const NEW_OWNER = `${USER_OWNER}-multi-field-new`;
    const NEW_REVIEWER = `${USER_REVIEWER}-multi-field-new`;

    const ownerChange = await recordOkrSetMaterialChange({
      setId,
      organizationId,
      expectedVersion: rowVersion,
      fieldName: 'owner_user_id',
      afterValue: NEW_OWNER,
      reason: 'ownership handoff',
      requestedBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `matchange-owner-${randomUUID()}`,
    });
    expect(ownerChange.result.version.versionNumber).toBe(2);
    expect(ownerChange.result.set.ownerUserId).toBe(NEW_OWNER);
    expect(ownerChange.result.set.currentVersion).toBe(2);

    const reviewerChange = await recordOkrSetMaterialChange({
      setId,
      organizationId,
      expectedVersion: ownerChange.result.set.rowVersion,
      fieldName: 'reviewer_user_id',
      afterValue: NEW_REVIEWER,
      reason: 'reviewer reassignment',
      requestedBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `matchange-reviewer-${randomUUID()}`,
    });
    expect(reviewerChange.result.version.versionNumber).toBe(3);
    expect(reviewerChange.result.set.reviewerUserId).toBe(NEW_REVIEWER);
    expect(reviewerChange.result.set.currentVersion).toBe(3);
    // Prior field's change (owner) is untouched by this second change.
    expect(reviewerChange.result.set.ownerUserId).toBe(NEW_OWNER);

    const versions = await client.query(
      `SELECT version_number, field_name FROM okr_vnext_set_versions WHERE set_id = $1 ORDER BY version_number`,
      [setId]
    );
    expect(versions.rows).toEqual([
      { version_number: 2, field_name: 'owner_user_id' },
      { version_number: 3, field_name: 'reviewer_user_id' },
    ]);
  });

  itDB('REVOKE UPDATE/DELETE from PUBLIC on okr_vnext_set_versions at the DB level', async () => {
    const grants = await client.query<{ privilege_type: string }>(
      `SELECT privilege_type FROM information_schema.role_table_grants
        WHERE table_name = 'okr_vnext_set_versions' AND grantee = 'PUBLIC'`
    );
    const grantedPrivileges = grants.rows.map((r) => r.privilege_type);
    expect(grantedPrivileges).not.toContain('UPDATE');
    expect(grantedPrivileges).not.toContain('DELETE');
  });
});
