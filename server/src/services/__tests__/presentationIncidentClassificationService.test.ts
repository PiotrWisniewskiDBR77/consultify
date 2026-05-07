import { describe, expect, it } from 'vitest';

import {
  classifyIncident,
  EXPORT_BLOCKED_RATE_BREACH,
  EXPORT_SUCCESS_RATE_BREACH,
  LATENCY_BREACH_MS,
  MIN_TEMPLATE_CLUSTER_SIZE,
  type IncidentSignals,
} from '../presentationIncidentClassificationService.js';

function healthySignals(
  overrides: Partial<IncidentSignals> = {}
): IncidentSignals {
  return {
    exportBlockedRate: 0.02,
    exportSuccessRate: 0.99,
    p95GenerationLatencyMs: 5_000,
    blockedP0DecksCount: 0,
    blockedP0SharedTemplateId: null,
    anomalies: [],
    ...overrides,
  };
}

describe('classifyIncident', () => {
  it('returns no-incident envelope for healthy signals', () => {
    const result = classifyIncident(healthySignals());
    expect(result.runbook).toBeNull();
    expect(result.severity).toBeNull();
    expect(result.reason).toBe('No incident detected');
    expect(result.recommendedActions).toEqual([]);
  });

  it('classifies template corruption as P0/RB-04 when shared template + cluster size met', () => {
    const result = classifyIncident(
      healthySignals({
        blockedP0DecksCount: MIN_TEMPLATE_CLUSTER_SIZE,
        blockedP0SharedTemplateId: 'tmpl_abc',
      })
    );
    expect(result.runbook).toBe('RB-04');
    expect(result.severity).toBe('P0');
    expect(result.reason).toContain('tmpl_abc');
    expect(result.recommendedActions).toHaveLength(3);
    expect(result.recommendedActions[0]).toMatch(/deprecate/i);
  });

  it('does NOT classify template corruption when cluster size is below threshold', () => {
    const result = classifyIncident(
      healthySignals({
        blockedP0DecksCount: MIN_TEMPLATE_CLUSTER_SIZE - 1,
        blockedP0SharedTemplateId: 'tmpl_abc',
      })
    );
    expect(result.runbook).toBeNull();
  });

  it('classifies low export success rate as P1/RB-02', () => {
    const result = classifyIncident(
      healthySignals({ exportSuccessRate: 0.85 })
    );
    expect(result.runbook).toBe('RB-02');
    expect(result.severity).toBe('P1');
    expect(result.reason).toContain('export_success_rate');
    expect(result.recommendedActions).toHaveLength(3);
    expect(result.recommendedActions[0]).toMatch(/error_reason/);
  });

  it('classifies a major anomaly on export_success_rate as RB-02 even when raw rate is null', () => {
    const result = classifyIncident(
      healthySignals({
        exportSuccessRate: null,
        anomalies: [{ sloId: 'export_success_rate', severity: 'major' }],
      })
    );
    expect(result.runbook).toBe('RB-02');
    expect(result.severity).toBe('P1');
    expect(result.reason.toLowerCase()).toContain('anomaly');
  });

  it('classifies high latency as P1/RB-03', () => {
    const result = classifyIncident(
      healthySignals({ p95GenerationLatencyMs: LATENCY_BREACH_MS + 1_000 })
    );
    expect(result.runbook).toBe('RB-03');
    expect(result.severity).toBe('P1');
    expect(result.reason).toContain('p95_generation_latency_ms');
    expect(result.recommendedActions).toHaveLength(3);
    expect(result.recommendedActions[0]).toMatch(/in_progress/);
  });

  it('classifies a major anomaly on p95_generation_latency_ms as RB-03', () => {
    const result = classifyIncident(
      healthySignals({
        p95GenerationLatencyMs: 1_000,
        anomalies: [{ sloId: 'p95_generation_latency_ms', severity: 'major' }],
      })
    );
    expect(result.runbook).toBe('RB-03');
    expect(result.severity).toBe('P1');
  });

  it('classifies high blocked rate as P1/RB-01', () => {
    const result = classifyIncident(
      healthySignals({ exportBlockedRate: EXPORT_BLOCKED_RATE_BREACH + 0.05 })
    );
    expect(result.runbook).toBe('RB-01');
    expect(result.severity).toBe('P1');
    expect(result.reason).toContain('export_blocked_rate');
    expect(result.recommendedActions).toHaveLength(3);
    expect(result.recommendedActions[0]).toMatch(/auto-publish/i);
  });

  it('honors priority order: template corruption beats export-success failure', () => {
    const result = classifyIncident(
      healthySignals({
        blockedP0DecksCount: MIN_TEMPLATE_CLUSTER_SIZE + 5,
        blockedP0SharedTemplateId: 'tmpl_x',
        exportSuccessRate: 0.05,
      })
    );
    expect(result.runbook).toBe('RB-04');
    expect(result.severity).toBe('P0');
  });

  it('honors priority order: export success beats latency beats blocked rate', () => {
    const r1 = classifyIncident(
      healthySignals({
        exportSuccessRate: 0.5,
        p95GenerationLatencyMs: LATENCY_BREACH_MS + 5_000,
        exportBlockedRate: EXPORT_BLOCKED_RATE_BREACH + 0.5,
      })
    );
    expect(r1.runbook).toBe('RB-02');
    const r2 = classifyIncident(
      healthySignals({
        exportSuccessRate: 0.99,
        p95GenerationLatencyMs: LATENCY_BREACH_MS + 5_000,
        exportBlockedRate: EXPORT_BLOCKED_RATE_BREACH + 0.5,
      })
    );
    expect(r2.runbook).toBe('RB-03');
  });

  it('returns runbook=null with manual reason when there is a major anomaly on a non-mapped SLO', () => {
    const result = classifyIncident(
      healthySignals({
        anomalies: [
          { sloId: 'agent_edit_success_rate', severity: 'major' },
        ],
      })
    );
    expect(result.runbook).toBeNull();
    expect(result.severity).toBeNull();
    expect(result.reason).toMatch(/manually/i);
    expect(result.recommendedActions).toEqual([]);
  });

  it('treats minor anomalies on mapped SLOs as no-incident (only major fires the runbook)', () => {
    const result = classifyIncident(
      healthySignals({
        anomalies: [
          { sloId: 'export_success_rate', severity: 'minor' },
          { sloId: 'export_blocked_rate', severity: 'minor' },
        ],
      })
    );
    expect(result.runbook).toBeNull();
    expect(result.severity).toBeNull();
    expect(result.reason).toBe('No incident detected');
  });

  it('output is JSON-serializable', () => {
    const result = classifyIncident(
      healthySignals({
        blockedP0DecksCount: MIN_TEMPLATE_CLUSTER_SIZE,
        blockedP0SharedTemplateId: 'tmpl_abc',
      })
    );
    const round = JSON.parse(JSON.stringify(result));
    expect(round).toEqual(result);
  });

  it('never throws on malformed inputs', () => {
    expect(() => classifyIncident(null)).not.toThrow();
    expect(() => classifyIncident(undefined)).not.toThrow();
    expect(() =>
      classifyIncident({
        exportBlockedRate: Number.NaN,
        exportSuccessRate: Number.POSITIVE_INFINITY,
        p95GenerationLatencyMs: Number.NEGATIVE_INFINITY,
        blockedP0DecksCount: -7,
        blockedP0SharedTemplateId: '',
        // @ts-expect-error intentional garbage to test resilience
        anomalies: 'definitely-not-an-array',
      })
    ).not.toThrow();
    expect(() =>
      // @ts-expect-error intentional garbage to test resilience
      classifyIncident({ this: { is: { not: 'a signal' } } })
    ).not.toThrow();
  });

  it('returns healthy envelope for null/undefined input', () => {
    const a = classifyIncident(null);
    const b = classifyIncident(undefined);
    expect(a).toEqual({
      runbook: null,
      severity: null,
      reason: 'No incident detected',
      recommendedActions: [],
    });
    expect(b).toEqual(a);
  });

  it('classification is deterministic for identical inputs', () => {
    const sig: IncidentSignals = healthySignals({
      exportSuccessRate: EXPORT_SUCCESS_RATE_BREACH - 0.01,
    });
    const a = classifyIncident(sig);
    const b = classifyIncident(sig);
    const c = classifyIncident(sig);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('coerces non-integer / negative blockedP0DecksCount safely', () => {
    const r1 = classifyIncident(
      healthySignals({
        blockedP0DecksCount: -5,
        blockedP0SharedTemplateId: 'tmpl_abc',
      })
    );
    expect(r1.runbook).toBeNull();
    const r2 = classifyIncident(
      healthySignals({
        blockedP0DecksCount: 3.9,
        blockedP0SharedTemplateId: 'tmpl_abc',
      })
    );
    expect(r2.runbook).toBe('RB-04');
  });
});
