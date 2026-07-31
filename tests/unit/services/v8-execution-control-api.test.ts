import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Patch: vi.fn(),
  v8Put: vi.fn(),
}));

import {
  shouldFallbackToLegacyExecutionControl,
  V8ExecutionControlApi,
} from '@/services/api/v8/execution-control';
import { v8Get, v8Patch, v8Post } from '@/services/api/v8/client';

describe('V8ExecutionControlApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the additive management snapshot with optional project scope', async () => {
    await V8ExecutionControlApi.getManagementSnapshot('initiative/1', 'project-1');

    expect(v8Get).toHaveBeenCalledWith(
      '/execution/management/initiatives/initiative%2F1',
      { projectId: 'project-1' }
    );
  });

  it('requests risk signals from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ signals: [], count: 0 });

    await V8ExecutionControlApi.getRiskSignals('proj-1');

    expect(v8Get).toHaveBeenCalledWith('/execution-control/risk-signals', {
      projectId: 'proj-1',
    });
  });

  it('requests timeline warnings from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ warnings: [], total: 0 });

    await V8ExecutionControlApi.getTimelineWarnings('proj-1');

    expect(v8Get).toHaveBeenCalledWith('/execution-control/timeline-warnings', {
      projectId: 'proj-1',
    });
  });

  it('requests delay signals from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ signals: [], count: 0, source: 'live' });

    await V8ExecutionControlApi.getDelaySignals({
      projectId: 'proj-1',
      persisted: true,
      severity: 'CRITICAL',
    });

    expect(v8Get).toHaveBeenCalledWith('/execution-control/delay-signals', {
      projectId: 'proj-1',
      persisted: 'true',
      severity: 'CRITICAL',
    });
  });

  it('requests portfolio budget summary from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ summary: null });

    await V8ExecutionControlApi.getBudgetPortfolio('proj-1');

    expect(v8Get).toHaveBeenCalledWith('/execution-control/budget/portfolio', {
      projectId: 'proj-1',
    });
  });

  it('requests initiative budget summary from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ summary: null });

    await V8ExecutionControlApi.getBudgetInitiativeSummary('init-1');

    expect(v8Get).toHaveBeenCalledWith('/execution-control/budget/initiative/init-1');
  });

  it('requests overspend signals from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ signals: [], count: 0 });

    await V8ExecutionControlApi.getOverspendSignals('proj-1');

    expect(v8Get).toHaveBeenCalledWith('/execution-control/budget/overspend-signals', {
      projectId: 'proj-1',
    });
  });

  it('requests capacity leveling alerts from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ alerts: [] });

    await V8ExecutionControlApi.getCapacityLevelingAlerts();

    expect(v8Get).toHaveBeenCalledWith('/execution-control/capacity/leveling-alerts');
  });

  it('requests capacity timeline from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ weeks: [] });

    await V8ExecutionControlApi.getCapacityTimeline('init-1');

    expect(v8Get).toHaveBeenCalledWith('/execution-control/capacity/timeline', {
      initiativeId: 'init-1',
    });
  });

  it('posts risk dismisses to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true, signalId: 'sig-1' });

    await V8ExecutionControlApi.dismissRiskSignal('sig-1');

    expect(v8Post).toHaveBeenCalledWith('/execution-control/risk-signals/dismiss', {
      signalId: 'sig-1',
    });
  });

  it('posts delay detection to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true, detected: 0, persisted: 0, alertsSent: 0 });

    await V8ExecutionControlApi.detectDelaySignals('proj-1');

    expect(v8Post).toHaveBeenCalledWith('/execution-control/delay-signals/detect', {
      projectId: 'proj-1',
    });
  });

  it('posts delay dismisses to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true, signalId: 'delay-1' });

    await V8ExecutionControlApi.dismissDelaySignal({
      signalId: 'delay-1',
      entityType: 'INITIATIVE',
      entityId: 'init-1',
      deviationType: 'OVERDUE',
    });

    expect(v8Post).toHaveBeenCalledWith('/execution-control/delay-signals/dismiss', {
      signalId: 'delay-1',
      entityType: 'INITIATIVE',
      entityId: 'init-1',
      deviationType: 'OVERDUE',
    });
  });

  it('posts timeline updates to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      success: true,
      field: 'planned_end_date',
      oldValue: null,
      newValue: '2026-04-01',
    });

    await V8ExecutionControlApi.updateTimeline({
      initiativeId: 'init-1',
      field: 'planned_end_date',
      value: '2026-04-01',
      reason: 'Rebased after review',
    });

    expect(v8Post).toHaveBeenCalledWith('/execution-control/timeline-update', {
      initiativeId: 'init-1',
      field: 'planned_end_date',
      value: '2026-04-01',
      reason: 'Rebased after review',
    });
  });

  it('patches raid mitigation updates to the V8 namespace', async () => {
    vi.mocked(v8Patch).mockResolvedValue({ success: true, raidItemId: 'raid-1' });

    await V8ExecutionControlApi.updateRaidMitigation('raid-1', {
      raidItemId: 'raid-1',
      mitigationPlan: 'Reassign owner',
      mitigationStatus: 'IN_PROGRESS',
    });

    expect(v8Patch).toHaveBeenCalledWith('/execution-control/raid/raid-1/mitigation', {
      raidItemId: 'raid-1',
      mitigationPlan: 'Reassign owner',
      mitigationStatus: 'IN_PROGRESS',
    });
  });

  it('posts budget entries to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true, id: 'be-1' });

    await V8ExecutionControlApi.createBudgetEntry({
      initiativeId: 'init-1',
      entryType: 'ACTUAL',
      costType: 'CAPEX',
      amount: 1200,
      periodMonth: 3,
      periodYear: 2026,
    });

    expect(v8Post).toHaveBeenCalledWith('/execution-control/budget/entries', {
      initiativeId: 'init-1',
      entryType: 'ACTUAL',
      costType: 'CAPEX',
      amount: 1200,
      periodMonth: 3,
      periodYear: 2026,
    });
  });

  it('allows legacy execution-control fallback only for bounded non-supported statuses', () => {
    expect(shouldFallbackToLegacyExecutionControl({ status: 404 })).toBe(true);
    expect(shouldFallbackToLegacyExecutionControl({ status: 405 })).toBe(true);
    expect(shouldFallbackToLegacyExecutionControl({ status: 501 })).toBe(true);
  });

  it('prevents silent legacy execution-control fallback on transient failures', () => {
    expect(shouldFallbackToLegacyExecutionControl({ status: 429 })).toBe(false);
    expect(shouldFallbackToLegacyExecutionControl({ status: 500 })).toBe(false);
    expect(shouldFallbackToLegacyExecutionControl({ status: 503 })).toBe(false);
  });
});
