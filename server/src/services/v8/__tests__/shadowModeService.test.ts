import { describe, it, expect, vi, beforeEach } from 'vitest';

// ==========================================
// HOISTED MOCKS
// ==========================================

const { mockDbRun, mockDbGet, mockDbAll, mockTableExists } = vi.hoisted(() => ({
  mockDbRun: vi.fn().mockResolvedValue({ success: true }),
  mockDbGet: vi.fn().mockResolvedValue(null),
  mockDbAll: vi.fn().mockResolvedValue([]),
  mockTableExists: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
  tableExists: (...args: unknown[]) => mockTableExists(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

import {
  recordShadowComparison,
  getShadowStats,
  getRecentComparisons,
  getShadowPromotionReadiness,
} from '../shadowModeService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = 'org-test-001';

const BASE_COMPARISON_PARAMS = {
  organizationId: ORG_ID,
  endpoint: '/api/v8/chat/messages',
  method: 'POST',
  legacyStatusCode: 200,
  v8StatusCode: 200,
  legacyResponseTimeMs: 45,
  v8ResponseTimeMs: 52,
  legacyResponseBody: { messages: [{ id: 1, text: 'hello' }] },
  v8ResponseBody: { messages: [{ id: 1, text: 'hello' }] },
};

// ==========================================
// TESTS
// ==========================================

describe('shadowModeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTableExists.mockResolvedValue(true);
    mockDbRun.mockResolvedValue({ success: true });
    mockDbGet.mockResolvedValue(null);
    mockDbAll.mockResolvedValue([]);
  });

  // ==========================================
  // recordShadowComparison
  // ==========================================

  describe('recordShadowComparison', () => {
    it('records a matching comparison', async () => {
      const result = await recordShadowComparison(BASE_COMPARISON_PARAMS);

      expect(result.comparisonId).toBe('test-uuid-1234');
      expect(result.organizationId).toBe(ORG_ID);
      expect(result.responsesMatch).toBe(true);
      expect(result.diffSummary).toBeNull();
      expect(result.endpoint).toBe('/api/v8/chat/messages');
      expect(result.method).toBe('POST');

      expect(mockDbRun).toHaveBeenCalledTimes(1);
      const [sql, params] = mockDbRun.mock.calls[0];
      expect(sql).toContain('INSERT INTO v8_shadow_comparisons');
      expect(params[0]).toBe('test-uuid-1234');
      expect(params[1]).toBe(ORG_ID);
      expect(params[8]).toBe(1); // responses_match = true → 1
    });

    it('records a mismatching comparison with status code diff', async () => {
      const result = await recordShadowComparison({
        ...BASE_COMPARISON_PARAMS,
        v8StatusCode: 500,
      });

      expect(result.responsesMatch).toBe(false);
      expect(result.diffSummary).toContain('status: 200 vs 500');

      const [, params] = mockDbRun.mock.calls[0];
      expect(params[8]).toBe(0); // responses_match = false → 0
    });

    it('records a mismatching comparison with body diff', async () => {
      const result = await recordShadowComparison({
        ...BASE_COMPARISON_PARAMS,
        v8ResponseBody: { messages: [{ id: 1, text: 'different' }] },
      });

      expect(result.responsesMatch).toBe(false);
      expect(result.diffSummary).toContain('response body differs');
    });

    it('records a mismatch with both status and body diff', async () => {
      const result = await recordShadowComparison({
        ...BASE_COMPARISON_PARAMS,
        v8StatusCode: 404,
        v8ResponseBody: { error: 'not found' },
      });

      expect(result.responsesMatch).toBe(false);
      expect(result.diffSummary).toContain('status: 200 vs 404');
      expect(result.diffSummary).toContain('response body differs');
    });

    it('throws when table does not exist', async () => {
      mockTableExists.mockResolvedValue(false);

      await expect(recordShadowComparison(BASE_COMPARISON_PARAMS)).rejects.toThrow(
        /v8_shadow_comparisons table does not exist/,
      );
    });

    it('rejects empty organizationId', async () => {
      await expect(
        recordShadowComparison({ ...BASE_COMPARISON_PARAMS, organizationId: '' }),
      ).rejects.toThrow();
    });

    it('handles undefined response bodies gracefully', async () => {
      const result = await recordShadowComparison({
        organizationId: ORG_ID,
        endpoint: '/api/test',
        method: 'GET',
        legacyStatusCode: 200,
        v8StatusCode: 200,
        legacyResponseTimeMs: 10,
        v8ResponseTimeMs: 12,
      });

      expect(result.responsesMatch).toBe(true);
      expect(result.diffSummary).toBeNull();
    });
  });

  // ==========================================
  // getShadowStats
  // ==========================================

  describe('getShadowStats', () => {
    it('returns zero stats when table does not exist', async () => {
      mockTableExists.mockResolvedValue(false);

      const stats = await getShadowStats(ORG_ID);

      expect(stats).toEqual({
        totalComparisons: 0,
        matchRate: 0,
        avgLegacyLatencyMs: 0,
        avgV8LatencyMs: 0,
        v8ErrorRate: 0,
        recentMismatches: 0,
      });
    });

    it('computes stats from DB aggregates', async () => {
      mockDbGet
        .mockResolvedValueOnce({
          total: '150',
          matches: '140',
          avg_legacy: '42.5',
          avg_v8: '55.3',
          v8_errors: '3',
        })
        .mockResolvedValueOnce({ count: '2' });

      const stats = await getShadowStats(ORG_ID);

      expect(stats.totalComparisons).toBe(150);
      expect(stats.matchRate).toBeCloseTo(140 / 150);
      expect(stats.avgLegacyLatencyMs).toBe(43);
      expect(stats.avgV8LatencyMs).toBe(55);
      expect(stats.v8ErrorRate).toBeCloseTo(3 / 150);
      expect(stats.recentMismatches).toBe(2);
    });

    it('handles null DB results gracefully', async () => {
      mockDbGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const stats = await getShadowStats(ORG_ID);

      expect(stats.totalComparisons).toBe(0);
      expect(stats.matchRate).toBe(0);
      expect(stats.avgLegacyLatencyMs).toBe(0);
      expect(stats.avgV8LatencyMs).toBe(0);
      expect(stats.v8ErrorRate).toBe(0);
      expect(stats.recentMismatches).toBe(0);
    });

    it('rejects empty organizationId', async () => {
      await expect(getShadowStats('')).rejects.toThrow();
    });
  });

  // ==========================================
  // getRecentComparisons
  // ==========================================

  describe('getRecentComparisons', () => {
    it('returns empty array when table does not exist', async () => {
      mockTableExists.mockResolvedValue(false);

      const result = await getRecentComparisons(ORG_ID);

      expect(result).toEqual([]);
    });

    it('maps DB rows to typed results', async () => {
      mockDbAll.mockResolvedValue([
        {
          comparison_id: 'cmp-1',
          organization_id: ORG_ID,
          endpoint: '/api/test',
          method: 'GET',
          legacy_status_code: 200,
          v8_status_code: 200,
          legacy_response_time_ms: 30,
          v8_response_time_ms: 35,
          responses_match: 1,
          diff_summary: null,
          created_at: '2026-03-24T10:00:00Z',
        },
        {
          comparison_id: 'cmp-2',
          organization_id: ORG_ID,
          endpoint: '/api/other',
          method: 'POST',
          legacy_status_code: 200,
          v8_status_code: 500,
          legacy_response_time_ms: 25,
          v8_response_time_ms: 120,
          responses_match: 0,
          diff_summary: 'status: 200 vs 500',
          created_at: '2026-03-24T09:00:00Z',
        },
      ]);

      const result = await getRecentComparisons(ORG_ID, 10);

      expect(result).toHaveLength(2);
      expect(result[0].comparisonId).toBe('cmp-1');
      expect(result[0].responsesMatch).toBe(true);
      expect(result[1].comparisonId).toBe('cmp-2');
      expect(result[1].responsesMatch).toBe(false);
      expect(result[1].diffSummary).toBe('status: 200 vs 500');
    });

    it('passes limit to query', async () => {
      mockDbAll.mockResolvedValue([]);

      await getRecentComparisons(ORG_ID, 25);

      const [, params] = mockDbAll.mock.calls[0];
      expect(params[1]).toBe(25);
    });

    it('defaults limit to 50', async () => {
      mockDbAll.mockResolvedValue([]);

      await getRecentComparisons(ORG_ID);

      const [, params] = mockDbAll.mock.calls[0];
      expect(params[1]).toBe(50);
    });

    it('rejects empty organizationId', async () => {
      await expect(getRecentComparisons('')).rejects.toThrow();
    });
  });

  // ==========================================
  // getShadowPromotionReadiness
  // ==========================================

  describe('getShadowPromotionReadiness', () => {
    it('returns ready=true when all criteria pass', async () => {
      mockDbGet
        .mockResolvedValueOnce({
          total: '200',
          matches: '198',
          avg_legacy: '40',
          avg_v8: '50',
          v8_errors: '2',
        })
        .mockResolvedValueOnce({ count: '0' });

      const result = await getShadowPromotionReadiness(ORG_ID);

      expect(result.ready).toBe(true);
      expect(result.criteria).toHaveLength(5);
      expect(result.criteria.every((c) => c.passed)).toBe(true);
    });

    it('returns ready=false when comparisons < 100', async () => {
      mockDbGet
        .mockResolvedValueOnce({
          total: '50',
          matches: '50',
          avg_legacy: '40',
          avg_v8: '45',
          v8_errors: '0',
        })
        .mockResolvedValueOnce({ count: '0' });

      const result = await getShadowPromotionReadiness(ORG_ID);

      expect(result.ready).toBe(false);
      const minCriteria = result.criteria.find((c) => c.name === 'Minimum 100 comparisons');
      expect(minCriteria?.passed).toBe(false);
    });

    it('returns ready=false when match rate < 95%', async () => {
      mockDbGet
        .mockResolvedValueOnce({
          total: '200',
          matches: '180',
          avg_legacy: '40',
          avg_v8: '50',
          v8_errors: '0',
        })
        .mockResolvedValueOnce({ count: '0' });

      const result = await getShadowPromotionReadiness(ORG_ID);

      expect(result.ready).toBe(false);
      const matchCriteria = result.criteria.find((c) => c.name === 'Match rate >= 95%');
      expect(matchCriteria?.passed).toBe(false);
    });

    it('returns ready=false when v8 error rate >= 5%', async () => {
      mockDbGet
        .mockResolvedValueOnce({
          total: '200',
          matches: '195',
          avg_legacy: '40',
          avg_v8: '50',
          v8_errors: '15',
        })
        .mockResolvedValueOnce({ count: '0' });

      const result = await getShadowPromotionReadiness(ORG_ID);

      expect(result.ready).toBe(false);
      const errorCriteria = result.criteria.find((c) => c.name === 'V8 error rate < 5%');
      expect(errorCriteria?.passed).toBe(false);
    });

    it('returns ready=false when latency overhead >= 100ms', async () => {
      mockDbGet
        .mockResolvedValueOnce({
          total: '200',
          matches: '198',
          avg_legacy: '40',
          avg_v8: '160',
          v8_errors: '0',
        })
        .mockResolvedValueOnce({ count: '0' });

      const result = await getShadowPromotionReadiness(ORG_ID);

      expect(result.ready).toBe(false);
      const latencyCriteria = result.criteria.find((c) => c.name === 'V8 latency overhead < 100ms');
      expect(latencyCriteria?.passed).toBe(false);
    });

    it('returns ready=false when recent mismatches > 0', async () => {
      mockDbGet
        .mockResolvedValueOnce({
          total: '200',
          matches: '198',
          avg_legacy: '40',
          avg_v8: '50',
          v8_errors: '2',
        })
        .mockResolvedValueOnce({ count: '5' });

      const result = await getShadowPromotionReadiness(ORG_ID);

      expect(result.ready).toBe(false);
      const recentCriteria = result.criteria.find((c) => c.name === 'No mismatches in last 24h');
      expect(recentCriteria?.passed).toBe(false);
    });

    it('returns ready=false with zero stats (no table)', async () => {
      mockTableExists.mockResolvedValue(false);

      const result = await getShadowPromotionReadiness(ORG_ID);

      expect(result.ready).toBe(false);
    });
  });
});
