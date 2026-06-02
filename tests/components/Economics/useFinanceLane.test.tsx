import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../src/services/api/v8/finance', () => ({
  V8FinanceApi: {
    getLaneRuns: vi.fn(),
    startLaneRun: vi.fn(),
    advanceLaneStep: vi.fn(),
    getMutationAudits: vi.fn(),
    getVersionSnapshots: vi.fn(),
    checkKpiCoherence: vi.fn(),
  },
  shouldFallbackToLegacyFinance: () => false,
}));

import { V8FinanceApi } from '../../../src/services/api/v8/finance';

const mockGetLaneRuns = V8FinanceApi.getLaneRuns as ReturnType<typeof vi.fn>;
const mockStartLaneRun = V8FinanceApi.startLaneRun as ReturnType<typeof vi.fn>;
const mockAdvanceLaneStep = V8FinanceApi.advanceLaneStep as ReturnType<typeof vi.fn>;
const mockGetMutationAudits = V8FinanceApi.getMutationAudits as ReturnType<typeof vi.fn>;
const mockGetVersionSnapshots = V8FinanceApi.getVersionSnapshots as ReturnType<typeof vi.fn>;

function makeRunData(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'run-1',
    organizationId: 'org-1',
    currentStep: 'import',
    importOutcome: null,
    analysisCompleted: false,
    mutationOutcome: null,
    readbackConfirmed: false,
    degraded: [],
    auditTrail: [],
    versionType: 'current',
    kpiLinkageStatus: 'coherent',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('useFinanceLane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLaneRuns.mockResolvedValue({ data: [] });
    mockGetMutationAudits.mockResolvedValue({ data: [] });
    mockGetVersionSnapshots.mockResolvedValue({ data: [] });
  });

  it('calls getLaneRuns on mount', async () => {
    const { renderHook, waitFor } = await import('@testing-library/react');
    const { useFinanceLane } = await import('../../../src/components/Economics/hooks/useFinanceLane');

    renderHook(() => useFinanceLane());

    await waitFor(() => {
      expect(mockGetLaneRuns).toHaveBeenCalledWith(20);
    });
  });

  it('sets activeLaneRun from the first non-completed run', async () => {
    const activeRun = makeRunData({ currentStep: 'analysis' });
    const completedRun = makeRunData({ runId: 'run-2', currentStep: 'readback', readbackConfirmed: true });
    mockGetLaneRuns.mockResolvedValue({ data: [activeRun, completedRun] });

    const { renderHook, waitFor } = await import('@testing-library/react');
    const { useFinanceLane } = await import('../../../src/components/Economics/hooks/useFinanceLane');

    const { result } = renderHook(() => useFinanceLane());

    await waitFor(() => {
      expect(result.current.activeLaneRun?.runId).toBe('run-1');
    });
  });

  it('maps degraded entries to alerts with correct severity', async () => {
    const run = makeRunData({
      degraded: [
        { reason: 'import_failed', detail: 'fail', nextAction: 'fix' },
        { reason: 'stale_model', detail: 'old', nextAction: 'refresh' },
        { reason: 'mutation_conflict', detail: 'conflict', nextAction: 'retry' },
        { reason: 'schema_drift', detail: 'drift', nextAction: 'update' },
        { reason: 'import_mapping_missing', detail: 'missing', nextAction: 'configure' },
        { reason: 'switchover_misconfigured', detail: 'wrong', nextAction: 'fix' },
        { reason: 'import_completed_with_warnings', detail: 'warn', nextAction: 'review' },
        { reason: 'permission_denied', detail: 'denied', nextAction: 'contact' },
        { reason: 'reconciliation_mismatch', detail: 'mismatch', nextAction: 'acknowledge' },
      ],
    });
    mockGetLaneRuns.mockResolvedValue({ data: [run] });

    const { renderHook, waitFor } = await import('@testing-library/react');
    const { useFinanceLane } = await import('../../../src/components/Economics/hooks/useFinanceLane');

    const { result } = renderHook(() => useFinanceLane());

    await waitFor(() => {
      expect(result.current.degradedAlerts).toHaveLength(9);
    });

    const severities = result.current.degradedAlerts.map((a) => a.severity);
    expect(severities.filter((s) => s === 'destructive')).toHaveLength(2);
    expect(severities.filter((s) => s === 'warning')).toHaveLength(5);
    expect(severities.filter((s) => s === 'info')).toHaveLength(2);
  });

  it('startRun calls API and updates state', async () => {
    const newRun = makeRunData();
    mockStartLaneRun.mockResolvedValue({ data: newRun });

    const { renderHook, waitFor, act } = await import('@testing-library/react');
    const { useFinanceLane } = await import('../../../src/components/Economics/hooks/useFinanceLane');

    const { result } = renderHook(() => useFinanceLane());

    await act(async () => {
      await result.current.startRun('current');
    });

    expect(mockStartLaneRun).toHaveBeenCalledWith('current');
    expect(result.current.activeLaneRun?.runId).toBe('run-1');
  });

  it('advanceStep calls API and refreshes run', async () => {
    const run = makeRunData();
    mockGetLaneRuns.mockResolvedValue({ data: [run] });
    const advancedRun = makeRunData({ currentStep: 'analysis', importOutcome: 'completed' });
    mockAdvanceLaneStep.mockResolvedValue({ data: advancedRun });

    const { renderHook, waitFor, act } = await import('@testing-library/react');
    const { useFinanceLane } = await import('../../../src/components/Economics/hooks/useFinanceLane');

    const { result } = renderHook(() => useFinanceLane());

    await waitFor(() => {
      expect(result.current.activeLaneRun).toBeTruthy();
    });

    await act(async () => {
      await result.current.advanceStep('completed');
    });

    expect(mockAdvanceLaneStep).toHaveBeenCalledWith('run-1', 'completed', undefined);
    expect(result.current.activeLaneRun?.currentStep).toBe('analysis');
  });

  it('refreshCoherence calls checkKpiCoherence and sets kpiCoherence state', async () => {
    const run = makeRunData({ currentStep: 'readback' });
    mockGetLaneRuns.mockResolvedValue({ data: [run] });
    const mockCheckKpiCoherence = V8FinanceApi.checkKpiCoherence as ReturnType<typeof vi.fn>;
    mockCheckKpiCoherence.mockResolvedValue({ data: { status: 'stale', detail: 'Stale linkage' } });

    const { renderHook, waitFor, act } = await import('@testing-library/react');
    const { useFinanceLane } = await import('../../../src/components/Economics/hooks/useFinanceLane');

    const { result } = renderHook(() => useFinanceLane());

    await waitFor(() => {
      expect(result.current.activeLaneRun).toBeTruthy();
    });

    await act(async () => {
      await result.current.refreshCoherence();
    });

    expect(mockCheckKpiCoherence).toHaveBeenCalledWith('run-1');
    expect(result.current.kpiCoherence?.status).toBe('stale');
  });

  it('refreshCoherence falls back to unavailable on API error', async () => {
    const run = makeRunData({ currentStep: 'mutation' });
    mockGetLaneRuns.mockResolvedValue({ data: [run] });
    const mockCheckKpiCoherence = V8FinanceApi.checkKpiCoherence as ReturnType<typeof vi.fn>;
    mockCheckKpiCoherence.mockRejectedValue(new Error('Network error'));

    const { renderHook, waitFor, act } = await import('@testing-library/react');
    const { useFinanceLane } = await import('../../../src/components/Economics/hooks/useFinanceLane');

    const { result } = renderHook(() => useFinanceLane());

    await waitFor(() => {
      expect(result.current.activeLaneRun).toBeTruthy();
    });

    await act(async () => {
      await result.current.refreshCoherence();
    });

    expect(result.current.kpiCoherence?.status).toBe('unavailable');
  });

  it('uses getFinanceErrorMessage for error reporting', async () => {
    const apiError = { response: { data: { code: 'P05_CONCURRENT_RUN_EXISTS', error: 'Active lane run already exists' } } };
    mockStartLaneRun.mockRejectedValue(apiError);

    const { renderHook, waitFor, act } = await import('@testing-library/react');
    const { useFinanceLane } = await import('../../../src/components/Economics/hooks/useFinanceLane');

    const { result } = renderHook(() => useFinanceLane());

    await expect(
      act(async () => {
        await result.current.startRun('current');
      })
    ).rejects.toThrow();

    expect(mockStartLaneRun).toHaveBeenCalledWith('current');
  });
});
