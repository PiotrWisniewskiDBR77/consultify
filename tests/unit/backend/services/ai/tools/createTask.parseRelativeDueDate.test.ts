/**
 * parseRelativeDueDate — Teresa `create_task` chat tool (sędzia BCG #2)
 *
 * Reproduces the reported defect: the prompt "audyt … do końca miesiąca" produced
 * dueDate = createdAt + 7 days instead of the actual end of the month, because
 * the tool had no way to convey a RELATIVE deadline. This test locks in the
 * text-level parser added in createTask.ts: an explicit relative term in the task
 * text ("koniec miesiąca", "koniec tygodnia", "za X dni", "do <ISO>") resolves to
 * the correct calendar date and wins over the priority default.
 *
 * All cases inject a fixed `now` so they are deterministic across months / years
 * / leap year. Results are LOCAL end-of-day ISO strings.
 *
 * @module tests/unit/backend/services/ai/tools/createTask.parseRelativeDueDate.test.ts
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { parseRelativeDueDate } from '../../../../../../../server/src/services/ai/tools/createTask.js';

/** Local Y-M-D of an ISO string (uses the same local tz the parser resolves in). */
function localYMD(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

describe('parseRelativeDueDate (create_task chat tool)', () => {
  describe('"koniec miesiąca" → last day of the current month', () => {
    it('reproduces the reported case: audyt do końca miesiąca (July 2026 → 2026-07-31)', () => {
      const now = new Date(2026, 6, 7, 10, 0, 0); // 2026-07-07 (month index 6 = July)
      const iso = parseRelativeDueDate('Przeprowadzić audyt bezpieczeństwa do końca miesiąca', now);
      expect(iso).toBeDefined();
      expect(localYMD(iso as string)).toBe('2026-07-31');
    });

    it('February in a leap year (2024) → 2024-02-29', () => {
      const now = new Date(2024, 1, 3, 9, 0, 0); // 2024-02-03
      const iso = parseRelativeDueDate('zamknąć raport na koniec miesiąca', now);
      expect(localYMD(iso as string)).toBe('2024-02-29');
    });

    it('February in a non-leap year (2026) → 2026-02-28', () => {
      const now = new Date(2026, 1, 10, 9, 0, 0); // 2026-02-10
      const iso = parseRelativeDueDate('koniec miesiąca', now);
      expect(localYMD(iso as string)).toBe('2026-02-28');
    });

    it('December → 2026-12-31 (year boundary, no roll into January)', () => {
      const now = new Date(2026, 11, 15, 9, 0, 0); // 2026-12-15
      const iso = parseRelativeDueDate('do końca miesiąca', now);
      expect(localYMD(iso as string)).toBe('2026-12-31');
    });

    it('works without Polish diacritics ("do konca miesiaca")', () => {
      const now = new Date(2026, 6, 7, 10, 0, 0);
      const iso = parseRelativeDueDate('audyt do konca miesiaca', now);
      expect(localYMD(iso as string)).toBe('2026-07-31');
    });

    it('English "end of the month" also parses', () => {
      const now = new Date(2026, 6, 7, 10, 0, 0);
      const iso = parseRelativeDueDate('finish the audit by end of the month', now);
      expect(localYMD(iso as string)).toBe('2026-07-31');
    });
  });

  describe('"koniec tygodnia" → Friday of the current week', () => {
    it('Tuesday → the same week Friday', () => {
      const now = new Date(2026, 6, 7, 10, 0, 0); // 2026-07-07 is a Tuesday
      expect(now.getDay()).toBe(2);
      const iso = parseRelativeDueDate('zrób to do końca tygodnia', now);
      expect(localYMD(iso as string)).toBe('2026-07-10'); // Fri 2026-07-10
    });

    it('Friday → the same day (Friday)', () => {
      const now = new Date(2026, 6, 10, 10, 0, 0); // 2026-07-10 Friday
      expect(now.getDay()).toBe(5);
      const iso = parseRelativeDueDate('koniec tygodnia', now);
      expect(localYMD(iso as string)).toBe('2026-07-10');
    });
  });

  describe('"za X dni / tygodni"', () => {
    it('"za 3 dni" → +3 days', () => {
      const now = new Date(2026, 6, 7, 10, 0, 0);
      const iso = parseRelativeDueDate('oddać za 3 dni', now);
      expect(localYMD(iso as string)).toBe('2026-07-10');
    });

    it('"za 2 tygodnie" → +14 days', () => {
      const now = new Date(2026, 6, 7, 10, 0, 0);
      const iso = parseRelativeDueDate('deadline za 2 tygodnie', now);
      expect(localYMD(iso as string)).toBe('2026-07-21');
    });

    it('English "in 5 days" → +5 days', () => {
      const now = new Date(2026, 6, 7, 10, 0, 0);
      const iso = parseRelativeDueDate('due in 5 days', now);
      expect(localYMD(iso as string)).toBe('2026-07-12');
    });
  });

  describe('explicit ISO date "do <YYYY-MM-DD>"', () => {
    it('parses a future explicit date', () => {
      const now = new Date(2026, 6, 7, 10, 0, 0);
      const iso = parseRelativeDueDate('termin do 2026-08-15', now);
      expect(localYMD(iso as string)).toBe('2026-08-15');
    });

    it('ignores a PAST explicit date (falls through to undefined)', () => {
      const now = new Date(2026, 6, 7, 10, 0, 0);
      const iso = parseRelativeDueDate('note the 2020-01-01 baseline', now);
      expect(iso).toBeUndefined();
    });
  });

  describe('jutro / koniec kwartału', () => {
    it('"jutro" → +1 day', () => {
      const now = new Date(2026, 6, 7, 10, 0, 0);
      const iso = parseRelativeDueDate('zrób to jutro', now);
      expect(localYMD(iso as string)).toBe('2026-07-08');
    });

    it('"koniec kwartału" in July (Q3) → 2026-09-30', () => {
      const now = new Date(2026, 6, 7, 10, 0, 0);
      const iso = parseRelativeDueDate('domknąć do końca kwartału', now);
      expect(localYMD(iso as string)).toBe('2026-09-30');
    });
  });

  describe('no relative term → undefined (caller uses model date / priority offset)', () => {
    it('returns undefined for text with no deadline phrase', () => {
      const now = new Date(2026, 6, 7, 10, 0, 0);
      expect(parseRelativeDueDate('Przeprowadzić audyt bezpieczeństwa', now)).toBeUndefined();
    });

    it('returns undefined for empty text', () => {
      expect(parseRelativeDueDate('', new Date())).toBeUndefined();
      expect(parseRelativeDueDate(undefined, new Date())).toBeUndefined();
    });
  });
});
