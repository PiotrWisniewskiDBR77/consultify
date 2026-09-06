/**
 * Dowód na defekt #4 audytu FIN 2026-09-06: KAŻDY kod linii kanonicznej pakietu
 * CD PROJEKT ma polską nazwę pozycji, a żaden kod nie przecieka na ekran surowy.
 *
 * Lista 119 kodów nie jest przepisana z audytu — jest WYPROWADZONA z tego samego
 * pliku danych, z którego seed buduje pakiet (`server/scripts/data/cdprojekt-2025.json`),
 * więc test pilnuje realnego zbioru, a nie zamrożonej kopii.
 */
import { describe, expect, it } from 'vitest';

import cdprojekt from '../../../server/scripts/data/cdprojekt-2025.json';
import { FINANCE_LINE_LABELS, financeLineLabel, hasFinanceLineLabel } from '../financeLineLabels';

const packLineCodes: string[] = Array.from(
  new Set(
    (cdprojekt as { lines: Array<{ code: string | null }> }).lines
      .map((line) => line.code)
      .filter((code): code is string => Boolean(code))
  )
).sort();

describe('financeLineLabels — pakiet CD PROJEKT', () => {
  it('zbiór kodów pakietu jest tym, co mierzył audyt (119 kodów)', () => {
    expect(packLineCodes.length).toBe(119);
  });

  it('KAŻDY kod pakietu ma polską etykietę w katalogu', () => {
    const missing = packLineCodes.filter((code) => !hasFinanceLineLabel(code));
    expect(missing).toEqual([]);
  });

  it('żadna etykieta pakietu nie jest echem kodu (SCREAMING_CASE / Title_Case)', () => {
    const echoes = packLineCodes.filter((code) => {
      const label = financeLineLabel(code);
      return label === code || label.toUpperCase() === code.replace(/_/g, ' ');
    });
    expect(echoes).toEqual([]);
  });

  it('nazwy przepisane z PDF trafiają na ekran dosłownie', () => {
    expect(financeLineLabel('TOTAL_ASSETS')).toBe('AKTYWA RAZEM');
    expect(financeLineLabel('AP')).toBe('Zobowiązania handlowe');
    expect(financeLineLabel('CASH')).toBe('Środki pieniężne i ekwiwalenty środków pieniężnych');
    expect(financeLineLabel('RETAINED_EARNINGS_CURRENT')).toBe('Wynik finansowy bieżącego okresu');
  });
});

describe('financeLineLabels — fallbacki', () => {
  it('kod spoza katalogu bierze nazwę z taksonomii instalacji', () => {
    expect(
      financeLineLabel('ORG_CUSTOM_LINE', {
        fallback: { lineNamePl: 'Pozycja własna organizacji', lineName: 'Org custom line' },
      })
    ).toBe('Pozycja własna organizacji');
  });

  it('odrzuca nazwę z taksonomii będącą echem kodu i mówi wprost, że nie zna pozycji', () => {
    expect(
      financeLineLabel('ORG_CUSTOM_LINE', {
        fallback: { lineNamePl: 'Org Custom Line', lineName: 'Org Custom Line' },
      })
    ).toBe('Nieznana pozycja (ORG_CUSTOM_LINE)');
  });

  it('bez żadnego źródła NIGDY nie zwraca gołego kodu', () => {
    expect(financeLineLabel('ZUPELNIE_NIEZNANY')).toBe('Nieznana pozycja (ZUPELNIE_NIEZNANY)');
  });

  it('katalog pokrywa całą taksonomię systemową, nie tylko CD PROJEKT', () => {
    expect(Object.keys(FINANCE_LINE_LABELS).length).toBeGreaterThanOrEqual(246);
  });
});
