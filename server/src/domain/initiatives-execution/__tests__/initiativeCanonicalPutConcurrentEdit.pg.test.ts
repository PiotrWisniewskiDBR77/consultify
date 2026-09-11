/** @vitest-environment node */

/**
 * FIX-4 (docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX2_JEDEN_MAGAZYN_2/97_ODBIOR_W1_W2.md §8,
 * §5.5) — documents, without changing, TODAY's optimistic-concurrency
 * behavior of `PUT /api/initiatives/:id` for a canonical (unified-write)
 * record.
 *
 * `InitiativeController.updateInitiative` (server/src/controllers/InitiativeController.ts:943)
 * fills `expectedVersion` from `canonical.version` re-read fresh on every
 * request, instead of accepting it from the client. Two editors who both
 * opened the card at version V and edit independently therefore do NOT
 * collide: the second writer's request silently re-reads the (already
 * bumped) current version and succeeds — "last write wins", with no `409`
 * and no signal to either editor that the other's change was overwritten.
 *
 * The 97_ODBIOR_W1_W2.md odbiór (§5.5) measured exactly this and flagged it
 * as a STOP the original instruction (§0.2e) explicitly required and that
 * was never raised. FIX-4 is to document this test, not to change the
 * semantics — the decision (accept `expectedVersion` from the client vs.
 * keep "last wins") is left open for the owner (98_RAPORT.md §11).
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../../config/Config.js';
import { ApiGateway } from '../../../Gateway.js';

describe('CODEX2 E1 canonical PUT — concurrent editors (FIX-4, documents current behavior)', { retry: 0 }, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const initiativeId = `initiative-${randomUUID()}`;
  const proposalId = `proposal-${randomUUID()}`;
  let app: Express;
  let sql: Client;
  let authorization: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
    expect(process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE).toBe('enforce');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).not.toBe('true');
    expect(process.env.ENABLE_INITIATIVE_UNIFIED_READ).toBe('true');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(`INSERT INTO organizations(id,name,status) VALUES($1,'CODEX2 FIX-4','active')`, [organizationId]);
    await sql.query(`INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'local-only','OWNER','active')`, [userId, organizationId, `${userId}@test.invalid`]);
    await sql.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')`, [randomUUID(), organizationId, userId]);
    await sql.query(`INSERT INTO projects(id,organization_id,name,owner_id) VALUES($1,$2,'CODEX2 FIX-4 project',$3)`, [projectId, organizationId, userId]);
    authorization = `Bearer ${jwt.sign({ id: userId, userId, email: `${userId}@test.invalid`, organizationId, organization_id: organizationId, role: 'OWNER' }, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' })}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = 'true';
    const sourceId = `manual-hub-${randomUUID()}`;
    const submit = await request(app).post('/api/initiatives/runtime-v1/source-proposals').set('Authorization', authorization).send({ proposalId, expectedVersion: 0, clientRequestId: `submit-${randomUUID()}`, sourceType: 'MANUAL_HUB', sourceId, sourceVersion: 1, provenance: { system: 'consultify.initiatives-hub', recordType: 'manual-initiative-proposal', capturedAt: new Date().toISOString(), evidenceRefs: [`consultify://initiatives/source-proposals/${proposalId}`] }, title: 'Before', problem: 'Before problem', proposedOutcome: null, priority: 'MEDIUM', projectId, initiativeOwnerId: userId, visibility: 'PROJECT' });
    expect(submit.status, JSON.stringify(submit.body)).toBe(201);
    const register = await request(app).post('/api/initiatives/runtime-v1/registrations').set('Authorization', authorization).send({ initiativeId, expectedVersion: 0, clientRequestId: `register-${randomUUID()}`, proposalId, proposalVersion: 1, sourceType: 'MANUAL_HUB', sourceId, sourceVersion: 1, title: 'Before', problem: 'Before problem', proposedOutcome: null, priority: 'MEDIUM', projectId, visibility: 'PROJECT', initiativeOwnerId: userId });
    expect(register.status, JSON.stringify(register.body)).toBe(201);
  }, 30_000);

  afterAll(async () => {
    if (!sql) return;
    await sql.query(`DELETE FROM ie_outbox_events WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM ie_audit_events WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM ie_command_receipts WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM ie_aggregate_state WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM projects WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM users WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await sql.end();
  });

  it('does NOT return 409 when a second editor overwrites the first — "last write wins" (documents FIX-4, does not fix it)', async () => {
    // Both editors "opened the card" at the same version (both would read
    // version 1 here); they edit independently and submit sequentially,
    // exactly like a real UI where B did not see A's save yet.
    const editorA = await request(app)
      .put(`/api/initiatives/${initiativeId}`)
      .set('Authorization', authorization)
      .send({ title: 'Editor A title', summary: 'Editor A outcome', description: 'Editor A problem' });
    expect(editorA.status, JSON.stringify(editorA.body)).toBe(200);

    const editorB = await request(app)
      .put(`/api/initiatives/${initiativeId}`)
      .set('Authorization', authorization)
      .send({ title: 'Editor B title', summary: 'Editor B outcome', description: 'Editor B problem' });

    // Current (documented, NOT desired) behavior: no optimistic-concurrency
    // conflict is raised. If the owner later decides to accept
    // `expectedVersion` from the client (see 98_RAPORT.md §11), this
    // assertion is the one to flip to `toBe(409)`.
    expect(editorB.status, JSON.stringify(editorB.body)).toBe(200);

    const result = await sql.query(
      `SELECT version, payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2`,
      [organizationId, initiativeId]
    );
    // Editor B's write silently overwrote editor A's — no trace of A's
    // "Editor A title" survives, and no warning was returned to either.
    expect(result.rows[0].payload_json.title).toBe('Editor B title');
    expect(result.rows[0].version).toBe(3); // 1 (register) -> 2 (A) -> 3 (B)
  });
});
