import { v4 as uuidv4 } from 'uuid';

import { send as sendEmail } from '../emailService.js';
import { getMeeting } from '../meetingService.js';
import { run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { buildMeetingInvitationIcs } from '../../utils/ics/icsBuilder.js';
import {
  listMeetingParticipants,
  MeetingParticipant,
  setParticipantDelivery,
} from './meetingDay16Service.js';

export type InvitationDeliveryResult = {
  participantId: string;
  status: MeetingParticipant['deliveryStatus'];
  error?: string;
};

const isLiveTransportEnabled = (): boolean =>
  process.env.MEETING_INVITES_LIVE === 'true' &&
  Boolean(process.env.SMTP_HOST) &&
  Boolean(process.env.SMTP_USER);

export async function sendMeetingInvitations(input: {
  organizationId: string;
  meetingId: string;
  actorId: string;
  participantIds?: string[];
  method?: 'REQUEST' | 'CANCEL';
}): Promise<InvitationDeliveryResult[]> {
  const meeting = await getMeeting(input);
  if (!meeting) throw new Error('MEETING_NOT_FOUND');
  const participants = await listMeetingParticipants(input);
  const organizer = participants.find((item) => item.role === 'organizer');
  if (!organizer?.email) throw new Error('ORGANIZER_EMAIL_REQUIRED');
  const wanted = new Set(input.participantIds || []);
  const recipients = participants.filter(
    (item) => item.role !== 'organizer' && item.email && (wanted.size === 0 || wanted.has(item.id))
  );
  const method = input.method || 'REQUEST';
  const demoOrgId = process.env.DEMO_ORG_ID || 'demo-org';
  const live = isLiveTransportEnabled();
  const results: InvitationDeliveryResult[] = [];

  for (const participant of recipients) {
    const ics = buildMeetingInvitationIcs({
      uid: `${meeting.id}@consultify`,
      sequence: meeting.invitationSequence,
      method,
      title: meeting.title,
      location: meeting.location,
      startAt: meeting.startAt,
      endAt: meeting.endAt,
      timezone: meeting.timezone || 'UTC',
      recurrenceRule: meeting.recurrenceRule,
      organizer: {
        email: organizer.email,
        displayName: organizer.displayName,
        role: 'organizer',
        invitationStatus: 'accepted',
      },
      attendees: participants
        .filter((item) => item.role !== 'organizer' && item.email)
        .map((item) => ({
          email: item.email!,
          displayName: item.displayName,
          role: item.role,
          invitationStatus: item.invitationStatus,
        })),
    });

    let status: MeetingParticipant['deliveryStatus'];
    let error: string | undefined;
    if (input.organizationId === demoOrgId) {
      status = 'blocked_demo';
      // FIX-8 (P2 PII, 2026-08-26): log identifiers, not personal data, at
      // info level — meetingId/participantId/status are enough to trace a
      // delivery in production logs without an email address landing in
      // them (info-level logs are typically retained/aggregated far more
      // broadly than debug).
      logger.warn(
        `[Meeting invitations] blocked_demo meetingId=${meeting.id} participantId=${participant.id} status=blocked_demo`
      );
    } else if (!live) {
      status = 'captured';
      logger.info(
        `[Meeting invitations] captured meetingId=${meeting.id} participantId=${participant.id} status=captured`
      );
      // Full ICS content and the recipient's email are useful for local
      // debugging but are PII-bearing / verbose — keep them at debug only.
      logger.debug(
        `[Meeting invitations] captured payload meetingId=${meeting.id} participantId=${participant.id} recipient=${participant.email}\n${ics}`
      );
    } else {
      // FIX-7 (P2, 2026-08-26): sendEmail() rejecting (SMTP transport
      // exception, network error, etc.) used to propagate straight out of
      // sendMeetingInvitations and abort the whole batch — every recipient
      // after the failing one never got a delivery attempt or a status row
      // at all, not even 'failed'. Contain the failure to this one
      // recipient so one bad address/transient error can't block delivery
      // to the rest of the invite list.
      try {
        const sent = await sendEmail({
          to: participant.email!,
          subject:
            method === 'CANCEL' ? `Cancelled: ${meeting.title}` : `Invitation: ${meeting.title}`,
          html: `<p>${meeting.title}</p><p>${meeting.startAt}</p><p>${meeting.location}</p>`,
          attachments: [
            {
              filename: 'invite.ics',
              content: ics,
              contentType: `text/calendar; method=${method}`,
            },
          ],
          requireDelivery: true,
        });
        status = sent ? 'sent' : 'failed';
        error = sent ? undefined : 'MAILER_DELIVERY_FAILED';
      } catch (err: unknown) {
        status = 'failed';
        error = err instanceof Error ? err.message : 'MAILER_DELIVERY_FAILED';
      }
    }
    await setParticipantDelivery({ ...input, participantId: participant.id, status, error });
    await dbRun(
      `INSERT INTO meeting_invitation_deliveries (
         id, organization_id, meeting_id, participant_id, method, sequence,
         delivery_status, attempted_by, attempted_at, error
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `meeting-delivery-${uuidv4()}`,
        input.organizationId,
        input.meetingId,
        participant.id,
        method,
        meeting.invitationSequence,
        status,
        input.actorId,
        new Date().toISOString(),
        error || null,
      ]
    );
    results.push({ participantId: participant.id, status, ...(error ? { error } : {}) });
  }
  return results;
}
