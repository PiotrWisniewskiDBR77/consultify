/**
 * P15-K3 (DEC-421) — REGUŁA CYKLU ZALEŻNOŚCI, zanim dotknie bazy.
 *
 * Bez tej reguły „A po B" i „B po A" zapisałyby się bez słowa, a padłby dopiero
 * NASTĘPNY zapis planu — regułą `Plan dependency cycle detected` z domeny, bez
 * wskazania, która krawędź zawiniła.
 */
import { describe, expect, it } from 'vitest';

import {
  findInitiativeDependencyCycle,
  withReplacedDependencies,
} from '../../../server/src/domain/initiatives-execution/initiativeDependencyGraph';

describe('P15-K3 — graf zależności inicjatyw', () => {
  it('łańcuch bez koła przechodzi', () => {
    const edges = new Map([
      ['b', ['a']],
      ['c', ['b']],
    ]);
    expect(findInitiativeDependencyCycle(edges)).toBeNull();
  });

  it('koło jest wskazane ze ścieżką, nie tylko „nie wolno"', () => {
    const edges = new Map([
      ['a', ['b']],
      ['b', ['a']],
    ]);
    const cykl = findInitiativeDependencyCycle(edges);
    expect(cykl).not.toBeNull();
    expect(cykl?.[0]).toBe(cykl?.[cykl.length - 1]);
    expect(new Set(cykl)).toEqual(new Set(['a', 'b']));
  });

  it('inicjatywa wskazana sama na siebie NIE trafia do grafu', () => {
    const edges = withReplacedDependencies(new Map(), 'a', ['a', 'b', 'b']);
    expect(edges.get('a')).toEqual(['b']);
  });

  it('pusta lista KASUJE zależności tej inicjatywy', () => {
    const edges = withReplacedDependencies(new Map([['a', ['b']]]), 'a', []);
    expect(edges.has('a')).toBe(false);
  });

  it('zmiana domykająca koło jest wykrywana PRZED zapisem', () => {
    const istniejace = new Map([['b', ['a']]]);
    const po = withReplacedDependencies(istniejace, 'a', ['b']);
    expect(findInitiativeDependencyCycle(po)).not.toBeNull();
    expect(findInitiativeDependencyCycle(istniejace)).toBeNull();
  });

  it('krawędź do inicjatywy spoza grafu nie jest cyklem', () => {
    expect(findInitiativeDependencyCycle(new Map([['a', ['nieznana']]]))).toBeNull();
  });
});
