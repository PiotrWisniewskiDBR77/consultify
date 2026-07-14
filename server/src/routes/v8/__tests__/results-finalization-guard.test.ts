/**
 * Focused unit coverage for the KPI report finalization/lock guard
 * (`findKpiReportFinalizationViolation`). This proves the hidden-finalization
 * regression: a report must not be creatable on a locked KPI set or when a
 * finalized snapshot already exists.
 *
 * NOTE: The full HTTP round-trip is covered in `results.routes.test.ts`; this
 * suite isolates the guard's pure decision logic so it runs without the v8
 * router middleware chain.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
const mockDbGet = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: vi.fn(),
}));

// Mock the remaining heavy imports the route module pulls in so importing it is
// side-effect free and fast.
vi.mock('../../../services/v8/resultsROIService.js', () => ({
  getResultsDashboard: vi.fn(),
  getResultsKpiCatalog: vi.fn(),
  getResultsKpiDrawerDetail: vi.fn(),
  getROIPortfolioSummary: vi.fn(),
  getROIInitiativeDetail: vi.fn(),
}));
vi.mock('../../../services/results/kpiReportSnapshotService.js', () => ({
  createKpiReportSnapshot: vi.fn(),
  getKpiReportSnapshot: vi.fn(),
}));
vi.mock('../../../services/results/kpiDeviationService.js', () => ({
  handleTimeSeriesRecorded: vi.fn(),
}));
vi.mock('../../../services/reportBuilderService.js', () => ({
  createReport: vi.fn(),
  updateSectionContent: vi.fn(),
  updateReportStatus: vi.fn(),
}));
vi.mock('../../../services/resultsEnterpriseService.js', () => ({
  resultsEnterpriseService: {},
}));

import { findKpiEditLockViolation, findKpiReportFinalizationViolation } from '../results.routes.js';

const ORG = '00000000-0000-4000-8000-000000000099';

describe('findKpiReportFinalizationViolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset queued one-shot return values so a prior test's unused
    // `mockResolvedValueOnce` cannot leak into the next test's call sequence.
    mockDbAll.mockReset();
    mockDbGet.mockReset();
  });

  it('blocks when a selected KPI is in a locked lifecycle status', async () => {
    // Only the KPI lock-status lookup runs; the guard returns before the
    // snapshot query is reached.
    mockDbAll.mockResolvedValueOnce([{ id: 'kpi-1', status: 'benefits_realization' }]);

    const violation = await findKpiReportFinalizationViolation({
      organizationId: ORG,
      kpiIds: ['kpi-1'],
    });

    expect(violation).not.toBeNull();
    expect(violation?.code).toBe('RESULTS_KPI_REPORT_SET_LOCKED');
    expect(violation?.detail.lockedKpiIds).toEqual(['kpi-1']);
    expect(violation?.detail.lockedStatuses).toEqual(['benefits_realization']);
  });

  it('blocks when a finalized snapshot already exists (hidden-finalization regression)', async () => {
    // KPI lock lookup: none locked.
    mockDbAll.mockResolvedValueOnce([{ id: 'kpi-1', status: 'active' }]);
    // Snapshot lookup: one finalized snapshot present.
    mockDbAll.mockResolvedValueOnce([
      { id: 'snap-draft', status: 'draft' },
      { id: 'snap-final', status: 'finalized' },
    ]);

    const violation = await findKpiReportFinalizationViolation({
      organizationId: ORG,
      kpiIds: ['kpi-1'],
    });

    expect(violation).not.toBeNull();
    expect(violation?.code).toBe('RESULTS_KPI_REPORT_ALREADY_FINALIZED');
    expect(violation?.detail.finalizedSnapshotId).toBe('snap-final');
  });

  it('blocks when an approved snapshot already exists', async () => {
    mockDbAll.mockResolvedValueOnce([{ id: 'kpi-1', status: 'active' }]);
    mockDbAll.mockResolvedValueOnce([{ id: 'snap-approved', status: 'approved' }]);

    const violation = await findKpiReportFinalizationViolation({
      organizationId: ORG,
      kpiIds: ['kpi-1'],
    });

    expect(violation?.code).toBe('RESULTS_KPI_REPORT_ALREADY_FINALIZED');
  });

  it('allows creation when no KPI is locked and no finalized snapshot exists', async () => {
    mockDbAll.mockResolvedValueOnce([{ id: 'kpi-1', status: 'active' }]);
    mockDbAll.mockResolvedValueOnce([{ id: 'snap-draft', status: 'draft' }]);

    const violation = await findKpiReportFinalizationViolation({
      organizationId: ORG,
      kpiIds: ['kpi-1'],
    });

    expect(violation).toBeNull();
  });

  it('skips the KPI lock query when no kpiIds scope is provided but still checks snapshots', async () => {
    // Only the snapshot lookup runs (no KPI scope).
    mockDbAll.mockResolvedValueOnce([{ id: 'snap-draft', status: 'draft' }]);

    const violation = await findKpiReportFinalizationViolation({
      organizationId: ORG,
      kpiIds: null,
    });

    expect(violation).toBeNull();
    // Exactly one dbAll call (snapshot lookup); KPI lock lookup is skipped.
    expect(mockDbAll).toHaveBeenCalledTimes(1);
    expect(String(mockDbAll.mock.calls[0]?.[0] || '')).toContain('results_kpi_report_snapshots');
  });

  it('degrades to no-violation when the snapshot table query rejects', async () => {
    mockDbAll.mockResolvedValueOnce([{ id: 'kpi-1', status: 'active' }]);
    mockDbAll.mockRejectedValueOnce(new Error('no such column: status'));

    const violation = await findKpiReportFinalizationViolation({
      organizationId: ORG,
      kpiIds: ['kpi-1'],
    });

    expect(violation).toBeNull();
  });

  it('org-scopes BOTH the KPI lock lookup and the finalized-snapshot lookup', async () => {
    // SEC-3: the finalization guard must never evaluate a lock or a finalized
    // snapshot from another org. Both queries carry organization_id = ? bound
    // to the caller org, so org A cannot be blocked by — or peek at — org B's
    // locked KPIs or finalized snapshots.
    mockDbAll.mockResolvedValueOnce([{ id: 'kpi-1', status: 'active' }]);
    mockDbAll.mockResolvedValueOnce([{ id: 'snap-draft', status: 'draft' }]);

    await findKpiReportFinalizationViolation({ organizationId: ORG, kpiIds: ['kpi-1'] });

    const lockSql = String(mockDbAll.mock.calls[0]?.[0] || '');
    expect(lockSql).toContain('FROM initiative_kpis');
    expect(lockSql).toContain('organization_id = ?');
    expect(mockDbAll.mock.calls[0]?.[1]).toContain(ORG);

    const snapshotSql = String(mockDbAll.mock.calls[1]?.[0] || '');
    expect(snapshotSql).toContain('results_kpi_report_snapshots');
    expect(snapshotSql).toContain('organization_id = ?');
    expect(mockDbAll.mock.calls[1]?.[1]).toContain(ORG);
  });

  it('does not let one org’s finalized snapshot block a different org (no cross-org block)', async () => {
    // org B has NO finalized snapshot of its own → the guard allows creation,
    // proving the snapshot lookup is bound to the caller org rather than global.
    const OTHER_ORG = '00000000-0000-4000-8000-000000000077';
    mockDbAll.mockResolvedValueOnce([{ id: 'kpi-9', status: 'active' }]);
    mockDbAll.mockResolvedValueOnce([]); // no snapshots in OTHER_ORG scope

    const violation = await findKpiReportFinalizationViolation({
      organizationId: OTHER_ORG,
      kpiIds: ['kpi-9'],
    });

    expect(violation).toBeNull();
    expect(mockDbAll.mock.calls[1]?.[1]).toContain(OTHER_ORG);
  });
});

describe('findKpiEditLockViolation (mass-assignment: locked KPI target/definition edit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockReset();
    mockDbGet.mockReset();
  });

  it.each(['benefits_realization', 'review', 'locked'])(
    'blocks a definition/target edit when the KPI is in locked status "%s"',
    async (status) => {
      mockDbGet.mockResolvedValueOnce({ status });

      const violation = await findKpiEditLockViolation({ organizationId: ORG, kpiId: 'kpi-1' });

      expect(violation).not.toBeNull();
      expect(violation?.code).toBe('RESULTS_KPI_EDIT_LOCKED');
      expect(violation?.detail.status).toBe(status);
      expect(violation?.detail.kpiId).toBe('kpi-1');
    }
  );

  it('allows the edit when the KPI is in an active (unlocked) status', async () => {
    mockDbGet.mockResolvedValueOnce({ status: 'active' });

    const violation = await findKpiEditLockViolation({ organizationId: ORG, kpiId: 'kpi-1' });

    expect(violation).toBeNull();
  });

  it('allows the edit when the KPI has no status (null)', async () => {
    mockDbGet.mockResolvedValueOnce({ status: null });

    const violation = await findKpiEditLockViolation({ organizationId: ORG, kpiId: 'kpi-1' });

    expect(violation).toBeNull();
  });

  it('org-scopes the status lookup to the caller org', async () => {
    mockDbGet.mockResolvedValueOnce({ status: 'active' });

    await findKpiEditLockViolation({ organizationId: ORG, kpiId: 'kpi-1' });

    const sql = String(mockDbGet.mock.calls[0]?.[0] || '');
    expect(sql).toContain('FROM initiative_kpis');
    expect(sql).toContain('organization_id');
    expect(mockDbGet.mock.calls[0]?.[1]).toEqual(['kpi-1', ORG]);
  });

  it('degrades to no-violation (status uppercase tolerated) — case-insensitive lock match', async () => {
    // Defense: a stored status persisted with different casing must still be
    // recognised as locked so the guard cannot be sidestepped.
    mockDbGet.mockResolvedValueOnce({ status: 'LOCKED' });

    const violation = await findKpiEditLockViolation({ organizationId: ORG, kpiId: 'kpi-1' });

    expect(violation?.code).toBe('RESULTS_KPI_EDIT_LOCKED');
  });

  it('degrades to no-violation when the status lookup rejects (schema-tolerant)', async () => {
    mockDbGet.mockRejectedValueOnce(new Error('no such column: status'));

    const violation = await findKpiEditLockViolation({ organizationId: ORG, kpiId: 'kpi-1' });

    expect(violation).toBeNull();
  });
});
