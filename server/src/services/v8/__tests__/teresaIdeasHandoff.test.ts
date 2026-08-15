import { beforeEach, describe, expect, it, vi } from 'vitest';

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

let issued: Array<{ sql: string; params: unknown[] }> = [];
let answers: Array<{ match: string; rows: any[] }> = [];
let failOn: string | null = null;
let released = 0;
vi.mock('../../../database/PostgresDatabase.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getPoolClientForPinnedTransaction: async () => ({
    query: async (sql: string, params: unknown[] = []) => {
      issued.push({ sql, params });
      if (failOn && sql.includes(failOn)) throw new Error(`injected: ${failOn}`);
      return { rows: answers.find((answer) => sql.includes(answer.match))?.rows ?? [] };
    },
    release: () => { released += 1; },
  }),
}));

const { executeProposal } = await import('../teresaCopilotService.js');
const ORG = 'org-ideas-1';
const USER = 'user-ideas-1';
const PROPOSAL = 'proposal-ideas-1';
const context = {
  origin: 'teresa', user_intent: 'capture idea', active_surface: 'chat', org_context_ref: `org:${ORG}`,
  bounded_context_pack: [], constraints: [], assumptions: [],
  uncertainty_boundary: { missing_inputs: [], conflicts: [], what_would_change_next_action: [] },
  evidence_pointers: [],
  proposed_next_action: { target_module: 'ideas', handoff_intent: 'create', requires_approval: true },
  audit_stub: { actor: 'teresa:copilot', timestamp: '2026-08-15T00:00:00.000Z' },
};
const payload = { ideas_context: { title: 'Pricing pilot', body: 'Test three tiers' }, canvas_type: 'mindmap' };

function approvedRow() {
  return {
    id: PROPOSAL, organization_id: ORG, user_id: USER, session_id: 'session-1',
    target_module: 'ideas', state: 'approved', handoff_context_json: JSON.stringify(context),
    target_payload_json: JSON.stringify(payload), created_at: context.audit_stub.timestamp,
    updated_at: context.audit_stub.timestamp,
  };
}
async function execute() {
  mockDbGet.mockResolvedValue(approvedRow());
  return executeProposal({ proposalId: PROPOSAL, organizationId: ORG, userId: USER });
}
const matching = (part: string) => issued.filter(({ sql }) => sql.includes(part));
const position = (part: string) => issued.findIndex(({ sql }) => sql.includes(part));

describe('CLEAN-002-CHAT-013 Teresa Ideas handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbRun.mockResolvedValue({ changes: 1 });
    mockDbAll.mockResolvedValue([]);
    issued = []; answers = []; failOn = null; released = 0;
  });

  it('serializes before checking the receipt and commits owner rows plus receipt', async () => {
    answers = [{ match: 'SELECT i.id AS idea_id', rows: [{ idea_id: 'idea', map_id: 'map' }] }];
    const result = await execute();
    expect(result.success).toBe(true);
    expect(issued[0].sql).toBe('BEGIN');
    expect(position('pg_advisory_xact_lock')).toBeLessThan(position('SELECT result_ref'));
    expect(position('SELECT i.id AS idea_id')).toBeLessThan(position('INSERT INTO teresa_handoff_results'));
    expect(issued.at(-1)?.sql).toBe('COMMIT');
    expect(released).toBe(1);
  });

  it('writes and confirms a canonical map scoped to tenant and owner', async () => {
    answers = [{ match: 'SELECT i.id AS idea_id', rows: [{ idea_id: 'idea', map_id: 'map' }] }];
    await execute();
    const map = matching('INSERT INTO my_idea_maps')[0];
    expect(map.sql).toContain('is_canonical');
    expect(map.params.slice(2, 4)).toEqual([USER, ORG]);
    const readback = matching('SELECT i.id AS idea_id')[0];
    expect(readback.sql).toContain('m.is_canonical = TRUE');
    expect(readback.sql).toContain('m.user_id = $4');
    expect(readback.params.slice(2)).toEqual([ORG, USER]);
  });

  it('rolls back all owner writes when receipt persistence fails', async () => {
    answers = [{ match: 'SELECT i.id AS idea_id', rows: [{ idea_id: 'idea', map_id: 'map' }] }];
    failOn = 'INSERT INTO teresa_handoff_results';
    const result = await execute();
    expect(result.success).toBe(false);
    expect(matching('ROLLBACK')).toHaveLength(1);
    expect(released).toBe(1);
  });

  it('idempotently resumes a tenant-owned existing receipt without new writes', async () => {
    answers = [
      { match: 'SELECT result_ref', rows: [{ result_ref: 'idea-existing' }] },
      { match: 'JOIN my_idea_maps m ON m.idea_id', rows: [{ id: 'idea-existing' }] },
    ];
    const result = await execute();
    expect(result.success).toBe(true);
    expect(matching('INSERT INTO my_ideas')).toHaveLength(0);
    expect(matching('INSERT INTO teresa_handoff_results')).toHaveLength(0);
  });

  it('fails closed when a receipt does not resolve to this tenant and owner', async () => {
    answers = [{ match: 'SELECT result_ref', rows: [{ result_ref: 'foreign-idea' }] }];
    const result = await execute();
    expect(result.success).toBe(false);
    expect(matching('INSERT INTO my_ideas')).toHaveLength(0);
    expect(matching('ROLLBACK')).toHaveLength(1);
  });
});
