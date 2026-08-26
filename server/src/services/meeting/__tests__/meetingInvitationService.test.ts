/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMeeting = vi.fn();
const mockListMeetingParticipants = vi.fn();
const mockSetParticipantDelivery = vi.fn().mockResolvedValue(undefined);
const mockDbRun = vi.fn().mockResolvedValue({ success: true, changes: 1 });
const mockSendEmail = vi.fn();

vi.mock('../../meetingService.js', () => ({
  getMeeting: (...args: unknown[]) => mockGetMeeting(...args),
}));

vi.mock('../meetingDay16Service.js', () => ({
  listMeetingParticipants: (...args: unknown[]) => mockListMeetingParticipants(...args),
  setParticipantDelivery: (...args: unknown[]) => mockSetParticipantDelivery(...args),
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../../emailService.js', () => ({
  send: (...args: unknown[]) => mockSendEmail(...args),
}));

import { sendMeetingInvitations } from '../meetingInvitationService.js';

const meeting = {
  id: 'meeting-1',
  title: 'Operating review',
  location: 'Zoom',
  startAt: '2026-08-26T08:00:00.000Z',
  endAt: '2026-08-26T09:00:00.000Z',
  timezone: 'Europe/Warsaw',
  recurrenceRule: null,
  invitationSequence: 0,
};

const organizer = {
  id: 'participant-organizer',
  role: 'organizer' as const,
  email: 'owner@example.com',
  displayName: 'Owner',
  invitationStatus: 'accepted' as const,
};

function guest(id: string, email: string) {
  return {
    id,
    role: 'attendee' as const,
    email,
    displayName: email,
    invitationStatus: 'invited' as const,
  };
}

describe('sendMeetingInvitations — FIX-7 per-recipient failure isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetParticipantDelivery.mockResolvedValue(undefined);
    mockDbRun.mockResolvedValue({ success: true, changes: 1 });
    mockGetMeeting.mockResolvedValue(meeting);
    // Live SMTP transport must be enabled for the mailer branch to run.
    process.env.MEETING_INVITES_LIVE = 'true';
    process.env.SMTP_HOST = 'smtp.example.invalid';
    process.env.SMTP_USER = 'smtp-user';
    delete process.env.DEMO_ORG_ID;
  });

  it('keeps delivering to the second recipient when the mailer throws for the first', async () => {
    const first = guest('participant-1', 'first@example.com');
    const second = guest('participant-2', 'second@example.com');
    mockListMeetingParticipants.mockResolvedValue([organizer, first, second]);
    mockSendEmail
      .mockRejectedValueOnce(new Error('ECONNRESET: SMTP transport exploded'))
      .mockResolvedValueOnce(true);

    const results = await sendMeetingInvitations({
      organizationId: 'org-1',
      meetingId: meeting.id,
      actorId: 'user-1',
    });

    // Both recipients got a delivery attempt — the throw on the first did
    // not abort the loop before the second was ever tried.
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(results).toEqual([
      {
        participantId: 'participant-1',
        status: 'failed',
        error: 'ECONNRESET: SMTP transport exploded',
      },
      { participantId: 'participant-2', status: 'sent' },
    ]);
    // Each recipient's own delivery status was persisted, including the
    // failed one — nothing was silently dropped.
    expect(mockSetParticipantDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: 'participant-1',
        status: 'failed',
        error: 'ECONNRESET: SMTP transport exploded',
      })
    );
    expect(mockSetParticipantDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ participantId: 'participant-2', status: 'sent' })
    );
    expect(mockDbRun).toHaveBeenCalledTimes(2);
  });

  it('records a generic reason when the mailer throws a non-Error value', async () => {
    const first = guest('participant-1', 'first@example.com');
    mockListMeetingParticipants.mockResolvedValue([organizer, first]);
    mockSendEmail.mockRejectedValueOnce('nope');

    const results = await sendMeetingInvitations({
      organizationId: 'org-1',
      meetingId: meeting.id,
      actorId: 'user-1',
    });

    expect(results).toEqual([
      { participantId: 'participant-1', status: 'failed', error: 'MAILER_DELIVERY_FAILED' },
    ]);
  });
});
