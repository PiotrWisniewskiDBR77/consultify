/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import { ApiGateway } from '../../Gateway.js';
import config from '../../config/Config.js';

describe('Day231 outline route through real ApiGateway', { retry: 0 }, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const memberId = randomUUID();
  let app: express.Express;
  let pool: Pool;
  let token = '';
  let deckId = '';

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_DB).toBe('false');
    expect(process.env.ENABLE_DECK_FROM_KNOWLEDGE).not.toBe('true');
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`INSERT INTO organizations(id,name,plan,status) VALUES($1,$2,'enterprise','active')`, [organizationId, 'Day231 flag-off org']);
    await pool.query(`INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'unused','OWNER','active')`, [userId, organizationId, `day231-${userId}@test.invalid`]);
    await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')`, [memberId, organizationId, userId]);
    token = jwt.sign({ id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' }, config.JWT_SECRET, { expiresIn: '30m' });
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  afterAll(async () => {
    if (!pool) return;
    if (deckId) await pool.query('DELETE FROM presentation_decks WHERE id=$1', [deckId]);
    await pool.query('DELETE FROM organization_members WHERE id=$1', [memberId]);
    await pool.query('DELETE FROM users WHERE id=$1', [userId]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
    await pool.end();
  });

  it('keeps flag-OFF behavior deterministic and persists honest empty source_refs_json', async () => {
    const response = await request(app)
      .post('/api/presentations/generate/outline')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Day231 flag off',
        audience: 'executive',
        goal: 'decide',
        language: 'pl',
        theme: 'corporate',
        confidentiality: 'internal',
        sourceArtifacts: [],
      });
    expect(response.status).toBe(200);
    deckId = String(response.body?.data?.deckId || '');
    expect(deckId).not.toBe('');
    expect(response.body.data.outline.length).toBeGreaterThan(1);
    const stored = await pool.query<{ source_type: string; source_id: string | null; source_refs_json: unknown; outline_json: unknown }>(
      `SELECT source_type,source_id,source_refs_json,outline_json FROM presentation_decks WHERE id=$1 AND organization_id=$2`,
      [deckId, organizationId]
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].source_type).toBe('manual');
    expect(stored.rows[0].source_id).toBeNull();
    const storedRefs = typeof stored.rows[0].source_refs_json === 'string'
      ? JSON.parse(stored.rows[0].source_refs_json)
      : stored.rows[0].source_refs_json;
    expect(storedRefs).toEqual([]);
    expect(JSON.stringify(stored.rows[0].outline_json)).not.toContain('org_knowledge_outline');
  }, 30_000);
});
