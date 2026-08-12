/**
 * OKR-E007 — `finalScoreOkrSet` (OKR-F-021, D1-D3), against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E007_DESIGN.md §4.1, D1-D3.
 *
 * Proves: (1) `applyOkrScoringModel` dispatch for all four `scoring_model`
 * values — `zero_to_one` passes `objective.progress` through unchanged,
 * `percentage` multiplies by 100, `categories`/`custom` are honestly
 * stubbed (`final_score=NULL`, `scoring_model_unsupported=true`, never a
 * fabricated bucket threshold, per IO-5); (2) upsert-not-duplicate on
 * rerun — calling `finalScoreOkrSet` twice updates the SAME
 * `okr_vnext_reflections` row per Objective, never inserts a second one;
 * (3) the `status==='review'` guard rejects a call against an `'active'`
 * Set.
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
const ORG_PREFIX = `okr-e007-finalscore-org-${tag}`;
const USER_ADMIN = `okr-e007-finalscore-admin-${tag}`;
const USER_OWNER = `okr-e007-finalscore-owner-${tag}`;
const USER_REVIEWER = `okr-e007-finalscore-reviewer-${tag}`;

let client: Client;
let reachable = false;

type ReflectionCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrReflectionCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let finalScoreOkrSet: ReflectionCommandsModule['finalScoreOkrSet'];
let applyOkrScoringModel: ReflectionCommandsModule['applyOkrScoringModel'];
let runOkrSetLifecycleTransition: SetCommandsModule['runOkrSetLifecycleTransition'];
let OKR_SET_OPEN_REVIEW_SPEC: SetCommandsModule['OKR_SET_OPEN_REVIEW_SPEC'];
let OkrSetValidationError: SetCommandsModule['OkrSetValidationError'];
let closePgPool: (() => Promise<void>) | undefined;

const organizationIdsUsed: string[] = [];

describe('OKR-E007 finalScoreOkrSet — scoring-model dispatch + upsert + status guard (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E007 finalScoreOkrSet realdb tests did NOT run. This run is not evidence.');
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
    finalScoreOkrSet = reflectionCommands.finalScoreOkrSet;
    applyOkrScoringModel = reflectionCommands.applyOkrScoringModel;

    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
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

  async function freshFixture(scoringModel: 'zero_to_one' | 'percentage' | 'categories' | 'custom') {
    const organizationId = `${ORG_PREFIX}-${scoringModel}-${randomUUID()}`;
    organizationIdsUsed.push(organizationId);
    const fixture = await buildActiveOkrSetFixture({
      organizationId,
      adminUserId: USER_ADMIN,
      ownerUserId: USER_OWNER,
      reviewerUserId: USER_REVIEWER,
      programPolicyOverrides: { objectiveRollupModel: 'equal_average', scoringModel },
      objectives: [
        {
          title: 'Objective at 50%',
          keyResults: [
            { currentValue: 5, targetValue: 10 },
            { currentValue: 5, targetValue: 10 },
          ],
        },
      ],
    });
    const { rowVersion } = await readSetVersionAndStatus(client, fixture.setId);
    await runOkrSetLifecycleTransition(OKR_SET_OPEN_REVIEW_SPEC, {
      setId: fixture.setId,
      organizationId,
      expectedVersion: rowVersion,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `open-review-${randomUUID()}`,
    });
    return fixture;
  }

  itDB('applyOkrScoringModel: pure dispatch matches D2 literally (unit-shaped, no DB)', async () => {
    expect(applyOkrScoringModel('0.5', 'zero_to_one')).toEqual({ score: 0.5, unsupported: false });
    expect(applyOkrScoringModel('0.5', 'percentage')).toEqual({ score: 50, unsupported: false });
    expect(applyOkrScoringModel('0.5', 'categories')).toEqual({ score: null, unsupported: true });
    expect(applyOkrScoringModel('0.5', 'custom')).toEqual({ score: null, unsupported: true });
    expect(applyOkrScoringModel(null, 'zero_to_one')).toEqual({ score: null, unsupported: false });
  });

  itDB('zero_to_one: freezes objective.progress unchanged into final_score', async () => {
    const fixture = await freshFixture('zero_to_one');
    const { rowVersion } = await readSetVersionAndStatus(client, fixture.setId);
    const outcome = await finalScoreOkrSet({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: rowVersion,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `final-score-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.scoredObjectives).toHaveLength(1);
    expect(outcome.result.scoredObjectives[0]!.finalScore).toBeCloseTo(0.5, 5);
    expect(outcome.result.scoredObjectives[0]!.scoringModelUnsupported).toBe(false);

    const row = await client.query<{ final_score: string; final_score_payload: unknown; status: string }>(
      `SELECT final_score, final_score_payload, status FROM okr_vnext_reflections WHERE objective_id = $1`,
      [fixture.objectiveIds[0]]
    );
    expect(Number(row.rows[0]!.final_score)).toBeCloseTo(0.5, 5);
    expect(row.rows[0]!.status).toBe('draft');
    expect(Array.isArray(row.rows[0]!.final_score_payload)).toBe(true);
    expect((row.rows[0]!.final_score_payload as unknown[]).length).toBe(2);
  });

  itDB('percentage: freezes objective.progress x100 into final_score', async () => {
    const fixture = await freshFixture('percentage');
    const { rowVersion } = await readSetVersionAndStatus(client, fixture.setId);
    const outcome = await finalScoreOkrSet({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: rowVersion,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `final-score-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(outcome.result.scoredObjectives[0]!.finalScore).toBeCloseTo(50, 5);
  });

  itDB('categories: honestly stubbed — final_score NULL, scoring_model_unsupported=true, no fabricated threshold', async () => {
    const fixture = await freshFixture('categories');
    const { rowVersion } = await readSetVersionAndStatus(client, fixture.setId);
    const outcome = await finalScoreOkrSet({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: rowVersion,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `final-score-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(outcome.result.scoredObjectives[0]!.finalScore).toBeNull();
    expect(outcome.result.scoredObjectives[0]!.scoringModelUnsupported).toBe(true);

    const row = await client.query<{ final_score: string | null; scoring_model_unsupported: boolean }>(
      `SELECT final_score, scoring_model_unsupported FROM okr_vnext_reflections WHERE objective_id = $1`,
      [fixture.objectiveIds[0]]
    );
    expect(row.rows[0]!.final_score).toBeNull();
    expect(row.rows[0]!.scoring_model_unsupported).toBe(true);
  });

  itDB('custom: honestly stubbed identically to categories', async () => {
    const fixture = await freshFixture('custom');
    const { rowVersion } = await readSetVersionAndStatus(client, fixture.setId);
    const outcome = await finalScoreOkrSet({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: rowVersion,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `final-score-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(outcome.result.scoredObjectives[0]!.finalScore).toBeNull();
    expect(outcome.result.scoredObjectives[0]!.scoringModelUnsupported).toBe(true);
  });

  itDB('upsert-not-duplicate: a second finalScoreOkrSet call updates the SAME reflection row, never inserts a second one', async () => {
    const fixture = await freshFixture('zero_to_one');
    const firstVersion = await readSetVersionAndStatus(client, fixture.setId);
    const first = await finalScoreOkrSet({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: firstVersion.rowVersion,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `final-score-1-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(first.outcome).toBe('applied');

    const secondVersion = await readSetVersionAndStatus(client, fixture.setId);
    const second = await finalScoreOkrSet({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: secondVersion.rowVersion,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `final-score-2-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(second.outcome).toBe('applied');

    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM okr_vnext_reflections WHERE objective_id = $1`,
      [fixture.objectiveIds[0]]
    );
    expect(Number(countResult.rows[0]!.count)).toBe(1);
  });

  itDB('status guard: finalScoreOkrSet rejects a Set that is "active" (not yet "review")', async () => {
    const organizationId = `${ORG_PREFIX}-guard-${randomUUID()}`;
    organizationIdsUsed.push(organizationId);
    const fixture = await buildActiveOkrSetFixture({
      organizationId,
      adminUserId: USER_ADMIN,
      ownerUserId: USER_OWNER,
      reviewerUserId: USER_REVIEWER,
      programPolicyOverrides: { objectiveRollupModel: 'equal_average' },
    });
    const { rowVersion } = await readSetVersionAndStatus(client, fixture.setId);
    await expect(
      finalScoreOkrSet({
        setId: fixture.setId,
        organizationId,
        expectedVersion: rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `final-score-guard-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toThrow(OkrSetValidationError);
  });
});
