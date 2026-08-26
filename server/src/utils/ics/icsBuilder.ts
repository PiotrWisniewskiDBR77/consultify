export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function formatIcsDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid ICS date');
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

export type IcsParticipant = {
  email: string;
  displayName?: string;
  role?: 'organizer' | 'attendee' | 'optional';
  invitationStatus?: 'invited' | 'accepted' | 'declined' | 'tentative' | 'no_response';
};

export type MeetingInvitationIcsInput = {
  uid: string;
  sequence?: number;
  method?: 'REQUEST' | 'CANCEL';
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  timezone: string;
  recurrenceRule?: string | null;
  organizer: IcsParticipant;
  attendees: IcsParticipant[];
};

const partStat = (status: IcsParticipant['invitationStatus']): string => {
  if (status === 'accepted') return 'ACCEPTED';
  if (status === 'declined') return 'DECLINED';
  if (status === 'tentative') return 'TENTATIVE';
  return 'NEEDS-ACTION';
};

const participantLine = (participant: IcsParticipant): string => {
  const role = participant.role === 'optional' ? 'OPT-PARTICIPANT' : 'REQ-PARTICIPANT';
  const name = escapeIcsText(participant.displayName || participant.email);
  return `ATTENDEE;CN=${name};ROLE=${role};PARTSTAT=${partStat(participant.invitationStatus)};RSVP=TRUE:mailto:${participant.email}`;
};

export function buildMeetingInvitationIcs(input: MeetingInvitationIcsInput): string {
  if (!input.timezone.trim()) throw new Error('timezone is required');
  if (!input.organizer.email.trim()) throw new Error('organizer email is required');
  const method = input.method || 'REQUEST';
  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Consultify//Meetings//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(input.uid)}`,
    `SEQUENCE:${Math.max(0, input.sequence || 0)}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART;TZID=${escapeIcsText(input.timezone)}:${formatIcsDate(input.startAt).replace(/Z$/, '')}`,
    `DTEND;TZID=${escapeIcsText(input.timezone)}:${formatIcsDate(input.endAt).replace(/Z$/, '')}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
    `DESCRIPTION:${escapeIcsText(input.description || '')}`,
    `LOCATION:${escapeIcsText(input.location || '')}`,
    `ORGANIZER;CN=${escapeIcsText(input.organizer.displayName || input.organizer.email)}:mailto:${input.organizer.email}`,
  ];
  if (input.recurrenceRule) {
    lines.push(`RRULE:${input.recurrenceRule.replace(/^RRULE:/i, '')}`);
  }
  lines.push(...input.attendees.map(participantLine), 'END:VEVENT', 'END:VCALENDAR', '');
  return lines.join('\r\n');
}
