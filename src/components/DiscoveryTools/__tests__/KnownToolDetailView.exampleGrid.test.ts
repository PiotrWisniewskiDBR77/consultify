/**
 * Plan napraw MVP 05.09.2026, pozycja (2) `karta-tool` (A10): właściciel —
 * karta ostatniego przykładu (po usunięciu dwóch, zostaje 1) wygląda źle jako
 * jedna wąska kolumna. Naprawione już 2026-08-30 (SHA 05c32fc417): siatka
 * sekcji PRZYKŁAD dopasowuje liczbę kolumn do liczby pozycji zamiast trzymać
 * sztywne `lg:grid-cols-3`. Brakowało testu regresyjnego — ten plik pilnuje
 * czystej funkcji wyodrębnionej z `caseGrid` w KnownToolDetailView.tsx.
 */
import { describe, expect, it } from 'vitest';

import { exampleCaseGridCols } from '../KnownToolDetailView';

describe('exampleCaseGridCols — siatka sekcji PRZYKŁAD dopasowana do liczby pozycji', () => {
  it('1 pozycja → pełna szerokość (brak klasy kolumn, karta nie jest wąska)', () => {
    expect(exampleCaseGridCols(1)).toBe('');
  });

  it('2 pozycje → dwie kolumny', () => {
    expect(exampleCaseGridCols(2)).toBe('md:grid-cols-2');
  });

  it('3 pozycje → trzy kolumny (oryginalny układ)', () => {
    expect(exampleCaseGridCols(3)).toBe('lg:grid-cols-3');
  });

  it('więcej niż 3 → nadal trzy kolumny (siatka się zawija)', () => {
    expect(exampleCaseGridCols(5)).toBe('lg:grid-cols-3');
  });
});
