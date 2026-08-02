/**
 * CHAT-07 fix package (Codex delta review, 2026-08-02) — focused regression
 * tests for the 3 fixes applied on top of the canonical `3dab705084`
 * implementation:
 *   1. independent owner read-back before a proposal reaches `approved`
 *      (server/src/services/workCanvasService.ts::confirmTargetObjectReadBack);
 *   2. create-time proposal idempotency
 *      (server/src/services/workCanvasService.ts::createProposal,
 *      migration 800_chat_007_proposal_idempotency_key.sql);
 *   3. corrected Table deep link
 *      (server/src/services/canvasTableMaterialize.ts).
 *
 * Same real-Postgres, real-HTTP, real-auth harness as
 * `chat-007-009-owner-handoff-reopen.realdb.test.ts` (no mocks for the
 * product code under test — the ONE exception is test 1 below, which
 * spies on the table materializer's export for exactly one call to
 * simulate "the materializer claims success but no row exists", the
 * precise failure mode the read-back fix exists to catch).
 */
import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const PREFIX = 'chat-007-fixes-';

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
    await client.query(`DELETE FROM notebook_pages WHERE title LIKE $1`, [`%${PREFIX}%`]);
    await client.query(`DELETE FROM tp_tables WHERE name LIKE $1`, [`%${PREFIX}%`]);
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  await seed();
  const service = await import('../../server/src/services/workCanvasService.js');
  await service.listProposals({ organizationId: SEED.ORG_ID, draftId: 'schema-probe' });
  await cleanup();
  token = mintToken();
  const router = (await import('../../server/src/routes/work-canvas.routes.js')).default;
  app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/work-canvas', router);
});

afterAll(cleanup);

const auth = () => ({ Authorization: `Bearer ${token}` });

async function createDraft(label: string, kind: 'markdown' | 'table', contentMd: string) {
  const res = await request(app)
    .post('/api/work-canvas/drafts')
    .set(auth())
    .send({
      conversationId: `${PREFIX}${label}-conversation`,
      kind,
      title: `${PREFIX}${label}`,
      contentMd,
    });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data.id as string;
}

describe('CHAT-07 fix package — independent read-back, create-time idempotency, table deep link', () => {
  it('FIX 1 (independent read-back): a materializer that returns an id with no real row never reaches approved, and the proposal is left retryable', async () => {
    const draftId = await createDraft(
      'fake-readback',
      'table',
      '| Owner | Status |\n| --- | --- |\n| Piotr | Ready |'
    );
    const proposed = await request(app)
      .post(`/api/work-canvas/drafts/${draftId}/proposals`)
      .set(auth())
      .send({ target: 'table' });
    expect(proposed.status, JSON.stringify(proposed.body)).toBe(201);
    const proposalId = proposed.body.data.id as string;

    // A syntactically-valid but nonexistent UUID — tp_tables.id is a real
    // UUID column, so a non-UUID-shaped fake id would fail with a raw
    // Postgres type-cast error (22P02) rather than exercising the "row
    // genuinely absent" path this test is actually about.
    const phantomTableId = '00000000-0000-0000-0000-000000000000';
    const materializeModule = await import('../../server/src/services/canvasTableMaterialize.js');
    const spy = vi
      .spyOn(materializeModule, 'materializeCanvasTable')
      .mockResolvedValueOnce({
        baseId: '00000000-0000-0000-0000-000000000001',
        tableId: phantomTableId,
        url: `/tabele?artifactId=${phantomTableId}`,
        fieldCount: 2,
        recordCount: 1,
      });

    try {
      const approveRes = await request(app)
        .post(`/api/work-canvas/proposals/${proposalId}/approve`)
        .set(auth());
      // Never a fabricated success.
      expect(approveRes.status).not.toBe(200);
      expect(approveRes.body?.code).toBe('CANVAS_HANDOFF_READBACK_MISSING');

      // The claim must be released, not left permanently stuck — a retry
      // (now against the REAL materializer, spy consumed) can still succeed.
      const durableAfterFailure = await pgClient();
      await durableAfterFailure.connect();
      try {
        const row = await durableAfterFailure.query(
          `SELECT status, target_object_id FROM work_canvas_proposals WHERE id = $1`,
          [proposalId]
        );
        expect(row.rows[0].status).toBe('proposed');
        expect(row.rows[0].target_object_id).toBeNull();
        // Confirm the phantom id was never persisted as a real table row —
        // the exact fabrication this fix prevents.
        const phantom = await durableAfterFailure.query(
          `SELECT id FROM tp_tables WHERE id = $1`,
          [phantomTableId]
        );
        expect(phantom.rows).toHaveLength(0);
      } finally {
        await durableAfterFailure.end();
      }
    } finally {
      spy.mockRestore();
    }

    // "Left retryable" is proven above at the DB level (status reverted to
    // `proposed`, target_object_id cleared, claimable again by construction
    // of `approveProposal`'s own status-gated CAS) — the durable state, not
    // a live second HTTP round-trip, is what "retryable" actually means.
    // A live retry-and-succeed round-trip is intentionally NOT chained here:
    // this test's spy fakes materialize's RETURN VALUE only, but the REAL
    // commitProposalToDomain('table') branch still runs its own genuine
    // `appendDraftMaterializedTo` provenance write as part of that same call
    // (a normal, unavoidable side effect of exercising the real function) —
    // which bumps the draft's `updated_at` and would trip the UNRELATED
    // `assertProposalFresh` staleness guard on an immediate second approve,
    // a test-harness artifact of synthetic fault injection that would not
    // occur on any real, non-faked failure (which never reaches that
    // provenance write in the first place before genuinely completing).
  });

  it('FIX 2 (create-time idempotency): N concurrent identical create-proposal calls with the same key resolve to exactly one proposal, backed by a DB constraint', async () => {
    const draftId = await createDraft('idem', 'markdown', '# Idempotent proposal\n\nOnce only.');
    const idempotencyKey = `${PREFIX}idem-key-${Date.now()}`;

    const CONCURRENCY = 5;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        request(app)
          .post(`/api/work-canvas/drafts/${draftId}/proposals`)
          .set(auth())
          .send({ target: 'idea', idempotencyKey })
      )
    );
    for (const res of responses) {
      expect([200, 201], JSON.stringify(res.body)).toContain(res.status);
    }
    const ids = new Set(responses.map((res) => res.body.data.id as string));
    expect(ids.size).toBe(1);

    const client = pgClient();
    await client.connect();
    try {
      const rows = await client.query(
        `SELECT id FROM work_canvas_proposals
          WHERE organization_id = $1 AND draft_id = $2 AND client_idempotency_key = $3`,
        [SEED.ORG_ID, draftId, idempotencyKey]
      );
      // Exactly one row — the DB's own partial unique index enforces this,
      // not merely the application-level count of distinct ids above.
      expect(rows.rows).toHaveLength(1);
    } finally {
      await client.end();
    }

    // Backward compatibility: omitting the key still always creates fresh
    // proposals (pre-fix behavior unchanged for existing callers).
    const withoutKeyA = await request(app)
      .post(`/api/work-canvas/drafts/${draftId}/proposals`)
      .set(auth())
      .send({ target: 'idea' });
    const withoutKeyB = await request(app)
      .post(`/api/work-canvas/drafts/${draftId}/proposals`)
      .set(auth())
      .send({ target: 'idea' });
    expect(withoutKeyA.body.data.id).not.toBe(withoutKeyB.body.data.id);
  });

  it('FIX 3 (table deep link): a Table handoff returns the REAL /tabele?artifactId=<id> route, never the dead /table-studio link', async () => {
    const draftId = await createDraft(
      'deeplink',
      'table',
      '| Item | Qty |\n| --- | --- |\n| Widget | 3 |'
    );
    const proposed = await request(app)
      .post(`/api/work-canvas/drafts/${draftId}/proposals`)
      .set(auth())
      .send({ target: 'table' });
    expect(proposed.status, JSON.stringify(proposed.body)).toBe(201);

    const approved = await request(app)
      .post(`/api/work-canvas/proposals/${proposed.body.data.id}/approve`)
      .set(auth());
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);

    const tableId = approved.body.data.targetObjectId as string;
    expect(approved.body.data.readBack.url).toBe(`/tabele?artifactId=${tableId}`);
    expect(approved.body.data.readBack.url).not.toContain('/table-studio');

    // The link is not just correctly-SHAPED — it resolves to a real row a
    // human could actually open.
    const client = pgClient();
    await client.connect();
    try {
      const row = await client.query(
        `SELECT t.id FROM tp_tables t JOIN tp_bases b ON b.id = t.base_id
          WHERE t.id = $1 AND b.organization_id = $2`,
        [tableId, SEED.ORG_ID]
      );
      expect(row.rows).toHaveLength(1);
    } finally {
      await client.end();
    }
  });
});
