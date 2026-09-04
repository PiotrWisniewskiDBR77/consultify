/** @vitest-environment node */
import fs from 'node:fs';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertRealPostgresTestEnvironment } from '../integration/_helpers/assertRealPostgres.js';

const fixturePath = process.env.DAY360_FIXTURE_PATH ?? '';
const resultPath = process.env.DAY360_RESULT_PATH ?? '';
type Fixture = { organizationId: string; userId: string; token: string };

describe('Day 360 G19 08 Meetings cross-org record isolation through ApiGateway', { retry: 0 }, () => {
  const app = express();
  let owner: Fixture;
  let foreign: Fixture;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
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

  it('denies a foreign organization while the owner reads the same seeded meeting', async () => {
    const meetingId = 'day360-meeting-owner';
    const target = `/api/meeting/${meetingId}`;
    const denied = await request(app).get(target).set('Authorization', `Bearer ${foreign.token}`);
    const allowed = await request(app).get(target).set('Authorization', `Bearer ${owner.token}`);
    fs.writeFileSync(resultPath, `${JSON.stringify({
      target, meetingId,
      foreign: { status: denied.status, bytes: Buffer.byteLength(JSON.stringify(denied.body)), body: denied.body },
      owner: { status: allowed.status, bytes: Buffer.byteLength(JSON.stringify(allowed.body)), body: allowed.body },
    }, null, 2)}\n`);
    expect(denied.status).toBe(404);
    expect(allowed.status).toBe(200);
    expect(Buffer.byteLength(JSON.stringify(allowed.body))).toBeGreaterThan(0);
    expect(allowed.body).toMatchObject({ meeting: { id: meetingId, organizationId: owner.organizationId } });
  });
});
