import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client, Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import {
  canonicalJsonForHash,
  computeContentHash,
  type GovernedSnapshotPayload,
} from '../OrganizationContextService.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_DB)('ORG-BVP-001 — pinned Chat/Idea consumers (mounted realPG)', () => {
  const suffix = randomUUID().slice(0, 8);
  const id = (part: string) => `org_pin_${part}_${suffix}`;
  const orgA = id('org_a');
  const orgB = id('org_b');
  const ownerA = id('owner_a');
  const ownerB = id('owner_b');
  const staleA = id('stale_a');
  const conversationId = id('conversation');
  const messageId = id('message');
  const ideaId = id('idea');
  const snapshot1Id = randomUUID();
  const snapshot2Id = randomUUID();
  const foreignSnapshotId = randomUUID();
  const payload1: GovernedSnapshotPayload = { organizationId: orgA, schemaVersion: 1, claims: [] };
  const payload2: GovernedSnapshotPayload = { organizationId: orgA, schemaVersion: 1, claims: [] };
  const foreignPayload: GovernedSnapshotPayload = { organizationId: orgB, schemaVersion: 1, claims: [] };
  const ref1 = { snapshotId: snapshot1Id, version: 1, contentHash: computeContentHash(payload1) };
  const ref2 = { snapshotId: snapshot2Id, version: 2, contentHash: computeContentHash(payload2) };
  const foreignRef = { snapshotId: foreignSnapshotId, version: 1, contentHash: computeContentHash(foreignPayload) };

  let pool: Pool;
  let app: Express;
  let tokenA = '';
  let tokenB = '';
  let staleToken = '';
  let chatProposalId = '';
  let ideaProposalId = '';
  let chatBindingId = '';
  let ideaBindingId = '';

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function mountApp(): Promise<Express> {
    const [{ default: v8Router }, { default: ideaRouter }, { default: orgRouter }] = await Promise.all([
      import('../../../routes/v8/index.js'),
      import('../../../routes/ideaBusinessCase.routes.js'),
      import('../../../routes/organization-context.routes.js'),
    ]);
    const mounted = express();
    mounted.use(express.json());
    mounted.use('/api/v8', v8Router);
    mounted.use('/api/idea-business-case', ideaRouter);
    mounted.use('/api/organization-context', orgRouter);
    return mounted;
  }

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: DATABASE_URL });
    for (const [organizationId, name] of [[orgA, 'Pinned consumer A'], [orgB, 'Pinned consumer B']]) {
      await pool.query(`INSERT INTO organizations (id,name,plan,status) VALUES ($1,$2,'enterprise','active')`, [organizationId, name]);
    }
    for (const [userId, organizationId, status] of [[ownerA, orgA, 'ACTIVE'], [ownerB, orgB, 'ACTIVE'], [staleA, orgA, 'INACTIVE']]) {
      await pool.query(`INSERT INTO users (id,organization_id,email,password,role,status) VALUES ($1,$2,$3,'unused','OWNER','active')`, [userId, organizationId, `${userId}@example.test`]);
      await pool.query(`INSERT INTO organization_members (id,organization_id,user_id,role,status) VALUES ($1,$2,$3,'OWNER',$4)`, [id(`member_${userId}`), organizationId, userId, status]);
    }
    await pool.query(`INSERT INTO conversations (id,user_id,organization_id,title) VALUES ($1,$2,$3,'Pinned Chat')`, [conversationId, ownerA, orgA]);
    await pool.query(`INSERT INTO conversation_messages (id,conversation_id,role,content,metadata) VALUES ($1,$2,'ai','Pinned governed context response https://example.test/source','{}'::jsonb)`, [messageId, conversationId]);
    await pool.query(`INSERT INTO my_ideas (id,user_id,organization_id,title,body,tags) VALUES ($1,$2,$3,'Pinned Idea','Pinned body','[]')`, [ideaId, ownerA, orgA]);

    for (const [snapshotId, organizationId, version, payload, ref] of [
      [snapshot1Id, orgA, 1, payload1, ref1],
      [snapshot2Id, orgA, 2, payload2, ref2],
      [foreignSnapshotId, orgB, 1, foreignPayload, foreignRef],
    ] as const) {
      await pool.query(
        `INSERT INTO organization_context_snapshot_versions
          (id,organization_id,version,schema_version,content_hash,claim_count,snapshot_json,source_refs_json,created_by)
         VALUES ($1,$2,$3,1,$4,0,$5,'[]',$6)`,
        [snapshotId, organizationId, version, ref.contentHash, canonicalJsonForHash(payload), organizationId === orgA ? ownerA : ownerB]
      );
    }

    const { default: config } = await import('../../../config/Config.js');
    const sign = (userId: string, organizationId: string) => jwt.sign(
      { id: userId, organizationId, role: 'OWNER', email: `${userId}@example.test` },
      config.JWT_SECRET,
      { expiresIn: '10m' }
    );
    tokenA = sign(ownerA, orgA);
    tokenB = sign(ownerB, orgB);
    staleToken = sign(staleA, orgA);
    process.env.ENABLE_V8_GLOBAL = 'true';
    app = await mountApp();
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`ALTER TABLE organization_context_consumer_bindings DISABLE TRIGGER trg_org_context_consumer_binding_immutable`);
    await pool.query(`DELETE FROM organization_context_consumer_bindings WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`ALTER TABLE organization_context_consumer_bindings ENABLE TRIGGER trg_org_context_consumer_binding_immutable`);
    await pool.query(`DELETE FROM artifact_handoff_receipts WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM artifact_handoff_proposals WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM organization_context_snapshot_versions WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM conversation_messages WHERE conversation_id=$1`, [conversationId]);
    await pool.query(`DELETE FROM conversations WHERE id=$1`, [conversationId]);
    await pool.query(`DELETE FROM my_ideas WHERE id=$1`, [ideaId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[ownerA, ownerB, staleA]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  }, 60_000);

  it('latest is resolved once into an exact immutable ref before command persistence', async () => {
    const latest = await request(app).get('/api/organization-context/governed/resolve-latest').set(bearer(tokenA));
    expect(latest.status).toBe(200);
    expect(latest.body.snapshotRef).toEqual(ref2);
  });

  it('governed Chat fails closed on missing/foreign/hash drift, then persists exact ref and replays once', async () => {
    const path = `/api/v8/chat/conversations/${conversationId}/governed-handoff-proposals`;
    const base = { messageId, targetKind: 'document', idempotencyKey: id('chat_idem') };
    expect((await request(app).post(path).set(bearer(tokenA)).send(base)).status).toBe(400);
    const foreign = await request(app).post(path).set(bearer(tokenA)).send({ ...base, governedSnapshotRef: foreignRef });
    expect(foreign.status).toBe(404);
    const badHash = await request(app).post(path).set(bearer(tokenA)).send({ ...base, governedSnapshotRef: { ...ref1, contentHash: '0'.repeat(64) } });
    expect(badHash.status).toBe(409);

    const results = await Promise.all(Array.from({ length: 8 }, () =>
      request(app).post(path).set(bearer(tokenA)).send({ ...base, governedSnapshotRef: ref1 })
    ));
    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.status === 200)).toHaveLength(7);
    const first = results.find((result) => result.status === 201)!;
    const replay = results.find((result) => result.status === 200)!;
    chatProposalId = first.body.data.proposal.proposalId;
    chatBindingId = first.body.data.binding.bindingId;
    expect(replay.body.data.binding.bindingId).toBe(chatBindingId);
    expect(first.body.data.proposal.payload.governedSnapshotRef).toEqual(ref1);

    const stale = await request(app).post(path).set(bearer(staleToken)).send({ ...base, governedSnapshotRef: ref1 });
    expect(stale.status).toBe(403);
    const foreignTenant = await request(app).post(path).set(bearer(tokenB)).send({ ...base, governedSnapshotRef: ref1 });
    expect(foreignTenant.status).toBe(404);
  });

  it('governed Idea requires the same exact ref and persists an immutable audit receipt', async () => {
    const path = `/api/idea-business-case/${ideaId}/governed-artifact-proposals`;
    const base = { targetKind: 'workbook', idempotencyKey: id('idea_idem') };
    expect((await request(app).post(path).set(bearer(tokenA)).send(base)).status).toBe(400);
    const first = await request(app).post(path).set(bearer(tokenA)).send({ ...base, governedSnapshotRef: ref2 });
    const replay = await request(app).post(path).set(bearer(tokenA)).send({ ...base, governedSnapshotRef: ref2 });
    expect([first.status, replay.status]).toEqual([201, 200]);
    ideaProposalId = first.body.proposal.proposalId;
    ideaBindingId = first.body.binding.bindingId;
    expect(replay.body.binding.bindingId).toBe(ideaBindingId);
    expect(first.body.proposal.payload.governedSnapshotRef).toEqual(ref2);

    await expect(pool.query(`UPDATE organization_context_consumer_bindings SET snapshot_version=99 WHERE binding_id=$1`, [ideaBindingId]))
      .rejects.toMatchObject({ message: expect.stringContaining('immutable') });
    await expect(pool.query(`DELETE FROM organization_context_consumer_bindings WHERE binding_id=$1`, [ideaBindingId]))
      .rejects.toMatchObject({ message: expect.stringContaining('immutable') });
    expect((await request(app).post(path).set(bearer(staleToken)).send({ ...base, governedSnapshotRef: ref2 })).status).toBe(403);
  });

  it('cold process/readback proves exact refs and restart replay never resolves latest/live context again', async () => {
    const cold = new Client({ connectionString: DATABASE_URL });
    await cold.connect();
    const rows = await cold.query(
      `SELECT b.consumer_kind,b.consumer_record_id,b.snapshot_id,b.snapshot_version,
              b.snapshot_content_hash,b.proposal_source_hash,p.payload_json
         FROM organization_context_consumer_bindings b
         JOIN artifact_handoff_proposals p ON p.proposal_id=b.proposal_id
        WHERE b.binding_id = ANY($1) ORDER BY b.consumer_kind`, [[chatBindingId, ideaBindingId]]
    );
    await cold.end();
    expect(rows.rows).toHaveLength(2);
    for (const row of rows.rows) {
      const payload = typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json;
      expect(payload.governedSnapshotRef).toEqual({
        snapshotId: row.snapshot_id,
        version: row.snapshot_version,
        contentHash: row.snapshot_content_hash,
      });
      expect(row.proposal_source_hash).toMatch(/^[a-f0-9]{64}$/);
    }

    app = await mountApp();
    const chatReplay = await request(app)
      .post(`/api/v8/chat/conversations/${conversationId}/governed-handoff-proposals`)
      .set(bearer(tokenA))
      .send({ messageId, targetKind: 'document', idempotencyKey: id('chat_idem'), governedSnapshotRef: ref1 });
    const ideaReplay = await request(app)
      .post(`/api/idea-business-case/${ideaId}/governed-artifact-proposals`)
      .set(bearer(tokenA))
      .send({ targetKind: 'workbook', idempotencyKey: id('idea_idem'), governedSnapshotRef: ref2 });
    expect(chatReplay.body.data.proposal.proposalId).toBe(chatProposalId);
    expect(ideaReplay.body.proposal.proposalId).toBe(ideaProposalId);
    const counts = await pool.query(`SELECT count(*)::int AS n FROM organization_context_consumer_bindings WHERE organization_id=$1`, [orgA]);
    expect(counts.rows[0]?.n).toBe(2);
  });
});
