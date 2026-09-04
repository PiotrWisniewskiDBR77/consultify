/** @vitest-environment node */
import fs from 'node:fs';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertRealPostgresTestEnvironment } from '../integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const fixturePath = process.env.DAY360_FIXTURE_PATH ?? '';
const resultPath = process.env.DAY360_RESULT_PATH ?? '';
type Fixture = { organizationId: string; userId: string; token: string };

describe('Day 360 G19 01 Organization cross-org workload isolation through ApiGateway', NO_RETRY, () => {
  const app = express();
  let owner: Fixture;
  let foreign: Fixture;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
    expect(fixturePath).toBeTruthy();
    expect(resultPath).toBeTruthy();
    await assertRealPostgresTestEnvironment();
    ({ owner, foreign } = JSON.parse(fs.readFileSync(fixturePath, 'utf8')));
    const { ApiGateway } = await import('../../server/src/Gateway.js');
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 60_000);

  afterAll(async () => {
    const pgModule = await import('../../server/src/database/PostgresDatabase.js');
    await pgModule.closePool?.();
  });

  it('denies a foreign organization while the owner reads the same seeded workload user', async () => {
    const target = `/api/pmo/tasks/workload/${owner.userId}`;
    const denied = await request(app).get(target).set('Authorization', `Bearer ${foreign.token}`);
    const allowed = await request(app).get(target).set('Authorization', `Bearer ${owner.token}`);
    const result = {
      target,
      sameUserId: owner.userId,
      foreign: { status: denied.status, bytes: Buffer.byteLength(JSON.stringify(denied.body)), body: denied.body },
      owner: { status: allowed.status, bytes: Buffer.byteLength(JSON.stringify(allowed.body)), body: allowed.body },
    };
    fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
    expect(denied.status).toBe(404);
    expect(denied.body).toMatchObject({ code: 'TASK_WORKLOAD_USER_NOT_FOUND' });
    expect(allowed.status).toBe(200);
    expect(Buffer.byteLength(JSON.stringify(allowed.body))).toBeGreaterThan(0);
    expect(allowed.body).toMatchObject({ userId: owner.userId, total: 1 });
  });
});
