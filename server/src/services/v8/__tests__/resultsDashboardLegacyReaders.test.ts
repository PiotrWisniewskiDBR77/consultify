import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ANTI-FALSE-GREEN — Results dashboard legacy readers (split-brain finish).
 *
 * Guards the fix that repoints the two remaining orphan dashboard readers
 * (`getKPIScorecard`, `getROIDashboard`) from the orphan v8 read-model
 * (`v8_kpi_definitions`, `v8_roi_realization_entries`) onto the CANONICAL legacy
 * family (`initiative_kpis`, `roi_realized_values` / `roi_assumptions`) where the
 * demo data and the whole M13→M14→M15 closure flow actually write.
 *
 * The DB mock below serves rows ONLY for the legacy tables and returns EMPTY for
 * every v8_* orphan table. Therefore:
 *   - on the OLD code (readers query v8_*)  → totalKpis === 0 and totalEntries === 0  (RED)
 *   - on the FIXED code (readers query legacy) → totalKpis > 0 and totalEntries > 0    (GREEN)
 *
 * This is the exact data shape of the atelier demo org, whose KPIs/ROI live only
 * in legacy — the scenario that made the M15 dashboard light `totalKpis=0` /
 * ROI `totalEntries=0`.
 */

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getKPIScorecard, getROIDashboard } from '../resultsROIService.js';

const ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const INITIATIVE_ID = '55555555-6666-4777-8888-999999999999';

/** true when the SQL touches any orphan v8_* read-model table. */
function isV8OrphanSql(sql: string): boolean {
  return /\bv8_kpi_definitions\b/.test(sql) || /\bv8_roi_realization_entries\b/.test(sql);
}

beforeEach(() => {
  vi.clearAllMocks();

  // Legacy tables carry the data; every v8_* orphan table is empty.
  mockDbGet.mockImplementation(async (sql: string) => {
    if (isV8OrphanSql(sql)) {
      if (/AS\s+total\b/.test(sql)) return { total: 0 };
      if (/AS\s+avg_rate\b/.test(sql)) return { avg_rate: null };
      if (/total_entries/.test(sql)) return { total_entries: 0, total_realized: 0 };
      if (/AS\s+projected\b/.test(sql)) return { projected: 0 };
      return null;
    }
    // --- legacy initiative_kpis (scorecard) ---
    if (sql.includes('COUNT(*) AS total FROM initiative_kpis')) {
      return { total: 3 };
    }
    if (sql.includes('AS avg_rate') && sql.includes('initiative_kpis')) {
      return { avg_rate: 0.8 };
    }
    // --- legacy roi_realized_values (ROI dashboard totals) ---
    if (sql.includes('total_entries') && sql.includes('roi_realized_values')) {
      return { total_entries: 4, total_realized: 12345 };
    }
    // --- legacy roi_assumptions (projected side) ---
    if (sql.includes('AS projected') && sql.includes('roi_assumptions')) {
      return { projected: 20000 };
    }
    return null;
  });

  mockDbAll.mockImplementation(async (sql: string) => {
    if (isV8OrphanSql(sql)) return [];
    // --- scorecard breakdowns from legacy initiative_kpis ---
    if (sql.includes('initiative_kpis') && sql.includes('GROUP BY k.status')) {
      return [{ status: 'active', cnt: 3 }];
    }
    if (sql.includes('initiative_kpis') && sql.includes('GROUP BY k.category')) {
      return [{ metric_type: 'currency', cnt: 3 }];
    }
    // --- ROI per-initiative rollup from legacy roi_realized_values ---
    if (sql.includes('roi_realized_values') && sql.includes('GROUP BY initiative_id')) {
      return [{ initiative_id: INITIATIVE_ID, entry_count: 4, realized_sum: 12345 }];
    }
    return [];
  });
});

describe('getKPIScorecard — legacy-only data (split-brain finish)', () => {
  it('reports totalKpis > 0 when KPIs exist ONLY in legacy initiative_kpis', async () => {
    const card = await getKPIScorecard(ORG_ID);
    // RED on the orphan-v8 reader (would be 0); GREEN once sourced from legacy.
    expect(card.totalKpis).toBeGreaterThan(0);
    expect(card.totalKpis).toBe(3);
    expect(card.byCategory.currency).toBe(3);
    expect(card.averageTargetAchievementRate).toBeCloseTo(0.8);
  });

  it('never reads the orphan v8_kpi_definitions table', async () => {
    await getKPIScorecard(ORG_ID);
    const touchedV8 = [...mockDbGet.mock.calls, ...mockDbAll.mock.calls].some((c) =>
      /\bv8_kpi_definitions\b/.test(String(c[0]))
    );
    expect(touchedV8).toBe(false);
  });
});

describe('getROIDashboard — legacy-only data (split-brain finish)', () => {
  it('reports totalEntries > 0 when ROI exists ONLY in legacy roi_realized_values', async () => {
    const dash = await getROIDashboard(ORG_ID);
    // RED on the orphan-v8 reader (would be 0); GREEN once sourced from legacy.
    expect(dash.totalEntries).toBeGreaterThan(0);
    expect(dash.totalEntries).toBe(4);
    expect(dash.totalRealized).toBe(12345);
    expect(dash.byInitiative).toHaveLength(1);
    expect(dash.byInitiative[0].realizedSum).toBe(12345);
  });

  it('never reads the orphan v8_roi_realization_entries table', async () => {
    await getROIDashboard(ORG_ID);
    const touchedV8 = [...mockDbGet.mock.calls, ...mockDbAll.mock.calls].some((c) =>
      /\bv8_roi_realization_entries\b/.test(String(c[0]))
    );
    expect(touchedV8).toBe(false);
  });
});
