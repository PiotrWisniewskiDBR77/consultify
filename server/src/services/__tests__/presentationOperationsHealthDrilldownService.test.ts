import { describe, expect, it } from 'vitest';

import {
  buildSloDrilldownReport,
  classifySloStatus,
  type BuildSloDrilldownInput,
  type DrilldownSloId,
} from '../presentationOperationsHealthDrilldownService.js';

const NOW_ISO = '2026-05-10T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const DAY_MS = 86_400_000;

function isoDaysAgo(days: number): string {
  return new Date(NOW_MS - days * DAY_MS).toISOString();
}

function baseInput(
  sloId: DrilldownSloId,
  overrides: Partial<BuildSloDrilldownInput> = {}
): BuildSloDrilldownInput {
  return {
    sloId,
    windowDays: 7,
    bucketDays: 1,
    nowIso: NOW_ISO,
    runtimeEvents: [],
    exportRecords: [],
    agentOperations: [],
    decks: [],
    ...overrides,
  };
}

describe('presentationOperationsHealthDrilldownService', () => {
  it('returns empty buckets / inconclusive trend / empty top decks for empty input', () => {
    const report = buildSloDrilldownReport(baseInput('generation_success_rate'));

    expect(report.sloId).toBe('generation_success_rate');
    expect(report.bucketDays).toBe(1);
    expect(report.trend).toHaveLength(7);
    for (const point of report.trend) {
      expect(point.status).toBe('inconclusive');
      expect(point.observedNumeric).toBeNull();
      expect(point.sampleSize).toBe(0);
    }
    expect(report.topProblematicDecks).toEqual([]);
    expect(report.recentSamples).toEqual([]);
  });

  it('builds 7 daily passing buckets for generation_success_rate when proposals dominate', () => {
    const ops: BuildSloDrilldownInput['agentOperations'] = [];
    // 19 applied + 1 failed per day, for 7 days → 95% per bucket → pass.
    for (let day = 0; day < 7; day += 1) {
      // Place at noon on each day to avoid bucket boundary edge cases.
      const at = new Date(NOW_MS - (day + 0.5) * DAY_MS).toISOString();
      for (let i = 0; i < 19; i += 1) {
        ops.push({
          deckId: `deck_${day}_${i}`,
          status: 'applied',
          operationType: 'agent_edit',
          createdAt: at,
        });
      }
      ops.push({
        deckId: `deck_${day}_fail`,
        status: 'failed',
        operationType: 'agent_edit',
        createdAt: at,
      });
    }

    const report = buildSloDrilldownReport(
      baseInput('generation_success_rate', { agentOperations: ops })
    );

    expect(report.trend).toHaveLength(7);
    for (const point of report.trend) {
      expect(point.sampleSize).toBe(20);
      expect(point.observedNumeric).toBeCloseTo(95, 1);
      expect(point.status).toBe('pass');
    }
  });

  it('computes export_success_rate per bucket from mixed completed/failed exports', () => {
    const exports: BuildSloDrilldownInput['exportRecords'] = [
      // Most recent day: 2 completed / 1 failed → 66.7%.
      { deckId: 'd1', status: 'completed', format: 'pptx', durationMs: 1000, createdAt: isoDaysAgo(0.2) },
      { deckId: 'd1', status: 'completed', format: 'pptx', durationMs: 1100, createdAt: isoDaysAgo(0.3) },
      { deckId: 'd1', status: 'failed', format: 'pptx', durationMs: 500, createdAt: isoDaysAgo(0.4) },
      // 2 days ago: 1 completed / 0 failed → 100%.
      { deckId: 'd2', status: 'completed', format: 'pdf', durationMs: 2000, createdAt: isoDaysAgo(2.5) },
      // 4 days ago: 0 completed / 1 failed → 0%.
      { deckId: 'd3', status: 'failed', format: 'pdf', durationMs: 4000, createdAt: isoDaysAgo(4.5) },
    ];

    const report = buildSloDrilldownReport(
      baseInput('export_success_rate', { exportRecords: exports })
    );

    const newestBucket = report.trend[report.trend.length - 1]!;
    expect(newestBucket.sampleSize).toBe(3);
    expect(newestBucket.observedNumeric).toBeCloseTo(66.7, 1);
    // 0% bucket is a hard breach.
    const breachBucket = report.trend.find((p) => p.observedNumeric === 0);
    expect(breachBucket?.status).toBe('breach');
  });

  it('marks p95_generation_latency_ms inconclusive in buckets with < 10 samples', () => {
    const exports: BuildSloDrilldownInput['exportRecords'] = Array.from(
      { length: 5 },
      (_, i) => ({
        deckId: `d_${i}`,
        status: 'completed',
        format: 'pptx',
        durationMs: 4000,
        createdAt: isoDaysAgo(0.2),
      })
    );

    const report = buildSloDrilldownReport(
      baseInput('p95_generation_latency_ms', { exportRecords: exports })
    );

    const newestBucket = report.trend[report.trend.length - 1]!;
    expect(newestBucket.sampleSize).toBe(5);
    expect(newestBucket.status).toBe('inconclusive');
  });

  it('orders topProblematicDecks correctly for export_success_rate (most failures first)', () => {
    const exports: BuildSloDrilldownInput['exportRecords'] = [
      // d_winner: 5 failures
      ...Array.from({ length: 5 }, (_, i) => ({
        deckId: 'd_winner',
        status: 'failed',
        format: 'pptx',
        durationMs: 1000 + i,
        createdAt: isoDaysAgo(1),
      })),
      { deckId: 'd_winner', status: 'completed', format: 'pptx', durationMs: 800, createdAt: isoDaysAgo(1) },
      // d_runner: 3 failures
      ...Array.from({ length: 3 }, () => ({
        deckId: 'd_runner',
        status: 'failed' as const,
        format: 'pdf',
        durationMs: 900,
        createdAt: isoDaysAgo(2),
      })),
      // d_clean: 0 failures, 5 completed
      ...Array.from({ length: 5 }, () => ({
        deckId: 'd_clean',
        status: 'completed' as const,
        format: 'pptx',
        durationMs: 700,
        createdAt: isoDaysAgo(2),
      })),
    ];

    const report = buildSloDrilldownReport(
      baseInput('export_success_rate', {
        exportRecords: exports,
        decks: [
          { id: 'd_winner', title: 'Winner Deck' },
          { id: 'd_runner', title: 'Runner Deck' },
          { id: 'd_clean', title: 'Clean Deck' },
        ],
      })
    );

    expect(report.topProblematicDecks[0]).toMatchObject({
      deckId: 'd_winner',
      title: 'Winner Deck',
      failureCount: 5,
      totalCount: 6,
    });
    expect(report.topProblematicDecks[1]).toMatchObject({
      deckId: 'd_runner',
      failureCount: 3,
    });
    // d_clean has 0 failures but should appear LAST or be excluded.
    const cleanRow = report.topProblematicDecks.find((d) => d.deckId === 'd_clean');
    if (cleanRow) {
      expect(cleanRow.failureCount).toBe(0);
    }
  });

  it('caps topProblematicDecks at 5 entries', () => {
    const exports: BuildSloDrilldownInput['exportRecords'] = [];
    for (let i = 0; i < 12; i += 1) {
      const failures = 12 - i;
      for (let f = 0; f < failures; f += 1) {
        exports.push({
          deckId: `deck_${i}`,
          status: 'failed',
          format: 'pptx',
          durationMs: 1000,
          createdAt: isoDaysAgo(1 + (i % 5)),
        });
      }
    }

    const report = buildSloDrilldownReport(
      baseInput('export_success_rate', { exportRecords: exports })
    );

    expect(report.topProblematicDecks.length).toBeLessThanOrEqual(5);
    expect(report.topProblematicDecks).toHaveLength(5);
    // First entry should be deck_0 (12 failures, the most).
    expect(report.topProblematicDecks[0]?.deckId).toBe('deck_0');
  });

  it('uses an allow-listed excerpt format for recent samples', () => {
    const exports: BuildSloDrilldownInput['exportRecords'] = [
      {
        deckId: 'deck_a',
        status: 'failed',
        format: 'pptx',
        durationMs: 18234,
        createdAt: isoDaysAgo(0.5),
      },
      {
        deckId: 'deck_b',
        status: 'completed',
        format: 'pdf',
        durationMs: 4321,
        createdAt: isoDaysAgo(0.6),
      },
    ];

    const report = buildSloDrilldownReport(
      baseInput('export_success_rate', { exportRecords: exports })
    );

    expect(report.recentSamples).toHaveLength(2);
    const failed = report.recentSamples.find((s) => s.deckId === 'deck_a');
    const ok = report.recentSamples.find((s) => s.deckId === 'deck_b');
    expect(failed?.excerpt).toMatch(/^Export failed: PPTX \d/);
    expect(ok?.excerpt).toMatch(/^Export completed: PDF \d/);
    // Excerpts are short, allow-listed phrases — never raw JSON or payload.
    for (const sample of report.recentSamples) {
      expect(sample.excerpt).not.toMatch(/[{}]/);
      expect(sample.excerpt?.length ?? 0).toBeLessThan(80);
    }
  });

  it('caps recentSamples at 8 entries and orders newest-first', () => {
    const exports: BuildSloDrilldownInput['exportRecords'] = [];
    for (let i = 0; i < 30; i += 1) {
      exports.push({
        deckId: `deck_${i}`,
        status: i % 2 === 0 ? 'completed' : 'failed',
        format: 'pptx',
        durationMs: 1000 + i,
        // Spread across days within window. Use 0..6 day offset.
        createdAt: isoDaysAgo(0.1 + (i % 7) * 0.5),
      });
    }

    const report = buildSloDrilldownReport(
      baseInput('export_success_rate', { exportRecords: exports })
    );

    expect(report.recentSamples).toHaveLength(8);
    for (let i = 1; i < report.recentSamples.length; i += 1) {
      const prev = Date.parse(report.recentSamples[i - 1]!.occurredAt);
      const curr = Date.parse(report.recentSamples[i]!.occurredAt);
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it('excludes events outside the windowDays bucket boundaries', () => {
    const exports: BuildSloDrilldownInput['exportRecords'] = [
      { deckId: 'in', status: 'failed', format: 'pptx', durationMs: 100, createdAt: isoDaysAgo(2) },
      // Way outside the 7-day window — must be ignored.
      { deckId: 'out', status: 'failed', format: 'pptx', durationMs: 100, createdAt: isoDaysAgo(40) },
    ];

    const report = buildSloDrilldownReport(
      baseInput('export_success_rate', { exportRecords: exports })
    );

    const allDeckIds = report.topProblematicDecks.map((d) => d.deckId);
    expect(allDeckIds).toContain('in');
    expect(allDeckIds).not.toContain('out');

    const sampleDeckIds = report.recentSamples.map((s) => s.deckId);
    expect(sampleDeckIds).not.toContain('out');
  });

  it('classifySloStatus matches Sprint 10 thresholds for generation_success_rate', () => {
    expect(classifySloStatus('generation_success_rate', 96, 50)).toBe('pass');
    expect(classifySloStatus('generation_success_rate', 92, 50)).toBe('at_risk');
    expect(classifySloStatus('generation_success_rate', 80, 50)).toBe('breach');
    expect(classifySloStatus('generation_success_rate', null, 0)).toBe('inconclusive');
    expect(classifySloStatus('generation_success_rate', 99, 0)).toBe('inconclusive');
  });

  it('classifySloStatus matches Sprint 10 thresholds for p95 latency and export_blocked_rate', () => {
    // p95 latency: <= 8000 pass, 8000..12000 at_risk, > 12000 breach. Needs >= 10 samples.
    expect(classifySloStatus('p95_generation_latency_ms', 4000, 20)).toBe('pass');
    expect(classifySloStatus('p95_generation_latency_ms', 10_000, 20)).toBe('at_risk');
    expect(classifySloStatus('p95_generation_latency_ms', 15_000, 20)).toBe('breach');
    expect(classifySloStatus('p95_generation_latency_ms', 4000, 5)).toBe('inconclusive');

    // blocked rate: <= 10% pass, 10..25 at_risk, > 25 breach.
    expect(classifySloStatus('export_blocked_rate', 5, 100)).toBe('pass');
    expect(classifySloStatus('export_blocked_rate', 20, 100)).toBe('at_risk');
    expect(classifySloStatus('export_blocked_rate', 40, 100)).toBe('breach');
  });
});
