/**
 * Odmiana liczebnikowa „dowód źródłowy" — jedno źródło dla Report i Presentation.
 *
 * ★ Powstało po tym, jak `MethodReportView` miał odmianę poprawną, a
 * `MethodPresentationView` z tej samej fali pokazywał klientowi
 * „1 dowodów źródłowych". Dwa miejsca, dwie implementacje, jedna zła.
 */
import { describe, expect, it } from 'vitest';

import { evidenceCountLabel } from '../evidencePlural';

describe('evidenceCountLabel — polska odmiana liczebnikowa', () => {
  it('0 nie udaje liczby', () => {
    expect(evidenceCountLabel(0)).toBe('Bez powiązanych dowodów');
  });

  it('1 = liczba pojedyncza', () => {
    expect(evidenceCountLabel(1)).toBe('1 dowód źródłowy');
  });

  it('2-4 = forma mnoga „dowody źródłowe"', () => {
    expect(evidenceCountLabel(2)).toBe('2 dowody źródłowe');
    expect(evidenceCountLabel(3)).toBe('3 dowody źródłowe');
    expect(evidenceCountLabel(4)).toBe('4 dowody źródłowe');
  });

  it('5+ = dopełniacz „dowodów źródłowych"', () => {
    expect(evidenceCountLabel(5)).toBe('5 dowodów źródłowych');
    expect(evidenceCountLabel(11)).toBe('11 dowodów źródłowych');
  });

  it('★ nastki 12-14 idą jak 5+, a nie jak 2-4 (klasyczna pułapka)', () => {
    expect(evidenceCountLabel(12)).toBe('12 dowodów źródłowych');
    expect(evidenceCountLabel(13)).toBe('13 dowodów źródłowych');
    expect(evidenceCountLabel(14)).toBe('14 dowodów źródłowych');
  });

  it('22-24 wracają do formy mnogiej', () => {
    expect(evidenceCountLabel(22)).toBe('22 dowody źródłowe');
    expect(evidenceCountLabel(24)).toBe('24 dowody źródłowe');
  });
});
