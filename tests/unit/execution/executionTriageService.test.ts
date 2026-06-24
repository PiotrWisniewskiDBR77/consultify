import { describe, expect, it } from 'vitest';

import {
  actionForType,
  groupByInitiative,
  triageSignals,
  type Signal,
} from '../../../server/src/services/executionTriageService.js';

const sig = (over: Partial<Signal> & Pick<Signal, 'id' | 'type' | 'severity' | 'title'>): Signal =>
  over;

describe('triageSignals', () => {
  it('sorts by severity CRITICAL > HIGH > MEDIUM > LOW', () => {
    const signals: Signal[] = [
      sig({ id: 's-low', type: 'STALE_INITIATIVE', severity: 'LOW', title: 'Low one' }),
      sig({ id: 's-crit', type: 'APPETITE_BREACH', severity: 'CRITICAL', title: 'Critical one' }),
      sig({ id: 's-med', type: 'OVERDUE_TASK', severity: 'MEDIUM', title: 'Medium one' }),
      sig({ id: 's-high', type: 'BLOCKED_LONG', severity: 'HIGH', title: 'High one' }),
    ];

    const { prioritized } = triageSignals(signals);

    expect(prioritized.map((p) => p.signal.id)).toEqual(['s-crit', 's-high', 's-med', 's-low']);
    expect(prioritized.map((p) => p.rank)).toEqual([1, 2, 3, 4]);
  });

  it('preserves input order for equal severity (stable, deterministic)', () => {
    const signals: Signal[] = [
      sig({ id: 'a', type: 'UNOWNED_RISK', severity: 'HIGH', title: 'A' }),
      sig({ id: 'b', type: 'UNOWNED_RISK', severity: 'HIGH', title: 'B' }),
      sig({ id: 'c', type: 'UNOWNED_RISK', severity: 'HIGH', title: 'C' }),
    ];

    const { prioritized } = triageSignals(signals);
    expect(prioritized.map((p) => p.signal.id)).toEqual(['a', 'b', 'c']);
  });

  it('rationale cites the concrete signal (id, type, severity, title) — no invented facts', () => {
    const signals: Signal[] = [
      sig({
        id: 'risk-42',
        type: 'UNOWNED_RISK',
        severity: 'HIGH',
        title: 'No owner on migration risk',
        initiativeId: 'init-7',
      }),
    ];

    const { prioritized } = triageSignals(signals);
    const rationale = prioritized[0].rationale;

    // Grounded: cites each field present on the signal.
    expect(rationale).toContain('risk-42');
    expect(rationale).toContain('UNOWNED_RISK');
    expect(rationale).toContain('HIGH');
    expect(rationale).toContain('No owner on migration risk');
    expect(rationale).toContain('init-7');
  });

  it('rationale does not reference initiative when signal has none', () => {
    const signals: Signal[] = [
      sig({ id: 's1', type: 'BLOCKED_LONG', severity: 'MEDIUM', title: 'Stuck task' }),
    ];

    const { prioritized } = triageSignals(signals);
    expect(prioritized[0].rationale).not.toContain('initiative');
    expect(prioritized[0].rationale).toContain('Stuck task');
  });

  it('summary counts per severity', () => {
    const signals: Signal[] = [
      sig({ id: '1', type: 'APPETITE_BREACH', severity: 'CRITICAL', title: 'x' }),
      sig({ id: '2', type: 'APPETITE_BREACH', severity: 'CRITICAL', title: 'y' }),
      sig({ id: '3', type: 'BLOCKED_LONG', severity: 'HIGH', title: 'z' }),
      sig({ id: '4', type: 'OVERDUE_TASK', severity: 'MEDIUM', title: 'w' }),
      sig({ id: '5', type: 'STALE_INITIATIVE', severity: 'LOW', title: 'v' }),
    ];

    const { summary } = triageSignals(signals);
    expect(summary).toContain('5 signal(s)');
    expect(summary).toContain('2 critical');
    expect(summary).toContain('1 high');
    expect(summary).toContain('1 medium');
    expect(summary).toContain('1 low');
  });

  it('topActions maps known types to actions, de-duplicated, in priority order', () => {
    const signals: Signal[] = [
      sig({ id: '1', type: 'APPETITE_BREACH', severity: 'CRITICAL', title: 'a' }),
      sig({ id: '2', type: 'BLOCKED_LONG', severity: 'HIGH', title: 'b' }),
      sig({ id: '3', type: 'UNOWNED_RISK', severity: 'MEDIUM', title: 'c' }),
      // duplicate type — action must not repeat
      sig({ id: '4', type: 'APPETITE_BREACH', severity: 'LOW', title: 'd' }),
    ];

    const { topActions } = triageSignals(signals);
    expect(topActions).toEqual(['escalate to sponsor', 'unblock', 'assign owner']);
  });

  it('actionForType returns mapped action per type and a grounded fallback for unknowns', () => {
    expect(actionForType('APPETITE_BREACH')).toBe('escalate to sponsor');
    expect(actionForType('BLOCKED_LONG')).toBe('unblock');
    expect(actionForType('UNOWNED_RISK')).toBe('assign owner');
    expect(actionForType('SOMETHING_UNKNOWN')).toBe('review and triage manually');
  });

  it('handles empty input deterministically', () => {
    const { summary, prioritized, topActions } = triageSignals([]);
    expect(prioritized).toEqual([]);
    expect(topActions).toEqual([]);
    expect(summary).toContain('0 signal(s)');
  });
});

describe('groupByInitiative', () => {
  it('groups signals by initiativeId', () => {
    const signals: Signal[] = [
      sig({ id: '1', type: 'OVERDUE_TASK', severity: 'HIGH', title: 'a', initiativeId: 'init-1' }),
      sig({ id: '2', type: 'BLOCKED_LONG', severity: 'LOW', title: 'b', initiativeId: 'init-2' }),
      sig({ id: '3', type: 'UNOWNED_RISK', severity: 'HIGH', title: 'c', initiativeId: 'init-1' }),
    ];

    const grouped = groupByInitiative(signals);
    expect(grouped.get('init-1')?.map((s) => s.id)).toEqual(['1', '3']);
    expect(grouped.get('init-2')?.map((s) => s.id)).toEqual(['2']);
  });

  it('collects signals without an initiativeId under __unassigned__', () => {
    const signals: Signal[] = [
      sig({ id: '1', type: 'OVERDUE_TASK', severity: 'HIGH', title: 'a' }),
      sig({ id: '2', type: 'BLOCKED_LONG', severity: 'LOW', title: 'b', initiativeId: 'init-9' }),
    ];

    const grouped = groupByInitiative(signals);
    expect(grouped.get('__unassigned__')?.map((s) => s.id)).toEqual(['1']);
    expect(grouped.get('init-9')?.map((s) => s.id)).toEqual(['2']);
  });

  it('returns an empty map for empty input', () => {
    expect(groupByInitiative([]).size).toBe(0);
  });
});
