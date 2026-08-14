import { describe, it, expect } from 'vitest';
import { siriAdapter } from '@/method-core/methods/siri/siriAdapter';
import { calculateImpactValue, rankByImpactValueV2, SIRI_PM_WEIGHT_PRESETS } from '@/services/siriPrioritisation';

const frozen = { vertical_integration: 2, horizontal_integration: 1, integrated_product_lifecycle: 3,
  shop_floor_automation: 2, enterprise_automation: 1, facility_automation: 2,
  shop_floor_connectivity: 3, enterprise_connectivity: 2, facility_connectivity: 1,
  shop_floor_intelligence: 1, enterprise_intelligence: 2, facility_intelligence: 1,
  workforce_learning: 3, leadership_competency: 2, strategy_governance: 2, inter_intra_collaboration: 1 };

describe('COORD-08 zero cichej zmiany', () => {
  it('★ BEZ FLAGI domyslna sciezka to legacy_v1', () => {
    const r = siriAdapter.prioritise!({ frozenUnitLevels: frozen, parameters: { sessionState: 'frozen', frozenSnapshotId: 'snap-1', planningHorizon: 'strategic' } });
    expect((r as any).calculationVersion).toBe('legacy_v1');
  });

  it('v2 wchodzi TYLKO przez jawny parametr', () => {
    const r = siriAdapter.prioritise!({ frozenUnitLevels: frozen,
      parameters: { sessionState: 'frozen', frozenSnapshotId: 'snap-1', calculationVersion: 'siri_pm_v2', planningHorizon: 'strategic' } });
    expect((r as any).calculationVersion).toBe('siri_pm_v2');
  });

  it('★ prioritise() ODRZUCA dane niezamrozone', () => {
    expect(() => siriAdapter.prioritise!({ frozenUnitLevels: {} as never, parameters: {} })).toThrow();
  });

  it('trzy presety sumuja sie do 1 i sa te z Figure 12', () => {
    expect(SIRI_PM_WEIGHT_PRESETS.strategic).toEqual({ cost: 0.30, kpi: 0.40, proximity: 0.30 });
    expect(SIRI_PM_WEIGHT_PRESETS.tactical).toEqual({ cost: 0.45, kpi: 0.30, proximity: 0.25 });
    expect(SIRI_PM_WEIGHT_PRESETS.operational).toEqual({ cost: 0.60, kpi: 0.20, proximity: 0.20 });
    for (const p of Object.values(SIRI_PM_WEIGHT_PRESETS)) {
      expect(p.cost + p.kpi + p.proximity).toBeCloseTo(1, 9);
    }
  });

  it('★ v2 obcina ujemny Proximity do zera (defekt 2 naprawiony)', () => {
    const r = rankByImpactValueV2(
      [{ areaId: 'vertical_integration', costRelevance: 0, costProfile: 0,
         kpiRelevance: 0, kpiImportance: 0, bic: 1, ams: 5 }], 'strategic');
    expect(r[0].impactValue).toBeGreaterThanOrEqual(0);
    // a legacy nadal daje ujemny — dowod, ze legacy NIE zostal cicho poprawiony
    const legacy = calculateImpactValue({ areaId: 'x', costRelevance: 0, costProfile: 0,
      kpiRelevance: 0, kpiImportance: 0, bic: 1, ams: 5 });
    expect(legacy).toBeLessThan(0);
  });
});
