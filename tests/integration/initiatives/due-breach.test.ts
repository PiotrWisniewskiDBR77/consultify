/**
 * M13 Depth · Seria R (R4 / E3) — due-date breach scan.
 *
 * Completes the previously-unwired notifyDueBreach: verifies the scan selects
 * genuinely-overdue, open, not-yet-notified items and fires one notification
 * each, with a controlled (mock) clock. Pure selection + fail-safe orchestration.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  isDueBreach,
  scanAndNotifyDueBreaches,
  selectDueBreaches,
  type DueBreachCandidate,
} from '../../../server/src/services/initiative/initiativeDueBreachService.js';

const NOW = new Date('2026-06-22T12:00:00.000Z');
const YESTERDAY = '2026-06-21T12:00:00.000Z';
const TOMORROW = '2026-06-23T12:00:00.000Z';

function candidate(over: Partial<DueBreachCandidate>): DueBreachCandidate {
  return {
    itemId: 'task-1',
    initiativeId: 'ini-1',
    organizationId: 'org-1',
    itemTitle: 'Ship migration',
    dueDate: YESTERDAY,
    status: 'IN_PROGRESS',
    recipients: ['owner-1'],
    lastNotifiedDueDate: null,
    ...over,
  };
}

describe('M13/R4 — due-breach selection (pure, mock clock)', () => {
  it('flags an overdue, open item with recipients', () => {
    expect(isDueBreach(candidate({}), NOW)).toBe(true);
  });

  it('ignores items not yet due', () => {
    expect(isDueBreach(candidate({ dueDate: TOMORROW }), NOW)).toBe(false);
  });

  it('ignores items with no / invalid due date', () => {
    expect(isDueBreach(candidate({ dueDate: null }), NOW)).toBe(false);
    expect(isDueBreach(candidate({ dueDate: 'not-a-date' }), NOW)).toBe(false);
  });

  it('ignores terminal statuses (DONE/CANCELLED/ARCHIVED/COMPLETED)', () => {
    for (const status of ['DONE', 'done', 'CANCELLED', 'ARCHIVED', 'COMPLETED']) {
      expect(isDueBreach(candidate({ status }), NOW)).toBe(false);
    }
  });

  it('ignores items already notified for the same due date (idempotency)', () => {
    expect(isDueBreach(candidate({ lastNotifiedDueDate: YESTERDAY }), NOW)).toBe(false);
    // …but re-notifies when the due date moved (a NEW breach).
    expect(
      isDueBreach(candidate({ lastNotifiedDueDate: '2026-06-01T00:00:00.000Z' }), NOW)
    ).toBe(true);
  });

  it('ignores breaches with no recipients to notify', () => {
    expect(isDueBreach(candidate({ recipients: [] }), NOW)).toBe(false);
    expect(isDueBreach(candidate({ recipients: [null, undefined] }), NOW)).toBe(false);
  });

  it('selectDueBreaches returns only the actionable subset', () => {
    const list = [
      candidate({ itemId: 'a' }), // breach
      candidate({ itemId: 'b', dueDate: TOMORROW }), // future
      candidate({ itemId: 'c', status: 'DONE' }), // closed
      candidate({ itemId: 'd', recipients: [] }), // nobody
      candidate({ itemId: 'e', lastNotifiedDueDate: YESTERDAY }), // already sent
    ];
    expect(selectDueBreaches(list, NOW).map((c) => c.itemId)).toEqual(['a']);
  });
});

describe('M13/R4 — due-breach scan orchestration (fail-safe)', () => {
  it('notifies each breach and marks it, returning counts', async () => {
    const notify = vi.fn(async () => undefined);
    const markNotified = vi.fn(async () => undefined);
    const fetchCandidates = vi.fn(async () => [
      candidate({ itemId: 'a' }),
      candidate({ itemId: 'b', dueDate: TOMORROW }), // skipped (future)
      candidate({ itemId: 'c' }),
    ]);

    const res = await scanAndNotifyDueBreaches(NOW, { fetchCandidates, notify, markNotified });

    expect(res).toEqual({ scanned: 3, notified: 2, skipped: 1, errors: 0 });
    expect(notify).toHaveBeenCalledTimes(2);
    expect(markNotified).toHaveBeenCalledTimes(2);
    expect(notify.mock.calls.map((c) => (c[0] as DueBreachCandidate).itemId)).toEqual(['a', 'c']);
  });

  it('a failing notify for one item does not abort the run', async () => {
    const notify = vi
      .fn()
      .mockRejectedValueOnce(new Error('smtp down'))
      .mockResolvedValueOnce(undefined);
    const fetchCandidates = vi.fn(async () => [
      candidate({ itemId: 'a' }),
      candidate({ itemId: 'b' }),
    ]);

    const res = await scanAndNotifyDueBreaches(NOW, { fetchCandidates, notify });

    expect(res.errors).toBe(1);
    expect(res.notified).toBe(1);
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('a failing fetch yields a zeroed result (no throw)', async () => {
    const notify = vi.fn();
    const fetchCandidates = vi.fn(async () => {
      throw new Error('db down');
    });
    const res = await scanAndNotifyDueBreaches(NOW, { fetchCandidates, notify });
    expect(res).toEqual({ scanned: 0, notified: 0, skipped: 0, errors: 0 });
    expect(notify).not.toHaveBeenCalled();
  });
});
