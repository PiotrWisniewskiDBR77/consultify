/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

describe('Day230 overflow preflight through real ApiGateway', { retry: 0 }, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const memberId = randomUUID();
  const deckId = randomUUID();
  let app: express.Express;
  let pool: Pool;
  let token = '';

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_DB).toBe('false');
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations(id,name,plan,status) VALUES($1,'Day230','enterprise','active')`,
      [organizationId]
    );
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status)
       VALUES($1,$2,$3,'unused','OWNER','active')`,
      [userId, organizationId, `day230-${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [memberId, organizationId, userId]
    );
    await pool.query(
      `INSERT INTO presentation_decks(id,organization_id,title,template_id,deck_json,version,status,created_by)
       VALUES($1,$2,'Day230 overflow','default',$3,1,'draft',$4)`,
      [
        deckId,
        organizationId,
        JSON.stringify({
          cards: [
            { title: 'Okładka', key_message: 'Krótko', blocks: [] },
            { title: 'Kontekst', key_message: 'Krótko', blocks: [] },
            { title: 'Wniosek', key_message: 'x'.repeat(721), blocks: [] },
          ],
        }),
        userId,
      ]
    );
    token = jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '30m' }
    );
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  afterAll(async () => {
    delete process.env.ENABLE_DECK_OVERFLOW_WARNING;
    if (!pool) return;
    const links = await pool.query<{ artifact_id: string }>(
      `SELECT artifact_id FROM v8_artifact_origin_links
       WHERE organization_id=$1 AND origin_runtime='presentation' AND origin_record_id=$2`,
      [organizationId, deckId]
    );
    await pool.query(
      `DELETE FROM v8_artifact_origin_links
       WHERE organization_id=$1 AND origin_runtime='presentation' AND origin_record_id=$2`,
      [organizationId, deckId]
    );
    for (const row of links.rows) {
      await pool.query('DELETE FROM v8_output_artifacts WHERE artifact_id=$1', [row.artifact_id]);
    }
    await pool.query('DELETE FROM presentation_decks WHERE id=$1', [deckId]);
    await pool.query('DELETE FROM organization_members WHERE id=$1', [memberId]);
    await pool.query('DELETE FROM users WHERE id=$1', [userId]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
    await pool.end();
  });

  it('ON zwraca nieblokujące ostrzeżenie z numerem slajdu 3', async () => {
    process.env.ENABLE_DECK_OVERFLOW_WARNING = 'true';
    const response = await request(app)
      .get(`/api/presentations/decks/${deckId}/download?mode=draft&preflight=overflow`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.overflowWarnings).toHaveLength(1);
    expect(response.body.data.overflowWarnings[0]).toMatchObject({ slideIndex: 3 });
  });

  it('OFF zachowuje ciszę', async () => {
    delete process.env.ENABLE_DECK_OVERFLOW_WARNING;
    const response = await request(app)
      .get(`/api/presentations/decks/${deckId}/download?mode=draft&preflight=overflow`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.overflowWarnings).toEqual([]);
  });
});
