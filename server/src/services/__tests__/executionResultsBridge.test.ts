/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSummary = vi.fn();
const mockCreateKpiSignal = vi.fn();
const mockDbAll = vi.fn();
const mockDbGet = vi.fn();

vi.mock('../executionBudgetService.js', () => ({
  getInitiativeBudgetSummary: (...args: unknown[]) => mockGetSummary(...args),
}));

vi.mock('../v8/resultsROIService.js', () => ({
  createKpiSignal: (...args: unknown[]) => mockCreateKpiSignal(...args),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: vi.fn(),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { exportBudgetHealthToResults } from '../executionResultsBridge.js';

const ORG = 'org-1';
const INITIATIVE = 'init-1';

function summary(status: 'GREEN' | 'AMBER' | 'RED') {
  return {
    initiativeId: INITIATIVE,
    initiativeName: 'Test Initiative',
    currency: 'PLN',
    planned: { total: 100000, capex: 60000, opex: 40000 },
    actual: { total: status === 'RED' ? 120000 : status === 'AMBER' ? 85000 : 30000 },
    variance: { total: 0, percent: status === 'RED' ? 120 : status === 'AMBER' ? 85 : 30 },
    burnRate: status === 'RED' ? 120 : status === 'AMBER' ? 85 : 30,
    forecast: { total: 120000, isOverBudget: status !== 'GREEN' },
    status,
  };
}

describe('executionResultsBridge — M14→M15 budget_health feed-forward', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbGet.mockResolvedValue(null);
    mockDbAll.mockResolvedValue([]);
    mockCreateKpiSignal.mockResolvedValue({ signalId: 'sig-1' });
  });

  it('does nothing when initiative has no budget summary', async () => {
    mockGetSummary.mockResolvedValueOnce(null);
    await exportBudgetHealthToResults(ORG, INITIATIVE);
    expect(mockDbAll).not.toHaveBeenCalled();
    expect(mockCreateKpiSignal).not.toHaveBeenCalled();
  });

  it('does nothing when budget status is GREEN', async () => {
    mockGetSummary.mockResolvedValueOnce(summary('GREEN'));
    await exportBudgetHealthToResults(ORG, INITIATIVE);
    expect(mockCreateKpiSignal).not.toHaveBeenCalled();
  });

  it('skips when no KPIs are linked to the initiative', async () => {
    mockGetSummary.mockResolvedValueOnce(summary('RED'));
    mockDbAll.mockResolvedValueOnce([]);
    await exportBudgetHealthToResults(ORG, INITIATIVE);
    expect(mockCreateKpiSignal).not.toHaveBeenCalled();
  });

  it('creates a medium budget_health signal for AMBER on each linked KPI', async () => {
    mockGetSummary.mockResolvedValueOnce(summary('AMBER'));
    mockDbAll.mockResolvedValueOnce([
      { kpi_id: 'kpi-1', name: 'Cost savings' },
      { kpi_id: 'kpi-2', name: 'Margin' },
    ]);
    await exportBudgetHealthToResults(ORG, INITIATIVE);

    expect(mockCreateKpiSignal).toHaveBeenCalledTimes(2);
    expect(mockCreateKpiSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        kpiId: 'kpi-1',
        signalType: 'budget_health',
        severity: 'medium',
        evidencePointers: [`execution:budget-summary:${INITIATIVE}`],
      })
    );
    expect(mockCreateKpiSignal).toHaveBeenCalledWith(
      expect.objectContaining({ kpiId: 'kpi-2', severity: 'medium' })
    );
  });

  it('creates a critical budget_health signal for RED', async () => {
    mockGetSummary.mockResolvedValueOnce(summary('RED'));
    mockDbAll.mockResolvedValueOnce([{ kpi_id: 'kpi-1', name: 'Cost savings' }]);
    await exportBudgetHealthToResults(ORG, INITIATIVE);

    expect(mockCreateKpiSignal).toHaveBeenCalledTimes(1);
    const call = mockCreateKpiSignal.mock.calls[0][0];
    expect(call.severity).toBe('critical');
    expect(call.description).toContain('Budget RED');
    expect(call.description).toContain('Test Initiative');
  });

  it('deduplicates: skips KPI with an existing pending budget_health signal', async () => {
    mockGetSummary.mockResolvedValueOnce(summary('RED'));
    mockDbAll.mockResolvedValueOnce([
      { kpi_id: 'kpi-1', name: 'Cost savings' },
      { kpi_id: 'kpi-2', name: 'Margin' },
    ]);
    // kpi-1 already has a pending signal; kpi-2 does not
    mockDbGet.mockResolvedValueOnce({ signal_id: 'existing-sig' }).mockResolvedValueOnce(null);

    await exportBudgetHealthToResults(ORG, INITIATIVE);

    expect(mockCreateKpiSignal).toHaveBeenCalledTimes(1);
    expect(mockCreateKpiSignal.mock.calls[0][0].kpiId).toBe('kpi-2');
  });
});
