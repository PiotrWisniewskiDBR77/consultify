import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../utils/dbSchema.js', () => ({
  getTableColumns: vi
    .fn()
    .mockResolvedValue(
      new Set([
        'id',
        'name',
        'status',
        'priority',
        'planned_end_date',
        'planned_start_date',
        'start_date',
        'sla_deadline',
        'blocked_reason',
        'blocked_at',
        'on_hold',
        'progress',
        'owner_business_id',
        'owner_execution_id',
        'project_id',
        'archived',
      ])
    ),
}));

import { detectRiskSignals } from '../riskDetectionService.js';

const ORG = 'org-risk-boundary';
const PROJECT = 'project-risk-boundary';

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

describe('riskDetectionService work/risk boundary caller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds classified work/risk boundary output to real risk signals and keeps project scope', async () => {
    mockDbAll.mockImplementation((sql: unknown, params: unknown[]) => {
      const query = String(sql);
      if (query.includes('FROM risk_signal_alerts')) return Promise.resolve([]);
      if (query.includes('FROM initiatives')) {
        expect(params).toEqual([ORG, PROJECT]);
        return Promise.resolve([
          {
            id: 'init-overdue',
            name: 'Overdue initiative',
            status: 'IN_PROGRESS',
            priority: 'HIGH',
            planned_end_date: daysAgo(21),
            planned_start_date: daysAgo(40),
            start_date: daysAgo(40),
            sla_deadline: null,
            blocked_reason: null,
            blocked_at: null,
            on_hold: false,
            progress: 60,
            owner_business_id: null,
            owner_execution_id: null,
            project_id: PROJECT,
          },
          {
            id: 'init-blocked',
            name: 'Blocked initiative',
            status: 'IN_PROGRESS',
            priority: 'MEDIUM',
            planned_end_date: daysFromNow(30),
            planned_start_date: daysAgo(10),
            start_date: daysAgo(10),
            sla_deadline: null,
            blocked_reason: 'Dependency missing',
            blocked_at: daysAgo(8),
            on_hold: true,
            progress: 25,
            owner_business_id: null,
            owner_execution_id: null,
            project_id: PROJECT,
          },
        ]);
      }
      if (query.includes('FROM initiative_dependencies')) return Promise.resolve([]);
      if (query.includes('FROM raid_items')) {
        expect(params).toEqual([ORG, PROJECT]);
        return Promise.resolve([
          {
            id: 'raid-critical',
            initiative_id: 'init-overdue',
            type: 'RISK',
            title: 'Critical supplier risk',
            status: 'OPEN',
            probability: 'HIGH',
            impact: 'CRITICAL',
            owner_id: null,
            mitigation_plan: '',
            mitigation_status: 'OPEN',
            due_date: null,
            project_id: PROJECT,
          },
        ]);
      }
      if (query.includes('FROM raid_appetite_thresholds')) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const signals = await detectRiskSignals(ORG, PROJECT);
    const classified = signals.filter((signal) => signal.sourceData?.workRiskBoundary);

    expect(classified.map((signal) => signal.id)).toEqual(
      expect.arrayContaining([
        'overdue-init-overdue',
        'blocked-init-blocked',
        'unowned-risk-raid-critical',
      ])
    );
    expect(classified).toHaveLength(5);
    expect(classified.map((signal) => signal.sourceData?.workRiskBoundary)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'overdue-init-overdue',
          riskState: 'red',
          decisionLevel: 3,
        }),
        expect.objectContaining({
          sourceId: 'blocked-init-blocked',
          riskState: 'watch',
          decisionLevel: 2,
        }),
        expect.objectContaining({
          sourceId: 'unowned-risk-raid-critical',
          riskState: 'red',
          decisionLevel: 2,
        }),
      ])
    );
  });
});
