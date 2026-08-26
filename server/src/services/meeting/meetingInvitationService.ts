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
      logger.warn(`[Meeting invitations] blocked demo delivery meeting=${meeting.id}`);
    } else if (!live) {
      status = 'captured';
      logger.info(
        `[Meeting invitations] captured recipient=${participant.email} meeting=${meeting.id}\n${ics}`
      );
    } else {
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
