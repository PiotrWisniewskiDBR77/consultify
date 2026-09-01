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

const orgId = randomUUID();
const userId = randomUUID();
const memberId = randomUUID();
const templateId = randomUUID();

const customTemplate = {
  version: 1,
  theme: {
    titleFont: 'Day226 Marker Font',
    bodyFont: 'Arial',
    primaryColor: 'A10B2C',
    backgroundColor: 'FFFDF8',
    surfaceColor: 'F3F4F6',
    textColor: '111827',
    accentColor: 'C2410C',
  },
  layouts: { standard: { masterName: 'Day226 Master' } },
  layoutMapping: {
    cover: 'standard',
    content: 'standard',
    kpi: 'standard',
    table: 'standard',
    decision: 'standard',
  },
  variables: [],
};

describe('Day 226 custom presentation template save through real ApiGateway', { retry: 0 }, () => {
  let app: express.Express;
  let pool: Pool;
  let token: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_DB).toBe('false');
    await assertRealPostgresTestEnvironment();

    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations (id, name, plan, status)
       VALUES ($1, 'Day 226', 'enterprise', 'active')`,
      [orgId]
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email, password, role, status)
       VALUES ($1, $2, $3, 'unused', 'OWNER', 'active')`,
      [userId, orgId, `day226-${userId}@example.test`]
    );
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
      [memberId, orgId, userId]
    );
    await pool.query(
      `INSERT INTO presentation_templates
       (id, organization_id, name, deck_type, audience, goal, theme, outline_json,
        max_slides, min_slides, must_have_intents, recommended_visuals, is_system,
        is_active, lifecycle_state, layout_policy_json, created_by)
       VALUES ($1, $2, 'Day 226 Template', 'steering_committee', 'Board', 'Decision',
        'corporate', '[]', 10, 3, '[]', '[]', FALSE, TRUE, 'draft', '{}', $3)`,
      [templateId, orgId, userId]
    );

    token = jwt.sign(
      { id: userId, userId, organizationId: orgId, organization_id: orgId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    app = express();
    app.use(express.json({ limit: '2mb' }));
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM presentation_templates WHERE id = $1', [templateId]);
    await pool.query('DELETE FROM organization_members WHERE id = $1', [memberId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    await pool.end();
  });

  it('ON persists both fields and exposes the same values in runtime', async () => {
    process.env.ENABLE_PRESENTATION_TEMPLATE_CUSTOM_SAVE = 'true';
    const response = await request(app)
      .put(`/api/presentations/templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ colorTemplateId: 'burgundy', customTemplate });
    expect(response.status).toBe(200);

    const result = await pool.query(
      'SELECT layout_policy_json FROM presentation_templates WHERE id = $1 AND organization_id = $2',
      [templateId, orgId]
    );
    const stored = JSON.parse(String(result.rows[0].layout_policy_json));
    expect(stored.colorTemplateId).toBe('burgundy');
    expect(stored.customTemplate.theme.titleFont).toBe('Day226 Marker Font');
    expect(stored.customTemplate.theme.primaryColor).toBe('A10B2C');

    const runtime = buildTemplateRuntimeFromRow(result.rows[0]);
    expect(runtime?.colorTemplateId).toBe('burgundy');
    expect(runtime?.customTemplate?.theme.titleFont).toBe('Day226 Marker Font');
  });

  it('OFF preserves the legacy loss of customTemplate and hides colorTemplateId in runtime', async () => {
    delete process.env.ENABLE_PRESENTATION_TEMPLATE_CUSTOM_SAVE;
    await pool.query("UPDATE presentation_templates SET layout_policy_json = '{}' WHERE id = $1", [
      templateId,
    ]);
    const response = await request(app)
      .put(`/api/presentations/templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ customTemplate });
    expect(response.status).toBe(200);

    const result = await pool.query(
      'SELECT layout_policy_json FROM presentation_templates WHERE id = $1 AND organization_id = $2',
      [templateId, orgId]
    );
    expect(JSON.parse(String(result.rows[0].layout_policy_json))).toEqual({});
    expect(buildTemplateRuntimeFromRow(result.rows[0])).not.toHaveProperty('colorTemplateId');
  });

  it('ON rejects an invalid custom template without changing the stored row', async () => {
    process.env.ENABLE_PRESENTATION_TEMPLATE_CUSTOM_SAVE = 'true';
    const before = await pool.query('SELECT layout_policy_json FROM presentation_templates WHERE id = $1', [
      templateId,
    ]);
    const response = await request(app)
      .put(`/api/presentations/templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ customTemplate: { version: 1, theme: {}, layouts: {}, layoutMapping: {} } });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('custom_template_invalid');
    const after = await pool.query('SELECT layout_policy_json FROM presentation_templates WHERE id = $1', [
      templateId,
    ]);
    expect(after.rows[0].layout_policy_json).toBe(before.rows[0].layout_policy_json);
  });
});
