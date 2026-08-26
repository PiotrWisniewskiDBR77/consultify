import { describe, expect, it } from 'vitest';

import { buildMeetingInvitationIcs } from '../icsBuilder.js';

const base = {
  uid: 'meeting-1@consultify',
  title: 'Review, plan; next',
  startAt: '2026-08-26T08:00:00.000Z',
  endAt: '2026-08-26T09:00:00.000Z',
  timezone: 'Europe/Warsaw',
  organizer: { email: 'owner@example.com', displayName: 'Owner' },
  attendees: [
    {
      email: 'guest@example.com',
      displayName: 'Guest',
      invitationStatus: 'accepted' as const,
    },
  ],
};

describe('meeting ICS invitation', () => {
  it('builds REQUEST with timezone, organizer and attendee', () => {
    const ics = buildMeetingInvitationIcs(base);
    expect(ics).toContain('METHOD:REQUEST');
    expect(ics).toContain('DTSTART;TZID=Europe/Warsaw:20260826T080000');
    expect(ics).toContain('ORGANIZER;CN=Owner:mailto:owner@example.com');
    expect(ics).toContain('PARTSTAT=ACCEPTED');
  });

  it('keeps a recurrence rule', () => {
    expect(buildMeetingInvitationIcs({ ...base, recurrenceRule: 'FREQ=WEEKLY;COUNT=4' })).toContain(
      'RRULE:FREQ=WEEKLY;COUNT=4'
    );
  });

  it('emits an update sequence', () => {
    expect(buildMeetingInvitationIcs({ ...base, sequence: 3 })).toContain('SEQUENCE:3');
  });

  it('emits cancellation and escapes text', () => {
    const ics = buildMeetingInvitationIcs({ ...base, method: 'CANCEL' });
    expect(ics).toContain('METHOD:CANCEL');
    expect(ics).toContain('SUMMARY:Review\\, plan\\; next');
  });
});
