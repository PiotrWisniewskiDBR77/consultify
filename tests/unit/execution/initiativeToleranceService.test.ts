/**
 * M14/F3 — per-initiative tolerances (manage-by-exception).
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TOLERANCES,
  evaluateToleranceBreaches,
  isException,
  resolveTolerances,
} from '../../../server/src/services/initiativeToleranceService.js';

describe('initiativeToleranceService', () => {
  it('resolves overrides over defaults; ignores invalid', () => {
    const t = resolveTolerances({ scheduleDays: 14, costPct: -1 as any });
    expect(t.scheduleDays).toBe(14);
    expect(t.costPct).toBe(DEFAULT_TOLERANCES.costPct); // invalid → default
    expect(t.riskCount).toBe(DEFAULT_TOLERANCES.riskCount);
  });

  it('no breach when within tolerance', () => {
    expect(isException({ slipDays: 3, costOverrunPct: 0.05, openHighRisks: 1 })).toBe(false);
  });

  it('breach when schedule slip exceeds tolerance', () => {
    const b = evaluateToleranceBreaches({ slipDays: 10 });
    expect(b.map((x) => x.dimension)).toContain('scheduleDays');
  });

  it('breach when cost overrun exceeds tolerance', () => {
    expect(isException({ costOverrunPct: 0.2 })).toBe(true); // > 10% default
  });

  it('per-initiative tolerance widens the band', () => {
    const wide = resolveTolerances({ scheduleDays: 30 });
    expect(isException({ slipDays: 10 }, wide)).toBe(false); // within 30
    expect(isException({ slipDays: 10 })).toBe(true); // breaches default 7
  });
});
