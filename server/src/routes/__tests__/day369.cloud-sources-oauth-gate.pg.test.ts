/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';
import { getStoredToken } from '../../services/integrationOAuthEngine.js';
import { listCloudFiles } from '../../services/cloudDataService.js';
import { encryptSecret } from '../../utils/secretEncryption.js';

describe('Day 369 — cloud sources require the real per-user OAuth token', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || '' });
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  let app: express.Express;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    await pool.query('INSERT INTO organizations (id,name) VALUES ($1,$2),($3,$4)', [
      orgA,
      'Day369 org A',
      orgB,
      'Day369 org B',
    ]);
    await pool.query(
      `INSERT INTO users (id,organization_id,email,role,status) VALUES
       ($1,$2,$3,'OWNER','active'),($4,$5,$6,'OWNER','active')`,
      [userA, orgA, `${userA}@test.invalid`, userB, orgB, `${userB}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status) VALUES
       ($1,$2,$3,'OWNER','ACTIVE'),($4,$5,$6,'OWNER','ACTIVE')`,
      [randomUUID(), orgA, userA, randomUUID(), orgB, userB]
    );

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    tokenA = jwt.sign(
      { id: userA, userId: userA, organizationId: orgA, role: 'OWNER', email: `${userA}@test.invalid` },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
    tokenB = jwt.sign(
      { id: userB, userId: userB, organizationId: orgB, role: 'OWNER', email: `${userB}@test.invalid` },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
  }, 30000);

  afterEach(() => vi.unstubAllGlobals());

  afterAll(async () => {
    await pool.query('DELETE FROM cloud_sources WHERE organization_id = ANY($1)', [[orgA, orgB]]);
    await pool.query('DELETE FROM integration_oauth_tokens WHERE user_id = ANY($1)', [[userA, userB]]);
    await pool.query('DELETE FROM organization_members WHERE organization_id = ANY($1)', [[orgA, orgB]]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [[userA, userB]]);
    await pool.query('DELETE FROM organizations WHERE id = ANY($1)', [[orgA, orgB]]);
    await pool.end();
  });

  it('returns 409 and writes nothing when the verified user has no OAuth token', async () => {
    const response = await request(app)
      .post('/api/cloud/sources')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ provider: 'google_drive', name: 'No token', accessToken: 'body-must-not-count' });
    console.log('DAY369_NO_TOKEN_HTTP', response.status, JSON.stringify(response.body));
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CLOUD_PROVIDER_NOT_CONNECTED');
    const rows = await pool.query('SELECT id FROM cloud_sources WHERE organization_id=$1', [orgA]);
    expect(rows.rowCount).toBe(0);
  });

  it('returns 201 with a stored token while ignoring request-body tokens', async () => {
    await getStoredToken(userA, 'google_drive');
    await pool.query(
      `INSERT INTO integration_oauth_tokens
       (id,user_id,connector_id,access_token,refresh_token,status)
       VALUES ($1,$2,'google_drive',$3,$4,'active')`,
      [randomUUID(), userA, encryptSecret('fake-google-token-day369'), encryptSecret('refresh-day369')]
    );
    const response = await request(app)
      .post('/api/cloud/sources')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        provider: 'google_drive',
        name: 'Verified Drive',
        accessToken: 'attacker-body-token',
        refreshToken: 'attacker-body-refresh',
      });
    console.log('DAY369_WITH_TOKEN_HTTP', response.status, JSON.stringify(response.body));
    expect(response.status).toBe(201);
    const stored = await pool.query(
      'SELECT id,access_token,refresh_token FROM cloud_sources WHERE organization_id=$1 AND name=$2',
      [orgA, 'Verified Drive']
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].access_token).toBeNull();
    expect(stored.rows[0].refresh_token).toBeNull();
  });

  it('isolates tokens by verified user even across organizations', async () => {
    const response = await request(app)
      .post('/api/cloud/sources')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ provider: 'google_drive', name: 'Foreign token must not count' });
    console.log('DAY369_CROSS_USER_HTTP', response.status, JSON.stringify(response.body));
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CLOUD_PROVIDER_NOT_CONNECTED');
  });

  it('always rejects unsupported SharePoint with 400', async () => {
    const response = await request(app)
      .post('/api/cloud/sources')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ provider: 'sharepoint', name: 'Unsupported' });
    console.log('DAY369_SHAREPOINT_HTTP', response.status, JSON.stringify(response.body));
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('CLOUD_PROVIDER_UNSUPPORTED');
  });

  it('uses the live OAuth-engine token for the Google Drive HTTP request', async () => {
    const source = await pool.query(
      'SELECT id FROM cloud_sources WHERE organization_id=$1 AND name=$2',
      [orgA, 'Verified Drive']
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ files: [] }),
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    await listCloudFiles(source.rows[0].id, orgA);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    console.log('DAY369_GOOGLE_FETCH', url, JSON.stringify(init));
    expect(String(url)).toContain('www.googleapis.com/drive/v3/files');
    expect(init.headers.Authorization).toBe('Bearer fake-google-token-day369');
  });

});
