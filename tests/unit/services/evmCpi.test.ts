/**
 * M14/F2 — CPI lands once actual cost is supplied.
 */
import { describe, expect, it } from 'vitest';

import { deriveInitiativeEvm, derivePortfolioEvm } from '../../../server/src/services/evmService.js';

const asOf = new Date('2026-07-01').getTime();

describe('EVM CPI with actual cost', () => {
  it('deriveInitiativeEvm yields a real CPI when actualCost present', () => {
    const r = deriveInitiativeEvm(
      { bac: 1000, plannedStart: '2026-01-01', plannedEnd: '2026-12-31', progressPct: 40, actualCost: 450 },
      asOf
    );
    expect(r).not.toBeNull();
    expect(r!.ev).toBe(400); // 40% × 1000
    expect(r!.cpi).toBe(0.89); // 400/450
    expect(r!.cv).toBe(-50); // over budget
  });

  it('portfolio CPI is null without actuals, real with actuals', () => {
    const noAc = derivePortfolioEvm(
      [{ bac: 1000, plannedStart: '2026-01-01', plannedEnd: '2026-12-31', progressPct: 40 }],
      asOf
    );
    expect(noAc!.cpi).toBeNull();
    const withAc = derivePortfolioEvm(
      [{ bac: 1000, plannedStart: '2026-01-01', plannedEnd: '2026-12-31', progressPct: 40, actualCost: 400 }],
      asOf
    );
    expect(withAc!.cpi).toBe(1); // 400/400
  });
});
