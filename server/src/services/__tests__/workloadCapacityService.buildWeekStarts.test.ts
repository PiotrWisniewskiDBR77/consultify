/**
 * [ODMROZENIE 06_EXECUTION DEC-453] P16-R0
 *
 * `buildWeekStarts()` (workloadCapacityService.ts) liczy `weekCount` kolejnych
 * poniedziałków dla planu zasobów (`getExecutionResourcePlan`). Zmierzony defekt
 * (P16 §3 pkt 2, `workloadCapacityService.ts:666-667` przed naprawą): stara
 * wersja liczyła kolejny tydzień jako `firstMonday.getTime() + w * 7 * 24h`
 * w milisekundach. Zmiana czasu w Europie (Europe/Warsaw, ostatnia niedziela
 * października — 25.10.2026 ma 25 h) sprawia, że dodanie DOKŁADNIE 7*24h nie
 * ląduje w poniedziałek 00:00, tylko w niedzielę 23:00 — `getMonday()` cofa
 * wtedy datę o dodatkowy dzień i dwa kolejne tygodnie wyliczają TEN SAM
 * poniedziałek (`2026-10-19` dwa razy zamiast `2026-10-19`/`2026-10-26`).
 * Duplikat tygodnia w `weeks[]` wlicza się do podaży i popytu podwójnie
 * (`ResourcePlan.rows` ma jeden wiersz na `userId × weekStart` — duplikat w
 * `weeks[]` = dwa wiersze o tym samym `weekStart` i tych samych wartościach).
 *
 * Test działa w strefie Europe/Warsaw (ustawiona w `vitest.setup`/CI albo tu
 * lokalnie przez `process.env.TZ`) — na innej strefie bez DST 07.09 defekt by
 * nie czerwienił się, więc strefa jest częścią kontraktu testu.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildWeekStarts } from '../workloadCapacityService.js';

describe('workloadCapacityService.buildWeekStarts (P16-R0)', () => {
  let originalTz: string | undefined;

  beforeAll(() => {
    originalTz = process.env.TZ;
    process.env.TZ = 'Europe/Warsaw';
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  it('zwraca 8 RÓŻNYCH poniedziałków od 2026-09-07, bez duplikatu na zmianie czasu 25.10', () => {
    const asOf = new Date('2026-09-07T10:00:00');
    const weeks = buildWeekStarts(asOf, 8);

    expect(weeks).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
    ]);
    // Bezpiecznik ogólny: niezależnie od konkretnych dat, N tygodni = N
    // RÓŻNYCH poniedziałków (zero duplikatów).
    expect(new Set(weeks).size).toBe(weeks.length);
  });

  it('kolejne poniedziałki różnią się dokładnie o 7 dni kalendarzowych (nie o godziny zegarowe)', () => {
    const asOf = new Date('2026-09-07T10:00:00');
    const weeks = buildWeekStarts(asOf, 8);
    for (let i = 1; i < weeks.length; i += 1) {
      const prev = new Date(`${weeks[i - 1]}T00:00:00`);
      const curr = new Date(`${weeks[i]}T00:00:00`);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(7);
    }
  });

  it('mutacja dokumentacyjna: arytmetyka milisekundowa `+7*24h` dubluje tydzień 19.10/26.10', () => {
    // To NIE testuje kodu produkcyjnego — odtwarza STARĄ (wadliwą) arytmetykę
    // obok nowej, żeby udowodnić, że test wyżej faktycznie łapie ten defekt
    // (czerwony, gdyby ktoś przywrócił `+7*24h` w `buildWeekStarts`).
    function getMondayLikeProd(d: Date): Date {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      return monday;
    }
    function formatDateLikeProd(d: Date): string {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    const asOf = new Date('2026-09-07T10:00:00');
    const firstMonday = getMondayLikeProd(asOf);
    const buggyWeeks: string[] = [];
    for (let w = 0; w < 8; w += 1) {
      buggyWeeks.push(
        formatDateLikeProd(getMondayLikeProd(new Date(firstMonday.getTime() + w * 7 * 24 * 60 * 60 * 1000)))
      );
    }
    expect(new Set(buggyWeeks).size).toBe(7); // duplikat: 7 unikalnych z 8
    expect(buggyWeeks[6]).toBe('2026-10-19');
    expect(buggyWeeks[7]).toBe('2026-10-19'); // <- defekt: powinno być 2026-10-26

    // Naprawiona funkcja NIE ma tego defektu na tych samych danych.
    const fixedWeeks = buildWeekStarts(asOf, 8);
    expect(new Set(fixedWeeks).size).toBe(8);
    expect(fixedWeeks[7]).toBe('2026-10-26');
  });
});
