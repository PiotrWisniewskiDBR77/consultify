/** @vitest-environment node */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

import express from 'express';
import JSZip from 'jszip';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

const marker = `ZNACZNIK-DAY186-${randomUUID()}`;
const orgId = randomUUID();
const userId = randomUUID();
const memberId = randomUUID();
const artifactPath = '/private/tmp/cx-day186-gen4-tresc-artefakty/day186-template-content.pptx';

function cardText(value: unknown): string {
  return JSON.stringify(value ?? '');
}

async function pptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort();
  const xml = await Promise.all(slideNames.map((name) => zip.file(name)!.async('string')));
  return xml
    .flatMap((slide) => [...slide.matchAll(/<a:t>(.*?)<\/a:t>/g)].map((match) => match[1]))
    .join('\n');
}

describe('Day 186 template brief content through the real ApiGateway', { retry: 0 }, () => {
  let app: express.Express;
  let pool: Pool;
  let token: string;
  let templateId = '';
  const deckIds: string[] = [];

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_DB).toBe('false');
    const proof = await assertRealPostgresTestEnvironment();
    expect(proof.database.length).toBeGreaterThan(0);
    expect(proof.host.length).toBeGreaterThan(0);
    expect(Number(proof.port)).toBeGreaterThan(0);

    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations (id, name, plan, status)
       VALUES ($1, $2, 'enterprise', 'active')`,
      [orgId, `Day 186 ${marker}`]
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email, password, role, status)
       VALUES ($1, $2, $3, 'unused', 'OWNER', 'active')`,
      [userId, orgId, `day186-${userId}@example.test`]
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
    for (const deckId of deckIds) {
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

  it('persists brief-grounded cards for three intents and exports their content to PPTX', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const create = await request(app)
      .post('/api/deliverables/templates')
      .set(auth)
      .send({
        type: 'deck',
        name: `Day 186 ${marker}`,
        description: marker,
        meta: {
          outline_json: [
            { intent: 'risk_management', title: 'Risks' },
            {
              intent: 'performance_overview',
              title: 'Financial outlook',
              dataNeeded: ['Annual benefit'],
            },
            { intent: 'next_steps', title: 'Next steps' },
          ],
          scope: 'org',
        },
      });
    expect(create.status).toBe(201);
    templateId = String(create.body.template?.id || '');
    expect(templateId).not.toBe('');

    const approve = await request(app)
      .post(`/api/deliverables/templates/${templateId}/provenance/approve`)
      .set(auth)
      .set('Idempotency-Key', `day186-${randomUUID()}`)
      .send({
        registry: 'presentation_templates',
        source: 'internal-catalog',
        licenseBasis: 'owned',
        authority: 'day186@example.test',
        version: '1.0.0',
        evidence: `urn:day186:${marker}`,
      });
    expect(approve.status).toBe(201);

    const artifact = await pool.query<{ artifact_id: string }>(
      `SELECT artifact_id FROM v8_artifact_origin_links
       WHERE organization_id = $1 AND origin_runtime = 'presentation_template'
         AND origin_record_id = $2`,
      [orgId, templateId]
    );
    const artifactId = String(artifact.rows[0]?.artifact_id || '');
    expect(artifactId).not.toBe('');

    const baseline = await request(app)
      .post('/api/presentations/decks/from-template')
      .set(auth)
      .send({ templateArtifactId: artifactId, title: `Before ${marker}` });
    expect(baseline.status).toBe(201);
    const baselineDeckId = String(baseline.body.data?.id || '');
    deckIds.push(baselineDeckId);

    const brief = [
      `Top risks: risk evidence includes ${marker} data migration delay and weak adoption.`,
      'Mitigations: parallel reconciliation and named local champions.',
      'Financial scenario: Annual benefit: EUR 2.2m.',
      'Decisions: approve phase two by 15 August and confirm the Operations owner.',
    ].join(' ');
    const generated = await request(app)
      .post('/api/presentations/decks/from-template')
      .set(auth)
      .send({ templateArtifactId: artifactId, title: marker, brief });
    expect(generated.status).toBe(201);
    const deckId = String(generated.body.data?.id || '');
    expect(deckId).not.toBe('');
    deckIds.push(deckId);

    const beforeCards = await pool.query<{ intent: string; blocks_json: unknown }>(
      `SELECT intent, blocks_json FROM presentation_cards
       WHERE deck_id = $1 ORDER BY card_index`,
      [baselineDeckId]
    );
    const afterCards = await pool.query<{ intent: string; blocks_json: unknown }>(
      `SELECT intent, blocks_json FROM presentation_cards
       WHERE deck_id = $1 ORDER BY card_index`,
      [deckId]
    );
    expect(afterCards.rows.map((row) => row.intent)).toEqual([
      'risk_management',
      'performance_overview',
      'next_steps',
    ]);
    const beforeText = cardText(beforeCards.rows.map((row) => row.blocks_json));
    expect(beforeText).toContain('Data required');
    expect(beforeText).toContain('Confirm the decision and conditions');
    const afterText = cardText(afterCards.rows.map((row) => row.blocks_json));
    console.log('DAY186_BEFORE_CARDS', cardText(beforeCards.rows.map((row) => row.blocks_json)));
    console.log('DAY186_AFTER_CARDS', afterText);
    fs.writeFileSync(
      '/private/tmp/cx-day186-gen4-tresc-artefakty/day186-cards-before-after.json',
      JSON.stringify({ before: beforeCards.rows, after: afterCards.rows }, null, 2)
    );
    expect(afterText).toContain('ZNACZNIK-DAY186');
    expect(afterText).toContain('EUR 2.2m');
    expect(afterText).toContain('approve phase two by 15 August');
    expect(afterText).not.toContain('Key point');

    const exportResponse = await request(app)
      .get(`/api/presentations/decks/${deckId}/download?mode=draft`)
      .set(auth)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    expect(exportResponse.body).toBeInstanceOf(Buffer);
    expect(exportResponse.body.length).toBeGreaterThan(0);
    fs.writeFileSync(artifactPath, exportResponse.body);

    const renderedText = await pptxText(exportResponse.body);
    expect(renderedText).toContain(marker);
    expect(renderedText).toContain('EUR 2.2m');
    expect(renderedText).toContain('approve phase two by 15 August');
    expect(renderedText).not.toContain('Key point');
    expect(renderedText).not.toMatch(/(^|\n)(Signal|Implication|Action):?(\n|$)/);
  }, 60_000);
});
