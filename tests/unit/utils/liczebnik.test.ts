import { describe, expect, it } from 'vitest';

import { liczebnik } from '@/utils/liczebnik';

// Rzeczownik z trzema RÓŻNYMI formami (dzień/dni/dni ma formę 2 i 3 identyczną —
// nie wystarczy do wyłapania pomyłki kilka/wiele), więc test celuje w 'test'/'testy'/'testów'.
const TEST_FORMS: [string, string, string] = ['test', 'testy', 'testów'];

describe('liczebnik — polska odmiana po liczebniku głównym', () => {
  it('1 → forma 1 (mianownik lp.)', () => {
    expect(liczebnik(1, TEST_FORMS)).toBe('test');
  });

  it('2 → forma 2 (2-4)', () => {
    expect(liczebnik(2, TEST_FORMS)).toBe('testy');
  });

  it('5 → forma 3 (5+)', () => {
    expect(liczebnik(5, TEST_FORMS)).toBe('testów');
  });

  it('12 → forma 3 (wyjątek nastek, nie forma 2)', () => {
    expect(liczebnik(12, TEST_FORMS)).toBe('testów');
  });

  it('22 → forma 2 (dziesiątki spoza zakresu nastek)', () => {
    expect(liczebnik(22, TEST_FORMS)).toBe('testy');
  });

  it('25 → forma 3', () => {
    expect(liczebnik(25, TEST_FORMS)).toBe('testów');
  });

  it('0 → forma 3', () => {
    expect(liczebnik(0, TEST_FORMS)).toBe('testów');
  });

  it('101 → forma 3 (kończy się na 1, ale n !== 1 — nie mianownik lp.)', () => {
    expect(liczebnik(101, TEST_FORMS)).toBe('testów');
  });

  it('112 → forma 3 (nastka w setkach)', () => {
    expect(liczebnik(112, TEST_FORMS)).toBe('testów');
  });

  it('rzeczownik z identyczną formą 2 i 3 (dzień/dni/dni) — sanity check regresji ekranu WIEK', () => {
    const DNI: [string, string, string] = ['dzień', 'dni', 'dni'];
    expect(liczebnik(1, DNI)).toBe('dzień');
    expect(liczebnik(2, DNI)).toBe('dni');
    expect(liczebnik(5, DNI)).toBe('dni');
  });

  it('wartości niecałkowite i nieskończone dostają bezpieczną formę 3', () => {
    expect(liczebnik(1.5, TEST_FORMS)).toBe('testów');
    expect(liczebnik(Number.NaN, TEST_FORMS)).toBe('testów');
    expect(liczebnik(Number.POSITIVE_INFINITY, TEST_FORMS)).toBe('testów');
  });
});
