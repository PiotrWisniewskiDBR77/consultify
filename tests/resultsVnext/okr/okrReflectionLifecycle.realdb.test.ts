/**
 * OKR-E007 — `recordObjectiveReflection` lifecycle + the two-stage freeze
 * (D4) + `closeOkrSet`'s `reflection_required_for_close` completeness gate
 * (§4.5 step 5), against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E007_DESIGN.md §4.2/§4.5, D3/D4.
 *
 * Proves: (1) create path (`expectedVersion=0`, no row exists yet) and
 * update-while-draft path both succeed; (2) the parent-Set status guard
 * (`active`/`review` only); (3) `okr_vnext_reflection_protect_frozen` — a
 * raw UPDATE against a `status='finalized'` row touching a protected field
 * is rejected by the trigger (Postgres 23001), NOT merely by application
 * code (so even a rogue direct-SQL write cannot silently corrupt a
 * finalized reflection); (4) `closeOkrSet`'s
 * `reflection_required_for_close` gate lists EVERY offending Objective,
 * not just the first.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  DB_CONFIGURED,
  buildClientConfig,
  buildActiveOkrSetFixture,
  cleanupOkrE007Fixture,
  readSetVersionAndStatus,
} from './okrE007TestFixtures.js';

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_PREFIX = `okr-e007-reflect-org-${tag}`;
const USER_ADMIN = `okr-e007-reflect-admin-${tag}`;
const USER_OWNER = `okr-e007-reflect-owner-${tag}`;
const USER_REVIEWER = `okr-e007-reflect-reviewer-${tag}`;

let client: Client;
let reachable = false;

type ReflectionCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrReflectionCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let recordObjectiveReflection: ReflectionCommandsModule['recordObjectiveReflection'];
let OkrReflectionValidationError: ReflectionCommandsModule['OkrReflectionValidationError'];
let OkrSetReflectionRequiredError: ReflectionCommandsModule['OkrSetReflectionRequiredError'];
let closeOkrSet: SetCommandsModule['closeOkrSet'];
let runOkrSetLifecycleTransition: SetCommandsModule['runOkrSetLifecycleTransition'];
let OKR_SET_OPEN_REVIEW_SPEC: SetCommandsModule['OKR_SET_OPEN_REVIEW_SPEC'];
let OkrSetValidationError: SetCommandsModule['OkrSetValidationError'];
let closePgPool: (() => Promise<void>) | undefined;

const organizationIdsUsed: string[] = [];

describe('OKR-E007 recordObjectiveReflection lifecycle + protect-frozen trigger + reflection-required close gate (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E007 reflection-lifecycle realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_reflections LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR-E007 reflection schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const reflectionCommands: ReflectionCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrReflectionCommands.js'
    );
    recordObjectiveReflection = reflectionCommands.recordObjectiveReflection;
    OkrReflectionValidationError = reflectionCommands.OkrReflectionValidationError;
    OkrSetReflectionRequiredError = reflectionCommands.OkrSetReflectionRequiredError;

    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    closeOkrSet = setCommands.closeOkrSet;
    runOkrSetLifecycleTransition = setCommands.runOkrSetLifecycleTransition;
    OKR_SET_OPEN_REVIEW_SPEC = setCommands.OKR_SET_OPEN_REVIEW_SPEC;
    OkrSetValidationError = setCommands.OkrSetValidationError;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    for (const organizationId of organizationIdsUsed) {
      await cleanupOkrE007Fixture(client, organizationId);
    }
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

  async function freshFixture(objectiveCount: 1 | 2 = 1, reflectionRequiredForClose = false) {
    const organizationId = `${ORG_PREFIX}-${randomUUID()}`;
    organizationIdsUsed.push(organizationId);
    const objectives =
      objectiveCount === 1
        ? [
            {
              title: 'Reflection fixture Objective',
              keyResults: [
                { currentValue: 5, targetValue: 10 },
                { currentValue: 5, targetValue: 10 },
              ],
            },
          ]
        : [
            {
              title: 'Reflection fixture Objective 1',
              keyResults: [
                { currentValue: 5, targetValue: 10 },
                { currentValue: 5, targetValue: 10 },
              ],
            },
            {
              title: 'Reflection fixture Objective 2',
              keyResults: [
                { currentValue: 5, targetValue: 10 },
                { currentValue: 5, targetValue: 10 },
              ],
            },
          ];
    const fixture = await buildActiveOkrSetFixture({
      organizationId,
      adminUserId: USER_ADMIN,
      ownerUserId: USER_OWNER,
      reviewerUserId: USER_REVIEWER,
      programPolicyOverrides: {
        objectiveRollupModel: 'equal_average',
        managerReviewRequired: false,
        reflectionRequiredForClose,
      },
      objectives,
    });
    return fixture;
  }

  itDB('create path (expectedVersion=0): inserts a new draft reflection row', async () => {
    const fixture = await freshFixture();
    const outcome = await recordObjectiveReflection({
      objectiveId: fixture.objectiveIds[0]!,
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 0,
      whatWorked: 'Shipped the feature early',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `reflect-create-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.status).toBe('draft');
    expect(outcome.result.whatWorked).toBe('Shipped the feature early');
    expect(outcome.result.rowVersion).toBe(1);
  });

  itDB('update-while-draft path: a second call with expectedVersion=1 updates the SAME row', async () => {
    const fixture = await freshFixture();
    const first = await recordObjectiveReflection({
      objectiveId: fixture.objectiveIds[0]!,
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 0,
      whatWorked: 'v1',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `reflect-create-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const second = await recordObjectiveReflection({
      objectiveId: fixture.objectiveIds[0]!,
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: first.result.rowVersion,
      whatWorked: 'v2',
      whatDidNotWork: 'nothing major',
      why: 'good planning',
      learning: 'plan earlier next time',
      nextCycleChange: 'start sprint planning a week earlier',
      disposition: 'complete',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `reflect-update-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(second.outcome).toBe('applied');
    expect(second.result.whatWorked).toBe('v2');
    expect(second.result.disposition).toBe('complete');

    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM okr_vnext_reflections WHERE objective_id = $1`,
      [fixture.objectiveIds[0]]
    );
    expect(Number(countResult.rows[0]!.count)).toBe(1);
  });

  itDB('create path with a stale expectedVersion=0 against an EXISTING row is rejected (not silently overwritten)', async () => {
    const fixture = await freshFixture();
    await recordObjectiveReflection({
      objectiveId: fixture.objectiveIds[0]!,
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 0,
      whatWorked: 'first write',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `reflect-create-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    // The row now exists at row_version=1 — a second "create path"
    // (expectedVersion=0) call is a CAS mismatch, not a not-found: the
    // existing row IS found, its version just doesn't match what the
    // caller believed ("no row yet"). STALE_VERSION, not NOT_FOUND.
    let caught: unknown;
    try {
      await recordObjectiveReflection({
        objectiveId: fixture.objectiveIds[0]!,
        setId: fixture.setId,
        organizationId: fixture.organizationId,
        expectedVersion: 0,
        whatWorked: 'racing write',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `reflect-race-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OkrReflectionValidationError);
    expect((caught as InstanceType<typeof OkrReflectionValidationError>).code).toBe('STALE_VERSION');

    // The racing write must NOT have landed — the row still holds the
    // first write's content.
    const row = await client.query<{ what_worked: string }>(
      `SELECT what_worked FROM okr_vnext_reflections WHERE objective_id = $1`,
      [fixture.objectiveIds[0]]
    );
    expect(row.rows[0]!.what_worked).toBe('first write');
  });

  itDB('set-status guard: reflecting on a Set that is neither "active" nor "review" is rejected', async () => {
    const organizationId = `${ORG_PREFIX}-notactive-${randomUUID()}`;
    organizationIdsUsed.push(organizationId);
    const fixture = await buildActiveOkrSetFixture({
      organizationId,
      adminUserId: USER_ADMIN,
      ownerUserId: USER_OWNER,
      reviewerUserId: USER_REVIEWER,
      programPolicyOverrides: { objectiveRollupModel: 'equal_average' },
    });
    // Cancel the Set (a real non-active/non-review terminal state).
    const { rowVersion } = await readSetVersionAndStatus(client, fixture.setId);
    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    await setCommands.runOkrSetLifecycleTransition(setCommands.OKR_SET_CANCEL_SPEC, {
      setId: fixture.setId,
      organizationId,
      expectedVersion: rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `cancel-${randomUUID()}`,
    });

    // The Set-status guard reuses `OkrSetValidationError` (imported from
    // `okrSetCommands.ts`) — a Set-level precondition, not a
    // reflection-row-level one, so this is deliberately NOT
    // `OkrReflectionValidationError`.
    await expect(
      recordObjectiveReflection({
        objectiveId: fixture.objectiveIds[0]!,
        setId: fixture.setId,
        organizationId,
        expectedVersion: 0,
        whatWorked: 'should not land',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `reflect-cancelled-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toThrow(OkrSetValidationError);
  });

  itDB('protect-frozen trigger: a raw UPDATE against a finalized reflection touching a protected field is rejected (Postgres 23001)', async () => {
    const fixture = await freshFixture();
    await recordObjectiveReflection({
      objectiveId: fixture.objectiveIds[0]!,
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 0,
      whatWorked: 'about to be frozen',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `reflect-create-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    // Manually finalize (bypassing closeOkrSet's own orchestration — this
    // test targets the DB trigger, not the command layer).
    await client.query(
      `UPDATE okr_vnext_reflections SET status = 'finalized', finalized_by = $1, finalized_at = now()
        WHERE objective_id = $2`,
      [USER_ADMIN, fixture.objectiveIds[0]]
    );

    await expect(
      client.query(`UPDATE okr_vnext_reflections SET what_worked = 'tampered' WHERE objective_id = $1`, [
        fixture.objectiveIds[0],
      ])
    ).rejects.toMatchObject({ code: '23001' });

    // A no-op update (row_version/updated_at churn only, no protected field
    // touched) is NOT rejected — the trigger only guards the specific
    // protected columns, not every UPDATE unconditionally.
    await expect(
      client.query(`UPDATE okr_vnext_reflections SET updated_at = now() WHERE objective_id = $1`, [fixture.objectiveIds[0]])
    ).resolves.toBeDefined();
  });

  itDB(
    'closeOkrSet reflection_required_for_close gate: lists EVERY offending Objective, not just the first',
    async () => {
      const fixture = await freshFixture(2, true);

      const { rowVersion } = await readSetVersionAndStatus(client, fixture.setId);
      await runOkrSetLifecycleTransition(OKR_SET_OPEN_REVIEW_SPEC, {
        setId: fixture.setId,
        organizationId: fixture.organizationId,
        expectedVersion: rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `open-review-${randomUUID()}`,
      });

      // Score BOTH Objectives (finalScoreOkrSet is a Set-level batch) so
      // the score-half of the gate is satisfied for both — isolating the
      // narrative half as the ONLY thing that can still be incomplete.
      const reflectionCommands: ReflectionCommandsModule = await import(
        '../../../server/src/services/resultsVnext/okr/okrReflectionCommands.js'
      );
      const { rowVersion: reviewVersion1 } = await readSetVersionAndStatus(client, fixture.setId);
      await reflectionCommands.finalScoreOkrSet({
        setId: fixture.setId,
        organizationId: fixture.organizationId,
        expectedVersion: reviewVersion1,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `final-score-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      // Complete the narrative ONLY for the first Objective — the second
      // stays incomplete (this is the one gap the gate must report).
      await recordObjectiveReflection({
        objectiveId: fixture.objectiveIds[0]!,
        setId: fixture.setId,
        organizationId: fixture.organizationId,
        expectedVersion: 1, // finalScoreOkrSet already created row_version=1
        whatWorked: 'a',
        whatDidNotWork: 'b',
        why: 'c',
        learning: 'd',
        nextCycleChange: 'e',
        disposition: 'complete',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `reflect-complete-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      const { rowVersion: reviewVersion2 } = await readSetVersionAndStatus(client, fixture.setId);
      let caught: unknown;
      try {
        await closeOkrSet({
          setId: fixture.setId,
          organizationId: fixture.organizationId,
          expectedVersion: reviewVersion2,
          actorUserId: USER_OWNER,
          actorEffectiveRole: 'member',
          idempotencyKey: `close-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(OkrSetReflectionRequiredError);
      const details = (caught as InstanceType<typeof OkrSetReflectionRequiredError>).details as {
        missingObjectiveIds: string[];
      };
      expect(details.missingObjectiveIds).toEqual([fixture.objectiveIds[1]]);
    }
  );
});
