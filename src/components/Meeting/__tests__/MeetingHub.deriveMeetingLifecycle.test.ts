/**
 * CB-04/RB-009/RV-024 — meeting lifecycle must distinguish genuinely
 * upcoming, past-but-unclosed, and completed meetings. Fixed clock, no real
 * wall-clock time — boundary-exact.
 */
import { describe, expect, it } from 'vitest';

import { deriveMeetingLifecycle, type MeetingItem } from '../MeetingHub';

// Fixed clock: 2026-08-07T12:00:00Z, matching the RV-024 repro date.
const NOW = new Date('2026-08-07T12:00:00.000Z').getTime();

function meeting(overrides: Partial<MeetingItem>): MeetingItem {
  return {
    id: 'm1',
    title: 'Test meeting',
    startAt: '2026-08-07T09:00:00.000Z',
    endAt: '2026-08-07T10:00:00.000Z',
    location: '',
    attendees: [],
    preRead: [],
    agenda: [],
    decisions: [],
    followUps: [],
    status: 'scheduled',
    ...overrides,
  };
}

describe('deriveMeetingLifecycle', () => {
  it('is "completed" whenever status is completed, regardless of date', () => {
    expect(
      deriveMeetingLifecycle(
        meeting({ status: 'completed', endAt: '2026-12-01T00:00:00.000Z' }),
        NOW
      )
    ).toBe('completed');
  });

  it('is "scheduled" for a genuinely future meeting', () => {
    expect(deriveMeetingLifecycle(meeting({ endAt: '2026-08-08T10:00:00.000Z' }), NOW)).toBe(
      'scheduled'
    );
  });

  it('is "past_needs_update" for a meeting whose end time has passed and was never marked completed — the RV-024 repro', () => {
    expect(
      deriveMeetingLifecycle(
        meeting({ status: 'scheduled', endAt: '2026-03-15T10:00:00.000Z' }),
        NOW
      )
    ).toBe('past_needs_update');
  });

  it('is exact at the boundary — the instant `end === now` is still "scheduled", one ms later is "past_needs_update"', () => {
    const end = new Date(NOW).toISOString();
    expect(deriveMeetingLifecycle(meeting({ endAt: end }), NOW)).toBe('scheduled');
    const endPast = new Date(NOW - 1).toISOString();
    expect(deriveMeetingLifecycle(meeting({ endAt: endPast }), NOW)).toBe('past_needs_update');
  });

  it('falls back to startAt when endAt is missing', () => {
    expect(
      deriveMeetingLifecycle(meeting({ endAt: '', startAt: '2026-03-15T10:00:00.000Z' }), NOW)
    ).toBe('past_needs_update');
  });
});
