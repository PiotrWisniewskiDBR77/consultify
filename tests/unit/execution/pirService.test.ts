import { describe, it, expect, vi, beforeEach } from 'vitest';

// Service under test (M14/F8 — Post-Implementation Review)
import { createPir, finalizePir, getPir } from '../../../server/src/services/pirService.ts';

import DbPromise from '../../../server/src/utils/DbPromise.ts';

// Mock the DbPromise helpers the service calls (node-pg wrappers).
vi.mock('../../../server/src/utils/DbPromise.ts', () => ({
  default: {
    all: vi.fn(),
    get: vi.fn(),
    run: vi.fn(),
  },
}));

describe('pirService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DbPromise.all).mockResolvedValue([]);
    vi.mocked(DbPromise.get).mockResolvedValue(null);
    vi.mocked(DbPromise.run).mockResolvedValue({ changes: 1, lastID: 1, success: true });
  });

  describe('getPir', () => {
    it('scopes the query to org + initiative', async () => {
      await getPir('org-1', 'init-1');

      expect(DbPromise.all).toHaveBeenCalledTimes(1);
      const [sql, params] = vi.mocked(DbPromise.all).mock.lastCall as [string, unknown[]];
      expect(sql).toMatch(/organization_id\s*=\s*\$1/);
      expect(sql).toMatch(/initiative_id\s*=\s*\$2/);
      expect(params).toEqual(['org-1', 'init-1']);
    });
  });

  describe('createPir', () => {
    it('inserts an org-scoped DRAFT row with the supplied fields', async () => {
      const result = await createPir('org-1', 'init-1', {
        title: 'Retro Q2',
        went_well: 'Shipped on time',
        went_wrong: 'Scope creep',
        do_better: 'Tighter gates',
        recommendations: 'Add a gate review',
      });

      // Returned object reflects org-scope + status + supplied fields
      expect(result.organization_id).toBe('org-1');
      expect(result.initiative_id).toBe('init-1');
      expect(result.status).toBe('DRAFT');
      expect(result.title).toBe('Retro Q2');
      expect(result.went_well).toBe('Shipped on time');
      expect(result.went_wrong).toBe('Scope creep');
      expect(result.do_better).toBe('Tighter gates');
      expect(result.recommendations).toBe('Add a gate review');
      expect(result.reviewed_by).toBeNull();
      expect(result.reviewed_at).toBeNull();
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);

      // INSERT carried the same org/initiative/status + DRAFT defaults
      expect(DbPromise.run).toHaveBeenCalledTimes(1);
      const [sql, params] = vi.mocked(DbPromise.run).mock.lastCall as [string, unknown[]];
      expect(sql).toMatch(/INSERT INTO post_implementation_reviews/);
      expect(params[0]).toBe(result.id);
      expect(params[1]).toBe('org-1'); // organization_id
      expect(params[2]).toBe('init-1'); // initiative_id
      expect(params[3]).toBe('Retro Q2'); // title
      expect(params[8]).toBe('DRAFT'); // status
      expect(params[9]).toBeNull(); // reviewed_by
      expect(params[10]).toBeNull(); // reviewed_at
    });

    it('defaults optional fields to null', async () => {
      const result = await createPir('org-2', 'init-2', {});
      expect(result.title).toBeNull();
      expect(result.went_well).toBeNull();
      expect(result.recommendations).toBeNull();
      expect(result.status).toBe('DRAFT');
    });
  });

  describe('finalizePir', () => {
    it('transitions DRAFT → FINALIZED and stamps reviewer + reviewed_at', async () => {
      vi.mocked(DbPromise.get).mockResolvedValue({
        id: 'pir-1',
        organization_id: 'org-1',
        initiative_id: 'init-1',
        title: 'Retro',
        went_well: null,
        went_wrong: null,
        do_better: null,
        recommendations: null,
        status: 'FINALIZED',
        reviewed_by: 'user-9',
        reviewed_at: '2026-06-23T00:00:00.000Z',
        created_at: '2026-06-22T00:00:00.000Z',
        updated_at: '2026-06-23T00:00:00.000Z',
      });

      const result = await finalizePir('org-1', 'pir-1', 'user-9');

      // UPDATE: status flips, reviewer + timestamp set, org-scoped, only on DRAFT
      expect(DbPromise.run).toHaveBeenCalledTimes(1);
      const [sql, params] = vi.mocked(DbPromise.run).mock.lastCall as [string, unknown[]];
      expect(sql).toMatch(/UPDATE post_implementation_reviews/);
      expect(sql).toMatch(/status\s*=\s*'FINALIZED'/);
      expect(sql).toMatch(/reviewed_by\s*=\s*\$1/);
      expect(sql).toMatch(/reviewed_at\s*=\s*\$2/);
      expect(sql).toMatch(/organization_id\s*=\s*\$3/);
      expect(sql).toMatch(/status\s*=\s*'DRAFT'/); // guard: only finalize drafts
      expect(params[0]).toBe('user-9'); // reviewed_by
      expect(typeof params[1]).toBe('string'); // reviewed_at ISO
      expect(params[2]).toBe('org-1'); // organization_id
      expect(params[3]).toBe('pir-1'); // id

      // Returns the finalized row
      expect(result).not.toBeNull();
      expect(result?.status).toBe('FINALIZED');
      expect(result?.reviewed_by).toBe('user-9');
      expect(result?.reviewed_at).toBe('2026-06-23T00:00:00.000Z');
    });

    it('returns null when no matching row is found', async () => {
      vi.mocked(DbPromise.get).mockResolvedValue(null);
      const result = await finalizePir('org-1', 'missing', 'user-9');
      expect(result).toBeNull();
    });

    it('reads back the row org-scoped by id', async () => {
      await finalizePir('org-7', 'pir-7', 'user-1');
      const [sql, params] = vi.mocked(DbPromise.get).mock.lastCall as [string, unknown[]];
      expect(sql).toMatch(/SELECT/);
      expect(sql).toMatch(/organization_id\s*=\s*\$1/);
      expect(params).toEqual(['org-7', 'pir-7']);
    });
  });
});
