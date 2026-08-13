import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SIRI_PRIORITISATION_AREAS } from '@/services/siriStructure';
import { SIRI_PM_V2_FLAG_KEYS } from '@/utils/siriPmV2Flag';

import { runSiriTier, siriTierActiveCalculationVersionFromFlag, siriTierAvailability } from '../siriTierView';

function frozenLevels(): Record<string, number> {
  const levels: Record<string, number> = {};
  SIRI_PRIORITISATION_AREAS.forEach((area, i) => {
    levels[area.id] = i % 6;
  });
  return levels;
}

beforeEach(() => {
  window.localStorage.removeItem(SIRI_PM_V2_FLAG_KEYS.localStorage);
});
afterEach(() => {
  window.localStorage.removeItem(SIRI_PM_V2_FLAG_KEYS.localStorage);
});

describe('SIRI TIER — unavailable before freeze (test 6)', () => {
  it('is unavailable for every non-frozen session state, with an explicit reason', () => {
    for (const state of ['draft', 'prepared', 'active', 'in_review', 'closed', 'archived']) {
      const availability = siriTierAvailability(state);
      expect(availability.available).toBe(false);
      expect(availability.reason).not.toBeNull();
      expect(availability.reason).toMatch(/freeze|zamr/i);
    }
  });

  it('is available once the session is frozen', () => {
    const availability = siriTierAvailability('frozen');
    expect(availability.available).toBe(true);
    expect(availability.reason).toBeNull();
  });
});

describe('SIRI TIER — default calculation version is legacy_v1 (test 7)', () => {
  it('siriTierActiveCalculationVersionFromFlag() reads OFF as legacy_v1 when the flag is untouched', () => {
    expect(siriTierActiveCalculationVersionFromFlag()).toBe('legacy_v1');
  });

  it('runSiriTier() without an explicit calculationVersion also resolves to legacy_v1 (flag off)', () => {
    const result = runSiriTier({
      frozenSnapshotId: 'snap-001',
      frozenUnitLevels: frozenLevels(),
      planningHorizon: 'tactical',
    });
    expect(result.calculationVersion).toBe('legacy_v1');
  });
});

describe('SIRI TIER — flag ON + explicit planningHorizon -> siri_pm_v2, focus per block (test 8)', () => {
  it('the SIRI_PM_V2 localStorage flag flips the "current" resolution to siri_pm_v2', () => {
    window.localStorage.setItem(SIRI_PM_V2_FLAG_KEYS.localStorage, '1');
    expect(siriTierActiveCalculationVersionFromFlag()).toBe('siri_pm_v2');
  });

  it('runSiriTier() with calculationVersion=siri_pm_v2 and a planningHorizon selects >=1 focus per building block plus the Step-8b bonus', () => {
    const result = runSiriTier({
      frozenSnapshotId: 'snap-002',
      frozenUnitLevels: frozenLevels(),
      planningHorizon: 'strategic',
      calculationVersion: 'siri_pm_v2',
    });

    expect(result.calculationVersion).toBe('siri_pm_v2');
    expect(result.planningHorizon).toBe('strategic');
    expect(result.ranked).toHaveLength(16);

    // >= 1 per block...
    for (const block of result.focusByBlock) {
      expect(block.focusAreaIds.length).toBeGreaterThanOrEqual(1);
    }
    // ...plus the Whitepaper Step 8 bonus dimension -> >= 4 total.
    expect(result.totalFocusCount).toBeGreaterThanOrEqual(4);
    expect(result.focusByBlock).toHaveLength(3);
  });

  it('every planning horizon preset weight sums to 1 and is shown explicitly alongside the version', () => {
    for (const horizon of ['strategic', 'tactical', 'operational'] as const) {
      const result = runSiriTier({
        frozenSnapshotId: 'snap-003',
        frozenUnitLevels: frozenLevels(),
        planningHorizon: horizon,
        calculationVersion: 'siri_pm_v2',
      });
      const sum = result.weights.cost + result.weights.kpi + result.weights.proximity;
      expect(sum).toBeCloseTo(1, 10);
      expect(result.parametersVersion).toContain(horizon);
    }
  });
});
