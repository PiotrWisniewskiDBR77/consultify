import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbAll = vi.fn().mockResolvedValue([]);
const dbGet = vi.fn().mockResolvedValue(null);
const dbRun = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));
vi.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));

import { computeScore, tierFromScore, saveSnapshot, getLatestScore, getRanking, type ReadinessSnapshot } from '../../../../server/src/services/transactionReadinessService.js';

describe('transactionReadinessService', () => {
  beforeEach(() => { vi.clearAllMocks(); dbAll.mockResolvedValue([]); dbGet.mockResolvedValue(null); dbRun.mockResolvedValue(undefined); });

  describe('tierFromScore', () => {
    it('returns LOW for scores 0-39', () => { expect(tierFromScore(0)).toBe('LOW'); expect(tierFromScore(39)).toBe('LOW'); });
    it('returns MEDIUM for scores 40-59', () => { expect(tierFromScore(40)).toBe('MEDIUM'); expect(tierFromScore(59)).toBe('MEDIUM'); });
    it('returns HIGH for scores 60-79', () => { expect(tierFromScore(60)).toBe('HIGH'); expect(tierFromScore(79)).toBe('HIGH'); });
    it('returns READY for scores 80-100', () => { expect(tierFromScore(80)).toBe('READY'); expect(tierFromScore(100)).toBe('READY'); });
  });

  describe('computeScore', () => {
    it('returns a valid snapshot with all dimensions', async () => {
      const snapshot = await computeScore('org-123');
      expect(snapshot.organizationId).toBe('org-123');
      expect(snapshot.score).toBeGreaterThanOrEqual(0);
      expect(snapshot.score).toBeLessThanOrEqual(100);
      expect(['LOW', 'MEDIUM', 'HIGH', 'READY']).toContain(snapshot.tier);
      expect(snapshot.dimensions).toHaveLength(5);
      expect(snapshot.dimensions.map((d) => d.dimension)).toEqual(['D1', 'D2', 'D3', 'D4', 'D5']);
      expect(snapshot.algorithmVersion).toBe('v1');
    });

    it('caps score at 0 when penalties exceed points', async () => {
      dbGet.mockImplementation((sql: string) => {
        if (sql.includes('churn_warnings')) return { severity: 'CRITICAL' };
        if (sql.includes('login_history') && sql.includes('MAX')) return { last: new Date(Date.now() - 30 * 86400000).toISOString() };
        return null;
      });
      const snapshot = await computeScore('org-penalized');
      expect(snapshot.score).toBeGreaterThanOrEqual(0);
      expect(snapshot.penalties.length).toBeGreaterThan(0);
    });

    it('adds BLOCKED_BY_BILLING when D4 score is low', async () => {
      dbGet.mockImplementation((sql: string) => {
        if (sql.includes('FROM organizations')) return { plan: 'trial', status: 'past_due', stripe_customer_id: null };
        return null;
      });
      const snapshot = await computeScore('org-no-billing');
      expect(snapshot.blockers).toContain('BLOCKED_BY_BILLING');
    });

    it('adds BLOCKED_BY_COMPLIANCE when D5 score is low', async () => {
      const snapshot = await computeScore('org-no-compliance');
      expect(snapshot.blockers).toContain('BLOCKED_BY_COMPLIANCE');
    });
  });

  describe('saveSnapshot', () => {
    it('calls dbRun with correct INSERT', async () => {
      const snapshot: ReadinessSnapshot = { id: 'snap-1', organizationId: 'org-1', score: 75, tier: 'HIGH', dimensions: [], penalties: [], blockers: [], algorithmVersion: 'v1', computedBy: 'admin-1', computedAt: new Date().toISOString() };
      await saveSnapshot(snapshot);
      expect(dbRun).toHaveBeenCalledTimes(1);
      expect(dbRun.mock.calls[0][0]).toContain('INSERT INTO transaction_readiness_scores');
    });
  });

  describe('getLatestScore', () => {
    it('returns null when no data exists', async () => { expect(await getLatestScore('org-empty')).toBeNull(); });
    it('maps row to snapshot correctly', async () => {
      dbGet.mockResolvedValueOnce({ id: 'row-1', organization_id: 'org-1', score: 85, tier: 'READY', dimensions_json: '[]', penalties_json: '[]', blockers_json: '["BLOCKED_BY_BILLING"]', algorithm_version: 'v1', computed_by: 'system', computed_at: '2026-03-01T00:00:00Z' });
      const result = await getLatestScore('org-1');
      expect(result).not.toBeNull();
      expect(result!.score).toBe(85);
      expect(result!.tier).toBe('READY');
      expect(result!.blockers).toEqual(['BLOCKED_BY_BILLING']);
    });
  });

  describe('getRanking', () => {
    it('returns sorted snapshots', async () => {
      dbAll.mockResolvedValueOnce([
        { id: '1', organization_id: 'org-a', score: 50, tier: 'MEDIUM', dimensions_json: '[]', penalties_json: '[]', blockers_json: '[]', algorithm_version: 'v1', computed_by: 'system', computed_at: '2026-03-01' },
        { id: '2', organization_id: 'org-b', score: 90, tier: 'READY', dimensions_json: '[]', penalties_json: '[]', blockers_json: '[]', algorithm_version: 'v1', computed_by: 'system', computed_at: '2026-03-01' },
      ]);
      const ranking = await getRanking(10);
      expect(ranking).toHaveLength(2);
      expect(ranking[0].score).toBe(90);
      expect(ranking[1].score).toBe(50);
    });
  });
});
