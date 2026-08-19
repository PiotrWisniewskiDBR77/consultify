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

describe.skipIf(!REAL_DB)(
  'CHAT-BVP-001 — mounted Chat handoff golden path (real PostgreSQL)',
  () => {
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
    const driftMessage = makeId('message_drift');
    const idempotencyKey = makeId('idempotency');

    let pool: Pool;
    let app: Express;
    let ownerAToken = '';
    let ownerBToken = '';
    let staleToken = '';
    let memberToken = '';
    let proposalId = '';
    let sourceContentHash = '';
    let receiptId = '';
    let ingressId = '';
    let claimToken = '';

    const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

    beforeAll(async () => {
      await assertRealPostgresTestEnvironment();
      pool = new Pool({ connectionString: DATABASE_URL });
      for (const [organizationId, name] of [
        [orgA, 'CHAT BVP A'],
        [orgB, 'CHAT BVP B'],
      ]) {
        await pool.query(
          `INSERT INTO organizations (id, name, plan, status) VALUES ($1,$2,'enterprise','active')`,
          [organizationId, name]
        );
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
        [
          messageA,
          'Use attached evidence [A1], named source [Source: Q3 Plan], and https://example.test/report.',
        ],
        [rejectMessage, 'Reject this draft with https://example.test/reject.'],
        [driftMessage, 'Versioned owner ingress draft with https://example.test/version.'],
      ]) {
        await pool.query(
          `INSERT INTO conversation_messages (id, conversation_id, role, content, metadata)
         VALUES ($1,$2,'ai',$3,'{}'::jsonb)`,
          [messageId, conversationA, content]
        );
      }

      const { default: config } = await import('../../../config/Config.js');
      const sign = (userId: string, organizationId: string, role = 'OWNER') =>
        jwt.sign(
          { id: userId, organizationId, role, email: `${userId}@example.test` },
          config.JWT_SECRET,
          { expiresIn: '10m' }
        );
      ownerAToken = sign(ownerA, orgA);
      ownerBToken = sign(ownerB, orgB);
      staleToken = sign(staleA, orgA);
      memberToken = sign(ownerA, orgA, 'MEMBER');

      process.env.ENABLE_V8_GLOBAL = 'true';
      const { default: v8Router } = await import('../../../routes/v8/index.js');
      app = express();
      app.use(express.json());
      app.use('/api/v8', v8Router);
    }, 60_000);

    afterAll(async () => {
      if (!pool) return;
      await pool.query(`DELETE FROM chat_handoff_owner_claims WHERE organization_id = ANY($1)`, [
        [orgA, orgB],
      ]);
      await pool.query(
        `ALTER TABLE chat_handoff_owner_ingress DISABLE TRIGGER trg_chat_handoff_owner_ingress_immutable`
      );
      await pool.query(`DELETE FROM chat_handoff_owner_ingress WHERE organization_id = ANY($1)`, [
        [orgA, orgB],
      ]);
      await pool.query(
        `ALTER TABLE chat_handoff_owner_ingress ENABLE TRIGGER trg_chat_handoff_owner_ingress_immutable`
      );
      await pool.query(`DELETE FROM artifact_handoff_receipts WHERE organization_id = ANY($1)`, [
        [orgA, orgB],
      ]);
      await pool.query(`DELETE FROM artifact_handoff_proposals WHERE organization_id = ANY($1)`, [
        [orgA, orgB],
      ]);
      await pool.query(`DELETE FROM conversation_messages WHERE conversation_id = $1`, [
        conversationA,
      ]);
      await pool.query(`DELETE FROM conversations WHERE id = $1`, [conversationA]);
      await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
        [orgA, orgB],
      ]);
      await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[ownerA, ownerB, staleA]]);
      await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
      const residue = await pool.query<{ n: number }>(
        `SELECT (SELECT count(*) FROM artifact_handoff_proposals WHERE organization_id = ANY($1))::int +
              (SELECT count(*) FROM users WHERE id = ANY($2))::int AS n`,
        [
          [orgA, orgB],
          [ownerA, ownerB, staleA],
        ]
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

      const count = await pool.query(
        `SELECT count(*)::int AS n FROM artifact_handoff_proposals WHERE organization_id = $1 AND idempotency_key = $2`,
        [orgA, idempotencyKey]
      );
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

    it('concurrent mounted approvals converge and neutral delivery is immutable/idempotent', async () => {
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

      const deliver = () =>
        request(app)
          .post(`/api/v8/chat/handoff-proposals/${proposalId}/owner-ingress`)
          .set(bearer(ownerAToken))
          .send({});
      const [d1, d2] = await Promise.all([deliver(), deliver()]);
      expect([d1.status, d2.status].sort()).toEqual([200, 201]);
      ingressId = d1.body.data.ingress.ingressId;
      expect(d2.body.data.ingress.ingressId).toBe(ingressId);
      expect(d1.body.data.ingress).toMatchObject({
        proposalId,
        sourceContentHash,
        sourceVersion: 1,
        contractVersion: 'v1',
        targetKind: 'document',
      });
      await expect(
        pool.query(`UPDATE chat_handoff_owner_ingress SET source_version=99 WHERE ingress_id=$1`, [
          ingressId,
        ])
      ).rejects.toMatchObject({ message: expect.stringContaining('immutable') });
      await expect(
        pool.query(`DELETE FROM chat_handoff_owner_ingress WHERE ingress_id=$1`, [ingressId])
      ).rejects.toMatchObject({ message: expect.stringContaining('immutable') });
    });

    it('mounted claim is tenant-scoped, exclusive, reclaimable, and stale tokens fail closed', async () => {
      const insufficient = await request(app)
        .post(`/api/v8/chat/handoff-owner-ingress/${ingressId}/claim`)
        .set(bearer(memberToken))
        .send({ leaseSeconds: 60 });
      expect(insufficient.status).toBe(403);
      expect(insufficient.body).toMatchObject({ code: 'CHAT_HANDOFF_OWNER_REQUIRED' });

      const foreign = await request(app)
        .post(`/api/v8/chat/handoff-owner-ingress/${ingressId}/claim`)
        .set(bearer(ownerBToken))
        .send({ leaseSeconds: 60 });
      expect(foreign.status).toBe(404);

      const first = await request(app)
        .post(`/api/v8/chat/handoff-owner-ingress/${ingressId}/claim`)
        .set(bearer(ownerAToken))
        .send({ leaseSeconds: 60 });
      expect(first.status).toBe(200);
      expect(first.body.data).toMatchObject({ ingressId, attemptCount: 1 });
      const staleClaimToken = first.body.data.claimToken;

      const unavailable = await request(app)
        .post(`/api/v8/chat/handoff-owner-ingress/${ingressId}/claim`)
        .set(bearer(ownerAToken))
        .send({ leaseSeconds: 60 });
      expect(unavailable.status).toBe(409);
      expect(unavailable.body).toMatchObject({ code: 'CLAIM_UNAVAILABLE' });

      await pool.query(
        `UPDATE chat_handoff_owner_claims SET lease_expires_at=NOW()-INTERVAL '1 second' WHERE ingress_id=$1`,
        [ingressId]
      );
      const reclaimed = await request(app)
        .post(`/api/v8/chat/handoff-owner-ingress/${ingressId}/claim`)
        .set(bearer(ownerAToken))
        .send({ leaseSeconds: 60 });
      expect(reclaimed.status).toBe(200);
      expect(reclaimed.body.data).toMatchObject({ ingressId, attemptCount: 2 });
      claimToken = reclaimed.body.data.claimToken;
      expect(claimToken).not.toBe(staleClaimToken);

      const staleComplete = await request(app)
        .post(`/api/v8/chat/handoff-owner-ingress/${ingressId}/complete`)
        .set(bearer(ownerAToken))
        .send({ claimToken: staleClaimToken, targetRecordId: makeId('document_receipt') });
      expect(staleComplete.status).toBe(409);
      expect(staleComplete.body).toMatchObject({ code: 'CLAIM_MISMATCH' });
    });

    it('crash-window reclaim cold-reads the existing receipt; 8-way completion converges and conflicting replay fails closed', async () => {
      const targetRecordId = makeId('document_receipt');
      // Simulate a process dying after the shared spine committed its receipt
      // but before chat_handoff_owner_claims was marked consumed.
      const crashWindow = await materializeProposal({
        organizationId: orgA,
        proposalId,
        targetRecordId,
        materializedBy: ownerA,
        outputPayload: { title: 'Approved chat artifact' },
      });
      receiptId = crashWindow.receipt.receiptId;
      const beforeReclaim = await pool.query(
        `SELECT consumed_at, handoff_receipt_id FROM chat_handoff_owner_claims WHERE ingress_id=$1`,
        [ingressId]
      );
      expect(beforeReclaim.rows[0]).toMatchObject({ consumed_at: null, handoff_receipt_id: null });
      await pool.query(
        `UPDATE chat_handoff_owner_claims SET lease_expires_at=NOW()-INTERVAL '1 second' WHERE ingress_id=$1`,
        [ingressId]
      );
      const reclaimed = await request(app)
        .post('/api/v8/chat/handoff-owner-ingress/claim')
        .set(bearer(ownerAToken))
        .send({ targetKind: 'document', leaseSeconds: 60 });
      expect(reclaimed.status).toBe(200);
      expect(reclaimed.body.data).toMatchObject({ ingressId, attemptCount: 3 });
      claimToken = reclaimed.body.data.claimToken;

      const complete = (target = targetRecordId) =>
        request(app)
          .post(`/api/v8/chat/handoff-owner-ingress/${ingressId}/complete`)
          .set(bearer(ownerAToken))
          .send({
            claimToken,
            targetRecordId: target,
            outputPayload: { title: 'Approved chat artifact' },
          });
      const results = await Promise.all(Array.from({ length: 8 }, () => complete()));
      expect(results.every((result) => result.status === 200)).toBe(true);
      const ids = new Set(results.map((result) => result.body.data.receipt.receiptId));
      expect(ids.size).toBe(1);
      expect(results[0].body.data.receipt.receiptId).toBe(receiptId);

      const conflict = await complete(makeId('other_target'));
      expect(conflict.status).toBe(409);
      expect(conflict.body).toMatchObject({ code: 'TARGET_RECORD_CONFLICT' });
    });

    it('mounted reject and missing-source fail closed without foreign writes', async () => {
      const created = await request(app)
        .post(`/api/v8/chat/conversations/${conversationA}/handoff-proposals`)
        .set(bearer(ownerAToken))
        .send({
          messageId: rejectMessage,
          targetKind: 'document',
          idempotencyKey: makeId('reject_key'),
        });
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

    it('unknown proposal contract and foreign dispatch fail closed before ingress', async () => {
      const created = await request(app)
        .post(`/api/v8/chat/conversations/${conversationA}/handoff-proposals`)
        .set(bearer(ownerAToken))
        .send({
          messageId: driftMessage,
          targetKind: 'document',
          idempotencyKey: makeId('drift_key'),
        });
      const driftProposalId = created.body.data.proposal.proposalId;
      await request(app)
        .post(`/api/v8/chat/handoff-proposals/${driftProposalId}/approve`)
        .set(bearer(ownerAToken))
        .send({});
      await pool.query(
        `UPDATE artifact_handoff_proposals SET contract_version='v2' WHERE proposal_id=$1`,
        [driftProposalId]
      );

      const unsupported = await request(app)
        .post(`/api/v8/chat/handoff-proposals/${driftProposalId}/owner-ingress`)
        .set(bearer(ownerAToken))
        .send({});
      expect(unsupported.status).toBe(409);
      expect(unsupported.body).toMatchObject({ code: 'UNSUPPORTED_CONTRACT_VERSION' });

      const foreign = await request(app)
        .post(`/api/v8/chat/handoff-proposals/${driftProposalId}/owner-ingress`)
        .set(bearer(ownerBToken))
        .send({});
      expect(foreign.status).toBe(404);
      const count = await pool.query(
        `SELECT count(*)::int AS n FROM chat_handoff_owner_ingress WHERE proposal_id=$1`,
        [driftProposalId]
      );
      expect(count.rows[0]?.n).toBe(0);

      await pool.query(
        `UPDATE artifact_handoff_proposals SET contract_version='v1' WHERE proposal_id=$1`,
        [driftProposalId]
      );
      const delivered = await request(app)
        .post(`/api/v8/chat/handoff-proposals/${driftProposalId}/owner-ingress`)
        .set(bearer(ownerAToken))
        .send({});
      expect(delivered.status).toBe(201);
      const driftIngressId = delivered.body.data.ingress.ingressId;
      const claimed = await request(app)
        .post('/api/v8/chat/handoff-owner-ingress/claim')
        .set(bearer(ownerAToken))
        .send({ targetKind: 'document', leaseSeconds: 60 });
      expect(claimed.status).toBe(200);
      expect(claimed.body.data.ingressId).toBe(driftIngressId);
      await pool.query(
        `UPDATE artifact_handoff_proposals SET source_version=2 WHERE proposal_id=$1`,
        [driftProposalId]
      );
      const policyDrift = await request(app)
        .post(`/api/v8/chat/handoff-owner-ingress/${driftIngressId}/complete`)
        .set(bearer(ownerAToken))
        .send({ claimToken: claimed.body.data.claimToken, targetRecordId: makeId('drift_target') });
      expect(policyDrift.status).toBe(409);
      expect(policyDrift.body).toMatchObject({ code: 'INGRESS_POLICY_DRIFT' });
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
      const ingress = await cold.query(
        `SELECT i.source_content_hash, i.source_version, i.contract_version, i.payload_json,
              c.attempt_count, c.handoff_receipt_id, c.consumed_at
         FROM chat_handoff_owner_ingress i
         JOIN chat_handoff_owner_claims c ON c.ingress_id=i.ingress_id
        WHERE i.ingress_id=$1 AND i.organization_id=$2`,
        [ingressId, orgA]
      );
      await cold.end();

      expect(proposal.rows).toHaveLength(1);
      expect(proposal.rows[0]).toMatchObject({
        source_content_hash: sourceContentHash,
        state: 'materialized',
      });
      expect(JSON.parse(proposal.rows[0].payload_json).citations.length).toBeGreaterThanOrEqual(3);
      expect(receipts.rows).toHaveLength(1);
      expect(receipts.rows[0].receipt_id).toBe(receiptId);
      expect(ingress.rows).toHaveLength(1);
      expect(ingress.rows[0]).toMatchObject({
        source_content_hash: sourceContentHash,
        source_version: 1,
        contract_version: 'v1',
        attempt_count: 3,
        handoff_receipt_id: receiptId,
      });
      expect(ingress.rows[0].consumed_at).toBeTruthy();
    });
  }
);
