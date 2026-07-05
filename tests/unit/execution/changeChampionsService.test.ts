/**
 * Change Champions Service — Unit Tests (REAL CODE)
 *
 * Tests server/src/services/changeChampionsService.ts (M14/F6, 6.6).
 * DB layer mocked with an in-memory store to assert org-scoped persistence;
 * pure analytics (coalitionCoverage / detectNoChampion) tested directly.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

const db = vi.hoisted(() => ({
  rows: [] as Row[],
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('INSERT INTO change_champions')) {
      const [id, organizationId, initiativeId, userId, role, influence, status] = params;
      db.rows.push({
        id,
        organization_id: organizationId,
        initiative_id: initiativeId,
        user_id: userId,
        role,
        influence,
        status,
        created_at: '2026-06-23T00:00:00Z',
        updated_at: '2026-06-23T00:00:00Z',
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('DELETE FROM change_champions')) {
      const [id, organizationId] = params;
      const before = db.rows.length;
      db.rows = db.rows.filter(
        (r) => !(r.id === id && r.organization_id === organizationId),
      );
      return { changes: before - db.rows.length };
    }
    return { changes: 0 };
  },
  all: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('SELECT * FROM change_champions')) {
      const organizationId = params[0];
      let rows = db.rows.filter((r) => r.organization_id === organizationId);
      if (/initiative_id = \?/.test(normalized)) {
        const initiativeId = params[1];
        rows = rows.filter((r) => r.initiative_id === initiativeId);
      }
      return rows;
    }
    return [];
  },
}));

import {
  addChampion,
  listChampions,
  removeChampion,
  coalitionCoverage,
  detectNoChampion,
} from '../../../server/src/services/changeChampionsService.js';

describe('changeChampionsService (REAL)', () => {
  beforeEach(() => {
    db.rows = [];
  });

  describe('addChampion — org-scoped persistence', () => {
    it('inserts a champion and lists it back within the same org', async () => {
      const id = await addChampion('org-A', {
        initiativeId: 'init-1',
        userId: 'user-1',
        influence: 'high',
      });
      expect(id).toBeTruthy();

      const listed = await listChampions('org-A');
      expect(listed).toHaveLength(1);
      expect(listed[0].id).toBe(id);
      expect(listed[0].organizationId).toBe('org-A');
      expect(listed[0].role).toBe('champion'); // default
      expect(listed[0].status).toBe('active'); // default
    });

    it('does NOT leak a champion across orgs', async () => {
      await addChampion('org-A', { initiativeId: 'init-1' });
      const otherOrg = await listChampions('org-B');
      expect(otherOrg).toHaveLength(0);
    });

    it('filters by initiative and removes org-scoped', async () => {
      await addChampion('org-A', { initiativeId: 'init-1' });
      const id2 = await addChampion('org-A', { initiativeId: 'init-2' });

      expect(await listChampions('org-A', 'init-1')).toHaveLength(1);

      // cross-org remove is a no-op
      await removeChampion('org-B', id2);
      expect(await listChampions('org-A')).toHaveLength(2);

      await removeChampion('org-A', id2);
      expect(await listChampions('org-A')).toHaveLength(1);
    });
  });

  describe('coalitionCoverage — Kotter ~15% target', () => {
    it('marks coverage adequate at exactly 15%', () => {
      const r = coalitionCoverage(15, 100);
      expect(r.coveragePct).toBe(15);
      expect(r.adequate).toBe(true);
    });

    it('marks coverage inadequate below 15%', () => {
      const r = coalitionCoverage(10, 100);
      expect(r.coveragePct).toBe(10);
      expect(r.adequate).toBe(false);
    });

    it('handles zero / invalid population safely', () => {
      expect(coalitionCoverage(5, 0)).toEqual({ coveragePct: 0, adequate: false });
      expect(coalitionCoverage(5, -1)).toEqual({ coveragePct: 0, adequate: false });
    });
  });

  describe('detectNoChampion — governance gap', () => {
    it('returns ids of initiatives with zero champions only', () => {
      const gaps = detectNoChampion([
        { id: 'init-1', championCount: 3 },
        { id: 'init-2', championCount: 0 },
        { id: 'init-3', championCount: 1 },
        { id: 'init-4', championCount: 0 },
      ]);
      expect(gaps).toEqual(['init-2', 'init-4']);
    });

    it('returns empty when every initiative has a champion', () => {
      const gaps = detectNoChampion([
        { id: 'init-1', championCount: 2 },
        { id: 'init-2', championCount: 5 },
      ]);
      expect(gaps).toEqual([]);
    });
  });
});
