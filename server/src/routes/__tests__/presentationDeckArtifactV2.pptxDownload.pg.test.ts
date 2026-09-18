/** @vitest-environment node */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import JSZip from 'jszip';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';
import { publishDeckVersion } from '../../services/presentationDeckArtifactLifecycleService.js';

const notificationSend = vi.hoisted(() => vi.fn().mockResolvedValue('rd2-notification'));

vi.mock('../../services/notificationService.js', () => ({
  send: notificationSend,
  default: { send: notificationSend },
}));

const marker = `RD2-V2-${randomUUID()}`;
const orgId = randomUUID();
const authorId = randomUUID();
const reviewerId = randomUUID();
const memberId = randomUUID();
const deckId = randomUUID();
const artifactId = randomUUID();

async function readSlideText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort();
  const xml = await Promise.all(slideNames.map((name) => zip.file(name)!.async('string')));
  return xml
    .flatMap((slide) => [...slide.matchAll(/<a:t>(.*?)<\/a:t>/g)].map((match) => match[1]))
    .join('\n');
}

describe('RD-2 v2 published deck artifact PPTX download through ApiGateway', { retry: 0 }, () => {
  let app: express.Express;
  let pool: Pool;
  let token: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_DB).toBe('false');
    const proof = await assertRealPostgresTestEnvironment();
    expect(proof.database.length).toBeGreaterThan(0);
    expect(Number(proof.port)).toBeGreaterThan(0);

    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, CURRENT_TIMESTAMP)`,
      [orgId, `RD-2 v2 ${marker}`]
    );
    for (const [userId, role] of [
      [authorId, 'OWNER'],
      [reviewerId, 'OWNER'],
    ] as const) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, created_at)
         VALUES ($1, $2, $3, 'unused', $4, 'active', CURRENT_TIMESTAMP)`,
        [userId, orgId, `${userId}@example.test`, role]
      );
    }
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
      [memberId, orgId, reviewerId]
    );

    const deckJson = {
      cards: [
        {
          id: `${deckId}-slide-1`,
          card_id: `${deckId}-slide-1`,
          title: `Published artifact ${marker}`,
          blocks: [
            {
              id: `${deckId}-block-1`,
              type: 'text',
              content: `Immutable RD-2 export marker ${marker}`,
            },
          ],
        },
        {
          id: `${deckId}-slide-2`,
          card_id: `${deckId}-slide-2`,
          title: 'Receipt slide',
          blocks: [
            {
              id: `${deckId}-block-2`,
              type: 'text',
              content: 'Published from 1.0 and downloaded through ApiGateway',
            },
          ],
        },
      ],
    };
    await pool.query(
      `INSERT INTO presentation_decks
         (id, organization_id, title, deck_json, slide_count, version, status, created_by,
          created_at, updated_at)
       VALUES ($1, $2, $3, $4, 2, 1, 'draft', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [deckId, orgId, `RD-2 v2 ${marker}`, JSON.stringify(deckJson), authorId]
    );
    await pool.query(
      `INSERT INTO presentation_cards
         (id, deck_id, card_index, intent, blocks_json, created_at, updated_at)
       VALUES
         ($1, $2, 0, 'published_artifact', $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
         ($4, $2, 1, 'receipt', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        `${deckId}-card-1`,
        deckId,
        JSON.stringify(deckJson.cards[0].blocks),
        `${deckId}-card-2`,
        JSON.stringify(deckJson.cards[1].blocks),
      ]
    );
    await pool.query(
      `INSERT INTO v8_output_artifacts
         (artifact_id, organization_id, output_type, delivery_state, artifact_family,
          title_snapshot, canonical_home, visibility_scope, created_by, created_at,
          last_transition_at, is_draft, origin_summary_json)
       VALUES ($1, $2, 'presentation', 'editing', 'presentation', $3,
               'outputs_library', 'organization', $4, CURRENT_TIMESTAMP::text,
               CURRENT_TIMESTAMP::text, 1, '{}')`,
      [artifactId, orgId, `RD-2 v2 ${marker}`, authorId]
    );
    await pool.query(
      `INSERT INTO v8_artifact_origin_links
         (link_id, artifact_id, organization_id, origin_runtime, origin_record_id,
          is_primary_origin, created_at)
       VALUES ($1, $2, $3, 'presentation', $4, 1, CURRENT_TIMESTAMP::text)`,
      [randomUUID(), artifactId, orgId, deckId]
    );
    await pool.query(
      `INSERT INTO approval_assignments
         (id, org_id, proposal_id, assigned_to_user_id, status, sla_due_at, completed_at,
          created_at, assignment_kind, artifact_type, artifact_id, requested_by_user_id)
       VALUES ($1, $2, $3, $4, 'DONE', CURRENT_TIMESTAMP + INTERVAL '1 day',
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'artifact', 'presentation_version', $5, $6)`,
      [randomUUID(), orgId, randomUUID(), reviewerId, `${deckId}@1`, authorId]
    );
    await publishDeckVersion({ deckId, organizationId: orgId, actorUserId: reviewerId });

    token = jwt.sign(
      {
        id: reviewerId,
        userId: reviewerId,
        organizationId: orgId,
        organization_id: orgId,
        role: 'OWNER',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM presentation_export_records WHERE deck_id = $1', [deckId]);
    await pool.query('DELETE FROM presentation_deck_versions WHERE deck_id = $1', [deckId]);
    await pool.query('DELETE FROM approval_assignments WHERE org_id = $1', [orgId]);
    await pool.query('DELETE FROM v8_artifact_origin_links WHERE organization_id = $1', [orgId]);
    await pool.query('DELETE FROM v8_output_artifacts WHERE organization_id = $1', [orgId]);
    await pool.query('DELETE FROM presentation_cards WHERE deck_id = $1', [deckId]);
    await pool.query('DELETE FROM presentation_decks WHERE id = $1', [deckId]);
    await pool.query('DELETE FROM organization_members WHERE organization_id = $1', [orgId]);
    await pool.query('DELETE FROM users WHERE organization_id = $1', [orgId]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    await pool.end();
  });

  it('downloads a real PPTX for the published deck and writes the proof artifact', async () => {
    const response = await request(app)
      .get(`/api/presentations/decks/${deckId}/download?mode=draft`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    expect(response.body).toBeInstanceOf(Buffer);
    expect(response.body.length).toBeGreaterThan(10_000);

    const body = response.body as Buffer;
    const zip = await JSZip.loadAsync(body);
    expect(zip.file('[Content_Types].xml')).toBeTruthy();
    expect(zip.file('ppt/slides/slide1.xml')).toBeTruthy();
    expect(zip.file('ppt/slides/slide2.xml')).toBeTruthy();
    const text = await readSlideText(body);
    expect(text).toContain(marker);
    expect(text).toContain('Receipt slide');

    const deckState = await pool.query(
      `SELECT status, version, exported_version, exported_at
         FROM presentation_decks
        WHERE id = $1`,
      [deckId]
    );
    expect(deckState.rows[0]).toMatchObject({
      status: 'ready',
      version: 1,
    });
    expect(deckState.rows[0].exported_at).toBeTruthy();

    const versionState = await pool.query(
      `SELECT version, created_by, slide_count, deck_json_snapshot
         FROM presentation_deck_versions
        WHERE deck_id = $1 AND version = 1`,
      [deckId]
    );
    expect(versionState.rows[0]).toMatchObject({
      version: 1,
      created_by: reviewerId,
      slide_count: 2,
    });
    expect(String(versionState.rows[0].deck_json_snapshot)).toContain(marker);

    const artifactState = await pool.query(
      `SELECT delivery_state, is_draft
         FROM v8_output_artifacts
        WHERE artifact_id = $1`,
      [artifactId]
    );
    expect(artifactState.rows[0]).toMatchObject({ delivery_state: 'ready', is_draft: 0 });

    const outDir = process.env.RD2_EVIDENCE_DIR;
    if (outDir) {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'rd2-v2-published-download.pptx'), body);
      fs.writeFileSync(
        path.join(outDir, 'rd2-v2-published-download.json'),
        JSON.stringify(
          {
            deckId,
            marker,
            status: response.status,
            bytes: body.length,
            contentType: response.headers['content-type'],
            slideFiles: Object.keys(zip.files)
              .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
              .sort(),
            deckState: deckState.rows[0],
            versionState: versionState.rows[0],
            artifactState: artifactState.rows[0],
          },
          null,
          2
        )
      );
    }
  }, 60_000);
});
