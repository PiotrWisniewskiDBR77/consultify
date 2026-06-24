import { describe, it, expect } from 'vitest';
import {
  workingCapitalSchedule,
  debtSchedule,
  depreciationSchedule,
  taxSchedule,
} from '../../../server/src/services/financeSchedulesService.js';

describe('financeSchedulesService', () => {
  // ─── Working Capital ────────────────────────────────────────────────────
  describe('workingCapitalSchedule', () => {
    it('derives AR from DSO, Inventory from DIO, AP from DPO', () => {
      const rows = workingCapitalSchedule({
        periods: [{ revenue: 365_000, cogs: 365_000 }],
        dso: 30,
        dpo: 45,
        dio: 60,
      });

      expect(rows).toHaveLength(1);
      const r = rows[0];
      // AR = 365000 * 30 / 365 = 30000
      expect(r.ar).toBe(30_000);
      // Inventory = 365000 * 60 / 365 = 60000
      expect(r.inventory).toBe(60_000);
      // AP = 365000 * 45 / 365 = 45000
      expect(r.ap).toBe(45_000);
      // NWC = 30000 + 60000 - 45000 = 45000
      expect(r.netWorkingCapital).toBe(45_000);
      // First period delta == build-up of NWC from 0
      expect(r.deltaWC).toBe(45_000);
    });

    it('computes deltaWC as change vs prior period NWC', () => {
      const rows = workingCapitalSchedule({
        periods: [
          { revenue: 365_000, cogs: 0 }, // AR = 30000, NWC = 30000
          { revenue: 730_000, cogs: 0 }, // AR = 60000, NWC = 60000
        ],
        dso: 30,
        dpo: 0,
        dio: 0,
      });

      expect(rows[0].netWorkingCapital).toBe(30_000);
      expect(rows[1].netWorkingCapital).toBe(60_000);
      // delta in period 1 = 60000 - 30000 = 30000
      expect(rows[1].deltaWC).toBe(30_000);
    });
  });

  // ─── Debt ───────────────────────────────────────────────────────────────
  describe('debtSchedule', () => {
    it('charges interest on the opening balance and amortizes principal', () => {
      const rows = debtSchedule({
        openingDebt: 1_000,
        annualRatePct: 10,
        periods: 3,
        repaymentPerPeriod: 200,
      });

      expect(rows).toHaveLength(3);

      // Period 0: opening 1000, interest = 1000 * 10% = 100, repay 200, closing 800
      expect(rows[0].opening).toBe(1_000);
      expect(rows[0].interest).toBe(100);
      expect(rows[0].principalRepayment).toBe(200);
      expect(rows[0].closing).toBe(800);

      // Period 1: opening 800, interest = 80, closing 600
      expect(rows[1].opening).toBe(800);
      expect(rows[1].interest).toBe(80);
      expect(rows[1].closing).toBe(600);

      // Period 2: opening 600, interest = 60, closing 400
      expect(rows[2].opening).toBe(600);
      expect(rows[2].interest).toBe(60);
      expect(rows[2].closing).toBe(400);
    });

    it('opening balances are strictly non-increasing and interest decreases as principal amortizes', () => {
      const rows = debtSchedule({
        openingDebt: 1_000,
        annualRatePct: 10,
        periods: 3,
        repaymentPerPeriod: 200,
      });
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].opening).toBeLessThan(rows[i - 1].opening);
        expect(rows[i].interest).toBeLessThan(rows[i - 1].interest);
      }
    });

    it('does not repay more principal than outstanding and applies drawdowns', () => {
      const rows = debtSchedule({
        openingDebt: 100,
        annualRatePct: 0,
        periods: 2,
        repaymentPerPeriod: 500,
        drawdowns: [0, 1_000],
      });
      // Period 0: only 100 outstanding -> repay capped at 100, closing 0
      expect(rows[0].principalRepayment).toBe(100);
      expect(rows[0].closing).toBe(0);
      // Period 1: drawdown 1000 -> available 1000, repay 500, closing 500
      expect(rows[1].drawdown).toBe(1_000);
      expect(rows[1].principalRepayment).toBe(500);
      expect(rows[1].closing).toBe(500);
    });
  });

  // ─── Depreciation ─────────────────────────────────────────────────────────
  describe('depreciationSchedule', () => {
    it('straight-line charges sum to the depreciable cost over its life', () => {
      // cost 1000, life 4 -> 250/period for 4 periods = 1000 total
      const rows = depreciationSchedule({
        openingPPE: 1_000,
        usefulLifeYears: 4,
        capexByPeriod: [0, 0, 0, 0],
        method: 'straight_line',
      });

      expect(rows).toHaveLength(4);
      rows.forEach((r) => expect(r.depreciation).toBe(250));

      const totalDep = rows.reduce((s, r) => s + r.depreciation, 0);
      expect(totalDep).toBe(1_000);
      // Fully depreciated: final NBV = 0, accumulated = cost
      expect(rows[3].nbv).toBe(0);
      expect(rows[3].accumulated).toBe(1_000);
    });

    it('declining-balance front-loads depreciation and never goes below zero NBV', () => {
      const rows = depreciationSchedule({
        openingPPE: 1_000,
        usefulLifeYears: 5,
        capexByPeriod: [0, 0, 0],
        method: 'declining',
      });
      // Double-declining rate = 2/5 = 0.4. Period 0: 1000*0.4 = 400.
      expect(rows[0].depreciation).toBe(400);
      // Front-loaded: each charge >= the next
      expect(rows[0].depreciation).toBeGreaterThan(rows[1].depreciation);
      expect(rows[1].depreciation).toBeGreaterThan(rows[2].depreciation);
      rows.forEach((r) => expect(r.nbv).toBeGreaterThanOrEqual(0));
    });
  });

  // ─── Tax ────────────────────────────────────────────────────────────────
  describe('taxSchedule', () => {
    it('taxes only positive EBT at the given rate', () => {
      const rows = taxSchedule({ ebtByPeriod: [1_000], taxRatePct: 19 });
      // 1000 * 19% = 190
      expect(rows[0].tax).toBe(190);
      expect(rows[0].nol).toBe(0);
    });

    it('carries forward losses (NOL) to shelter future profits', () => {
      const rows = taxSchedule({
        ebtByPeriod: [-500, 300, 400],
        taxRatePct: 20,
      });

      // Period 0: loss 500 -> no tax, NOL = 500
      expect(rows[0].tax).toBe(0);
      expect(rows[0].nol).toBe(500);

      // Period 1: profit 300, fully sheltered by NOL -> tax 0, NOL = 200
      expect(rows[1].tax).toBe(0);
      expect(rows[1].nol).toBe(200);

      // Period 2: profit 400, 200 sheltered -> taxable 200, tax = 40, NOL = 0
      expect(rows[2].tax).toBe(40);
      expect(rows[2].nol).toBe(0);
    });

    it('never produces negative tax on a loss period', () => {
      const rows = taxSchedule({ ebtByPeriod: [-1_000], taxRatePct: 25 });
      expect(rows[0].tax).toBe(0);
      expect(rows[0].nol).toBe(1_000);
    });
  });
});
