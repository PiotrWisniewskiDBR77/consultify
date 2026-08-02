import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PREFIX = 'chat-007-009-';
const MATERIAL_USER_ID = '10000000-0000-4000-8000-000000000009';
const MATERIAL_CONVERSATION_ID = '20000000-0000-4000-8000-000000000009';
const MATERIAL_ORG_ID = '30000000-0000-4000-8000-000000000009';

let app: Express;
let token: string;

async function cleanup(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    const drafts = await client.query(`SELECT id FROM work_canvas_drafts WHERE title LIKE $1`, [
      `${PREFIX}%`,
    ]);
    const draftIds = drafts.rows.map((row) => row.id);
    if (draftIds.length) {
      await client.query(`DELETE FROM work_canvas_proposals WHERE draft_id = ANY($1::text[])`, [
        draftIds,
      ]);
      await client.query(`DELETE FROM work_canvas_drafts WHERE id = ANY($1::text[])`, [draftIds]);
    }
    await client.query(`DELETE FROM initiatives WHERE title LIKE $1`, [`${PREFIX}%`]);
    await client.query(`DELETE FROM initiatives WHERE title LIKE $1`, [`%${PREFIX}%`]);
    await client.query(`DELETE FROM notebook_pages WHERE title LIKE $1`, [`%${PREFIX}%`]);
    await client.query(`DELETE FROM tp_tables WHERE name LIKE $1`, [`%${PREFIX}%`]);
    await client.query('DELETE FROM conversations WHERE id = $1', [MATERIAL_CONVERSATION_ID]);
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  await seed();
  const service = await import('../../server/src/services/workCanvasService.js');
  await service.listProposals({ organizationId: SEED.ORG_ID, draftId: 'schema-probe' });
  await cleanup();
  const client = pgClient();
  await client.connect();
  try {
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, $3) ON CONFLICT (id) DO NOTHING`,
      [MATERIAL_ORG_ID, `${PREFIX}material-org`, now]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'not-used', 'ADMIN', 'active', 'Material', 'Fixture', $4)
       ON CONFLICT (id) DO NOTHING`,
      [MATERIAL_USER_ID, MATERIAL_ORG_ID, `${PREFIX}material@example.test`, now]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', $4) ON CONFLICT DO NOTHING`,
      [`${PREFIX}material-membership`, MATERIAL_ORG_ID, MATERIAL_USER_ID, now]
    );
    await client.query(
      `INSERT INTO conversations (id, user_id, organization_id, title, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5) ON CONFLICT (id) DO NOTHING`,
      [MATERIAL_CONVERSATION_ID, MATERIAL_USER_ID, MATERIAL_ORG_ID, `${PREFIX}material`, now]
    );
  } finally {
    await client.end();
  }
  token = mintToken();
  const router = (await import('../../server/src/routes/work-canvas.routes.js')).default;
  app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/work-canvas', router);
});

afterAll(cleanup);

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('CHAT-07/08/09 — owner handoff, durable receipt and reopen', () => {
  it('creates one canonical initiative, persists its receipt, and reopens it after retry', async () => {
    const title = `${PREFIX}initiative`;
    const draftResponse = await request(app)
      .post('/api/work-canvas/drafts')
      .set(auth())
      .send({
        conversationId: `${PREFIX}conversation`,
        kind: 'markdown',
        title,
        contentMd: '# Initiative\n\nLaunch the governed MVP.',
      });
    expect(draftResponse.status, JSON.stringify(draftResponse.body)).toBe(201);
    const draftId = draftResponse.body.data.id as string;

    const proposed = await request(app)
      .post(`/api/work-canvas/drafts/${draftId}/proposals`)
      .set(auth())
      .send({ target: 'initiative' });
    expect(proposed.status, JSON.stringify(proposed.body)).toBe(201);
    const proposalId = proposed.body.data.id as string;

    const approvals = await Promise.all([
      request(app).post(`/api/work-canvas/proposals/${proposalId}/approve`).set(auth()),
      request(app).post(`/api/work-canvas/proposals/${proposalId}/approve`).set(auth()),
    ]);
    expect(approvals.some((response) => response.status === 200)).toBe(true);
    expect(approvals.every((response) => response.status === 200 || response.status === 409)).toBe(
      true
    );

    const retry = await request(app)
      .post(`/api/work-canvas/proposals/${proposalId}/approve`)
      .set(auth());
    expect(retry.status, JSON.stringify(retry.body)).toBe(200);
    expect(retry.body.data.status).toBe('approved');
    expect(retry.body.data.targetObjectId).toEqual(expect.any(String));
    expect(retry.body.data.readBack.url).toContain('initiativeId=');

    const reopened = await request(app)
      .get(`/api/work-canvas/drafts/${draftId}`)
      .set(auth());
    expect(reopened.status).toBe(200);
    const receipt = reopened.body.data.proposals.find(
      (proposal: { id: string }) => proposal.id === proposalId
    );
    expect(receipt).toEqual(
      expect.objectContaining({
        status: 'approved',
        targetObjectId: retry.body.data.targetObjectId,
      })
    );
    expect(receipt.readBack.url).toBe(retry.body.data.readBack.url);

    const client = pgClient();
    await client.connect();
    try {
      const owners = await client.query(
        `SELECT id, organization_id FROM initiatives WHERE market_context = $1`,
        [`Created from Work Canvas draft ${draftId}`]
      );
      expect(owners.rows).toHaveLength(1);
      expect(owners.rows[0]).toEqual({
        id: retry.body.data.targetObjectId,
        organization_id: SEED.ORG_ID,
      });
      const durable = await client.query(
        `SELECT status, target_object_id, read_back_json
         FROM work_canvas_proposals WHERE id = $1`,
        [proposalId]
      );
      expect(durable.rows[0].status).toBe('approved');
      expect(durable.rows[0].target_object_id).toBe(owners.rows[0].id);
      expect(JSON.parse(durable.rows[0].read_back_json).url).toBe(receipt.readBack.url);
    } finally {
      await client.end();
    }
  });

  it('hands a Canvas to canonical Note and Table owners with reopenable receipts', async () => {
    const cases = [
      {
        target: 'note',
        kind: 'markdown',
        contentMd: '# Note\n\nDurable knowledge from chat.',
      },
      {
        target: 'table',
        kind: 'table',
        contentMd: '| Owner | Status |\n| --- | --- |\n| Piotr | Ready |',
      },
    ] as const;

    for (const current of cases) {
      const draftResponse = await request(app)
        .post('/api/work-canvas/drafts')
        .set(auth())
        .send({
          conversationId: `${PREFIX}${current.target}-conversation`,
          kind: current.kind,
          title: `${PREFIX}${current.target}`,
          contentMd: current.contentMd,
        });
      expect(draftResponse.status, JSON.stringify(draftResponse.body)).toBe(201);
      const draftId = draftResponse.body.data.id as string;

      const proposed = await request(app)
        .post(`/api/work-canvas/drafts/${draftId}/proposals`)
        .set(auth())
        .send({ target: current.target });
      expect(proposed.status, JSON.stringify(proposed.body)).toBe(201);

      const approved = await request(app)
        .post(`/api/work-canvas/proposals/${proposed.body.data.id}/approve`)
        .set(auth());
      expect(approved.status, JSON.stringify(approved.body)).toBe(200);
      expect(approved.body.data).toEqual(
        expect.objectContaining({ status: 'approved', targetObjectId: expect.any(String) })
      );
      expect(approved.body.data.readBack.url).toEqual(expect.any(String));

      const reopened = await request(app)
        .get(`/api/work-canvas/drafts/${draftId}`)
        .set(auth());
      const receipt = reopened.body.data.proposals.find(
        (proposal: { id: string }) => proposal.id === proposed.body.data.id
      );
      expect(receipt.targetObjectId).toBe(approved.body.data.targetObjectId);
      expect(receipt.readBack.url).toBe(approved.body.data.readBack.url);

      const client = pgClient();
      await client.connect();
      try {
        const owner = await client.query(
          current.target === 'note'
            ? `SELECT id FROM notebook_pages WHERE id = $1 AND organization_id = $2`
            : `SELECT t.id FROM tp_tables t JOIN tp_bases b ON b.id = t.base_id
               WHERE t.id = $1 AND b.organization_id = $2`,
          [receipt.targetObjectId, SEED.ORG_ID]
        );
        expect(owner.rows).toHaveLength(1);
      } finally {
        await client.end();
      }
    }
  });

  it('materializes a client deliverable and restores its owner URL from a fresh GET', async () => {
    const materialToken = mintToken({
      id: MATERIAL_USER_ID,
      email: `${PREFIX}material@example.test`,
      role: 'OWNER',
      organizationId: MATERIAL_ORG_ID,
      organization_id: MATERIAL_ORG_ID,
    });
    const materialAuth = { Authorization: `Bearer ${materialToken}` };
    const created = await request(app)
      .post('/api/work-canvas/drafts')
      .set(materialAuth)
      .send({
        conversationId: MATERIAL_CONVERSATION_ID,
        kind: 'markdown',
        title: `${PREFIX}material`,
        contentMd: '# Client material\n\nA durable governed deliverable.',
      });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const draftId = created.body.data.id as string;
    const proposed = await request(app)
      .post(`/api/work-canvas/drafts/${draftId}/proposals`)
      .set(materialAuth)
      .send({ target: 'client_deliverable', idempotencyKey: `${PREFIX}material-key` });
    expect(proposed.status, JSON.stringify(proposed.body)).toBe(201);
    const approved = await request(app)
      .post(`/api/work-canvas/proposals/${proposed.body.data.id}/approve`)
      .set(materialAuth);
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    expect(approved.body.data.targetObjectId).toEqual(expect.any(String));
    expect(approved.body.data.readBack.url).toContain('artifactId=');

    const reopened = await request(app)
      .get(`/api/work-canvas/drafts/${draftId}`)
      .set(materialAuth);
    expect(reopened.status).toBe(200);
    const receipt = reopened.body.data.proposals.find(
      (proposal: { id: string }) => proposal.id === proposed.body.data.id
    );
    expect(receipt.targetObjectId).toBe(approved.body.data.targetObjectId);
    expect(receipt.readBack.url).toBe(approved.body.data.readBack.url);
  });
});
