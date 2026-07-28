/**
 * Bramka: JEDEN format daty w listach, wybierany przez język KONTA.
 *
 * Powód (przegląd 128 zrzutów, 2026-07-27): sześć formatów tej samej rzeczy,
 * w tym dwa różne zapisy JEDNEJ daty w jednym wierszu (Interview → Sessions:
 * `7/21/2026` w nazwie, `21/07/2026` w kolumnie). Przyczyną było 270 wywołań
 * `toLocaleDateString()` bez locale — czyli format z przeglądarki zamiast
 * z konta.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import {
  formatListDate,
  formatListDateTime,
  formatRelativeHint,
  listDateCell,
  localeListy,
  PUSTA_DATA,
} from '@/utils/listDateFormat';

const ustawJezyk = (lng: string) => {
  vi.spyOn(i18n, 'language', 'get').mockReturnValue(lng);
};

describe('formatowanie dat w listach', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('JEDEN wzorzec DD/MM/YYYY — ten sam dla każdego języka konta', () => {
    for (const lng of ['pl', 'en', 'de', 'es', 'ja']) {
      ustawJezyk(lng);
      expect(formatListDate('2026-07-24T10:00:00Z'), `język ${lng}`).toBe('24/07/2026');
    }
  });

  it('angielskie konto NIE dostaje amerykańskiego M/D — to był źródłowy rozjazd', () => {
    ustawJezyk('en');
    // en-US dałoby "07/24/2026" i wrocilby rozjazd 7/3/2026 obok 24/07/2026.
    expect(localeListy()).toBe('en-GB');
    expect(formatListDate('2026-07-24T10:00:00Z')).not.toContain('07/24');
  });

  it('ta sama data w dwóch miejscach daje ten sam napis (regresja Interview → Sessions)', () => {
    ustawJezyk('pl');
    const zIso = formatListDate('2026-07-21T00:00:00Z');
    const zDate = formatListDate(new Date('2026-07-21T18:30:00Z'));
    expect(zIso).toBe(zDate);
  });

  it('brak daty daje myślnik, nie „Invalid Date" (kanon C7)', () => {
    ustawJezyk('pl');
    expect(formatListDate(null)).toBe(PUSTA_DATA);
    expect(formatListDate('')).toBe(PUSTA_DATA);
    expect(formatListDate('to nie data')).toBe(PUSTA_DATA);
    expect(formatListDateTime(undefined)).toBe(PUSTA_DATA);
  });

  it('zapis względny jest dopiskiem, a przy braku daty w ogóle go nie ma', () => {
    ustawJezyk('pl');
    const teraz = new Date('2026-07-28T12:00:00Z');
    expect(formatRelativeHint('2026-07-24T12:00:00Z', teraz)).toContain('dni');
    expect(formatRelativeHint(null, teraz)).toBeNull();
  });

  it('komórka tabeli niesie datę absolutną, a względną tylko w dymku', () => {
    ustawJezyk('pl');
    const teraz = new Date('2026-07-28T12:00:00Z');
    const cell = listDateCell('2026-07-24T12:00:00Z', teraz);

    expect(cell.text).toBe('24/07/2026');
    expect(cell.title).not.toBeNull();
    // Kolumna nigdy nie pokazuje samego "4 dni temu" — po tym nie da się
    // porownac dwoch wierszy wzrokiem.
    expect(cell.text).not.toMatch(/temu|ago/);
  });
});
