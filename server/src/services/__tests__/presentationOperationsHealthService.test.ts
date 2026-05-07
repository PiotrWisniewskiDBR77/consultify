import { describe, expect, it } from 'vitest';

import {
  buildOperationsHealthReport,
  type BuildOperationsHealthInput,
} from '../presentationOperationsHealthService.js';

const NOW_ISO = '2026-05-10T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const DAY_MS = 86_400_000;

function isoDaysAgo(days: number): string {
  return new Date(NOW_MS - days * DAY_MS).toISOString();
}

function baseInput(
  overrides: Partial<BuildOperationsHealthInput> = {}
): BuildOperationsHealthInput {
  return {
    organizationId: 'org_1',
    windowDays: 7,
    nowIso: NOW_ISO,
    runtimeEvents: [],
    exportRecords: [],
    agentOperations: [],
    jobRuns: {},
    alertDispatchRows: [],
    pausedSubscriptionsCount: 0,
    ...overrides,
  };
}

function findSlo(report: ReturnType<typeof buildOperationsHealthReport>, id: string) {
  return report.slos.find((s) => s.id === id);
}

function findJob(report: ReturnType<typeof buildOperationsHealthReport>, id: string) {
  return report.jobs.find((j) => j.jobId === id);
}

describe('presentationOperationsHealthService', () => {
  it('returns inconclusive SLOs and zeroed alerts on empty input', () => {
    const report = buildOperationsHealthReport(baseInput());

    expect(report.windowDays).toBe(7);
    expect(report.generatedAt).toBe(NOW_ISO);

    expect(report.slos).toHaveLength(5);
    for (const slo of report.slos) {
      expect(slo.status).toBe('inconclusive');
      expect(slo.observedNumeric).toBeNull();
    }

    for (const job of report.jobs) {
      expect(job.lastRunAt).toBeNull();
      expect(job.lastRunStatus).toBe('unknown');
      expect(job.isStale).toBe(true);
      expect(job.staleDays).toBeNull();
    }

    expect(report.alerts).toEqual({
      windowDays: 7,
      attempted: 0,
      sent: 0,
      failed: 0,
      suppressed: 0,
      dryRun: 0,
      uniqueDecks: 0,
      pausedSubscriptions: 0,
    });
  });

  it('classifies generation_success_rate as pass when applied/accepted dominate', () => {
    const ops: BuildOperationsHealthInput['agentOperations'] = [];
    for (let i = 0; i < 19; i += 1) {
      ops.push({ status: 'applied', operationType: 'agent_edit', createdAt: isoDaysAgo(1) });
    }
    ops.push({ status: 'failed', operationType: 'agent_edit', createdAt: isoDaysAgo(1) });
    // Out-of-scope operationType must be ignored.
    ops.push({ status: 'failed', operationType: 'something_else', createdAt: isoDaysAgo(1) });

    const report = buildOperationsHealthReport(baseInput({ agentOperations: ops }));
    const slo = findSlo(report, 'generation_success_rate');

    expect(slo?.status).toBe('pass');
    expect(slo?.observedNumeric).toBeCloseTo(95, 1);
    expect(slo?.observed).toContain('19/20');
  });

  it('classifies export_success_rate as breach when failures dominate', () => {
    const exports: BuildOperationsHealthInput['exportRecords'] = [
      ...Array.from({ length: 8 }, () => ({
        status: 'completed',
        createdAt: isoDaysAgo(1),
      })),
      ...Array.from({ length: 12 }, () => ({
        status: 'failed',
        createdAt: isoDaysAgo(1),
      })),
    ];

    const report = buildOperationsHealthReport(baseInput({ exportRecords: exports }));
    const slo = findSlo(report, 'export_success_rate');

    expect(slo?.status).toBe('breach');
    expect(slo?.observedNumeric).toBeCloseTo(40, 1);
  });

  it('marks p95_generation_latency_ms inconclusive when fewer than 10 samples are present', () => {
    const exports: BuildOperationsHealthInput['exportRecords'] = Array.from(
      { length: 5 },
      () => ({ status: 'completed', createdAt: isoDaysAgo(1), durationMs: 4000 })
    );

    const report = buildOperationsHealthReport(baseInput({ exportRecords: exports }));
    const slo = findSlo(report, 'p95_generation_latency_ms');

    expect(slo?.status).toBe('inconclusive');
    // Numeric MAY be present (we still surface what we computed) but the
    // status must remain inconclusive due to small-sample protection.
    expect(slo?.observed).toContain('5');
  });

  it('classifies agent_edit_success_rate as at_risk in the 50..70 band', () => {
    const events: BuildOperationsHealthInput['runtimeEvents'] = [];
    // 6 applied / 10 proposals = 60%
    for (let i = 0; i < 10; i += 1) {
      events.push({
        eventType: 'agent_edit_proposal_created',
        payloadJson: null,
        createdAt: isoDaysAgo(1),
      });
    }
    for (let i = 0; i < 6; i += 1) {
      events.push({
        eventType: 'agent_edit_applied',
        payloadJson: null,
        createdAt: isoDaysAgo(1),
      });
    }

    const report = buildOperationsHealthReport(baseInput({ runtimeEvents: events }));
    const slo = findSlo(report, 'agent_edit_success_rate');

    expect(slo?.status).toBe('at_risk');
    expect(slo?.observedNumeric).toBeCloseTo(60, 1);
  });

  it('flags job staleness per-job using the documented thresholds', () => {
    const report = buildOperationsHealthReport(
      baseInput({
        jobRuns: {
          // Within 7d threshold -> NOT stale.
          retentionTelemetry: {
            lastRunAt: isoDaysAgo(2),
            status: 'pass',
            summary: 'purged 12 rows',
          },
          // Within 8d threshold -> NOT stale.
          weeklyDigest: {
            lastRunAt: isoDaysAgo(3),
            status: 'pass',
            summary: 'sent 4 digests',
          },
          // Exceeds 1d threshold -> STALE.
          governanceCi: {
            lastRunAt: isoDaysAgo(2),
            status: 'fail',
            summary: 'last gate failed',
          },
          // Exceeds 0.5d threshold -> STALE.
          alertWorker: {
            lastRunAt: isoDaysAgo(1),
            status: 'pass',
            summary: 'no transitions',
          },
        },
      })
    );

    const retention = findJob(report, 'retention_telemetry');
    const digest = findJob(report, 'weekly_digest');
    const ci = findJob(report, 'governance_ci_gate');
    const worker = findJob(report, 'alert_worker');

    expect(retention?.isStale).toBe(false);
    expect(retention?.lastRunStatus).toBe('pass');

    expect(digest?.isStale).toBe(false);

    expect(ci?.isStale).toBe(true);
    expect(ci?.lastRunStatus).toBe('fail');

    expect(worker?.isStale).toBe(true);
    expect(worker?.lastRunStatus).toBe('pass');
    expect(worker?.lastRunSummary).toBe('no transitions');
  });

  it('aggregates alerts only for rows inside the window', () => {
    const rows: BuildOperationsHealthInput['alertDispatchRows'] = [
      { status: 'sent', createdAt: isoDaysAgo(1), deckId: 'd1' },
      { status: 'sent', createdAt: isoDaysAgo(1), deckId: 'd1' },
      { status: 'failed', createdAt: isoDaysAgo(2), deckId: 'd2' },
      { status: 'suppressed', createdAt: isoDaysAgo(3), deckId: 'd3' },
      { status: 'dry_run', createdAt: isoDaysAgo(4), deckId: 'd4' },
      // Outside the 7d window — must be excluded.
      { status: 'sent', createdAt: isoDaysAgo(15), deckId: 'd_outside' },
    ];

    const report = buildOperationsHealthReport(
      baseInput({ alertDispatchRows: rows, pausedSubscriptionsCount: 2 })
    );

    expect(report.alerts.attempted).toBe(5);
    expect(report.alerts.sent).toBe(2);
    expect(report.alerts.failed).toBe(1);
    expect(report.alerts.suppressed).toBe(1);
    expect(report.alerts.dryRun).toBe(1);
    expect(report.alerts.uniqueDecks).toBe(4);
    expect(report.alerts.pausedSubscriptions).toBe(2);
  });

  it('populates warnings when key inputs are missing', () => {
    const report = buildOperationsHealthReport({
      organizationId: 'org_1',
      windowDays: 7,
      nowIso: NOW_ISO,
      // Intentionally omit / null out arrays to simulate failed queries.
      runtimeEvents: null as unknown as BuildOperationsHealthInput['runtimeEvents'],
      exportRecords: null as unknown as BuildOperationsHealthInput['exportRecords'],
      agentOperations: null as unknown as BuildOperationsHealthInput['agentOperations'],
      jobRuns: undefined as unknown as BuildOperationsHealthInput['jobRuns'],
      alertDispatchRows: null as unknown as BuildOperationsHealthInput['alertDispatchRows'],
      pausedSubscriptionsCount: 0,
    });

    expect(report.warnings).toEqual(
      expect.arrayContaining([
        'runtime_events_unavailable',
        'exports_unavailable',
        'agent_operations_unavailable',
        'alert_dispatches_unavailable',
        'job_runs_unavailable',
      ])
    );

    // We still emit the full SLO/job structure so the UI can render even
    // when every backend query failed.
    expect(report.slos).toHaveLength(5);
    expect(report.jobs).toHaveLength(4);
  });
});
