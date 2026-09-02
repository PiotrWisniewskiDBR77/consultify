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
import { buildTemplateRuntimeFromRow } from '../../services/presentationTemplateRuntimeService.js';

const DATABASE_URL = process.env.DATABASE_URL || '';

describe('Day 228 imageStylePrompt through real ApiGateway and PostgreSQL', () => {
  const suffix = randomUUID().slice(0, 8);
  const organizationId = `day228_org_${suffix}`;
  const userId = `day228_owner_${suffix}`;
  const templateId = `day228_template_${suffix}`;
  let app: express.Express;
  let pool: Pool;
  let token: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [
      organizationId,
      'Day 228 image style proof',
    ]);
    await pool.query(
      'INSERT INTO users (id, organization_id, email, role, status, is_active) VALUES ($1, $2, $3, $4, $5, 1)',
      [userId, organizationId, `${userId}@example.test`, 'OWNER', 'active']
    );
    await pool.query(
      'INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES ($1, $2, $3, $4, $5)',
      [`day228_member_${suffix}`, organizationId, userId, 'OWNER', 'ACTIVE']
    );
    await pool.query(
      `INSERT INTO presentation_templates
       (id, organization_id, name, deck_type, outline_json, is_system, lifecycle_state,
        layout_policy_json, provenance_status, provenance_json)
       VALUES ($1, $2, $3, 'steering_committee', '[]', FALSE, 'draft', $4, 'approved', $5)`,
      [
        templateId,
        organizationId,
        'Day 228 template',
        JSON.stringify({ colorTemplateId: 'ocean' }),
        JSON.stringify({ authority: 'day228', actor: userId, version: '1', evidence: 'test' }),
      ]
    );

    token = jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { expiresIn: '15m' }
    );
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM presentation_templates WHERE id = $1', [templateId]);
    await pool.query('DELETE FROM organization_members WHERE organization_id = $1', [
      organizationId,
    ]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    await pool.end();
  });

  it('PUT persists imageStylePrompt without erasing colorTemplateId and GET/runtime read it back', async () => {
    const style = 'utilizing a gradient of fuchsia, pink, and royal blue';
    const put = await request(app)
      .put(`/api/presentations/templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ imageStylePrompt: style });
    expect(put.status).toBe(200);

    const sql = await pool.query(
      'SELECT * FROM presentation_templates WHERE id = $1 AND organization_id = $2',
      [templateId, organizationId]
    );
    const layout = JSON.parse(sql.rows[0].layout_policy_json);
    expect(layout).toEqual({ colorTemplateId: 'ocean', imageStylePrompt: style });

    const get = await request(app)
      .get(`/api/presentations/templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body?.data?.layout_policy_json?.imageStylePrompt).toBe(style);

    const runtime = buildTemplateRuntimeFromRow(sql.rows[0]);
    expect(runtime.imageStylePrompt).toBe(style);
  });
});
