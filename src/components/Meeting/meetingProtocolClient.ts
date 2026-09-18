/**
 * MTG-2a (DEC-607) — read/approve client for the structured meeting protocol.
 *
 * The protocol is generated server-side from meeting registers (agenda,
 * attendance, decisions, actions) — see `server/src/services/meeting/
 * meetingProtocolService.ts`. This client mirrors those block types 1:1 and
 * calls the three routes mounted at `/api/meeting` (Gateway.ts:770):
 *   GET  /:id/protocol          -> ProtocolPreview (pure read, never persists)
 *   POST /:id/protocol/approve  -> MeetingProtocol (draft -> approved v1.0)
 *   POST /:id/protocol/errata   -> MeetingProtocol (approved -> new vN draft)
 *
 * Same fetch discipline as `meetingAgendaClient.ts`: errors carry `.status` so
 * the viewer can tell 403/404 (no access) from a transport fault, and never
 * invents content on failure.
 */

export type ProtocolBlockKind =
  | 'meta'
  | 'roles'
  | 'attendance'
  | 'agenda'
  | 'proceedings'
  | 'decisions'
  | 'actions'
  | 'footer';

export interface ProtocolMetaBlock {
  kind: 'meta';
  title: string;
  startAt: string;
  endAt: string;
  timezone: string | null;
  location: string;
  meetingType: string | null;
  lifecycleState: string;
}

export interface ProtocolRolesBlock {
  kind: 'roles';
  chair: string | null;
  scribe: string | null;
  approver: string | null;
}

export interface ProtocolAttendanceBlock {
  kind: 'attendance';
  accepted: string[];
  declined: string[];
  pending: string[];
}

export interface ProtocolAgendaPoint {
  position: number;
  title: string;
  durationMinutes: number;
  purpose: string;
  lead: string | null;
  notes: string;
}

export interface ProtocolAgendaBlock {
  kind: 'agenda';
  items: ProtocolAgendaPoint[];
}

export interface ProtocolProceedingPoint {
  position: number;
  title: string;
  notes: string;
  decisionCount: number;
  actionCount: number;
}

export interface ProtocolProceedingsBlock {
  kind: 'proceedings';
  points: ProtocolProceedingPoint[];
}

export interface ProtocolDecision {
  statement: string;
  rationale: string;
  owner: string | null;
  decisionType: string | null;
  impact: string | null;
  rejectedAlternative: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  status: string;
}

export interface ProtocolDecisionsBlock {
  kind: 'decisions';
  items: ProtocolDecision[];
}

export interface ProtocolAction {
  title: string;
  owner: string | null;
  dueAt: string | null;
  status: string;
  taskId: string | null;
  taskStatus: string | null;
  agendaItemTitle: string | null;
}

export interface ProtocolActionsBlock {
  kind: 'actions';
  items: ProtocolAction[];
}

export interface ProtocolVersionInfo {
  version: string;
  status: string;
  approvedAt: string | null;
  approvedBy: string | null;
  errata: string;
}

export interface ProtocolFooterBlock {
  kind: 'footer';
  nextOccurrence: string | null;
  versions: ProtocolVersionInfo[];
}

export type ProtocolBlock =
  | ProtocolMetaBlock
  | ProtocolRolesBlock
  | ProtocolAttendanceBlock
  | ProtocolAgendaBlock
  | ProtocolProceedingsBlock
  | ProtocolDecisionsBlock
  | ProtocolActionsBlock
  | ProtocolFooterBlock;

export interface ProtocolContent {
  meetingId: string;
  generatedAt: string;
  blocks: ProtocolBlock[];
}

/** Shape returned by GET /:id/protocol (a pure read — draft is always live from source, never persisted). */
export interface ProtocolPreview {
  /** Always null — a working draft never writes a row (W109b). */
  id: string | null;
  /** '1.0' before first publish, else the next version after the published one. */
  version: string;
  /** Working view is always 'draft'; the snapshot lives only in approved rows. */
  status: 'draft' | 'approved';
  /** Always live from source — never `content_json`. */
  content: ProtocolContent;
  /** Last PUBLISHED (approved) version, or null before the first publication. */
  publishedVersion: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  errataNote: string;
  /** Always false — a draft does not persist. */
  persisted: boolean;
}

/** Shape returned by the approve / errata mutations (a persisted row). */
export interface MeetingProtocol {
  id: string;
  organizationId: string;
  meetingId: string;
  version: string;
  status: 'draft' | 'approved';
  content: ProtocolContent;
  sourceDigest: string | null;
  approvedByUserId: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  errataNote: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingProtocolApiError extends Error {
  status?: number;
  code?: string;
}

function protocolError(status: number, code?: string): MeetingProtocolApiError {
  const error: MeetingProtocolApiError = new Error(code || `HTTP_${status}`);
  error.status = status;
  error.code = code;
  return error;
}

async function readErrorCode(response: Response): Promise<string | undefined> {
  const body = (await response.json().catch(() => null)) as { code?: unknown; error?: unknown } | null;
  if (body && typeof body.code === 'string') return body.code;
  if (body && typeof body.error === 'string') return body.error;
  return undefined;
}

/** Pure read of the protocol for render — never persists a row. */
export async function fetchMeetingProtocolPreview(meetingId: string): Promise<ProtocolPreview> {
  const response = await fetch(`/api/meeting/${encodeURIComponent(meetingId)}/protocol`, {
    credentials: 'include',
  });
  if (!response.ok) throw protocolError(response.status, await readErrorCode(response));
  const payload = (await response.json()) as { protocol?: ProtocolPreview };
  if (!payload?.protocol) throw protocolError(response.status, 'MEETING_PROTOCOL_INVALID');
  return payload.protocol;
}

/** Chair/organizer accept: draft -> approved v1.0 (frozen). */
export async function approveMeetingProtocol(meetingId: string): Promise<MeetingProtocol> {
  const response = await fetch(`/api/meeting/${encodeURIComponent(meetingId)}/protocol/approve`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw protocolError(response.status, await readErrorCode(response));
  const payload = (await response.json()) as { protocol?: MeetingProtocol };
  if (!payload?.protocol) throw protocolError(response.status, 'MEETING_PROTOCOL_INVALID');
  return payload.protocol;
}

/** Edit an approved protocol: creates the next version draft carrying an errata note. */
export async function createMeetingProtocolErrata(
  meetingId: string,
  errataNote: string
): Promise<MeetingProtocol> {
  const response = await fetch(`/api/meeting/${encodeURIComponent(meetingId)}/protocol/errata`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ errataNote }),
  });
  if (!response.ok) throw protocolError(response.status, await readErrorCode(response));
  const payload = (await response.json()) as { protocol?: MeetingProtocol };
  if (!payload?.protocol) throw protocolError(response.status, 'MEETING_PROTOCOL_INVALID');
  return payload.protocol;
}

/** Narrow a block union by kind (keeps the viewer's switches type-safe). */
export function blockOf<K extends ProtocolBlockKind>(
  blocks: ProtocolBlock[],
  kind: K
): Extract<ProtocolBlock, { kind: K }> | null {
  return (blocks.find((b) => b.kind === kind) as Extract<ProtocolBlock, { kind: K }>) || null;
}
