export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

// FIX-4 (P2, 2026-08-26): parameter values (e.g. CN=...) follow a different
// escaping rule from property VALUEs. RFC 5545 §3.2 param-value grammar has
// no backslash-escape mechanism at all — a value containing COLON,
// SEMICOLON, or COMMA must instead be wrapped in DQUOTE (a quoted-string).
// The previous code ran participant/organizer display names through
// escapeIcsText (backslash-escaping, correct for content VALUEs like
// SUMMARY/DESCRIPTION) which is invalid here: `CN=Doe\, Jane` is not
// well-formed ICS and readers may parse the comma as ending the CN value.
// DQUOTE cannot itself appear inside a quoted-string (no escape for it), and
// CR/LF must never appear in an unfolded parameter, so both are stripped.
export function formatIcsParamValue(value: string): string {
  const sanitized = value.replace(/[\r\n"]/g, '');
  return /[,;:]/.test(sanitized) ? `"${sanitized}"` : sanitized;
}

// FIX-5 (P2, 2026-08-26): RFC 5545 §3.1 requires content lines to be folded
// at 75 octets — a long unfolded line (e.g. a verbose SUMMARY) is invalid
// ICS and some parsers truncate or reject it. Fold by inserting CRLF +
// a single leading space before the line would exceed 75 octets; the
// leading space is unfolded away by any RFC-conformant reader and does not
// become part of the value. Splits are octet-based (UTF-8 byte length, not
// JS string length) but never inside a multi-byte character.
function foldIcsLine(line: string): string {
  const LIMIT = 75;
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= LIMIT) return line;
  const parts: string[] = [];
  let start = 0;
  let limit = LIMIT;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Back off if `end` lands inside a multi-byte UTF-8 sequence (a
    // continuation byte has the high bits 10xxxxxx).
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end--;
    }
    parts.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
    // Continuation lines carry a 1-octet leading space that counts toward
    // their own 75-octet budget.
    limit = LIMIT - 1;
  }
  return parts.join('\r\n ');
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
  const name = formatIcsParamValue(participant.displayName || participant.email);
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
    // FIX-1 (P1-1/P1-4, 2026-08-26): startAt/endAt are already absolute UTC
    // instants (ISO strings with a Z offset, e.g. from the DB). The previous
    // code stripped the trailing Z and slapped `TZID=<meeting timezone>` on
    // the value WITHOUT converting the clock time to that zone — RFC 5545
    // says a TZID-qualified DTSTART is local wall-clock time in that zone, so
    // a 08:00 UTC meeting for Europe/Warsaw (UTC+2 in August) was emitted as
    // "08:00 Warsaw time" instead of "10:00 Warsaw time" — every invite was
    // off by the zone's UTC offset (2h for Europe/Warsaw). Emitting plain
    // UTC with the required `Z` suffix per RFC 5545 3.3.5 is correct
    // regardless of the organizer's/attendees' local zone and needs no
    // VTIMEZONE block. The meeting's configured timezone is still carried as
    // an informational X-property so downstream tooling/support can see what
    // zone the organizer scheduled in without it affecting the actual instant.
    `DTSTART:${formatIcsDate(input.startAt)}`,
    `DTEND:${formatIcsDate(input.endAt)}`,
    `X-CONSULTIFY-TIMEZONE:${escapeIcsText(input.timezone)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
    `DESCRIPTION:${escapeIcsText(input.description || '')}`,
    `LOCATION:${escapeIcsText(input.location || '')}`,
    `ORGANIZER;CN=${formatIcsParamValue(input.organizer.displayName || input.organizer.email)}:mailto:${input.organizer.email}`,
  ];
  if (method === 'CANCEL') {
    // FIX-3 (P2, 2026-08-26): RFC 5546 §3.2.5 requires a CANCEL component to
    // carry STATUS:CANCELLED — without it, some calendar clients (Outlook in
    // particular) show METHOD:CANCEL as an ordinary update rather than
    // removing/greying out the event.
    lines.push('STATUS:CANCELLED');
  }
  if (input.recurrenceRule) {
    // FIX-2 (P1-2, 2026-08-26) defense in depth: the route layer validates
    // recurrenceRule against a strict FREQ/INTERVAL/... whitelist before it
    // ever reaches here (server/src/routes/meeting.routes.ts,
    // validateRecurrenceRule), but this builder must not rely on that as its
    // only guard — strip any CR/LF an upstream caller might still pass
    // through. An unescaped line break inside an RRULE value would inject
    // arbitrary extra ICS lines (e.g. a spoofed ATTENDEE/ORGANIZER) into the
    // generated invite.
    const safeRecurrenceRule = input.recurrenceRule.replace(/^RRULE:/i, '').replace(/[\r\n]/g, '');
    if (safeRecurrenceRule) lines.push(`RRULE:${safeRecurrenceRule}`);
  }
  lines.push(...input.attendees.map(participantLine), 'END:VEVENT', 'END:VCALENDAR', '');
  return lines.map(foldIcsLine).join('\r\n');
}
