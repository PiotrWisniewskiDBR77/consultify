/**
 * Bramka odwrotna do `naglowkiKolumnJezyk.test.ts`: tam pilnujemy, żeby polskie
 * słowo nie trafiło do angielskiego UI — tu, żeby angielskie nie zostało
 * w polskim.
 *
 * Powód (2026-08-31): `finance.m16.monteCarlo.driverLabel` ISTNIAŁ w pl, tylko
 * z wartością "Driver" — czyli brak klucza to nie jedyny sposób, w jaki
 * angielszczyzna dociera do polskiego użytkownika; przepisany klucz wygląda
 * w audycie na przetłumaczony. Osobno: `kimi.showingAllRows`/`showAllRows`
 * nie istniały w żadnym locale i leciały angielskie defaulty z kodu, a
 * `kimi.showingRows` miał wpisane na sztywno "25", choć kod podaje {{cap}}=100.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const wczytaj = (jezyk: string) =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), `public/locales/${jezyk}/translation.json`), 'utf-8')
  ) as Record<string, unknown>;

const pobierz = (obiekt: unknown, sciezka: string): unknown =>
  sciezka.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown>)?.[k], obiekt);

const pl = wczytaj('pl');
const en = wczytaj('en');

describe('locale PL — brak angielskich resztek w naprawionych miejscach', () => {
  it('Monte Carlo: driver -> czynnik (etykieta, przycisk, ziarna wierszy)', () => {
    expect(pobierz(pl, 'finance.m16.monteCarlo.driverLabel')).toBe('Czynnik');
    expect(pobierz(pl, 'finance.m16.monteCarlo.addDriver')).toBe('+ czynnik');
    expect(pobierz(pl, 'finance.m16.monteCarlo.seedRevenue')).toBe('Przychody');
    expect(pobierz(pl, 'finance.m16.monteCarlo.seedCost')).toBe('Koszty');
    for (const klucz of ['driverLabel', 'addDriver', 'seedRevenue', 'seedCost', 'newDriver']) {
      expect(String(pobierz(pl, `finance.m16.monteCarlo.${klucz}`))).not.toMatch(/driver|revenue|cost/i);
    }
  });

  it('stopka rowCap: klucze istnieją w OBU locale i honorują {{cap}}', () => {
    for (const [jezyk, dane] of [
      ['pl', pl],
      ['en', en],
    ] as const) {
      expect(pobierz(dane, 'kimi.showingAllRows'), `${jezyk}.kimi.showingAllRows`).toBeTypeOf(
        'string'
      );
      expect(pobierz(dane, 'kimi.showAllRows'), `${jezyk}.kimi.showAllRows`).toBeTypeOf('string');
      // Kod podaje {{cap}} = rowCap (domyślnie 100); zaszyta liczba kłamie.
      expect(String(pobierz(dane, 'kimi.showingRows')), `${jezyk}.kimi.showingRows`).toContain(
        '{{cap}}'
      );
    }
  });
});
