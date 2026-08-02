import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PREFIX = 'chat-005-';
const PROPOSAL_ID = `${PREFIX}golden`;
const REJECTED_ID = `${PREFIX}rejected`;
const FOREIGN_ORG_ID = `${PREFIX}foreign-org`;
const FOREIGN_USER_ID = `${PREFIX}foreign-user`;
const FOREIGN_MEMBER_ID = `${PREFIX}foreign-member`;

let app: Express;
let token: string;

async function cleanup(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(`DELETE FROM ai_run_events WHERE action_id LIKE $1`, [`${PREFIX}%`]);
    await client.query(`DELETE FROM ai_run_ledger WHERE action_id LIKE $1`, [`${PREFIX}%`]);
    await client.query(`DELETE FROM ai_actions WHERE id LIKE $1`, [`${PREFIX}%`]);
    await client.query(
      `DELETE FROM teresa_handoff_results WHERE proposal_id LIKE $1`,
      [`${PREFIX}%`]
    );
    await client.query(`DELETE FROM teresa_audit_log WHERE proposal_id LIKE $1`, [`${PREFIX}%`]);
    await client.query(`DELETE FROM teresa_proposals WHERE id LIKE $1`, [`${PREFIX}%`]);
    await client.query(`DELETE FROM organization_members WHERE id = $1`, [FOREIGN_MEMBER_ID]);
    await client.query(`DELETE FROM users WHERE id = $1`, [FOREIGN_USER_ID]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [FOREIGN_ORG_ID]);
  } finally {
    await client.end();
  }
}

function proposalBody(idempotencyKey: string, sessionId: string) {
  return {
    sessionId,
    idempotencyKey,
    targetModule: 'excele',
    handoffContext: {
      origin: 'teresa',
      user_intent: 'Build a governed MVP readiness workbook',
      active_surface: 'chat',
      org_context_ref: `org:${SEED.ORG_ID}`,
      bounded_context_pack: [{ ref: 'mvp-board', type: 'document' }],
      constraints: ['no silent writes'],
      assumptions: [],
      uncertainty_boundary: {
        missing_inputs: [],
        conflicts: [],
        what_would_change_next_action: [],
      },
      evidence_pointers: ['document:mvp-board'],
      proposed_next_action: {
        target_module: 'excele',
        handoff_intent: 'generate',
        requires_approval: true,
      },
      audit_stub: { actor: 'teresa:copilot', timestamp: new Date().toISOString() },
    },
    targetPayload: { prompt: 'Build the MVP readiness workbook.' },
  };
}

beforeAll(async () => {
  await seed();
  const service = await import('../../server/src/services/v8/teresaCopilotService.js');
  service._resetTableCache();
  // Create the Teresa-owned tables before cleanup on a pristine acceptance DB.
  await service.getProposal('chat-005-schema-probe', SEED.ORG_ID);
  await cleanup();
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO organizations (id, name, status, is_active, created_at)
       VALUES ($1, 'CHAT-05 foreign org', 'active', 1, NOW())`,
      [FOREIGN_ORG_ID]
    );
    await client.query(
      `INSERT INTO users
         (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, 'chat-005-foreign@acceptance.local', 'acceptance-only',
               'ADMIN', 'active', 'CHAT-05', 'Foreign', NOW())`,
      [FOREIGN_USER_ID, FOREIGN_ORG_ID]
    );
    await client.query(
      `INSERT INTO organization_members
         (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', NOW())`,
      [FOREIGN_MEMBER_ID, FOREIGN_ORG_ID, FOREIGN_USER_ID]
    );
  } finally {
    await client.end();
  }

  token = mintToken();
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { attachV8Context } = await import('../../server/src/middleware/v8Auth.middleware.js');
  const router = (await import('../../server/src/routes/v8/teresa.routes.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/v8/teresa', verifyToken as any, attachV8Context, router);
  app.use((error: any, _req: any, res: any, _next: any) =>
    res.status(500).json({ error: error?.message || 'Internal error' })
  );
});

afterAll(cleanup);

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('CHAT-05 — proposal, approval, execution and durable audit', () => {
  it('does not write before approval, executes once, and survives a fresh read', async () => {
    const created = await request(app)
      .post('/api/v8/teresa/proposal')
      .set(auth())
      .send(proposalBody(PROPOSAL_ID, `${PREFIX}session-golden`));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.data.state).toBe('proposal');

    const client = pgClient();
    await client.connect();
    try {
      const beforeApproval = await client.query(
        `SELECT COUNT(*)::int AS count FROM teresa_handoff_results WHERE proposal_id = $1`,
        [PROPOSAL_ID]
      );
      expect(beforeApproval.rows[0].count).toBe(0);
    } finally {
      await client.end();
    }

    const approved = await request(app)
      .post(`/api/v8/teresa/proposal/${PROPOSAL_ID}/approve`)
      .set(auth());
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    expect(approved.body.data.state).toBe('approved');

    const executions = await Promise.all([
      request(app).post(`/api/v8/teresa/proposal/${PROPOSAL_ID}/execute`).set(auth()),
      request(app).post(`/api/v8/teresa/proposal/${PROPOSAL_ID}/execute`).set(auth()),
    ]);
    expect(executions.some((response) => response.status === 200)).toBe(true);
    expect(executions.every((response) => response.status === 200 || response.status === 409)).toBe(
      true
    );

    const retry = await request(app)
      .post(`/api/v8/teresa/proposal/${PROPOSAL_ID}/execute`)
      .set(auth());
    expect(retry.status, JSON.stringify(retry.body)).toBe(200);
    expect(retry.body.data.execution.state).toBe('completed');

    const reopened = await request(app)
      .get(`/api/v8/teresa/proposal/${PROPOSAL_ID}`)
      .set(auth());
    expect(reopened.status, JSON.stringify(reopened.body)).toBe(200);
    expect(reopened.body.data).toEqual(
      expect.objectContaining({
        state: 'completed',
        approvalState: 'completed',
        allowedActions: ['navigate'],
      })
    );
    expect(reopened.body.data.resultRef).toEqual(expect.any(String));

    const verification = pgClient();
    await verification.connect();
    try {
      const receipt = await verification.query(
        `SELECT COUNT(*)::int AS count FROM teresa_handoff_results WHERE proposal_id = $1`,
        [PROPOSAL_ID]
      );
      const audit = await verification.query(
        `SELECT action FROM teresa_audit_log WHERE proposal_id = $1 ORDER BY timestamp`,
        [PROPOSAL_ID]
      );
      expect(receipt.rows[0].count).toBe(1);
      expect(audit.rows.map((row) => row.action)).toEqual([
        'proposal_created',
        'submitted_for_approval',
        'approved',
        'execution_started',
        'execution_completed',
      ]);
    } finally {
      await verification.end();
    }
  });

  it('keeps rejection terminal and tenant-scopes every read and mutation', async () => {
    const created = await request(app)
      .post('/api/v8/teresa/proposal')
      .set(auth())
      .send(proposalBody(REJECTED_ID, `${PREFIX}session-rejected`));
    expect(created.status).toBe(201);

    const foreignToken = mintToken({
      id: FOREIGN_USER_ID,
      email: 'chat-005-foreign@acceptance.local',
      organizationId: FOREIGN_ORG_ID,
      organization_id: FOREIGN_ORG_ID,
    });
    expect(
      (await request(app).get(`/api/v8/teresa/proposal/${REJECTED_ID}`).set('Authorization', `Bearer ${foreignToken}`)).status
    ).toBe(404);
    expect(
      (await request(app).post(`/api/v8/teresa/proposal/${REJECTED_ID}/approve`).set('Authorization', `Bearer ${foreignToken}`)).status
    ).toBe(404);

    const rejected = await request(app)
      .post(`/api/v8/teresa/proposal/${REJECTED_ID}/reject`)
      .set(auth())
      .send({ reason: 'User declined the write' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.state).toBe('rejected');

    const execute = await request(app)
      .post(`/api/v8/teresa/proposal/${REJECTED_ID}/execute`)
      .set(auth());
    expect(execute.status).toBe(400);
    expect(execute.body.code).toBe('P08_INVALID_STATE_TRANSITION');
  });
});
