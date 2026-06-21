import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryAll = vi.fn();

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...a: unknown[]) => mockQueryAll(...a),
  queryOne: vi.fn(),
  queryRun: vi.fn(),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import {
  findSimilarInitiatives,
  jaccard,
  tokenize,
} from '../../../server/src/services/initiative/initiativeSimilarityService.js';

const ORG = 'org-1';

describe('initiativeSimilarity helpers', () => {
  it('tokenize drops stopwords + short tokens, lowercases', () => {
    const t = tokenize('The Robotic Process Automation for Warehouse');
    expect(t.has('robotic')).toBe(true);
    expect(t.has('automation')).toBe(true);
    expect(t.has('warehouse')).toBe(true);
    expect(t.has('the')).toBe(false);
    expect(t.has('for')).toBe(false);
  });

  it('jaccard is 0 for disjoint, 1 for identical', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['c', 'd']))).toBe(0);
    expect(jaccard(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
    expect(jaccard(new Set(['a', 'b', 'c']), new Set(['a', 'b']))).toBeCloseTo(2 / 3);
  });
});

describe('findSimilarInitiatives (C1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns [] for an empty candidate (no tokens)', async () => {
    const r = await findSimilarInitiatives(ORG, { name: '', summary: '' });
    expect(r).toEqual([]);
    expect(mockQueryAll).not.toHaveBeenCalled();
  });

  it('surfaces an existing near-duplicate above threshold', async () => {
    mockQueryAll.mockResolvedValueOnce([
      { id: 'i1', name: 'Warehouse Robotic Automation', summary: 'automate picking', status: 'PLANNING' },
      { id: 'i2', name: 'Marketing Website Refresh', summary: 'rebrand', status: 'DRAFT' },
    ]);
    const r = await findSimilarInitiatives(ORG, {
      name: 'Robotic Automation for Warehouse',
      summary: 'automate picking lines',
    });
    expect(r.length).toBe(1);
    expect(r[0].id).toBe('i1');
    expect(r[0].score).toBeGreaterThan(0.25);
  });

  it('is org-scoped (passes orgId to the query)', async () => {
    mockQueryAll.mockResolvedValueOnce([]);
    await findSimilarInitiatives(ORG, { name: 'Anything goes here' });
    expect(mockQueryAll).toHaveBeenCalledWith(expect.stringContaining('organization_id'), [ORG]);
  });

  it('excludes a given id (e.g. self) and respects limit/sort', async () => {
    mockQueryAll.mockResolvedValueOnce([
      { id: 'self', name: 'Robotic Automation Warehouse', summary: '', status: 'DRAFT' },
      { id: 'a', name: 'Robotic Automation Warehouse Picking', summary: '', status: 'DRAFT' },
      { id: 'b', name: 'Robotic Automation', summary: '', status: 'DRAFT' },
    ]);
    const r = await findSimilarInitiatives(
      ORG,
      { name: 'Robotic Automation Warehouse' },
      { excludeId: 'self', limit: 1 }
    );
    expect(r.length).toBe(1);
    expect(r.find((x) => x.id === 'self')).toBeUndefined();
  });

  it('fail-safe: a query error yields [] (never blocks creation)', async () => {
    mockQueryAll.mockRejectedValueOnce(new Error('db down'));
    const r = await findSimilarInitiatives(ORG, { name: 'Robotic Automation Warehouse' });
    expect(r).toEqual([]);
  });
});
