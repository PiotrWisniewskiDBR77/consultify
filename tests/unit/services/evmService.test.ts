/**
 * M14/F2 — EVM core + initiative derivation.
 */
import { describe, expect, it } from 'vitest';

import {
  computeEvm,
  deriveInitiativeEvm,
  evmScheduleHealth,
} from '../../../server/src/services/evmService.js';

describe('evmScheduleHealth — M14/2.4 SPI-driven health', () => {
  it('maps SPI 1.0 → 100 (on schedule)', () => {
    expect(evmScheduleHealth(1)).toBe(100);
  });
  it('maps SPI 0.8 → 80 (20% behind)', () => {
    expect(evmScheduleHealth(0.8)).toBe(80);
  });
  it('caps over-performance at 100 (SPI 1.3)', () => {
    expect(evmScheduleHealth(1.3)).toBe(100);
  });
  it('floors at 0 for zero SPI', () => {
    expect(evmScheduleHealth(0)).toBe(0);
  });
  it('returns null when SPI is unknown (no baseline coverage)', () => {
    expect(evmScheduleHealth(null)).toBeNull();
    expect(evmScheduleHealth(undefined)).toBeNull();
    expect(evmScheduleHealth(Number.NaN)).toBeNull();
  });
});

describe('computeEvm — ANSI-748 indices', () => {
  it('computes SPI/CPI/variances/EAC for a behind-and-over project', () => {
    const r = computeEvm({ bac: 1000, pv: 500, ev: 400, ac: 450 });
    expect(r.spi).toBe(0.8); // 400/500
    expect(r.cpi).toBe(0.89); // 400/450 ≈ 0.888 → 0.89
    expect(r.sv).toBe(-100); // 400-500
    expect(r.cv).toBe(-50); // 400-450
    expect(r.eac).toBeCloseTo(1125, 0); // 1000/0.888
    expect(r.vac).toBeLessThan(0); // over budget at completion
    expect(r.rag).toBe('RED'); // SPI 0.8 < 0.85
  });

  it('healthy project is GREEN', () => {
    const r = computeEvm({ bac: 1000, pv: 500, ev: 490, ac: 480 });
    expect(r.spi).toBe(0.98);
    expect(r.rag).toBe('GREEN');
  });

  it('null indices when PV or AC is zero', () => {
    expect(computeEvm({ bac: 100, pv: 0, ev: 0, ac: 0 }).spi).toBeNull();
    expect(computeEvm({ bac: 100, pv: 50, ev: 20, ac: 0 }).cpi).toBeNull();
  });
});

describe('deriveInitiativeEvm — schedule + budget → EVM', () => {
  const start = '2026-01-01';
  const end = '2026-12-31';
  const mid = new Date('2026-07-01').getTime();

  it('milestone-weighted EV when milestones exist', () => {
    const r = deriveInitiativeEvm(
      {
        bac: 1000,
        plannedStart: start,
        plannedEnd: end,
        actualCost: 400,
        milestones: [
          { weight: 0.25, done: true },
          { weight: 0.25, done: true },
          { weight: 0.25, done: false },
          { weight: 0.25, done: false },
        ],
      },
      mid
    );
    expect(r).not.toBeNull();
    expect(r!.ev).toBe(500); // 50% of milestone weight done
    expect(r!.pv).toBeCloseTo(497, -1); // ~half the schedule elapsed at mid-year
  });

  it('falls back to % complete when no milestones', () => {
    const r = deriveInitiativeEvm(
      { bac: 1000, plannedStart: start, plannedEnd: end, actualCost: 300, progressPct: 30 },
      mid
    );
    expect(r!.ev).toBe(300); // 30% × 1000
  });

  it('returns null without a cost baseline (BAC ≤ 0)', () => {
    expect(deriveInitiativeEvm({ bac: 0, progressPct: 50 }, mid)).toBeNull();
  });
});

import { derivePortfolioEvm } from '../../../server/src/services/evmService.js';

describe('derivePortfolioEvm — roll-up + coverage', () => {
  const asOf = new Date('2026-07-01').getTime();
  it('aggregates baselined initiatives and reports coverage', () => {
    const r = derivePortfolioEvm(
      [
        { bac: 1000, plannedStart: '2026-01-01', plannedEnd: '2026-12-31', progressPct: 30 },
        { bac: 500, plannedStart: '2026-01-01', plannedEnd: '2026-12-31', progressPct: 60 },
        { bac: 0, progressPct: 50 }, // no baseline → skipped
      ],
      asOf
    );
    expect(r).not.toBeNull();
    expect(r!.contributing).toBe(2);
    expect(r!.coverage).toBeCloseTo(0.67, 1);
    expect(r!.ev).toBe(600); // 300 + 300
  });
  it('null when no initiative has a cost baseline', () => {
    expect(derivePortfolioEvm([{ bac: 0, progressPct: 10 }], asOf)).toBeNull();
  });
});
