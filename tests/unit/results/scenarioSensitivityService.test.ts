import { describe, it, expect } from 'vitest';
import {
  npv,
  irr,
  paybackPeriod,
  runScenarios,
  sensitivity,
} from '../../../server/src/services/results/scenarioSensitivityService.js';

describe('scenarioSensitivityService', () => {
  describe('npv', () => {
    it('rate 0 = prosta suma przepływów', () => {
      expect(npv(0, [-100, 50, 70])).toBeCloseTo(20, 6);
    });

    it('dyskontuje przyszłe przepływy przy dodatniej stopie', () => {
      // -100 + 60/1.1 + 60/1.21 = -100 + 54.5454.. + 49.5867.. = 4.1322..
      expect(npv(0.1, [-100, 60, 60])).toBeCloseTo(4.13223, 4);
    });

    it('pusta tablica = 0', () => {
      expect(npv(0.1, [])).toBe(0);
    });

    it('przy stopie = IRR daje ~0', () => {
      const flows = [-1000, 300, 420, 680];
      const r = irr(flows)!;
      expect(npv(r, flows)).toBeCloseTo(0, 5);
    });
  });

  describe('irr', () => {
    it('znany przykład [-1000,500,500,500] ≈ 0.2337', () => {
      const r = irr([-1000, 500, 500, 500]);
      expect(r).not.toBeNull();
      expect(r!).toBeCloseTo(0.2337, 3);
    });

    it('prosty przykład [-100, 110] = 10%', () => {
      const r = irr([-100, 110]);
      expect(r).not.toBeNull();
      expect(r!).toBeCloseTo(0.1, 5);
    });

    it('null gdy brak zmiany znaku (same dodatnie)', () => {
      expect(irr([100, 200, 300])).toBeNull();
    });

    it('null gdy brak zmiany znaku (same ujemne)', () => {
      expect(irr([-100, -200, -300])).toBeNull();
    });

    it('null dla zbyt krótkich danych', () => {
      expect(irr([])).toBeNull();
      expect(irr([-100])).toBeNull();
    });

    it('weryfikacja: NPV przy zwróconej IRR ≈ 0', () => {
      const flows = [-500, 100, 200, 300, 100];
      const r = irr(flows)!;
      expect(npv(r, flows)).toBeCloseTo(0, 4);
    });
  });

  describe('paybackPeriod', () => {
    it('dokładny zwrot na całym okresie', () => {
      // skumulowane: -100, -50, 0 -> payback na okresie 2
      expect(paybackPeriod([-100, 50, 50])).toBeCloseTo(2, 6);
    });

    it('interpolacja w obrębie okresu', () => {
      // -100, -40, +20 -> przekroczenie 0 w okresie 2; prev=-40, cf=60 -> 1 + 40/60
      expect(paybackPeriod([-100, 60, 60])).toBeCloseTo(1 + 40 / 60, 6);
    });

    it('null gdy nigdy nie wraca na plus', () => {
      expect(paybackPeriod([-100, 10, 10])).toBeNull();
    });

    it('0 gdy start już dodatni', () => {
      expect(paybackPeriod([100, 50])).toBe(0);
    });

    it('null dla pustej tablicy', () => {
      expect(paybackPeriod([])).toBeNull();
    });
  });

  describe('runScenarios', () => {
    const base = { cashflows: [-1000, 500, 500, 500] };

    it('zwraca wynik per scenariusz z label/irr/npv/payback', () => {
      const out = runScenarios(base, [
        { label: 'pesymistyczny', multiplier: 0.8 },
        { label: 'bazowy', multiplier: 1.0 },
        { label: 'optymistyczny', multiplier: 1.2 },
      ]);
      expect(out).toHaveLength(3);
      expect(out.map((o) => o.label)).toEqual(['pesymistyczny', 'bazowy', 'optymistyczny']);
      for (const o of out) {
        expect(o).toHaveProperty('irr');
        expect(o).toHaveProperty('npv');
        expect(o).toHaveProperty('payback');
      }
    });

    it('bazowy (mult 1.0) zgodny z bezpośrednim liczeniem', () => {
      const [bazowy] = runScenarios(base, [{ label: 'bazowy', multiplier: 1.0 }]);
      expect(bazowy.irr!).toBeCloseTo(0.2337, 3);
      expect(bazowy.npv).toBeCloseTo(npv(0.1, base.cashflows), 6);
    });

    it('skaluje tylko dodatnie przepływy (capex nietknięty)', () => {
      const [pess] = runScenarios(base, [{ label: 'p', multiplier: 0.5 }]);
      // dodatnie 500 -> 250, capex -1000 bez zmian
      expect(pess.npv).toBeCloseTo(npv(0.1, [-1000, 250, 250, 250]), 6);
    });

    it('niższy mnożnik => niższy NPV', () => {
      const out = runScenarios(base, [
        { label: 'low', multiplier: 0.8 },
        { label: 'high', multiplier: 1.2 },
      ]);
      expect(out[0].npv).toBeLessThan(out[1].npv);
    });

    it('pusta lista scenariuszy => []', () => {
      expect(runScenarios(base, [])).toEqual([]);
    });
  });

  describe('sensitivity', () => {
    const base = { cashflows: [-1000, 500, 500, 500] };

    it('zwraca deltaPct/npv/irr per delta', () => {
      const out = sensitivity(base, [-0.1, 0, 0.1]);
      expect(out).toHaveLength(3);
      expect(out.map((o) => o.deltaPct)).toEqual([-0.1, 0, 0.1]);
      for (const o of out) {
        expect(o).toHaveProperty('npv');
        expect(o).toHaveProperty('irr');
      }
    });

    it('delta 0 = NPV bazowy przy rate domyślnym 0.1', () => {
      const [zero] = sensitivity(base, [0]);
      expect(zero.npv).toBeCloseTo(npv(0.1, base.cashflows), 6);
    });

    it('skaluje wszystkie przepływy o (1+delta)', () => {
      const [up] = sensitivity(base, [0.1]);
      const scaled = base.cashflows.map((c) => c * 1.1);
      expect(up.npv).toBeCloseTo(npv(0.1, scaled), 6);
    });

    it('honoruje niestandardową stopę', () => {
      const [zero] = sensitivity({ cashflows: base.cashflows, rate: 0.2 }, [0]);
      expect(zero.npv).toBeCloseTo(npv(0.2, base.cashflows), 6);
    });

    it('pusta lista delt => []', () => {
      expect(sensitivity(base, [])).toEqual([]);
    });
  });
});
