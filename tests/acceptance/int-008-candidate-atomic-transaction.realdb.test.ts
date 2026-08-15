/**
 * CLEAN-002-INT-005/006 — real PostgreSQL proof for candidate promotion.
 *
 * The fault is injected by PostgreSQL itself on the candidate receipt UPDATE.
 * That statement runs after the Initiative INSERT in the same pinned transaction,
 * so a surviving Initiative would prove a split/partial commit.
 */
import { pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PREFIX = 'odbior--int008-atomic--';
const FAULT_CANDIDATE_ID = `${PREFIX}fault`;
const RACE_CANDIDATE_ID = `${PREFIX}race`;
const TRIGGER_NAME = 'odbior_int008_atomic_fault_trigger';
const FUNCTION_NAME = 'odbior_int008_atomic_fault';
const CONCURRENCY = 8;

let acceptCandidate: typeof import('../../server/src/services/initiative/initiativeCandidateService.js').acceptCandidate;

async function insertCandidate(id: string, title: string): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO initiative_candidates
         (id, organization_id, source_type, source_id, title, rationale, fit_score, status, created_by)
       VALUES ($1, $2, 'manual', NULL, $3, $4, 0.9, 'pending', $5)`,
      [id, SEED.ORG_ID, title, `Atomic acceptance fixture for ${id}`, SEED.USER_ID]
    );
  } finally {
    await client.end();
  }
}

async function dropFaultTrigger(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(`DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON initiative_candidates`);
    await client.query(`DROP FUNCTION IF EXISTS ${FUNCTION_NAME}()`);
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  await seed();
  await dropFaultTrigger();

  const client = pgClient();
  await client.connect();
  try {
    await client.query('DELETE FROM initiatives WHERE source_candidate_id IN ($1, $2)', [
      FAULT_CANDIDATE_ID,
      RACE_CANDIDATE_ID,
    ]);
    await client.query('DELETE FROM initiative_candidates WHERE id IN ($1, $2)', [
      FAULT_CANDIDATE_ID,
      RACE_CANDIDATE_ID,
    ]);
  } finally {
    await client.end();
  }

  await insertCandidate(FAULT_CANDIDATE_ID, 'Fault-injected warehouse network redesign');
  await insertCandidate(RACE_CANDIDATE_ID, 'Concurrent service portfolio rationalization');
  ({ acceptCandidate } = await import(
    '../../server/src/services/initiative/initiativeCandidateService.js'
  ));
}, 60_000);

afterAll(async () => {
  await dropFaultTrigger();
  const client = pgClient();
  await client.connect();
  try {
    await client.query('DELETE FROM initiatives WHERE source_candidate_id IN ($1, $2)', [
      FAULT_CANDIDATE_ID,
      RACE_CANDIDATE_ID,
    ]);
    await client.query('DELETE FROM initiative_candidates WHERE id IN ($1, $2)', [
      FAULT_CANDIDATE_ID,
      RACE_CANDIDATE_ID,
    ]);
  } finally {
    await client.end();
  }
}, 30_000);

describe('INT-08 — candidate acceptance is one pinned PostgreSQL transaction', () => {
  it('rolls back the Initiative INSERT when the candidate receipt link fails', async () => {
    const client = pgClient();
    await client.connect();
    try {
      await client.query(`
        CREATE FUNCTION ${FUNCTION_NAME}() RETURNS trigger AS $$
        BEGIN
          IF NEW.id = '${FAULT_CANDIDATE_ID}' AND NEW.status = 'accepted' THEN
            RAISE EXCEPTION 'INT008 injected failure after initiative insert';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
      await client.query(`
        CREATE TRIGGER ${TRIGGER_NAME}
        BEFORE UPDATE ON initiative_candidates
        FOR EACH ROW EXECUTE FUNCTION ${FUNCTION_NAME}()
      `);
    } finally {
      await client.end();
    }

    await expect(
      acceptCandidate(undefined, FAULT_CANDIDATE_ID, {
        orgId: SEED.ORG_ID,
        userId: SEED.USER_ID,
        fill: false,
      })
    ).rejects.toThrow('INT008 injected failure after initiative insert');

    await dropFaultTrigger();
    const verify = pgClient();
    await verify.connect();
    try {
      const candidate = await verify.query(
        'SELECT status, initiative_id, accepted_at FROM initiative_candidates WHERE id = $1',
        [FAULT_CANDIDATE_ID]
      );
      const initiatives = await verify.query(
        'SELECT id FROM initiatives WHERE organization_id = $1 AND source_candidate_id = $2',
        [SEED.ORG_ID, FAULT_CANDIDATE_ID]
      );
      expect(candidate.rows[0]).toMatchObject({
        status: 'pending',
        initiative_id: null,
        accepted_at: null,
      });
      expect(initiatives.rowCount).toBe(0);
    } finally {
      await verify.end();
    }
  });

  it('serializes concurrent accepts and makes every retry return the same Initiative', async () => {
    const attempts = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        acceptCandidate(undefined, RACE_CANDIDATE_ID, {
          orgId: SEED.ORG_ID,
          userId: SEED.USER_ID,
          fill: false,
        })
      )
    );
    const ids = attempts.map((result) => result?.initiativeId);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(1);

    const retry = await acceptCandidate(undefined, RACE_CANDIDATE_ID, {
      orgId: SEED.ORG_ID,
      userId: SEED.USER_ID,
      fill: false,
    });
    expect(retry?.initiativeId).toBe(ids[0]);

    const verify = pgClient();
    await verify.connect();
    try {
      const candidate = await verify.query(
        'SELECT status, initiative_id, accepted_at FROM initiative_candidates WHERE id = $1',
        [RACE_CANDIDATE_ID]
      );
      const initiatives = await verify.query(
        `SELECT id, organization_id, source_candidate_id
           FROM initiatives
          WHERE organization_id = $1 AND source_candidate_id = $2`,
        [SEED.ORG_ID, RACE_CANDIDATE_ID]
      );
      expect(initiatives.rowCount).toBe(1);
      expect(initiatives.rows[0]).toMatchObject({
        id: ids[0],
        organization_id: SEED.ORG_ID,
        source_candidate_id: RACE_CANDIDATE_ID,
      });
      expect(candidate.rows[0].status).toBe('accepted');
      expect(candidate.rows[0].initiative_id).toBe(ids[0]);
      expect(candidate.rows[0].accepted_at).not.toBeNull();
    } finally {
      await verify.end();
    }
  });
});
