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
  it('builds REQUEST with UTC start/end, organizer and attendee', () => {
    // FIX-1 (P1-1/P1-4): DTSTART/DTEND must be plain UTC ("Z" suffix), never
    // a TZID-qualified local time built from an un-converted UTC instant —
    // that previously produced a 2h error for Europe/Warsaw. The meeting's
    // configured zone is still surfaced, but only as an informational
    // X-property that cannot desync the actual instant.
    const ics = buildMeetingInvitationIcs(base);
    expect(ics).toContain('METHOD:REQUEST');
    expect(ics).toContain('DTSTART:20260826T080000Z');
    expect(ics).toContain('DTEND:20260826T090000Z');
    expect(ics).not.toMatch(/DTSTART;TZID/);
    expect(ics).not.toMatch(/DTEND;TZID/);
    expect(ics).not.toContain('BEGIN:VTIMEZONE');
    expect(ics).toContain('X-CONSULTIFY-TIMEZONE:Europe/Warsaw');
    expect(ics).toContain('ORGANIZER;CN=Owner:mailto:owner@example.com');
    expect(ics).toContain('PARTSTAT=ACCEPTED');
  });

  it('keeps a recurrence rule', () => {
    expect(buildMeetingInvitationIcs({ ...base, recurrenceRule: 'FREQ=WEEKLY;COUNT=4' })).toContain(
      'RRULE:FREQ=WEEKLY;COUNT=4'
    );
  });

  it('FIX-2: strips CR/LF from recurrenceRule as defense in depth against line injection', () => {
    // The route layer (meeting.routes.ts validateRecurrenceRule) is the
    // primary guard and rejects this with 400 before it ever reaches the
    // builder — this test proves the builder does not blindly trust that and
    // would neutralise an injected line break even if it arrived here anyway.
    const malicious = 'FREQ=WEEKLY\r\nATTENDEE;CN=Attacker:mailto:attacker@evil.example';
    const ics = buildMeetingInvitationIcs({ ...base, recurrenceRule: malicious });
    // The injected text survives as inert content glued onto the RRULE value
    // — the point is that it must NOT become its own ICS line (no separate
    // spoofed ATTENDEE property).
    const lines = ics.split('\r\n');
    expect(lines).not.toContain('ATTENDEE;CN=Attacker:mailto:attacker@evil.example');
    expect(ics).toContain('RRULE:FREQ=WEEKLYATTENDEE;CN=Attacker:mailto:attacker@evil.example');
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
