/**
 * DEC-120 A1-A3 — the execution module's job is to tell the owner when
 * something is going wrong. It must not render a confident "Confidence:
 * high / Freshness: Live" footer while one of its own upstream signal
 * sources failed to load. These were zero-coverage before this batch.
 */
import { describe, expect, it } from 'vitest';

import {
  enrichExecutionReport,
  type ReportDataContext,
  type ReportDef,
} from '../../../src/components/Execution/executionReports';

function baseContext(overrides: Partial<ReportDataContext> = {}): ReportDataContext {
  return {
    initiatives: [
      { id: 'i1', name: 'Initiative 1', status: 'IN_PROGRESS', progress: 80 },
      { id: 'i2', name: 'Initiative 2', status: 'IN_PROGRESS', progress: 90 },
    ],
    tasks: [],
    decisions: [],
    blocked: [],
    riskSignals: [],
    delaySignals: [],
    overdueDecisions: [],
    missingDates: [],
    dueSoonTasks: [],
    overspendSignals: [],
    nextMilestones: [],
    priorityAlerts: [],
    timelineWarnings: [],
    capacityAlerts: [],
    capacityTimeline: [],
    progressPercent: 85,
    totalInitiatives: 2,
    lastRefreshAt: '2026-08-26T12:00:00.000Z',
    ...overrides,
  };
}

const reportShape: Omit<
  ReportDef,
  | 'aiExecutiveReadout'
  | 'aiRecommendedActions'
  | 'dataQuality'
  | 'degradedFlags'
  | 'lastRefreshAt'
  | 'scenarioNotes'
> = {
  id: 'weekly-status',
  title: 'Weekly Status',
  audience: 'Sponsor',
  cadence: 'Weekly',
  scope: 'Portfolio',
  dataSources: ['initiatives'],
  sections: ['overview'],
  ragLogic: 'n/a',
  followUpActions: [],
  icon: null,
  highlights: [],
};

describe('executionReports degraded-source footer (DEC-120 A1-A3)', () => {
  it('reports high confidence and Live freshness when every source is healthy', () => {
    const report = enrichExecutionReport(reportShape, baseContext());
    expect(report.dataQuality.confidence).toBe('high');
    expect(report.dataQuality.freshnessLabel).toBe('Live');
    expect(report.degradedFlags).toEqual([]);
  });

  it('never reports Confidence: high when the control tower failed to load', () => {
    const report = enrichExecutionReport(
      reportShape,
      baseContext({ controlTowerFailed: true })
    );
    expect(report.dataQuality.confidence).not.toBe('high');
    expect(report.dataQuality.freshnessLabel).not.toBe('Live');
    expect(report.degradedFlags.join(' ')).toMatch(/control tower/i);
  });

  it('never reports Freshness: Live when tasks failed to load, even with a fresh timestamp', () => {
    const report = enrichExecutionReport(reportShape, baseContext({ tasksFailed: true }));
    expect(report.dataQuality.freshnessLabel).not.toBe('Live');
    expect(report.dataQuality.confidence).not.toBe('high');
    expect(report.degradedFlags.join(' ')).toMatch(/task/i);
  });

  it('degrades on decision-source failure and names it in the footer', () => {
    const report = enrichExecutionReport(reportShape, baseContext({ decisionsFailed: true }));
    expect(report.dataQuality.confidence).not.toBe('high');
    expect(report.degradedFlags.join(' ')).toMatch(/decision/i);
  });

  it('names every unavailable signal source explicitly instead of a silent empty list', () => {
    const report = enrichExecutionReport(
      reportShape,
      baseContext({ signalsUnavailable: ['risk', 'delay', 'overspend'] })
    );
    expect(report.dataQuality.confidence).not.toBe('high');
    expect(report.dataQuality.freshnessLabel).not.toBe('Live');
    const flagText = report.degradedFlags.join(' ');
    expect(flagText).toMatch(/risk/);
    expect(flagText).toMatch(/delay/);
    expect(flagText).toMatch(/overspend/);
  });

  it('stacks degradation across multiple simultaneous source failures without losing any', () => {
    const report = enrichExecutionReport(
      reportShape,
      baseContext({
        tasksFailed: true,
        decisionsFailed: true,
        controlTowerFailed: true,
        signalsUnavailable: ['risk'],
      })
    );
    expect(report.dataQuality.confidence).not.toBe('high');
    expect(report.dataQuality.freshnessLabel).toBe('Degraded');
    const flagText = report.degradedFlags.join(' | ');
    expect(flagText).toMatch(/task/i);
    expect(flagText).toMatch(/decision/i);
    expect(flagText).toMatch(/control tower/i);
    expect(flagText).toMatch(/risk/i);
  });
});
