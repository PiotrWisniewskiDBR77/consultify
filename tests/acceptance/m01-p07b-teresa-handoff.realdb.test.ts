/**
 * M01-P07B — Teresa Copilot handoff (FINDING M01-005), against REAL Postgres.
 *
 * `teresaCopilotService.ts` owns three tables it self-creates on first use
 * (`ensureTeresaTables`): `teresa_proposals`, `teresa_audit_log`,
 * `teresa_handoff_results`. This file exercises the ACTUAL rows those tables
 * hold after `createProposal` -> `approveProposal` -> `executeProposal` runs
 * against a real Postgres connection (`DB_TYPE=postgres`, `RUN_DB_TESTS=1`) —
 * not a mocked DbPromise. The five foreign owner-module boundaries (radar /
 * initiatives / calendar / notebook / interview) are test doubles, same as
 * `server/src/services/v8/__tests__/teresaHandoffTargets.failClosed.test.ts`:
 * their internals belong to other module packets (M02/M03/M05/M09), not this
 * one — what this file proves on REAL Postgres is that teresaCopilotService's
 * OWN writes (the receipt row, the state transitions, the audit trail) never
 * fabricate a completed handoff.
 *
 * Complements teresaHandoffTargets.failClosed.test.ts (mocked DbPromise, all
 * 6 targets, full failure-mode matrix) with real-database proof for the two
 * targets that best demonstrate the contract end-to-end:
 *   - `excele`: no owner write path exists at all — proves on real Postgres
 *     that the proposal ends `rejected` with zero `teresa_handoff_results`
 *     rows, not a fabricated `completed`.
 *   - `notebook`: proves the M01-P07B owner_user_id fix — the acting userId
 *     reaches the (mocked) owner write, AND the real `teresa_handoff_results`
 *     row carries the confirmed note id, AND the real `teresa_proposals` row
 *     reaches `completed`.
 */
import { randomUUID } from 'node:crypto';

const ctl: { notebook: { create: any; read: any } } = {
  notebook: { create: null, read: null },
};

const notebookCreateCalls: Array<Record<string, unknown>> = [];

// server/src/services/v8/teresaCopilotService.ts resolves these via an
// opaque `tryImport` (`await import(/* @vite-ignore */ specifier)`), which
// vi.mock still intercepts — same technique as the mocked fail-closed suite.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/src/services/notebookService.js', () => ({
  get createNote() {
    if (!ctl.notebook.create) return undefined;
    return async (params: Record<string, unknown>) => {
      notebookCreateCalls.push(params);
      return ctl.notebook.create!(params);
    };
  },
  get default() {
    return ctl.notebook.read ? { resolveEmbedChip: ctl.notebook.read } : undefined;
  },
}));

const ORG = `m01-p07b-teresa-${randomUUID().slice(0, 8)}`;
const USER = `m01-p07b-user-${randomUUID().slice(0, 8)}`;
const SESSION = `m01-p07b-session-${randomUUID().slice(0, 8)}`;

let teresaCopilotService: typeof import('../../server/src/services/v8/teresaCopilotService.js');
let pg: typeof import('pg');

function requireLocalDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(`This test requires a LOCAL DATABASE_URL. Got: ${url || '(unset)'}`);
  }
  return url;
}

async function pgClient() {
  const client = new pg.default.Client({ connectionString: requireLocalDbUrl() });
  await client.connect();
  return client;
}

async function cleanup(): Promise<void> {
  const client = await pgClient();
  try {
    // teresa_* tables are self-created lazily by ensureTeresaTables() on the
    // FIRST teresaCopilotService DB call — on a brand-new local Postgres, the
    // pre-test cleanup() call in beforeAll runs before that has ever
    // happened, so "relation does not exist" here means "nothing to clean
    // yet", not a real failure.
    for (const sql of [
      `DELETE FROM teresa_handoff_results WHERE organization_id = $1`,
      `DELETE FROM teresa_audit_log WHERE proposal_id IN
        (SELECT id FROM teresa_proposals WHERE organization_id = $1)`,
      `DELETE FROM teresa_proposals WHERE organization_id = $1`,
    ]) {
      try {
        await client.query(sql, [ORG]);
      } catch (error: any) {
        if (error?.code !== '42P01') throw error;
      }
    }
  } finally {
    await client.end();
  }
}

function baseHandoffContext(targetModule: string) {
  return {
    origin: 'teresa',
    user_intent: `hand off to ${targetModule}`,
    active_surface: 'radar/triage',
    org_context_ref: `org:${ORG}`,
    bounded_context_pack: [{ ref: 'ref-001', type: 'note' }],
    constraints: [],
    assumptions: [],
    uncertainty_boundary: { missing_inputs: [], conflicts: [], what_would_change_next_action: [] },
    evidence_pointers: ['note:ref-001'],
    proposed_next_action: {
      target_module: targetModule,
      handoff_intent: 'create',
      requires_approval: true,
    },
    audit_stub: { actor: 'teresa:copilot', timestamp: new Date().toISOString() },
  };
}

async function createApprovedProposal(targetModule: 'excele' | 'notebook', targetPayload: unknown) {
  const created = await teresaCopilotService.createProposal({
    organizationId: ORG,
    userId: USER,
    sessionId: SESSION,
    handoffContext: baseHandoffContext(targetModule) as any,
    targetModule: targetModule as any,
    targetPayload: targetPayload as any,
  });
  await teresaCopilotService.approveProposal({
    proposalId: created.id,
    organizationId: ORG,
    userId: USER,
  });
  return created.id;
}

beforeAll(async () => {
  pg = await import('pg');
  teresaCopilotService = await import('../../server/src/services/v8/teresaCopilotService.js');
  await cleanup();
});

afterAll(cleanup);

describe('M01-P07B — Teresa handoff, real Postgres', () => {
  describe('excele — no owner write path, must never fabricate a receipt', () => {
    it('leaves the proposal rejected with zero teresa_handoff_results rows on real Postgres', async () => {
      const proposalId = await createApprovedProposal('excele', {
        prompt: 'build a risk table',
        workbook_intent: 'create',
      });

      const result = await teresaCopilotService.executeProposal({
        proposalId,
        organizationId: ORG,
        userId: USER,
      });
      expect(result.success).toBe(false);
      expect(result.state).not.toBe('completed');

      const client = await pgClient();
      try {
        const proposalRow = await client.query(
          `SELECT state FROM teresa_proposals WHERE id = $1`,
          [proposalId]
        );
        expect(proposalRow.rows[0].state).toBe('rejected');

        const receipts = await client.query(
          `SELECT * FROM teresa_handoff_results WHERE proposal_id = $1`,
          [proposalId]
        );
        expect(receipts.rows).toHaveLength(0);

        const failureAudit = await client.query(
          `SELECT action, to_state FROM teresa_audit_log WHERE proposal_id = $1 AND action = 'execution_failed'`,
          [proposalId]
        );
        expect(failureAudit.rows).toHaveLength(1);
        expect(failureAudit.rows[0].to_state).toBe('rejected');
      } finally {
        await client.end();
      }
    });
  });

  describe('notebook — owner_user_id fix + real receipt on completion', () => {
    it('forwards the real acting userId and writes exactly one confirmed receipt on real Postgres', async () => {
      ctl.notebook.create = vi.fn(async () => ({ id: 'note-real-p07b-1' }));
      ctl.notebook.read = vi.fn(async () => ({ artifactId: 'note-real-p07b-1', permissionOk: true }));

      const proposalId = await createApprovedProposal('notebook', {
        notebook_handoff_context: { title: 'Teresa note', body_preview: 'draft body' },
        provenance_markers: ['chat:m01-p07b'],
        evidence_pointers: ['note:ref-001'],
      });

      const result = await teresaCopilotService.executeProposal({
        proposalId,
        organizationId: ORG,
        userId: USER,
      });
      expect(result.success).toBe(true);
      expect(result.state).toBe('completed');

      // FIX assertion: createNote received the REAL acting userId, not
      // undefined (which notebookService.createNote would default to
      // 'system', making the note permanently invisible to USER).
      expect(notebookCreateCalls).toHaveLength(1);
      expect(notebookCreateCalls[0].userId).toBe(USER);

      const client = await pgClient();
      try {
        const proposalRow = await client.query(
          `SELECT state FROM teresa_proposals WHERE id = $1`,
          [proposalId]
        );
        expect(proposalRow.rows[0].state).toBe('completed');

        const receipts = await client.query(
          `SELECT result_ref, target_module FROM teresa_handoff_results WHERE proposal_id = $1`,
          [proposalId]
        );
        expect(receipts.rows).toHaveLength(1);
        expect(receipts.rows[0].result_ref).toBe('note-real-p07b-1');
        expect(receipts.rows[0].target_module).toBe('notebook');
      } finally {
        await client.end();
      }

      // Retry after completion is idempotent — no second receipt.
      const retry = await teresaCopilotService.executeProposal({
        proposalId,
        organizationId: ORG,
        userId: USER,
      });
      expect(retry.success).toBe(true);
      expect(retry.state).toBe('completed');

      const client2 = await pgClient();
      try {
        const receipts = await client2.query(
          `SELECT * FROM teresa_handoff_results WHERE proposal_id = $1`,
          [proposalId]
        );
        expect(receipts.rows).toHaveLength(1);
      } finally {
        await client2.end();
      }
    });
  });
});
