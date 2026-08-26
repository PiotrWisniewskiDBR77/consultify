import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeRealDb = databaseUrl ? describe : describe.skip;
const organizationId = 'day21-list-org';

describeRealDb('Day 21 initiative list keyset pagination', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 3 });
  const app = express();
  app.use((req, _res, next) => {
    (req as any).user = {
      id: 'day21-list-user',
      organizationId: req.header('x-test-org') ?? organizationId,
      role: 'USER',
    };
    next();
  });
  app.use(
    '/runtime-v1',
    createInitiativesExecutionRuntimeRouter({
      unitOfWork: {} as any,
      reader: new PostgresInitiativeReader(pool),
      authorize: async (actor) => actor.organizationId === organizationId,
      resolvePolicy: async () => ({}) as any,
    })
  );

  beforeAll(async () => {
    const values = Array.from({ length: 55 }, (_, index) => {
      const aggregateId = `day21-list-${String(index).padStart(3, '0')}`;
      const payload = {
        initiativeId: aggregateId,
        lifecycleState: 'REGISTERED_DRAFT',
        title: aggregateId,
        problem: 'Problem',
        proposedOutcome: null,
        projectId: 'day21-list-project',
        initiativeOwnerId: 'owner-1',
        visibility: 'PROJECT',
        readiness: 'NOT_EVALUATED',
        source: {
          proposalId: `proposal-${index}`,
          proposalVersion: 1,
          sourceType: 'MANUAL_HUB',
          sourceId: `source-${index}`,
          sourceVersion: 1,
        },
      };
      return pool.query(
        `INSERT INTO ie_aggregate_state
           (organization_id, aggregate_type, aggregate_id, version, payload_json, updated_at)
         VALUES ($1, 'initiative', $2, 1, $3::jsonb, $4::timestamptz)
         ON CONFLICT (organization_id, aggregate_type, aggregate_id)
         DO UPDATE SET payload_json=EXCLUDED.payload_json, updated_at=EXCLUDED.updated_at`,
        [
          organizationId,
          aggregateId,
          JSON.stringify(payload),
          `2026-01-01T00:${String(Math.floor(index / 10)).padStart(2, '0')}:00.000Z`,
        ]
      );
    });
    await Promise.all(values);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM ie_aggregate_state WHERE organization_id=$1`, [organizationId]);
    await pool.end();
  });

  it('returns stable pages without duplicates when timestamps tie', async () => {
    const first = await request(app).get('/runtime-v1/initiatives?limit=20');
    expect(first.status).toBe(200);
    expect(first.body.initiatives).toHaveLength(20);
    expect(first.body.nextCursor).toEqual(expect.any(String));

    const second = await request(app).get(
      `/runtime-v1/initiatives?limit=20&cursor=${encodeURIComponent(first.body.nextCursor)}`
    );
    expect(second.status).toBe(200);
    expect(second.body.initiatives).toHaveLength(20);
    const ids = [...first.body.initiatives, ...second.body.initiatives].map(
      (item) => item.initiative.initiativeId
    );
    expect(new Set(ids).size).toBe(40);
  });

  it('uses the documented default limit of 50', async () => {
    const response = await request(app).get('/runtime-v1/initiatives');
    expect(response.status).toBe(200);
    expect(response.body.initiatives).toHaveLength(50);
    expect(response.body.nextCursor).toEqual(expect.any(String));
  });

  it('returns 400 for malformed cursor and out-of-range limit', async () => {
    const malformed = await request(app).get('/runtime-v1/initiatives?cursor=not-a-cursor');
    const oversized = await request(app).get('/runtime-v1/initiatives?limit=201');
    expect(malformed.status).toBe(400);
    expect(oversized.status).toBe(400);
  });

  it('does not let a cursor or query organization escape the token tenant', async () => {
    const first = await request(app).get('/runtime-v1/initiatives?limit=2');
    const foreign = await request(app)
      .get(
        `/runtime-v1/initiatives?limit=2&organizationId=${organizationId}&cursor=${encodeURIComponent(first.body.nextCursor)}`
      )
      .set('x-test-org', 'foreign-day21-list-org');
    expect(foreign.status).toBe(404);
  });
});
