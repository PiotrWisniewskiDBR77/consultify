/**
 * R0 Smoke: V4-IDEA-09 — Knowledge Graph (Link Graph)
 * Verifies: searchEntities(), traverse(), getStats() via unifiedKGService
 */

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  queryRun: vi.fn().mockResolvedValue({ changes: 0 }),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    run: vi.fn().mockResolvedValue({ changes: 0 }),
    all: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
  }),
}));

import unifiedKGService from '../../../../server/src/services/knowledgeGraph/unifiedKGService.js';

describe('V4-IDEA-09: Knowledge Graph Service', () => {
  it('exports searchEntities method', () => {
    expect(typeof unifiedKGService.searchEntities).toBe('function');
  });

  it('exports traverse method', () => {
    expect(typeof unifiedKGService.traverse).toBe('function');
  });

  it('exports getStats method', () => {
    expect(typeof unifiedKGService.getStats).toBe('function');
  });

  it('exports getProvenance method', () => {
    expect(typeof unifiedKGService.getProvenance).toBe('function');
  });

  it('searchEntities() returns an array', async () => {
    const result = await unifiedKGService.searchEntities('org-1', { query: 'test' });
    expect(Array.isArray(result)).toBe(true);
  });

  it('traverse() returns entities and relations', async () => {
    const result = await unifiedKGService.traverse('org-1', {
      startEntityId: 'entity-1',
      maxDepth: 2,
    });
    expect(result).toHaveProperty('entities');
    expect(result).toHaveProperty('relations');
  });

  it('getStats() returns aggregate data', async () => {
    const result = await unifiedKGService.getStats('org-1');
    expect(result).toHaveProperty('totalEntities');
    expect(result).toHaveProperty('totalRelations');
  });
});
