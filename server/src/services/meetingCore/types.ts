/**
 * types.ts — shared domain types for Meeting Core (Wave 2).
 *
 * See server/migrations/20260801_meeting_core.sql for the tables these types
 * describe, and lifecycle.ts for the state machine these statuses drive.
 */

export type MeetingLifecycleStatus =
  | 'DRAFT'
  | 'PREPARING'
  | 'READY'
  | 'LIVE'
  | 'CLOSING'
  | 'CLOSED'
  | 'CANCELLED';

export const MEETING_LIFECYCLE_STATUSES: readonly MeetingLifecycleStatus[] = [
  'DRAFT',
  'PREPARING',
  'READY',
  'LIVE',
  'CLOSING',
  'CLOSED',
  'CANCELLED',
];

/**
 * Meeting-scoped role — independent of the org-level role
 * (admin/owner/superadmin) that already gates DELETE/PATCH-status at the
 * route layer. `teresa` is the reserved system role; see TERESA_ACTOR_ID.
 */
export type MeetingRole = 'owner' | 'facilitator' | 'participant' | 'observer' | 'teresa';

export const MEETING_ROLES: readonly MeetingRole[] = [
  'owner',
  'facilitator',
  'participant',
  'observer',
  'teresa',
];

/**
 * Fixed sentinel user id representing Teresa (the AI copilot) as a meeting
 * participant. Never a real users.id — this is how the domain distinguishes
 * "a human proposed/authored this" from "the system did". Teresa is added as
 * a participant automatically when a meeting is created via meetingCore.
 */
export const TERESA_ACTOR_ID = 'system:teresa';

export type NoteEntryType =
  | 'discussion'
  | 'insight'
  | 'question'
  | 'risk'
  | 'proposed_decision'
  | 'proposed_task'
  | 'parking_lot';

export const NOTE_ENTRY_TYPES: readonly NoteEntryType[] = [
  'discussion',
  'insight',
  'question',
  'risk',
  'proposed_decision',
  'proposed_task',
  'parking_lot',
];

export type NoteEntryStatus = 'active' | 'archived';

export type NoteAuthorKind = 'human' | 'system';

export type OutputKind = 'task' | 'decision';

export type OutputStatus =
  | 'PROPOSED'
  | 'APPROVED'
  | 'REJECTED'
  | 'MATERIALIZING'
  | 'MATERIALIZED'
  | 'MATERIALIZATION_FAILED';

/** The server-derived actor performing an operation — never trust body/header org or role. */
export interface MeetingActor {
  userId: string;
  organizationId: string;
  kind: NoteAuthorKind;
}

export interface MeetingCoreRecord {
  id: string;
  organizationId: string;
  projectId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  purpose: string | null;
  expectedOutcomes: string | null;
  preparationNotes: string | null;
  lifecycleStatus: MeetingLifecycleStatus | null;
  /** Legacy `status` column (scheduled|completed) — read by My Work calendar. Untouched by meetingCore. */
  legacyStatus: string;
  closedAt: string | null;
  closedBy: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingParticipantRecord {
  id: string;
  meetingId: string;
  organizationId: string;
  userId: string;
  meetingRole: MeetingRole;
  invitedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingNoteEntryRecord {
  id: string;
  meetingId: string;
  organizationId: string;
  entryType: NoteEntryType;
  content: string;
  authorUserId: string;
  authorKind: NoteAuthorKind;
  status: NoteEntryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingOutputRecord {
  id: string;
  meetingId: string;
  organizationId: string;
  sourceNoteEntryId: string | null;
  outputKind: OutputKind;
  proposedPayload: Record<string, unknown>;
  status: OutputStatus;
  canonicalId: string | null;
  idempotencyKey: string;
  failureReason: string | null;
  proposedBy: string;
  proposedByKind: NoteAuthorKind;
  reviewedBy: string | null;
  reviewedAt: string | null;
  materializedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingAggregate {
  meeting: MeetingCoreRecord;
  participants: MeetingParticipantRecord[];
  notes: MeetingNoteEntryRecord[];
  outputs: MeetingOutputRecord[];
}
