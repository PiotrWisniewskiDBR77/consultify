import { describe, expect, it } from 'vitest';

import {
  RUNTIME_ELIGIBLE_TOOL_TYPES,
  canStartToolSession,
  isLibraryVisible,
  isRuntimeActive,
} from '../toolAvailability.js';

/** 12 narzędzi bez silnika — oznaczone „coming soon". */
const COMING_SOON = [
  'vsm-builder',
  'constraint-control',
  'decision-engine',
  'control-tower',
  'automation-pipeline',
  'robotics-feasibility',
  'logistics-automation',
  'integration-diagnostic',
  'digital-value-pool',
  'legacy-analyzer',
  'data-inventory',
  'pain-to-solution',
];

const ALL_31 = [...RUNTIME_ELIGIBLE_TOOL_TYPES, ...COMING_SOON];

describe('rozdział trzech pojęć dostępności', () => {
  it('roster to dokładnie 31 narzędzi: 19 z silnikiem + 12 coming soon', () => {
    expect(RUNTIME_ELIGIBLE_TOOL_TYPES.size).toBe(19);
    expect(COMING_SOON).toHaveLength(12);
    expect(new Set(ALL_31).size).toBe(31);
  });

  // 1. LIBRARY
  it('WSZYSTKIE 31 są widoczne w Library', () => {
    ALL_31.forEach((t) => {
      expect(isLibraryVisible(t), `${t} niewidoczne w Library`).toBe(true);
    });
  });

  it('12 coming-soon JEST widocznych — to wymóg, nie efekt uboczny', () => {
    COMING_SOON.forEach((t) => expect(isLibraryVisible(t)).toBe(true));
  });

  // 2. SESJA
  it('12 coming-soon NIE MOŻE uruchomić sesji', () => {
    COMING_SOON.forEach((t) => {
      expect(canStartToolSession(t), `${t} nie powinno startować`).toBe(false);
    });
  });

  it('19 z silnikiem może uruchomić sesję', () => {
    [...RUNTIME_ELIGIBLE_TOOL_TYPES].forEach((t) => {
      expect(canStartToolSession(t), `${t} powinno startować`).toBe(true);
    });
  });

  it('flaga coming_soon w wierszu blokuje start mimo silnika', () => {
    expect(canStartToolSession('dynamic-swot', { is_active: 1, is_coming_soon: 1 })).toBe(false);
  });

  it('wyłączenie w bazie blokuje start', () => {
    expect(canStartToolSession('dynamic-swot', { is_active: 0 })).toBe(false);
  });

  // Kluczowe: baza nie może włączyć narzędzia, które nie ma silnika.
  it('is_active=1 w bazie NIE włącza narzędzia bez silnika', () => {
    expect(canStartToolSession('vsm-builder', { is_active: 1, is_coming_soon: 0 })).toBe(false);
  });

  // 3. RUNTIME ACTIVE
  const SHA = 'abc123';

  it('RUNTIME_ACTIVE wymaga kompletu bramek PASS', () => {
    expect(
      isRuntimeActive('dynamic-swot', {
        manifestAllGatesPass: false,
        verifiedAgainstSha: SHA,
        candidateSha: SHA,
      })
    ).toBe(false);
  });

  it('RUNTIME_ACTIVE odrzuca dowody z innego SHA', () => {
    expect(
      isRuntimeActive('dynamic-swot', {
        manifestAllGatesPass: true,
        verifiedAgainstSha: 'stare999',
        candidateSha: SHA,
      })
    ).toBe(false);
  });

  it('RUNTIME_ACTIVE odrzuca brak SHA', () => {
    expect(
      isRuntimeActive('dynamic-swot', {
        manifestAllGatesPass: true,
        verifiedAgainstSha: null,
        candidateSha: SHA,
      })
    ).toBe(false);
  });

  it('RUNTIME_ACTIVE niemożliwe dla narzędzia, które nie może startować', () => {
    expect(
      isRuntimeActive('vsm-builder', {
        manifestAllGatesPass: true,
        verifiedAgainstSha: SHA,
        candidateSha: SHA,
      })
    ).toBe(false);
  });

  it('RUNTIME_ACTIVE dopiero przy komplecie dowodów wobec bieżącego SHA', () => {
    expect(
      isRuntimeActive('dynamic-swot', {
        manifestAllGatesPass: true,
        verifiedAgainstSha: SHA,
        candidateSha: SHA,
      })
    ).toBe(true);
  });

  // Rozłączność pojęć — sedno decyzji.
  it('widoczność ≠ możliwość startu ≠ runtime active', () => {
    const t = 'vsm-builder';
    expect(isLibraryVisible(t)).toBe(true); // widoczne i opisane
    expect(canStartToolSession(t)).toBe(false); // ale nie startuje
    expect(
      isRuntimeActive(t, { manifestAllGatesPass: true, verifiedAgainstSha: SHA, candidateSha: SHA })
    ).toBe(false); // i na pewno nie jest aktywne
  });

  it('żadne z 31 nie jest dziś RUNTIME_ACTIVE — brak manifestów', () => {
    ALL_31.forEach((t) => {
      expect(
        isRuntimeActive(t, {
          manifestAllGatesPass: false,
          verifiedAgainstSha: null,
          candidateSha: SHA,
        })
      ).toBe(false);
    });
  });
});
