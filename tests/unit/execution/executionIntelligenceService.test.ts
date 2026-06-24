/**
 * M14 — Execution Intelligence (server-side fusion of EVM + prediction + triage).
 *
 * Pure service, no DB. Fix `now` so EVM time-phasing + slip are deterministic.
 */
import { describe, expect, it } from 'vitest';

import {
  buildExecutionIntelligence,
  type ExecutionIntelligenceInput,
} from '../../../server/src/services/executionIntelligenceService.js';

// Fixed as-of: 2026-06-24.
const NOW = new Date('2026-06-24T00:00:00.000Z').getTime();
const day = (iso: string) => iso;

describe('executionIntelligenceService.buildExecutionIntelligence', () => {
  it('behind-schedule initiative → HIGH/CRITICAL prediction and appears in triage', () => {
    // Planned Jan→Mar 2026 (long past end), only 30% done, big budget, overspent,
    // plus blockers and high risks → strong delay + overrun signal.
    const input: ExecutionIntelligenceInput = {
      initiatives: [
        {
          id: 'init-late',
          name: 'Late Initiative',
          status: 'EXECUTING',
          progress: 30,
          cost_capex: 80000,
          cost_opex: 20000,
          planned_start_date: day('2026-01-01'),
          planned_end_date: day('2026-03-01'),
          actual_cost: 90000,
        },
      ],
      blockedTaskCountByInitiative: { 'init-late': 2 },
      openHighRiskCountByInitiative: { 'init-late': 3 },
    };

    const out = buildExecutionIntelligence(input, NOW);

    expect(out.predictions).toHaveLength(1);
    const p = out.predictions[0];
    expect(p.initiativeId).toBe('init-late');
    expect(['HIGH', 'CRITICAL']).toContain(p.overall);
    expect(p.slipDays).toBeGreaterThan(0);
    expect(p.spi).not.toBeNull();
    expect(p.cpi).not.toBeNull();
    expect(p.reasons.length).toBeGreaterThan(0);

    // It is surfaced as a grounded triage signal.
    const triaged = out.triage.prioritized.map((x) => x.signal.id);
    expect(triaged).toContain('init-late');
    expect(out.triage.prioritized[0].signal.type).toBe('PREDICTED_RISK');

    // Summary counts it as at-risk.
    expect(out.summary.atRisk).toBe(1);
  });

  it('healthy initiative → LOW and NOT in triage', () => {
    // On schedule (ends in the future), nearly complete, on budget, no blockers.
    const input: ExecutionIntelligenceInput = {
      initiatives: [
        {
          id: 'init-ok',
          name: 'Healthy Initiative',
          status: 'EXECUTING',
          progress: 95,
          cost_capex: 50000,
          cost_opex: 0,
          planned_start_date: day('2026-01-01'),
          planned_end_date: day('2026-12-31'),
          actual_cost: 47000,
        },
      ],
    };

    const out = buildExecutionIntelligence(input, NOW);

    expect(out.predictions).toHaveLength(1);
    expect(out.predictions[0].overall).toBe('LOW');
    expect(out.predictions[0].slipDays).toBe(0);

    // Not surfaced in triage, not at-risk.
    expect(out.triage.prioritized).toHaveLength(0);
    expect(out.summary.atRisk).toBe(0);
    expect(out.summary.countByLevel.LOW).toBe(1);
  });

  it('skips non-EXECUTING/BLOCKED statuses (DONE / PLANNING)', () => {
    const input: ExecutionIntelligenceInput = {
      initiatives: [
        {
          id: 'init-done',
          name: 'Finished',
          status: 'DONE',
          progress: 100,
          cost_capex: 10000,
          cost_opex: 0,
          planned_start_date: day('2026-01-01'),
          planned_end_date: day('2026-02-01'),
          actual_cost: 9000,
        },
        {
          id: 'init-planning',
          name: 'Not started',
          status: 'PLANNING',
          progress: 0,
          cost_capex: 10000,
          cost_opex: 0,
          planned_start_date: day('2026-09-01'),
          planned_end_date: day('2026-12-01'),
          actual_cost: 0,
        },
      ],
    };

    const out = buildExecutionIntelligence(input, NOW);
    expect(out.predictions).toHaveLength(0);
    expect(out.triage.prioritized).toHaveLength(0);
    expect(out.summary.atRisk).toBe(0);
  });

  it('summary.atRisk counts only HIGH + CRITICAL across the portfolio', () => {
    const input: ExecutionIntelligenceInput = {
      initiatives: [
        // at-risk (late + overspent)
        {
          id: 'a',
          name: 'A',
          status: 'EXECUTING',
          progress: 20,
          cost_capex: 100000,
          cost_opex: 0,
          planned_start_date: day('2026-01-01'),
          planned_end_date: day('2026-02-01'),
          actual_cost: 120000,
        },
        // at-risk (BLOCKED + late)
        {
          id: 'b',
          name: 'B',
          status: 'BLOCKED',
          progress: 25,
          cost_capex: 100000,
          cost_opex: 0,
          planned_start_date: day('2026-01-01'),
          planned_end_date: day('2026-03-01'),
          actual_cost: 110000,
        },
        // healthy
        {
          id: 'c',
          name: 'C',
          status: 'EXECUTING',
          progress: 90,
          cost_capex: 50000,
          cost_opex: 0,
          planned_start_date: day('2026-01-01'),
          planned_end_date: day('2026-12-31'),
          actual_cost: 45000,
        },
      ],
      blockedTaskCountByInitiative: { a: 1, b: 2 },
      openHighRiskCountByInitiative: { a: 3, b: 3 },
    };

    const out = buildExecutionIntelligence(input, NOW);
    expect(out.predictions).toHaveLength(3);
    expect(out.summary.atRisk).toBe(
      out.summary.countByLevel.HIGH + out.summary.countByLevel.CRITICAL
    );
    expect(out.summary.atRisk).toBeGreaterThanOrEqual(2);
    // every at-risk prediction is in the triage list
    expect(out.triage.prioritized.length).toBe(out.summary.atRisk);
  });

  it('no cost baseline (BAC ≤ 0) → SPI/CPI null but still scored via slip/blockers', () => {
    const input: ExecutionIntelligenceInput = {
      initiatives: [
        {
          id: 'no-budget',
          name: 'No budget',
          status: 'EXECUTING',
          progress: 10,
          cost_capex: 0,
          cost_opex: 0,
          planned_start_date: day('2026-01-01'),
          planned_end_date: day('2026-02-01'),
          actual_cost: 0,
        },
      ],
      blockedTaskCountByInitiative: { 'no-budget': 2 },
    };

    const out = buildExecutionIntelligence(input, NOW);
    expect(out.predictions).toHaveLength(1);
    expect(out.predictions[0].spi).toBeNull();
    expect(out.predictions[0].cpi).toBeNull();
    expect(out.predictions[0].slipDays).toBeGreaterThan(0);
  });
});
