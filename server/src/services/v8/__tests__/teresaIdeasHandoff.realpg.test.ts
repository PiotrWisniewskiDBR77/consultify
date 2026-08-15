// @vitest-environment node
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const URL = process.env.M01_PG_URL;
const describeIfPg = URL ? describe : describe.skip;
const pool = URL ? new Pool({ connectionString: URL, max: 10, connectionTimeoutMillis: 5000 }) : null;
const verify = URL ? new Pool({ connectionString: URL, max: 3, connectionTimeoutMillis: 5000 }) : null;
const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();
vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));
vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
let failOn: string | null = null;
vi.mock('../../../database/PostgresDatabase.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getPoolClientForPinnedTransaction: async () => {
    const client = await pool!.connect();
    const query = client.query.bind(client);
    (client as any).query = async (sql: string, params?: unknown[]) => {
      if (failOn && sql.includes(failOn)) throw new Error(`injected: ${failOn}`);
      return query(sql as any, params as any);
    };
    return client;
  },
}));

const { executeProposal } = await import('../teresaCopilotService.js');
const ORG = 'org-clean-002-chat-013';
const USER = 'user-clean-002-chat-013';
const PROPOSAL = 'proposal-clean-002-chat-013';
const context = {
  origin: 'teresa', user_intent: 'capture pricing idea', active_surface: 'chat',
  org_context_ref: `org:${ORG}`, bounded_context_pack: [], constraints: [], assumptions: [],
  uncertainty_boundary: { missing_inputs: [], conflicts: [], what_would_change_next_action: [] },
  evidence_pointers: [],
  proposed_next_action: { target_module: 'ideas', handoff_intent: 'create', requires_approval: true },
  audit_stub: { actor: 'teresa:copilot', timestamp: '2026-08-15T00:00:00.000Z' },
};
const payload = { ideas_context: { title: 'Pricing pilot', body: 'Three tiers' }, canvas_type: 'mindmap' };
function row() {
  return { id: PROPOSAL, organization_id: ORG, user_id: USER, session_id: 's1', state: 'approved',
    target_module: 'ideas', handoff_context_json: JSON.stringify(context),
    target_payload_json: JSON.stringify(payload), created_at: context.audit_stub.timestamp,
    updated_at: context.audit_stub.timestamp };
}
async function execute() {
  mockDbGet.mockResolvedValue(row());
  return executeProposal({ proposalId: PROPOSAL, organizationId: ORG, userId: USER });
}
async function counts() {
  const count = async (table: string, where: string, values: unknown[]) =>
    Number((await verify!.query(`SELECT count(*)::int AS c FROM ${table} WHERE ${where}`, values)).rows[0].c);
  return {
    ideas: await count('my_ideas', 'organization_id=$1', [ORG]),
    maps: await count('my_idea_maps', 'organization_id=$1', [ORG]),
    receipts: await count('teresa_handoff_results', 'proposal_id=$1 AND organization_id=$2', [PROPOSAL, ORG]),
  };
}

describeIfPg('CLEAN-002-CHAT-013 real PostgreSQL atomicity', () => {
  beforeAll(async () => { await pool!.query('SELECT 1'); });
  afterAll(async () => { await pool!.end(); await verify!.end(); });
  beforeEach(async () => {
    vi.clearAllMocks(); mockDbRun.mockResolvedValue({ changes: 1 }); mockDbAll.mockResolvedValue([]); failOn = null;
    await verify!.query('DELETE FROM teresa_handoff_results WHERE proposal_id=$1 AND organization_id=$2', [PROPOSAL, ORG]);
    await verify!.query('DELETE FROM my_idea_maps WHERE organization_id=$1', [ORG]);
    await verify!.query('DELETE FROM my_ideas WHERE organization_id=$1', [ORG]);
  });

  it('rolls the idea and map back when receipt persistence fails', async () => {
    failOn = 'INSERT INTO teresa_handoff_results';
    expect((await execute()).success).toBe(false);
    expect(await counts()).toEqual({ ideas: 0, maps: 0, receipts: 0 });
  });

  it('serializes concurrent retries to exactly one owner object and receipt', async () => {
    const results = await Promise.all([execute(), execute()]);
    expect(results.every((result) => result.success)).toBe(true);
    expect(await counts()).toEqual({ ideas: 1, maps: 1, receipts: 1 });
  });
});
