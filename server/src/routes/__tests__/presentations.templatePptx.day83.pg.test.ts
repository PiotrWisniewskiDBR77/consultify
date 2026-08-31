/** @vitest-environment node */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

const marker = `ZNACZNIK-DAY83-${randomUUID()}`;
const orgId = randomUUID();
const userId = randomUUID();
const memberId = randomUUID();

describe('Day 83 template to current PPTX through the real ApiGateway', () => {
  let app: express.Express;
  let pool: Pool;
  let token: string;
  let templateId = '';
  let deckId = '';

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_DB).toBe('false');
    const proof = await assertRealPostgresTestEnvironment();
    expect(proof.database).toBe('cx_day83');
    expect(proof.host).toBe('127.0.0.1');
    expect(proof.port).toBe('5955');

    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations (id, name, plan, status)
       VALUES ($1, $2, 'enterprise', 'active')`,
      [orgId, `Day 83 ${marker}`]
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email, password, role, status)
       VALUES ($1, $2, $3, 'unused', 'OWNER', 'active')`,
      [userId, orgId, `day83-${userId}@example.test`]
    );
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
      [memberId, orgId, userId]
    );

    token = jwt.sign(
      { id: userId, userId, organizationId: orgId, organization_id: orgId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  afterAll(async () => {
    if (!pool) return;
    if (deckId) {
      await pool.query('DELETE FROM presentation_cards WHERE deck_id = $1', [deckId]);
      await pool.query('DELETE FROM presentation_decks WHERE id = $1', [deckId]);
    }
    if (templateId) {
      await pool.query('DELETE FROM presentation_templates WHERE id = $1', [templateId]);
    }
    await pool.query('DELETE FROM organization_members WHERE id = $1', [memberId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  });

  it('creates, approves, materializes and exports a marker-bearing presentation template', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const create = await request(app)
      .post('/api/deliverables/templates')
      .set(auth)
      .send({
        type: 'deck',
        name: `Day 83 ${marker}`,
        description: marker,
        meta: {
          outline_json: [
            {
              title: marker,
              archetype: 'title',
              hint: `Treść kontrolna ${marker}`,
              ai_filled: false,
            },
          ],
          scope: 'org',
        },
      });
    console.log('TEMPLATE_CREATE_STATUS', create.status);
    console.log('TEMPLATE_CREATE_BODY', JSON.stringify(create.body));
    expect(create.status).toBe(201);
    templateId = String(create.body.template?.id || '');
    expect(templateId).not.toBe('');

    const approve = await request(app)
      .post(`/api/deliverables/templates/${templateId}/provenance/approve`)
      .set(auth)
      .set('Idempotency-Key', `day83-${randomUUID()}`)
      .send({
        registry: 'presentation_templates',
        source: 'internal-catalog',
        licenseBasis: 'owned',
        authority: 'day83@example.test',
        version: '1.0.0',
        evidence: `urn:day83:${marker}`,
      });
    console.log('PROMOTION_STATUS', approve.status);
    console.log('PROMOTION_BODY', JSON.stringify(approve.body));
    expect(approve.status).toBe(201);

    const artifact = await pool.query<{ artifact_id: string }>(
      `SELECT artifact_id FROM v8_artifact_origin_links
       WHERE organization_id = $1 AND origin_runtime = 'presentation_template'
         AND origin_record_id = $2`,
      [orgId, templateId]
    );
    const artifactId = String(artifact.rows[0]?.artifact_id || '');
    expect(artifactId).not.toBe('');

    const generate = await request(app)
      .post('/api/presentations/decks/from-template')
      .set(auth)
      .send({ templateArtifactId: artifactId, title: `Day 83 ${marker}` });
    console.log('DECK_GENERATE_STATUS', generate.status);
    console.log('DECK_GENERATE_BODY', JSON.stringify(generate.body));
    expect(generate.status).toBe(201);
    deckId = String(generate.body.data?.id || '');
    expect(deckId).not.toBe('');

    const exportResponse = await request(app)
      .get(`/api/presentations/decks/${deckId}/download?mode=draft`)
      .set(auth)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    console.log('DECK_EXPORT_STATUS', exportResponse.status);
    console.log('DECK_EXPORT_BODY', JSON.stringify(exportResponse.body));
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    expect(exportResponse.body).toBeInstanceOf(Buffer);
    expect(exportResponse.body.length).toBeGreaterThan(0);
    fs.writeFileSync(
      '/private/tmp/cx-day83-pptx-export-artefakty/day83-template-loop.pptx',
      exportResponse.body
    );
  }, 60_000);
});
