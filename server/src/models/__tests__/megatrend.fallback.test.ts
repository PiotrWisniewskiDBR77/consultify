/**
 * F3b (pomiar DEC-463, 2026-09-10): before this fix, MegatrendsWorkspace
 * hardcoded `industry='automotive'` for every organization, and any industry
 * with zero curated rows (e.g. 'financial', 'edtech manufacturing') hit the
 * SAME 503 "not configured" the model uses for a genuinely missing table —
 * indistinguishable from an actual outage, with a Retry button that could
 * only fail identically forever.
 *
 * This test exercises `getBaselineTrends` directly against a fake db.all
 * (the model's only real dependency) to lock in the new contract:
 *   - an industry WITH rows            → plain array, no fallback markers.
 *   - an industry with NO rows, but
 *     'general' has rows               → plain array of 'general' rows,
 *                                         carrying non-enumerable
 *                                         fallbackIndustry/requestedIndustry
 *                                         (so JSON.stringify/res.json still
 *                                         serialize a bare array).
 *   - nothing at all (DB error, or
 *     'general' itself is empty too)   → still rejects 503 FEATURE_UNAVAILABLE
 *                                         (a real outage stays a real outage).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type FakeRow = {
  id: string;
  industry: string;
  type: string;
  label: string;
  description: string;
  base_impact_score: number;
  initial_ring: string;
};

let seedRows: FakeRow[] = [];
let dbAllError: Error | null = null;

vi.mock('../../database/index.js', () => ({
  getDatabase: () => ({
    all: (sql: string, params: unknown[], cb: (err: Error | null, rows?: FakeRow[]) => void) => {
      if (dbAllError) return cb(dbAllError);
      const industryFilter = params[0] as string | undefined;
      const rows = industryFilter
        ? seedRows.filter((r) => r.industry === industryFilter)
        : seedRows;
      cb(null, rows);
    },
  }),
}));

const row = (industry: string, id: string): FakeRow => ({
  id,
  industry,
  type: 'Technology',
  label: `${industry} trend ${id}`,
  description: 'desc',
  base_impact_score: 80,
  initial_ring: 'Now',
});

describe('megatrend model — getBaselineTrends industry fallback (F3b / DEC-463)', () => {
  beforeEach(() => {
    vi.resetModules();
    dbAllError = null;
    seedRows = [row('Industrial Manufacturing', 'im-1'), row('general', 'gen-1')];
  });

  it('returns a plain array with no fallback markers when the exact industry has rows', async () => {
    const { getBaselineTrends } = await import('../megatrend.js');

    const result: any = await getBaselineTrends('Industrial Manufacturing');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('im-1');
    expect(result.fallbackIndustry).toBeUndefined();
    // Non-enumerable markers must not exist at all here — not just be falsy.
    expect(Object.prototype.hasOwnProperty.call(result, 'fallbackIndustry')).toBe(false);
  });

  it('degrades to general when the requested industry has zero rows, marking the array non-enumerably', async () => {
    const { getBaselineTrends } = await import('../megatrend.js');

    const result: any = await getBaselineTrends('financial');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('gen-1');
    expect(result.fallbackIndustry).toBe('general');
    expect(result.requestedIndustry).toBe('financial');

    // The markers must be invisible to JSON serialization — the route relies
    // on this to keep the response body a backward-compatible bare array.
    const serialized = JSON.parse(JSON.stringify(result));
    expect(serialized).toEqual([
      {
        id: 'gen-1',
        industry: 'general',
        type: 'Technology',
        label: 'general trend gen-1',
        description: 'desc',
        baseImpactScore: 80,
        initialRing: 'Now',
      },
    ]);
    expect(serialized.fallbackIndustry).toBeUndefined();
  });

  it('rejects 503 FEATURE_UNAVAILABLE when even the general fallback has no rows', async () => {
    seedRows = []; // nothing anywhere, including 'general'
    const { getBaselineTrends } = await import('../megatrend.js');

    await expect(getBaselineTrends('financial')).rejects.toMatchObject({
      statusCode: 503,
      code: 'FEATURE_UNAVAILABLE',
    });
  });

  it('does not attempt a self-fallback when general is requested directly and is empty', async () => {
    seedRows = [row('Industrial Manufacturing', 'im-1')]; // general has no rows
    const { getBaselineTrends } = await import('../megatrend.js');

    await expect(getBaselineTrends('general')).rejects.toMatchObject({
      statusCode: 503,
      code: 'FEATURE_UNAVAILABLE',
    });
  });

  it('rejects 503 on a genuine db error even when a fallback might otherwise exist', async () => {
    dbAllError = new Error('connection reset');
    const { getBaselineTrends } = await import('../megatrend.js');

    await expect(getBaselineTrends('financial')).rejects.toMatchObject({
      statusCode: 503,
      code: 'FEATURE_UNAVAILABLE',
    });
  });
});
