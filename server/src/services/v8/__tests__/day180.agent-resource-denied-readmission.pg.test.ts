/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * FIX-180 / F1 — the acceptance probe, literally: four reservations held, the
 * fifth refused, one settled, the SAME step retried — and admitted.
 *
 * Before the fix the last step was impossible: a `denied` row was replayed
 * forever, so a step refused during a momentary peak stayed dead through every
 * retry and every resume (both rebuild the same idempotency key).
 *
 * The second half of this test is the other half of the contract: the
 * re-judgement is OPT-IN. Callers that do not ask for it (wave8, the
 * multi-agent work manager, the adapter orchestrator, the A09 proofs) still get
 * the durable refusal they were written against.
 */
const enabled = process.env.RUN_DB_TESTS === '1';

describe.skipIf(!enabled)('DAY180 denied-admission readmission — real PG', () => {
  const tag = randomUUID();
  const organizationId = `day180-readmit-org-${tag}`;
  const projectId = `day180-readmit-project-${tag}`;
  const runId = `day180-readmit-run-${tag}`;
  const base = {
    organizationId,
    projectId,
    runId,
    userId: `day180-readmit-user-${tag}`,
    agentId: 'agent-planner',
    toolName: 'bounded-tool',
    estimatedCostUsd: 0,
  };
  let pool: Pool;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations (id,name,plan,status,is_active) VALUES ($1,$2,'enterprise','active',1)`,
      [organizationId, 'Day 180 readmission']
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('re-judges a refusal once the peak has passed, but only when asked to', async () => {
    const { reserveAgentResource, settleAgentResource } =
      await import('../agentResourceGovernanceService.js');
    const held: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const decision = await reserveAgentResource({
        ...base,
        idempotencyKey: `day180-readmit-hold-${tag}-${i}`,
      });
      expect(decision).toMatchObject({ allowed: true, status: 'reserved' });
      held.push(decision.reservationId);
    }

    // 5. The peak refuses the step under test.
    const stepKey = `day180-readmit-step-${tag}`;
    const denied = await reserveAgentResource({ ...base, idempotencyKey: stepKey });
    expect(denied).toMatchObject({
      allowed: false,
      status: 'denied',
      reason: 'resource_concurrency_limit_exceeded',
      idempotentReplay: false,
    });

    // Contract for every caller that did NOT opt in: the refusal is durable.
    const replayed = await reserveAgentResource({ ...base, idempotencyKey: stepKey });
    expect(replayed).toMatchObject({
      allowed: false,
      status: 'denied',
      idempotentReplay: true,
      reservationId: denied.reservationId,
    });

    // Opted in, but the ceiling is still full: refused again on the merits.
    const stillFull = await reserveAgentResource({
      ...base,
      idempotencyKey: stepKey,
      recomputeDeniedAdmission: true,
    });
    expect(stillFull).toMatchObject({
      allowed: false,
      status: 'denied',
      reason: 'resource_concurrency_limit_exceeded',
      reservationId: denied.reservationId,
    });

    // The peak passes: one of the four finishes.
    await settleAgentResource({ reservationId: held[0], organizationId, projectId });

    // RETRY OF THE SAME STEP — the whole point of F1.
    const readmitted = await reserveAgentResource({
      ...base,
      idempotencyKey: stepKey,
      recomputeDeniedAdmission: true,
    });
    expect(readmitted).toMatchObject({
      allowed: true,
      status: 'reserved',
      reason: 'resource_reservation_allowed',
      idempotentReplay: false,
      // Re-judged in place: same row, no second reservation, no double count.
      reservationId: denied.reservationId,
    });
    expect(readmitted.leaseExpiresAt).not.toBeNull();
    expect(
      Number(
        (
          await pool.query(
            `SELECT COUNT(*) AS count FROM v8_agent_resource_reservations
              WHERE organization_id=$1 AND idempotency_key=$2`,
            [organizationId, stepKey]
          )
        ).rows[0].count
      )
    ).toBe(1);
  }, 60_000);
});
