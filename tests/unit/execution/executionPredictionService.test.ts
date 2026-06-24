/**
 * M14/F7 — heuristic prediction (leading indicators).
 */
import { describe, expect, it } from 'vitest';

import {
  predictDelayRisk,
  predictInitiative,
  predictOverrunRisk,
} from '../../../server/src/services/executionPredictionService.js';

describe('executionPredictionService', () => {
  it('healthy initiative → LOW delay risk', () => {
    const r = predictDelayRisk({ spi: 0.98, slipDays: 0, slipTrend: 'flat', blockers: 0 });
    expect(r.level).toBe('LOW');
  });

  it('severely behind + worsening + blocker → HIGH/CRITICAL delay risk', () => {
    const r = predictDelayRisk({ spi: 0.7, slipDays: 15, slipTrend: 'worsening', blockers: 1, percentComplete: 0.3 });
    expect(['HIGH', 'CRITICAL']).toContain(r.level);
    expect(r.reasons.length).toBeGreaterThan(2);
  });

  it('improving trend lowers the score', () => {
    const worse = predictDelayRisk({ spi: 0.88, slipDays: 5, slipTrend: 'worsening' });
    const better = predictDelayRisk({ spi: 0.88, slipDays: 5, slipTrend: 'improving' });
    expect(better.score).toBeLessThan(worse.score);
  });

  it('CPI overrun → HIGH overrun risk', () => {
    const r = predictOverrunRisk({ cpi: 0.78, spi: 0.85 });
    expect(['HIGH', 'CRITICAL']).toContain(r.level);
  });

  it('combined: open high risks bump the overall level', () => {
    const base = predictInitiative({ spi: 0.9, cpi: 0.92, slipDays: 3 });
    const amplified = predictInitiative({ spi: 0.9, cpi: 0.92, slipDays: 3, openHighRisks: 4 });
    const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    expect(order.indexOf(amplified.overall)).toBeGreaterThanOrEqual(order.indexOf(base.overall));
  });
});
