/**
 * AUD-MVP-LIFECYCLE-001 — real PostgreSQL CAS, tenant and cold-read proof.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { actorFor, addMember, cleanupOrg, insertOrganization, makeProgram, REAL_PG, requireRealPg, uid } from './helpers.js';

const describeDb = REAL_PG ? describe : describe.skip;
if (REAL_PG) requireRealPg();

describeDb('audit lifecycle optimistic concurrency (real PostgreSQL)', () => {
  let pool: InstanceType<typeof import('pg').Pool>;
  let programService: typeof import('../../audits/programService.js');

  const orgA = uid('org-lifecycle-cas-a');
  const orgB = uid('org-lifecycle-cas-b');
  const adminA = uid('admin-a');
  const adminB = uid('admin-b');

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    programService = await import('../../audits/programService.js');
    await insertOrganization(pool, orgA);
    await insertOrganization(pool, orgB);
  });

  afterAll(async () => {
    if (!pool) return;
    await cleanupOrg(pool, orgA);
    await cleanupOrg(pool, orgB);
    await pool.end();
  });

  it('allows exactly one of two stale transitions and cold-reads the winner plus exactly one event', async () => {
    const programId = await makeProgram(pool, orgA, adminA, 'Program CAS race');
    await addMember(pool, orgA, programId, adminA, 'program_owner');
    const actor = actorFor(orgA, adminA);

    const outcomes = await Promise.allSettled([
      programService.transitionLifecycle(orgA, actor, programId, 'evidence_review'),
      programService.transitionLifecycle(orgA, actor, programId, 'preparation', 'controlled rollback'),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: { code: 'AUDIT_INVALID_STATE', statusCode: 409 },
    });

    const { Pool } = await import('pg');
    const coldPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    try {
      const cold = await coldPool.query(
        `SELECT p.lifecycle_state,
                COUNT(e.id)::int AS transition_events,
                MAX(e.payload->>'to') AS recorded_target
           FROM audit_programs p
           LEFT JOIN audit_domain_events e
             ON e.organization_id=p.organization_id AND e.program_id=p.id
            AND e.event_type='program.lifecycle_transitioned'
          WHERE p.organization_id=$1 AND p.id=$2
          GROUP BY p.lifecycle_state`,
        [orgA, programId],
      );
      expect(cold.rows).toHaveLength(1);
      expect(['evidence_review', 'preparation']).toContain(cold.rows[0].lifecycle_state);
      expect(cold.rows[0].transition_events).toBe(1);
      expect(cold.rows[0].recorded_target).toBe(cold.rows[0].lifecycle_state);
    } finally {
      await coldPool.end();
    }
  });

  it('fails closed when a foreign tenant attempts the transition', async () => {
    const programId = await makeProgram(pool, orgA, adminA, 'Tenant-isolated lifecycle');
    await expect(
      programService.transitionLifecycle(
        orgB,
        actorFor(orgB, adminB, 'admin'),
        programId,
        'evidence_review',
      ),
    ).rejects.toMatchObject({ code: 'AUDIT_FORBIDDEN', statusCode: 403 });

    const state = await pool.query(
      `SELECT lifecycle_state FROM audit_programs WHERE organization_id=$1 AND id=$2`,
      [orgA, programId],
    );
    expect(state.rows[0].lifecycle_state).toBe('fieldwork');
  });
});
