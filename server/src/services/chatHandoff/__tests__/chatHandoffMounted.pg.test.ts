/** CHAT-BVP-001 — full mounted JWT/tenant/idempotency/cold proof on real PostgreSQL. */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client, Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import { materializeProposal } from '../../artifactHandoff/handoffSpineService.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_DB)('CHAT-BVP-001 — mounted Chat handoff golden path (real PostgreSQL)', () => {
  const suffix = randomUUID().slice(0, 8);
  const makeId = (part: string) => `codex_chat_bvp_${part}_${suffix}`;
  const orgA = makeId('org_a');
  const orgB = makeId('org_b');
  const ownerA = makeId('owner_a');
  const ownerB = makeId('owner_b');
  const staleA = makeId('stale_a');
  const conversationA = makeId('conversation_a');
  const messageA = makeId('message_a');
  const rejectMessage = makeId('message_reject');
  const idempotencyKey = makeId('idempotency');

  let pool: Pool;
  let app: Express;
  let ownerAToken = '';
  let ownerBToken = '';
  let staleToken = '';
  let proposalId = '';
  let sourceContentHash = '';
  let receiptId = '';

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: DATABASE_URL });
    for (const [organizationId, name] of [[orgA, 'CHAT BVP A'], [orgB, 'CHAT BVP B']]) {
      await pool.query(`INSERT INTO organizations (id, name, plan, status) VALUES ($1,$2,'enterprise','active')`, [organizationId, name]);
    }
    for (const [userId, organizationId, membershipStatus] of [
      [ownerA, orgA, 'ACTIVE'],
      [ownerB, orgB, 'ACTIVE'],
      [staleA, orgA, 'INACTIVE'],
    ]) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, password, role, status)
         VALUES ($1,$2,$3,'unused','OWNER','active')`,
        [userId, organizationId, `${userId}@example.test`]
      );
      await pool.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1,$2,$3,'OWNER',$4)`,
        [makeId(`membership_${userId}`), organizationId, userId, membershipStatus]
      );
    }
    await pool.query(
      `INSERT INTO conversations (id, user_id, organization_id, title) VALUES ($1,$2,$3,$4)`,
      [conversationA, ownerA, orgA, 'CHAT BVP mounted conversation']
    );
    for (const [messageId, content] of [
      [messageA, 'Use attached evidence [A1], named source [Source: Q3 Plan], and https://example.test/report.'],
      [rejectMessage, 'Reject this draft with https://example.test/reject.'],
    ]) {
      await pool.query(
        `INSERT INTO conversation_messages (id, conversation_id, role, content, metadata)
         VALUES ($1,$2,'ai',$3,'{}'::jsonb)`,
        [messageId, conversationA, content]
      );
    }

    const { default: config } = await import('../../../config/Config.js');
    const sign = (userId: string, organizationId: string) =>
      jwt.sign({ id: userId, organizationId, role: 'OWNER', email: `${userId}@example.test` }, config.JWT_SECRET, { expiresIn: '10m' });
    ownerAToken = sign(ownerA, orgA);
    ownerBToken = sign(ownerB, orgB);
    staleToken = sign(staleA, orgA);

    process.env.ENABLE_V8_GLOBAL = 'true';
    const { default: v8Router } = await import('../../../routes/v8/index.js');
    app = express();
    app.use(express.json());
    app.use('/api/v8', v8Router);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM artifact_handoff_receipts WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM artifact_handoff_proposals WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM conversation_messages WHERE conversation_id = $1`, [conversationA]);
    await pool.query(`DELETE FROM conversations WHERE id = $1`, [conversationA]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[ownerA, ownerB, staleA]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    const residue = await pool.query<{ n: number }>(
      `SELECT (SELECT count(*) FROM artifact_handoff_proposals WHERE organization_id = ANY($1))::int +
              (SELECT count(*) FROM users WHERE id = ANY($2))::int AS n`,
      [[orgA, orgB], [ownerA, ownerB, staleA]]
    );
    expect(residue.rows[0]?.n).toBe(0);
    await pool.end();
  }, 60_000);

  it('concurrent mounted creates with one key converge on one citation-bearing proposal', async () => {
    const create = () =>
      request(app)
        .post(`/api/v8/chat/conversations/${conversationA}/handoff-proposals`)
        .set(bearer(ownerAToken))
        .send({ messageId: messageA, targetKind: 'document', idempotencyKey });
    const [first, second] = await Promise.all([create(), create()]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(first.body.data.proposal.proposalId).toBe(second.body.data.proposal.proposalId);
    proposalId = first.body.data.proposal.proposalId;
    sourceContentHash = first.body.data.proposal.sourceContentHash;
    expect(first.body.data.citations.length).toBeGreaterThanOrEqual(3);

    const count = await pool.query(`SELECT count(*)::int AS n FROM artifact_handoff_proposals WHERE organization_id = $1 AND idempotency_key = $2`, [orgA, idempotencyKey]);
    expect(count.rows[0]?.n).toBe(1);
  });

  it('mounted tenant and stale-membership negatives deny reads and decisions', async () => {
    const foreignRead = await request(app)
      .get(`/api/v8/chat/handoff-proposals/${proposalId}`)
      .set(bearer(ownerBToken));
    expect(foreignRead.status).toBe(404);

    const foreignApprove = await request(app)
      .post(`/api/v8/chat/handoff-proposals/${proposalId}/approve`)
      .set(bearer(ownerBToken))
      .send({});
    expect(foreignApprove.status).toBe(404);

    const stale = await request(app)
      .get(`/api/v8/chat/handoff-proposals/${proposalId}`)
      .set(bearer(staleToken));
    expect(stale.status).toBe(403);
    expect(stale.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
  });

  it('concurrent mounted human approvals converge, then consumer retry yields one receipt', async () => {
    const approve = () =>
      request(app)
        .post(`/api/v8/chat/handoff-proposals/${proposalId}/approve`)
        .set(bearer(ownerAToken))
        .send({ reason: 'human approved' });
    const [a, b] = await Promise.all([approve(), approve()]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.data).toMatchObject({ state: 'approved', decidedBy: ownerA });
    expect(b.body.data.decidedBy).toBe(ownerA);

    const targetRecordId = makeId('document_receipt');
    const [m1, m2] = await Promise.all([
      materializeProposal({ organizationId: orgA, proposalId, targetRecordId, materializedBy: ownerA }),
      materializeProposal({ organizationId: orgA, proposalId, targetRecordId, materializedBy: ownerA }),
    ]);
    expect(m1.receipt.receiptId).toBe(m2.receipt.receiptId);
    receiptId = m1.receipt.receiptId;
  });

  it('mounted reject and missing-source fail closed without foreign writes', async () => {
    const created = await request(app)
      .post(`/api/v8/chat/conversations/${conversationA}/handoff-proposals`)
      .set(bearer(ownerAToken))
      .send({ messageId: rejectMessage, targetKind: 'document', idempotencyKey: makeId('reject_key') });
    expect(created.status).toBe(201);
    const rejected = await request(app)
      .post(`/api/v8/chat/handoff-proposals/${created.body.data.proposal.proposalId}/reject`)
      .set(bearer(ownerAToken))
      .send({ reason: 'human rejected' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.state).toBe('rejected');

    const missing = await request(app)
      .post(`/api/v8/chat/conversations/${conversationA}/handoff-proposals`)
      .set(bearer(ownerAToken))
      .send({ messageId: makeId('missing'), targetKind: 'document' });
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ code: 'SOURCE_NOT_FOUND' });
  });

  it('fresh connection reopens exact proposal hash, citations and exactly one receipt', async () => {
    const cold = new Client({ connectionString: DATABASE_URL });
    await cold.connect();
    const proposal = await cold.query(
      `SELECT source_content_hash, payload_json, state FROM artifact_handoff_proposals
       WHERE proposal_id = $1 AND organization_id = $2`,
      [proposalId, orgA]
    );
    const receipts = await cold.query(
      `SELECT receipt_id, target_record_id FROM artifact_handoff_receipts
       WHERE proposal_id = $1 AND organization_id = $2`,
      [proposalId, orgA]
    );
    await cold.end();

    expect(proposal.rows).toHaveLength(1);
    expect(proposal.rows[0]).toMatchObject({ source_content_hash: sourceContentHash, state: 'materialized' });
    expect(JSON.parse(proposal.rows[0].payload_json).citations.length).toBeGreaterThanOrEqual(3);
    expect(receipts.rows).toHaveLength(1);
    expect(receipts.rows[0].receipt_id).toBe(receiptId);
  });
});
