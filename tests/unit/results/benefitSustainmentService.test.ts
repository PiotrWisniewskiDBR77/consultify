import { describe, expect, it } from 'vitest';

import {
  buildGovernanceCalendar,
  nextReviewDate,
  reviewDue,
  sustainmentStatus,
} from '../../../server/src/services/results/benefitSustainmentService.js';

// Deterministyczny punkt odniesienia: 2026-01-15T00:00:00.000Z
const NOW = Date.parse('2026-01-15T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

describe('benefitSustainmentService', () => {
  describe('nextReviewDate', () => {
    it('weekly → +7 dni od ostatniego przeglądu', () => {
      const last = '2026-01-01T00:00:00.000Z';
      expect(nextReviewDate('weekly', last, NOW)).toBe('2026-01-08T00:00:00.000Z');
    });

    it('monthly → +30 dni od ostatniego przeglądu', () => {
      const last = '2026-01-01T00:00:00.000Z';
      expect(nextReviewDate('monthly', last, NOW)).toBe('2026-01-31T00:00:00.000Z');
    });

    it('quarterly → +91 dni od ostatniego przeglądu', () => {
      const last = '2026-01-01T00:00:00.000Z';
      expect(nextReviewDate('quarterly', last, NOW)).toBe('2026-04-02T00:00:00.000Z');
    });

    it('brak ostatniego przeglądu → liczy od teraz (nowMs)', () => {
      const expected = new Date(NOW + 7 * DAY).toISOString();
      expect(nextReviewDate('weekly', null, NOW)).toBe(expected);
    });

    it('nieznana kadencja → traktowana jak monthly (+30 dni)', () => {
      const last = '2026-01-01T00:00:00.000Z';
      expect(nextReviewDate('annually', last, NOW)).toBe('2026-01-31T00:00:00.000Z');
    });
  });

  describe('reviewDue', () => {
    it('brak ostatniego przeglądu → należny', () => {
      expect(reviewDue('monthly', null, NOW)).toBe(true);
    });

    it('przegląd w przyszłości → nienależny', () => {
      // ostatni przegląd 5 dni temu, kadencja monthly → następny za 25 dni
      const last = new Date(NOW - 5 * DAY).toISOString();
      expect(reviewDue('monthly', last, NOW)).toBe(false);
    });

    it('przegląd przeterminowany → należny', () => {
      // ostatni przegląd 40 dni temu, kadencja monthly (30) → przeterminowany
      const last = new Date(NOW - 40 * DAY).toISOString();
      expect(reviewDue('monthly', last, NOW)).toBe(true);
    });

    it('przegląd dokładnie teraz → należny (>=)', () => {
      // ostatni przegląd dokładnie 7 dni temu, kadencja weekly → należny
      const last = new Date(NOW - 7 * DAY).toISOString();
      expect(reviewDue('weekly', last, NOW)).toBe(true);
    });
  });

  describe('sustainmentStatus', () => {
    it('brak transferu własności → unowned', () => {
      const r = sustainmentStatus(
        { ownershipTransferred: false, lastReviewIso: new Date(NOW - DAY).toISOString(), cadence: 'monthly', realizationPct: 0.9 },
        NOW,
      );
      expect(r.status).toBe('unowned');
      expect(r.reasons).toContain('ownership-not-transferred');
    });

    it('brak pola ownershipTransferred → unowned', () => {
      const r = sustainmentStatus(
        { lastReviewIso: new Date(NOW - DAY).toISOString(), cadence: 'monthly', realizationPct: 0.9 },
        NOW,
      );
      expect(r.status).toBe('unowned');
    });

    it('własność przekazana ale przegląd przeterminowany → overdue-review', () => {
      const r = sustainmentStatus(
        { ownershipTransferred: true, lastReviewIso: new Date(NOW - 40 * DAY).toISOString(), cadence: 'monthly', realizationPct: 0.9 },
        NOW,
      );
      expect(r.status).toBe('overdue-review');
      expect(r.reasons).toContain('review-overdue');
    });

    it('własność przekazana, przegląd na czas, realizacja < 0.6 → at-risk', () => {
      const r = sustainmentStatus(
        { ownershipTransferred: true, lastReviewIso: new Date(NOW - DAY).toISOString(), cadence: 'monthly', realizationPct: 0.55 },
        NOW,
      );
      expect(r.status).toBe('at-risk');
      expect(r.reasons).toContain('realization-below-threshold');
    });

    it('wszystko ok → sustained', () => {
      const r = sustainmentStatus(
        { ownershipTransferred: true, lastReviewIso: new Date(NOW - DAY).toISOString(), cadence: 'monthly', realizationPct: 0.85 },
        NOW,
      );
      expect(r.status).toBe('sustained');
      expect(r.reasons).toContain('on-track');
    });

    it('realizacja dokładnie 0.6 → NIE at-risk (próg ostry <)', () => {
      const r = sustainmentStatus(
        { ownershipTransferred: true, lastReviewIso: new Date(NOW - DAY).toISOString(), cadence: 'monthly', realizationPct: 0.6 },
        NOW,
      );
      expect(r.status).toBe('sustained');
    });
  });

  describe('buildGovernanceCalendar', () => {
    it('sortuje po nextReviewIso rosnąco i ustawia flagę due', () => {
      const items = [
        // A: ostatni przegląd 40 dni temu, monthly → przeterminowany (najpilniejszy)
        { id: 'a', name: 'Alpha', cadence: 'monthly', lastReviewIso: new Date(NOW - 40 * DAY).toISOString() },
        // B: ostatni przegląd 1 dzień temu, weekly → następny za 6 dni
        { id: 'b', name: 'Beta', cadence: 'weekly', lastReviewIso: new Date(NOW - DAY).toISOString() },
        // C: ostatni przegląd 1 dzień temu, quarterly → następny za 90 dni
        { id: 'c', name: 'Gamma', cadence: 'quarterly', lastReviewIso: new Date(NOW - DAY).toISOString() },
      ];

      const cal = buildGovernanceCalendar(items, NOW);

      expect(cal.map((e) => e.id)).toEqual(['a', 'b', 'c']);
      expect(cal[0].due).toBe(true); // a — przeterminowany
      expect(cal[1].due).toBe(false); // b — w przyszłości
      expect(cal[2].due).toBe(false); // c — w przyszłości
      expect(cal[0].name).toBe('Alpha');

      // posortowane rosnąco
      const times = cal.map((e) => Date.parse(e.nextReviewIso));
      expect(times[0]).toBeLessThanOrEqual(times[1]);
      expect(times[1]).toBeLessThanOrEqual(times[2]);
    });

    it('brak lastReviewIso → due=true i liczy od teraz', () => {
      const cal = buildGovernanceCalendar([{ id: 'x', cadence: 'weekly' }], NOW);
      expect(cal[0].due).toBe(true);
      expect(cal[0].nextReviewIso).toBe(new Date(NOW + 7 * DAY).toISOString());
    });

    it('pusta lista → pusty kalendarz', () => {
      expect(buildGovernanceCalendar([], NOW)).toEqual([]);
    });
  });
});
