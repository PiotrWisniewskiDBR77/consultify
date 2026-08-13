import { describe, expect, it } from 'vitest';

import {
  containsTechnicalIdentifier,
  isTechnicalIdentifier,
  relationFallbackLabel,
  resolveBusinessDisplayLabel,
} from '../businessDisplayLabel';

describe('businessDisplayLabel', () => {
  it('prefers an explicit display name or title', () => {
    expect(
      resolveBusinessDisplayLabel({
        displayName: 'Linia pakująca — redukcja przezbrojenia',
        title: 'Fallback title',
        rawId: 'd585884f-6cd0-4be2-ae04-abaf0c223659',
      })
    ).toBe('Linia pakująca — redukcja przezbrojenia');
  });

  it('uses only the explicit role dictionary for technical role ids', () => {
    expect(resolveBusinessDisplayLabel({ rawId: 'execution-manager' })).toBe('Menedżer realizacji');
    expect(resolveBusinessDisplayLabel({ rawId: 'unknown-role-slug' })).toBe('Unknown');
  });

  it('fails closed for UUID and generated identifiers', () => {
    expect(
      resolveBusinessDisplayLabel({
        rawId: 'd585884f-6cd0-4be2-ae04-abaf0c223659',
        fallback: 'Powiązana inicjatywa',
      })
    ).toBe('Powiązana inicjatywa');
    expect(isTechnicalIdentifier('aco-plan-scenario-1786325712976')).toBe(true);
  });

  it('preserves explicit permission truth', () => {
    expect(
      resolveBusinessDisplayLabel({
        displayName: 'Name must not leak',
        restricted: true,
      })
    ).toBe('Restricted');
  });

  it('detects technical ids embedded in relation copy', () => {
    expect(containsTechnicalIdentifier('Realizacja · d585884f-6cd0-4be2-ae04-abaf0c223659')).toBe(
      true
    );
    expect(containsTechnicalIdentifier('Redukcja przezbrojenia linii')).toBe(false);
    expect(relationFallbackLabel('execution')).toBe('Powiązana realizacja');
  });
});
