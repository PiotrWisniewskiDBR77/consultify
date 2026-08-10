/**
 * Unit tests for `presentationStudioLayoutCapacityRegistryService` (Sprint S13).
 *
 * Verifies:
 *   - Canonical defaults exposed via `_snapshotRegistryForTests` match
 *     the numbers committed in S10 + S11. Drift is intentional and must
 *     be surfaced by these tests.
 *   - `applyOverrides` validates input strictly: any malformed entry
 *     causes the whole payload to be rejected; partial mutation is
 *     impossible.
 *   - Successful overrides merge — they raise / lower individual cap
 *     fields per density, per family, without touching unrelated
 *     entries.
 *   - `resolveSlotCapacity` returns the live cap (canonical or
 *     overridden), including for raw deck-type aliases.
 *   - `resetToDefaults` snaps state back to the canonical baseline.
 *   - The registry is process-global; tests must reset in `beforeEach`
 *     to stay isolated.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  _snapshotRegistryForTests,
  applyOverrides,
  getCurrentRegistrySnapshot,
  normalizeTemplateFamily,
  resetToDefaults,
  resolveSlotCapacity,
} from '../presentationStudioLayoutCapacityRegistryService.js';

describe('presentationStudioLayoutCapacityRegistryService', () => {
  beforeEach(() => {
    resetToDefaults();
  });

  it('exposes the canonical density baselines as defaults', () => {
    const snap = _snapshotRegistryForTests();
    expect(snap.densityBudgets.visual).toEqual({
      titleMaxChars: 80,
      keyMessageMaxChars: 160,
      blocksMax: 4,
    });
    expect(snap.densityBudgets.balanced).toEqual({
      titleMaxChars: 90,
      keyMessageMaxChars: 240,
      blocksMax: 6,
    });
    expect(snap.densityBudgets.document).toEqual({
      titleMaxChars: 110,
      keyMessageMaxChars: 360,
      blocksMax: 8,
    });
  });

  it('exposes the registered template-family overrides as defaults', () => {
    const snap = _snapshotRegistryForTests();
    expect(Object.keys(snap.templateFamilyOverrides).sort()).toEqual([
      'Board Decision Deck',
      'DRD Diagnostic Deck',
      'Steering Committee Deck',
    ]);
    expect(snap.templateFamilyOverrides['Steering Committee Deck'].balanced?.titleMaxChars).toBe(
      110
    );
  });

  it('exposes the registered raw-deck-type aliases as defaults', () => {
    const snap = _snapshotRegistryForTests();
    expect(snap.familyAliasByDeckType.steering_committee).toBe('Steering Committee Deck');
    expect(snap.familyAliasByDeckType.program_update).toBe('Steering Committee Deck');
  });

  it('resolveSlotCapacity falls back to the canonical baseline for an unknown family', () => {
    expect(resolveSlotCapacity('balanced', 'Unknown Family')).toEqual({
      titleMaxChars: 90,
      keyMessageMaxChars: 240,
      blocksMax: 6,
    });
  });

  it('resolveSlotCapacity normalizes raw deck-type aliases before override lookup', () => {
    expect(resolveSlotCapacity('balanced', 'steering_committee')).toEqual({
      titleMaxChars: 110, // override
      keyMessageMaxChars: 280,
      blocksMax: 7,
    });
  });

  it('applyOverrides merges per-family caps without touching unrelated entries', () => {
    const result = applyOverrides({
      templateFamilyOverrides: {
        'Steering Committee Deck': {
          balanced: { titleMaxChars: 200 },
        },
      },
    });
    expect(result.ok).toBe(true);
    expect(result.applied).toBe(true);

    // The overridden field is updated…
    expect(resolveSlotCapacity('balanced', 'Steering Committee Deck').titleMaxChars).toBe(200);
    // …other fields on the same family / density remain.
    expect(resolveSlotCapacity('balanced', 'Steering Committee Deck').keyMessageMaxChars).toBe(280);
    // …other families remain untouched.
    expect(resolveSlotCapacity('balanced', 'Board Decision Deck').titleMaxChars).toBe(100);
  });

  it('applyOverrides raises a global density baseline that flows into resolveSlotCapacity', () => {
    applyOverrides({
      densityBudgets: {
        visual: { titleMaxChars: 200 },
      },
    });
    expect(resolveSlotCapacity('visual', null).titleMaxChars).toBe(200);
  });

  it('applyOverrides registers a new alias that maps to a canonical family', () => {
    applyOverrides({
      familyAliasByDeckType: {
        product_strategy_deck: 'Steering Committee Deck',
      },
    });
    expect(normalizeTemplateFamily('product_strategy_deck')).toBe('Steering Committee Deck');
    // The alias route must reach the override (110 = Steering balanced cap).
    expect(resolveSlotCapacity('balanced', 'product_strategy_deck').titleMaxChars).toBe(110);
  });

  it('applyOverrides rejects unknown density keys without partial mutation', () => {
    const result = applyOverrides({
      densityBudgets: {
        // @ts-expect-error - intentionally invalid shape
        compact: { titleMaxChars: 999 },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.applied).toBe(false);
    expect(result.errors[0]?.path).toBe('densityBudgets.compact');
    // State is unchanged.
    expect(resolveSlotCapacity('visual', null).titleMaxChars).toBe(80);
  });

  it('applyOverrides rejects non-positive numbers and negative values', () => {
    const result = applyOverrides({
      densityBudgets: {
        visual: { titleMaxChars: -10 },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.path === 'densityBudgets.visual.titleMaxChars')).toBe(true);
    // State is unchanged.
    expect(resolveSlotCapacity('visual', null).titleMaxChars).toBe(80);
  });

  it('applyOverrides rejects unknown cap fields (typo guard)', () => {
    const result = applyOverrides({
      densityBudgets: {
        // @ts-expect-error - intentionally invalid shape
        visual: { titleMaxCharz: 200 },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.path === 'densityBudgets.visual.titleMaxCharz')).toBe(true);
  });

  it('applyOverrides rejects non-string alias values', () => {
    const result = applyOverrides({
      familyAliasByDeckType: {
        // @ts-expect-error - intentionally invalid
        product_strategy_deck: 12345,
      },
    });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.path === 'familyAliasByDeckType.product_strategy_deck')
    ).toBe(true);
  });

  it('applyOverrides accepts a payload that only sets one section', () => {
    const result = applyOverrides({
      familyAliasByDeckType: { quarterly_review: 'Steering Committee Deck' },
    });
    expect(result.ok).toBe(true);
    expect(_snapshotRegistryForTests().familyAliasByDeckType.quarterly_review).toBe(
      'Steering Committee Deck'
    );
  });

  it('resetToDefaults snaps state back to canonical baselines', () => {
    applyOverrides({ densityBudgets: { visual: { titleMaxChars: 200 } } });
    expect(resolveSlotCapacity('visual', null).titleMaxChars).toBe(200);
    resetToDefaults();
    expect(resolveSlotCapacity('visual', null).titleMaxChars).toBe(80);
  });

  it('keeps tenant-scoped overrides isolated from global defaults and other tenants (S23)', () => {
    applyOverrides({ densityBudgets: { balanced: { titleMaxChars: 123 } } }, 'org-A');

    expect(resolveSlotCapacity('balanced', null, 'org-A').titleMaxChars).toBe(123);
    expect(resolveSlotCapacity('balanced', null, 'org-B').titleMaxChars).toBe(90);
    expect(resolveSlotCapacity('balanced', null).titleMaxChars).toBe(90);
    expect(getCurrentRegistrySnapshot('org-A').densityBudgets.balanced.titleMaxChars).toBe(123);
    expect(getCurrentRegistrySnapshot('org-B').densityBudgets.balanced.titleMaxChars).toBe(90);
  });

  it('resetToDefaults(organizationId) drops only that tenant override (S23)', () => {
    applyOverrides({ densityBudgets: { balanced: { titleMaxChars: 123 } } }, 'org-A');
    applyOverrides({ densityBudgets: { balanced: { titleMaxChars: 140 } } }, 'org-B');

    resetToDefaults('org-A');

    expect(resolveSlotCapacity('balanced', null, 'org-A').titleMaxChars).toBe(90);
    expect(resolveSlotCapacity('balanced', null, 'org-B').titleMaxChars).toBe(140);
  });
});
