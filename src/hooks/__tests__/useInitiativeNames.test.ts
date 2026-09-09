/**
 * TEST-DANE D-06 (09.09.2026) — podgląd Mojej Pracy pokazywał surowy
 * identyfikator „Initiative: 4e7a8762-62e6-52b5-985b-536a4d9185aa" zamiast
 * nazwy („Skills Matrix and Upskilling" — zmierzone w bazie kopii stagingu).
 *
 * KSZTAŁT ODPOWIEDZI, w który trzeba trafić: `GET /api/initiatives` oddaje
 * wiersze inicjatyw, w których nazwa siedzi w `title` (kolumna `initiatives.title`,
 * sprawdzona na kopii bazy), a NIE w `name`. Resolver czytający samo `name`
 * nie trafiłby w nic — to dokładnie ta klasa błędu, którą naprawiał już
 * `useOrganizationMemberNames`.
 *
 * DOWÓD MUTACYJNY: zawężenie `readInitiativeLabel` do samego `initiative.name`
 * -> RED w pierwszym teście. Zwrócenie identyfikatora zamiast `null` przy
 * braku wiersza -> RED w ostatnim.
 */
import { describe, expect, it } from 'vitest';

import { buildInitiativeNameMap, readInitiativeLabel } from '../useInitiativeNames';

/** Wiersz w kształcie, jaki naprawdę leci po drucie z `/api/initiatives`. */
const WIERSZ_SERWERA = {
  id: '4e7a8762-62e6-52b5-985b-536a4d9185aa',
  title: 'Skills Matrix and Upskilling',
  status: 'IN_EXECUTION',
};

describe('useInitiativeNames — mapa identyfikator → nazwa inicjatywy', () => {
  it('czyta nazwę z `title` (kształt realnej odpowiedzi serwera)', () => {
    expect(readInitiativeLabel(WIERSZ_SERWERA)).toBe('Skills Matrix and Upskilling');
    expect(buildInitiativeNameMap([WIERSZ_SERWERA])).toEqual({
      '4e7a8762-62e6-52b5-985b-536a4d9185aa': 'Skills Matrix and Upskilling',
    });
  });

  it('przyjmuje też `name`, gdy wołacz poda drugą konwencję', () => {
    expect(readInitiativeLabel({ id: 'i-1', name: 'Line 3 MES rollout' })).toBe(
      'Line 3 MES rollout'
    );
  });

  it('pomija wiersze bez identyfikatora albo bez nazwy — nigdy nie zapisuje UUID-a jako nazwy', () => {
    const mapa = buildInitiativeNameMap([
      { id: 'i-2' },
      { title: 'Bez identyfikatora' },
      { id: 'i-3', title: '   ' },
      null,
      'nie-obiekt',
    ] as unknown as Record<string, unknown>[]);
    expect(mapa).toEqual({});
  });

  it('brak wiersza = brak nazwy (`null`), a nie identyfikator', () => {
    const mapa = buildInitiativeNameMap([WIERSZ_SERWERA]);
    expect(mapa['nieznane-id']).toBeUndefined();
  });
});
