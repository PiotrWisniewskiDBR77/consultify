import { beforeEach, describe, expect, it, vi } from 'vitest';

const statements: string[] = [];
let candidate: any;
let initiative: any;
let failLink = false;
let chain = Promise.resolve();

const tx = {
  queryOne: vi.fn(async (sql: string) => {
    statements.push(sql);
    if (sql.includes('FROM initiative_candidates') && sql.includes('FOR UPDATE')) return { ...candidate };
    if (sql.includes('SELECT c.id AS candidate_id')) {
      return candidate.initiative_id && initiative
        ? { candidate_id: candidate.id, initiative_id: candidate.initiative_id }
        : null;
    }
    if (sql.includes('source_candidate_id')) return initiative ? { id: initiative.id } : null;
    return null;
  }),
  queryAll: vi.fn(async () => []),
  queryRun: vi.fn(async (sql: string, params: unknown[] = []) => {
    statements.push(sql);
    if (sql.includes("SET status = 'accepted'")) {
      if (failLink) throw new Error('injected link failure');
      candidate.status = 'accepted'; candidate.initiative_id = params[0];
    }
    return { changes: 1 };
  }),
};

vi.mock('../../../server/src/database/PostgresDatabase.js', () => ({
  withPinnedPostgresTransaction: async (callback: (db: typeof tx) => Promise<unknown>) => {
    const run = chain.then(async () => {
      statements.push('BEGIN');
      const beforeCandidate = { ...candidate };
      const beforeInitiative = initiative ? { ...initiative } : null;
      try {
        const result = await callback(tx);
        statements.push('COMMIT');
        return result;
      } catch (error) {
        candidate = beforeCandidate; initiative = beforeInitiative;
        statements.push('ROLLBACK');
        throw error;
      }
    });
    chain = run.then(() => undefined, () => undefined);
    return run;
  },
}));

const createInitiative = vi.fn(async (_org: string, input: any, options: any) => {
  expect(options.db).toBe(tx);
  initiative = { id: 'initiative-1', organization_id: 'org-1', source_candidate_id: input.sourceCandidateId };
  statements.push('INSERT initiatives');
  return { id: initiative.id, projectId: null };
});
vi.mock('../../../server/src/services/initiative/createInitiativeService.js', () => ({
  createInitiative,
}));
vi.mock('../../../server/src/services/initiative/initiativeGeneratorBrain.js', () => ({
  generateFullInitiative: vi.fn(), defaultDeps: vi.fn(() => ({})),
}));
vi.mock('../../../server/src/services/initiative/sourceProjectResolver.js', () => ({
  resolveProjectIdFromSource: vi.fn(async () => null),
}));

const { acceptCandidate } = await import('../../../server/src/services/initiative/initiativeCandidateService.js');

describe('CLEAN-002-INT-005/006 atomic candidate acceptance', () => {
  beforeEach(() => {
    statements.length = 0; failLink = false; initiative = null; chain = Promise.resolve();
    candidate = { id: 'candidate-1', organization_id: 'org-1', source_type: 'interview_insight_finding',
      source_id: 'finding-1', title: 'Finding', rationale: 'Evidence', fit_score: 1,
      status: 'pending', initiative_id: null };
    createInitiative.mockClear();
  });

  it('locks candidate, creates initiative, links receipt/status and verifies lineage before commit', async () => {
    const result = await acceptCandidate(undefined, candidate.id, { orgId: 'org-1', fill: false });
    expect(result?.initiativeId).toBe('initiative-1');
    expect(result?.receiptPersisted).toBe(true);
    expect(statements[0]).toBe('BEGIN');
    expect(statements.findIndex((s) => s.includes('FOR UPDATE'))).toBeLessThan(statements.indexOf('INSERT initiatives'));
    expect(statements.indexOf('INSERT initiatives')).toBeLessThan(statements.findIndex((s) => s.includes("SET status = 'accepted'")));
    expect(statements.findIndex((s) => s.includes('SELECT c.id AS candidate_id'))).toBeLessThan(statements.indexOf('COMMIT'));
  });

  it('rolls candidate and initiative back when receipt/status linking fails', async () => {
    failLink = true;
    await expect(acceptCandidate(undefined, candidate.id, { orgId: 'org-1', fill: false })).rejects.toThrow('injected');
    expect(statements).toContain('ROLLBACK');
    expect(candidate.status).toBe('pending');
    expect(candidate.initiative_id).toBeNull();
    expect(initiative).toBeNull();
  });

  it('serializes concurrent retries and creates exactly one initiative', async () => {
    const [first, second] = await Promise.all([
      acceptCandidate(undefined, candidate.id, { orgId: 'org-1', fill: false }),
      acceptCandidate(undefined, candidate.id, { orgId: 'org-1', fill: false }),
    ]);
    expect(first?.initiativeId).toBe('initiative-1');
    expect(second?.initiativeId).toBe('initiative-1');
    expect(createInitiative).toHaveBeenCalledTimes(1);
  });

  it('fails closed with a typed conflict when the candidate was dismissed', async () => {
    candidate.status = 'dismissed';

    await expect(
      acceptCandidate(undefined, candidate.id, { orgId: 'org-1', fill: false })
    ).rejects.toMatchObject({
      code: 'CANDIDATE_DISMISSED',
      statusCode: 409,
    });
    expect(statements).toContain('ROLLBACK');
    expect(createInitiative).not.toHaveBeenCalled();
    expect(initiative).toBeNull();
  });
});
