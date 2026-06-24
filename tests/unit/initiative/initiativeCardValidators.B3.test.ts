import { describe, expect, it } from 'vitest';

import {
  validateCardStructure,
  kpiBaselineTarget,
  raidMix,
  scopeOutMece,
  scopeInCount,
  deliverablesCount,
  successCount,
  killCount,
  milestonesCount,
  roiSizing,
  ownerAssigned,
  CARD_STRUCT_VALIDATORS,
  type CardStructRule,
} from '../../../server/src/services/initiative/initiativeCardValidators.js';

const n = (count: number) => Array.from({ length: count }, (_, i) => `pozycja ${i + 1}`);

describe('initiativeCardValidators §B3 structural (F3.1)', () => {
  // 1. kpi_baseline_target ---------------------------------------------------
  describe('kpi_baseline_target', () => {
    it('pass: ≥1 KPI with baseline→target + unit', () => {
      const r = kpiBaselineTarget({
        kpis: [{ name: 'TTR', baseline: 10, target: 4, unit: 'dni' }],
      });
      expect(r.pass).toBe(true);
    });
    it('fail: KPI missing target', () => {
      const r = kpiBaselineTarget({ kpis: [{ baseline: 10, unit: 'dni' }] });
      expect(r.pass).toBe(false);
    });
    it('fail: no kpis field at all (tolerant)', () => {
      const r = kpiBaselineTarget({});
      expect(r.pass).toBe(false);
      expect(r.id).toBe('kpi_baseline_target');
    });
  });

  // 2. raid_mix --------------------------------------------------------------
  describe('raid_mix', () => {
    it('pass: ≥2 RISK + ≥1 ASSUMPTION + ≥1 DEPENDENCY', () => {
      const r = raidMix({
        key_risks: [
          { type: 'RISK', text: 'a' },
          { type: 'RISK', text: 'b' },
          { type: 'ASSUMPTION', text: 'c' },
          { category: 'DEPENDENCY', text: 'd' },
        ],
      });
      expect(r.pass).toBe(true);
    });
    it('fail: only 1 RISK, no assumption/dependency', () => {
      const r = raidMix({ key_risks: [{ type: 'RISK', text: 'a' }] });
      expect(r.pass).toBe(false);
    });
    it('fail: empty raid (tolerant)', () => {
      expect(raidMix(null).pass).toBe(false);
    });
  });

  // 3. scope_out_mece --------------------------------------------------------
  describe('scope_out_mece', () => {
    it('pass: scope_out ≥3', () => {
      expect(scopeOutMece({ scope_out: n(3) }).pass).toBe(true);
    });
    it('fail: scope_out <3', () => {
      expect(scopeOutMece({ scope_out: n(2) }).pass).toBe(false);
    });
    it('fail: missing scope_out', () => {
      expect(scopeOutMece({}).pass).toBe(false);
    });
  });

  // 4. scope_in_count --------------------------------------------------------
  describe('scope_in_count', () => {
    it('pass: scope_in ≥3', () => {
      expect(scopeInCount({ scope_in: n(4) }).pass).toBe(true);
    });
    it('fail: scope_in <3', () => {
      expect(scopeInCount({ scope_in: n(1) }).pass).toBe(false);
    });
  });

  // 5. deliverables_count ----------------------------------------------------
  describe('deliverables_count', () => {
    it('pass: deliverables ≥4', () => {
      expect(deliverablesCount({ deliverables: n(4) }).pass).toBe(true);
    });
    it('fail: deliverables <4', () => {
      expect(deliverablesCount({ deliverables: n(3) }).pass).toBe(false);
    });
  });

  // 6. success_count ---------------------------------------------------------
  describe('success_count', () => {
    it('pass: success_criteria ≥4', () => {
      expect(successCount({ success_criteria: n(5) }).pass).toBe(true);
    });
    it('fail: success_criteria <4', () => {
      expect(successCount({ success_criteria: n(2) }).pass).toBe(false);
    });
  });

  // 7. kill_count ------------------------------------------------------------
  describe('kill_count', () => {
    it('pass: kill_criteria ≥2', () => {
      expect(killCount({ kill_criteria: n(2) }).pass).toBe(true);
    });
    it('fail: kill_criteria <2', () => {
      expect(killCount({ kill_criteria: n(1) }).pass).toBe(false);
    });
  });

  // 8. milestones_count ------------------------------------------------------
  describe('milestones_count', () => {
    it('pass: milestones ≥3', () => {
      expect(milestonesCount({ milestones: n(3) }).pass).toBe(true);
    });
    it('fail: milestones <3', () => {
      expect(milestonesCount({ milestones: [] }).pass).toBe(false);
    });
  });

  // 9. roi_sizing ------------------------------------------------------------
  describe('roi_sizing', () => {
    it('pass: expected_roi present', () => {
      expect(roiSizing({ expected_roi: 1.4 }).pass).toBe(true);
    });
    it('pass: cost_capex present', () => {
      expect(roiSizing({ cost_capex: 50000 }).pass).toBe(true);
    });
    it('fail: no sizing at all', () => {
      expect(roiSizing({}).pass).toBe(false);
    });
  });

  // 10. owner_assigned -------------------------------------------------------
  describe('owner_assigned', () => {
    it('pass: owner_business_id present', () => {
      expect(ownerAssigned({ owner_business_id: 'u-123' }).pass).toBe(true);
    });
    it('pass: ownerId alias present', () => {
      expect(ownerAssigned({ ownerId: 'u-456' }).pass).toBe(true);
    });
    it('fail: no owner', () => {
      expect(ownerAssigned({}).pass).toBe(false);
    });
  });

  // aggregator ---------------------------------------------------------------
  describe('validateCardStructure aggregator', () => {
    it('runs all 10 rules and never throws on empty card', () => {
      const results = validateCardStructure({});
      expect(results).toHaveLength(10);
      expect(results.every((r) => r.pass === false)).toBe(true);
    });
    it('runs a subset when rules passed', () => {
      const rules: CardStructRule[] = ['owner_assigned', 'roi_sizing'];
      const results = validateCardStructure({ owner_id: 'u-1', cost_opex: 100 }, rules);
      expect(results.map((r) => r.id)).toEqual(rules);
      expect(results.every((r) => r.pass)).toBe(true);
    });
    it('registry exposes exactly 10 validators', () => {
      expect(Object.keys(CARD_STRUCT_VALIDATORS)).toHaveLength(10);
    });
    it('tolerates null/undefined card without throwing', () => {
      expect(() => validateCardStructure(null)).not.toThrow();
      expect(() => validateCardStructure(undefined)).not.toThrow();
    });
  });
});
