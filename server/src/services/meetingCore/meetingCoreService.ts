/**
 * meetingCoreService.ts — the ONE canonical owner of meeting creation,
 * preparation, participants/roles, lifecycle transitions, structured notes,
 * closure, and aggregate reads. Reuses the existing `meetings` table
 * (extended additively — see server/migrations/20260801_meeting_core.sql),
 * never a second registry.
 *
 * Every function derives `organizationId`/`actorUserId` from the caller
 * (which in production is the verified JWT via meeting.routes.ts —
 * req.user.organizationId / req.user.id) and folds `organizationId` into
 * every query — tenant isolation is enforced here, not left to callers.
 * Nothing here ever accepts a body/header-supplied organizationId or lets an
 * actor act as anyone but themselves.
 */

import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';

import { resolvePgPool, withPgTransaction } from '../../utils/pgTransaction.js';
import { writeAuditEvent } from './auditLog.js';
import { ForbiddenError, MeetingNotFoundError, ValidationError } from './errors.js';
import {
  assertMeetingIsWritable,
  assertTransitionAllowed,
  type MeetingTransitionName,
} from './lifecycle.js';
import {
  adoptLegacyMeetingRow,
  archiveNoteRow,
  getMeetingRow,
  getParticipantRoleRow,
  insertMeetingRow,
  insertNoteRow,
  listNoteRows,
  listOutputRows,
  listParticipantRows,
  removeParticipantRow,
  setMeetingClosedRow,
  setMeetingLifecycleRow,
  updateMeetingPrepRow,
  upsertParticipantRow,
} from './repo.js';
import {
  MEETING_LIFECYCLE_STATUSES,
  type MeetingAggregate,
  type MeetingCoreRecord,
  type MeetingNoteEntryRecord,
  type MeetingOutputRecord,
  type MeetingParticipantRecord,
  type MeetingRole,
  type NoteAuthorKind,
  type NoteEntryType,
  TERESA_ACTOR_ID,
} from './types.js';

export { MEETING_LIFECYCLE_STATUSES };
export type { MeetingTransitionName };

const PREP_EDIT_ROLES = ['owner', 'facilitator'] as const;
const PARTICIPANT_MANAGE_ROLES = ['owner', 'facilitator'] as const;
const NOTE_WRITE_ROLES = ['owner', 'facilitator', 'participant', 'teresa'] as const;

// ==========================================
// Create
// ==========================================

export interface CreateMeetingCoreInput {
  organizationId: string;
  createdBy: string;
  projectId?: string | null;
  title: string;
  startAt: string;
  endAt?: string;
  location?: string;
  purpose?: string;
  expectedOutcomes?: string;
  preparationNotes?: string;
}

/**
 * Creates a DRAFT meeting and seeds two participants: the creator as
 * `owner`, and the reserved Teresa sentinel as `teresa` — every meeting has
 * a system participant from birth so proposeOutput/addNoteEntry never need
 * a special-cased "does Teresa exist yet" check.
 */
export async function createMeetingCore(
  input: CreateMeetingCoreInput,
  pool?: Pool
): Promise<MeetingCoreRecord> {
  const title = input.title.trim();
  const startAt = input.startAt.trim();
  if (!title) throw new ValidationError('title is required');
  if (!startAt) throw new ValidationError('startAt is required');

  return withPgTransaction(async (client) => {
    const id = `meeting-${randomUUID()}`;
    const meeting = await insertMeetingRow(client, {
      id,
      organizationId: input.organizationId,
      projectId: input.projectId || null,
      title,
      startAt,
      endAt: (input.endAt || startAt).trim(),
      location: (input.location || '').trim(),
      purpose: input.purpose?.trim() || null,
      expectedOutcomes: input.expectedOutcomes?.trim() || null,
      preparationNotes: input.preparationNotes?.trim() || null,
      lifecycleStatus: 'DRAFT',
      createdBy: input.createdBy,
    });

    await upsertParticipantRow(client, {
      meetingId: id,
      organizationId: input.organizationId,
      userId: input.createdBy,
      role: 'owner',
      invitedBy: input.createdBy,
    });
    await upsertParticipantRow(client, {
      meetingId: id,
      organizationId: input.organizationId,
      userId: TERESA_ACTOR_ID,
      role: 'teresa',
      invitedBy: input.createdBy,
    });

    await writeAuditEvent(client, {
      actorId: input.createdBy,
      action: 'MEETING_CREATED',
      resourceType: 'meeting',
      resourceId: id,
      organizationId: input.organizationId,
      metadata: { title },
    });

    return meeting;
  }, pool);
}

/**
 * Idempotently brings a meeting created by the legacy CRUD route under the
 * governed lifecycle without creating a second Meeting ID.
 */
export async function adoptLegacyMeetingCore(
  input: { organizationId: string; meetingId: string; actorUserId: string },
  pool?: Pool
): Promise<MeetingCoreRecord> {
  return withPgTransaction(async (client) => {
    const existing = await getMeetingRow(client, input.organizationId, input.meetingId);
    if (!existing) throw new MeetingNotFoundError();
    if (existing.createdBy !== input.actorUserId) {
      throw new ForbiddenError('Only the meeting creator may enable governed minutes.');
    }
    const meeting = await adoptLegacyMeetingRow(client, input.organizationId, input.meetingId);
    if (!meeting) throw new MeetingNotFoundError();
    await upsertParticipantRow(client, {
      meetingId: meeting.id,
      organizationId: input.organizationId,
      userId: input.actorUserId,
      role: 'owner',
      invitedBy: input.actorUserId,
    });
    await upsertParticipantRow(client, {
      meetingId: meeting.id,
      organizationId: input.organizationId,
      userId: TERESA_ACTOR_ID,
      role: 'teresa',
      invitedBy: input.actorUserId,
    });
    await writeAuditEvent(client, {
      actorId: input.actorUserId,
      action: 'MEETING_CORE_ADOPTED',
      resourceType: 'meeting',
      resourceId: meeting.id,
      organizationId: input.organizationId,
      metadata: { previousLifecycleStatus: existing.lifecycleStatus },
    });
    return meeting;
  }, pool);
}

// ==========================================
// Prep edits
// ==========================================

export interface UpdateMeetingPrepInput {
  organizationId: string;
  meetingId: string;
  actorUserId: string;
  title?: string;
  startAt?: string;
  endAt?: string;
  location?: string;
  purpose?: string;
  expectedOutcomes?: string;
  preparationNotes?: string;
}

export async function updateMeetingPrep(
  input: UpdateMeetingPrepInput,
  pool?: Pool
): Promise<MeetingCoreRecord> {
  return withPgTransaction(async (client) => {
    const meeting = await getMeetingRow(client, input.organizationId, input.meetingId);
    if (!meeting) throw new MeetingNotFoundError();
    assertMeetingIsWritable(meeting.lifecycleStatus);

    const role = await getParticipantRoleRow(
      client,
      input.organizationId,
      input.meetingId,
      input.actorUserId
    );
    if (!role || !PREP_EDIT_ROLES.includes(role as (typeof PREP_EDIT_ROLES)[number])) {
      throw new ForbiddenError(
        `updateMeetingPrep: role '${role ?? 'none'}' may not edit meeting prep (allowed: ${PREP_EDIT_ROLES.join(', ')}).`
      );
    }
    if (input.title !== undefined && !input.title.trim()) {
      throw new ValidationError('title cannot be empty');
    }
    if (input.startAt !== undefined && !input.startAt.trim()) {
      throw new ValidationError('startAt cannot be empty');
    }

    const updated = await updateMeetingPrepRow(client, input.organizationId, input.meetingId, {
      title: input.title?.trim(),
      startAt: input.startAt?.trim(),
      endAt: input.endAt?.trim(),
      location: input.location?.trim(),
      purpose: input.purpose?.trim(),
      expectedOutcomes: input.expectedOutcomes?.trim(),
      preparationNotes: input.preparationNotes?.trim(),
    });
    if (!updated) throw new MeetingNotFoundError();

    await writeAuditEvent(client, {
      actorId: input.actorUserId,
      action: 'MEETING_PREP_UPDATED',
      resourceType: 'meeting',
      resourceId: input.meetingId,
      organizationId: input.organizationId,
      metadata: {
        fields: Object.keys(input).filter(
          (k) => !['organizationId', 'meetingId', 'actorUserId'].includes(k)
        ),
      },
    });

    return updated;
  }, pool);
}

// ==========================================
// Participants
// ==========================================

export async function addParticipant(
  input: {
    organizationId: string;
    meetingId: string;
    actorUserId: string;
    userId: string;
    role: MeetingRole;
  },
  pool?: Pool
): Promise<MeetingParticipantRecord> {
  if (input.role === 'teresa') {
    throw new ValidationError(
      "Cannot manually add a participant with role 'teresa' — it is reserved for the system."
    );
  }
  return withPgTransaction(async (client) => {
    const meeting = await getMeetingRow(client, input.organizationId, input.meetingId);
    if (!meeting) throw new MeetingNotFoundError();
    assertMeetingIsWritable(meeting.lifecycleStatus);

    const actingRole = await getParticipantRoleRow(
      client,
      input.organizationId,
      input.meetingId,
      input.actorUserId
    );
    if (
      !actingRole ||
      !PARTICIPANT_MANAGE_ROLES.includes(actingRole as (typeof PARTICIPANT_MANAGE_ROLES)[number])
    ) {
      throw new ForbiddenError(
        `addParticipant: role '${actingRole ?? 'none'}' may not manage participants (allowed: ${PARTICIPANT_MANAGE_ROLES.join(', ')}).`
      );
    }

    const participant = await upsertParticipantRow(client, {
      meetingId: input.meetingId,
      organizationId: input.organizationId,
      userId: input.userId,
      role: input.role,
      invitedBy: input.actorUserId,
    });

    await writeAuditEvent(client, {
      actorId: input.actorUserId,
      action: 'MEETING_PARTICIPANT_ADDED',
      resourceType: 'meeting_participant',
      resourceId: participant.id,
      organizationId: input.organizationId,
      metadata: { meetingId: input.meetingId, userId: input.userId, role: input.role },
    });

    return participant;
  }, pool);
}

export async function listParticipants(
  input: { organizationId: string; meetingId: string },
  pool?: Pool
): Promise<MeetingParticipantRecord[]> {
  const p = await resolvePgPool(pool);
  return listParticipantRows(p, input.organizationId, input.meetingId);
}

export async function removeParticipant(
  input: { organizationId: string; meetingId: string; actorUserId: string; targetUserId: string },
  pool?: Pool
): Promise<void> {
  if (input.targetUserId === TERESA_ACTOR_ID) {
    throw new ValidationError("Cannot remove the reserved 'teresa' participant.");
  }
  return withPgTransaction(async (client) => {
    const meeting = await getMeetingRow(client, input.organizationId, input.meetingId);
    if (!meeting) throw new MeetingNotFoundError();
    assertMeetingIsWritable(meeting.lifecycleStatus);

    const actingRole = await getParticipantRoleRow(
      client,
      input.organizationId,
      input.meetingId,
      input.actorUserId
    );
    if (
      !actingRole ||
      !PARTICIPANT_MANAGE_ROLES.includes(actingRole as (typeof PARTICIPANT_MANAGE_ROLES)[number])
    ) {
      throw new ForbiddenError(
        `removeParticipant: role '${actingRole ?? 'none'}' may not manage participants (allowed: ${PARTICIPANT_MANAGE_ROLES.join(', ')}).`
      );
    }
    const removed = await removeParticipantRow(
      client,
      input.organizationId,
      input.meetingId,
      input.targetUserId
    );
    if (!removed) throw new MeetingNotFoundError('Participant not found');

    await writeAuditEvent(client, {
      actorId: input.actorUserId,
      action: 'MEETING_PARTICIPANT_REMOVED',
      resourceType: 'meeting_participant',
      resourceId: `${input.meetingId}:${input.targetUserId}`,
      organizationId: input.organizationId,
      metadata: { meetingId: input.meetingId, userId: input.targetUserId },
    });
  }, pool);
}

// ==========================================
// Lifecycle transitions
// ==========================================

/**
 * Runs a single named transition atomically with its audit event (BLOKER 1:
 * both statements execute on the SAME pinned client inside ONE
 * BEGIN/COMMIT — see pgTransaction.ts). Illegal state or role throws before
 * any write happens (assertTransitionAllowed runs first, inside the same
 * transaction, so a failed check never partially commits anything).
 */
export async function transitionMeeting(
  input: {
    organizationId: string;
    meetingId: string;
    actorUserId: string;
    transition: MeetingTransitionName;
  },
  pool?: Pool
): Promise<MeetingCoreRecord> {
  return withPgTransaction(async (client) => {
    const meeting = await getMeetingRow(client, input.organizationId, input.meetingId);
    if (!meeting) throw new MeetingNotFoundError();

    const role = await getParticipantRoleRow(
      client,
      input.organizationId,
      input.meetingId,
      input.actorUserId
    );
    const rule = assertTransitionAllowed(input.transition, meeting.lifecycleStatus, role);

    const updated = await setMeetingLifecycleRow(
      client,
      input.organizationId,
      input.meetingId,
      rule.to
    );
    if (!updated) throw new MeetingNotFoundError();

    await writeAuditEvent(client, {
      actorId: input.actorUserId,
      action: `MEETING_TRANSITION_${input.transition}`,
      resourceType: 'meeting',
      resourceId: input.meetingId,
      organizationId: input.organizationId,
      metadata: { from: meeting.lifecycleStatus, to: rule.to },
    });

    return updated;
  }, pool);
}

export interface CloseMeetingResult {
  meeting: MeetingCoreRecord;
  /**
   * Proposed OR approved, but never materialized — a human has either not
   * yet triaged it (PROPOSED) or triaged it and green-lit it but nothing
   * ever turned it into a real task/decision (APPROVED). Both are "still
   * needs someone to do something", so both are reported here — an APPROVED
   * output is exactly as unresolved as a PROPOSED one from the closing
   * meeting's point of view, not a quieter, closer-to-done state.
   */
  unresolvedOutputs: MeetingOutputRecord[];
  /** A materialization attempt ran and failed — visible with `failureReason`, never silently reported as done. */
  failedOutputs: MeetingOutputRecord[];
  /**
   * Claimed for materialization (see markOutputMaterializingRow in repo.ts)
   * but never confirmed one way or the other — the worst of the three,
   * because it is not even retryable through the normal materializeOutput()
   * path (that path's atomic claim only accepts APPROVED or
   * MATERIALIZATION_FAILED, deliberately NOT MATERIALIZING, to protect the
   * concurrency fix from commit e51e57a4be). Reported here by name — never
   * folded into `unresolvedOutputs` — so it is visibly distinct and points
   * the caller at `reconcileMaterializingOutput` (outputs.ts) instead of a
   * bare retry.
   */
  materializingOutputs: MeetingOutputRecord[];
}

/**
 * CLOSE transition + an honest report of anything left dangling. Closing
 * never silently drops PROPOSED/APPROVED outputs, MATERIALIZATION_FAILED
 * ones, or stuck MATERIALIZING ones — all three are returned to the caller,
 * each under its own name, so the UI/API response can surface them, per
 * "Domknięcie uczciwie raportuje nierozwiązane/nieudane/zakleszczone
 * outputy." Closing does NOT block on unresolved outputs — a meeting that
 * must stay open forever until every proposal is triaged is a worse failure
 * mode than a closed meeting with a visible, reported backlog.
 */
export async function closeMeeting(
  input: { organizationId: string; meetingId: string; actorUserId: string },
  pool?: Pool
): Promise<CloseMeetingResult> {
  const meeting = await withPgTransaction(async (client) => {
    const current = await getMeetingRow(client, input.organizationId, input.meetingId);
    if (!current) throw new MeetingNotFoundError();

    const role = await getParticipantRoleRow(
      client,
      input.organizationId,
      input.meetingId,
      input.actorUserId
    );
    assertTransitionAllowed('CLOSE', current.lifecycleStatus, role);

    const closed = await setMeetingClosedRow(
      client,
      input.organizationId,
      input.meetingId,
      input.actorUserId
    );
    if (!closed) throw new MeetingNotFoundError();

    await writeAuditEvent(client, {
      actorId: input.actorUserId,
      action: 'MEETING_TRANSITION_CLOSE',
      resourceType: 'meeting',
      resourceId: input.meetingId,
      organizationId: input.organizationId,
      metadata: { from: current.lifecycleStatus, to: 'CLOSED' },
    });

    return closed;
  }, pool);

  const p = await resolvePgPool(pool);
  const outputs = await listOutputRows(p, input.organizationId, input.meetingId);
  // Every meeting_outputs.status lands in EXACTLY one of the three buckets
  // below, or is REJECTED/MATERIALIZED (both genuinely resolved, reported
  // nowhere) — never silently merged, never dropped. See CloseMeetingResult
  // for what each bucket means and why APPROVED counts as unresolved.
  const unresolvedOutputs = outputs.filter(
    (o) => o.status === 'PROPOSED' || o.status === 'APPROVED'
  );
  const failedOutputs = outputs.filter((o) => o.status === 'MATERIALIZATION_FAILED');
  const materializingOutputs = outputs.filter((o) => o.status === 'MATERIALIZING');

  return { meeting, unresolvedOutputs, failedOutputs, materializingOutputs };
}

// ==========================================
// Structured notes
// ==========================================

export async function addNoteEntry(
  input: {
    organizationId: string;
    meetingId: string;
    actorUserId: string;
    actorKind: NoteAuthorKind;
    entryType: NoteEntryType;
    content: string;
  },
  pool?: Pool
): Promise<MeetingNoteEntryRecord> {
  const content = input.content.trim();
  if (!content) throw new ValidationError('content is required');

  return withPgTransaction(async (client) => {
    const meeting = await getMeetingRow(client, input.organizationId, input.meetingId);
    if (!meeting) throw new MeetingNotFoundError();
    assertMeetingIsWritable(meeting.lifecycleStatus);

    const role = await getParticipantRoleRow(
      client,
      input.organizationId,
      input.meetingId,
      input.actorUserId
    );
    if (!role || !NOTE_WRITE_ROLES.includes(role as (typeof NOTE_WRITE_ROLES)[number])) {
      throw new ForbiddenError(
        `addNoteEntry: role '${role ?? 'none'}' may not write notes (allowed: ${NOTE_WRITE_ROLES.join(', ')}).`
      );
    }
    // A human actor must be authoring as themselves — never impersonate
    // Teresa, and Teresa entries must be tagged 'system' consistently.
    if (input.actorKind === 'system' && input.actorUserId !== TERESA_ACTOR_ID) {
      throw new ValidationError(
        "actorKind 'system' requires actorUserId to be the reserved TERESA_ACTOR_ID."
      );
    }
    if (input.actorKind === 'human' && input.actorUserId === TERESA_ACTOR_ID) {
      throw new ValidationError("actorKind 'human' cannot use the reserved TERESA_ACTOR_ID.");
    }

    const note = await insertNoteRow(client, {
      meetingId: input.meetingId,
      organizationId: input.organizationId,
      entryType: input.entryType,
      content,
      authorUserId: input.actorUserId,
      authorKind: input.actorKind,
    });

    await writeAuditEvent(client, {
      actorId: input.actorUserId,
      actorType: input.actorKind === 'system' ? 'SYSTEM' : 'USER',
      action: 'MEETING_NOTE_ADDED',
      resourceType: 'meeting_note_entry',
      resourceId: note.id,
      organizationId: input.organizationId,
      metadata: { meetingId: input.meetingId, entryType: input.entryType },
    });

    return note;
  }, pool);
}

export async function listNoteEntries(
  input: { organizationId: string; meetingId: string },
  pool?: Pool
): Promise<MeetingNoteEntryRecord[]> {
  const p = await resolvePgPool(pool);
  return listNoteRows(p, input.organizationId, input.meetingId);
}

export async function archiveNoteEntry(
  input: { organizationId: string; meetingId: string; noteId: string; actorUserId: string },
  pool?: Pool
): Promise<MeetingNoteEntryRecord> {
  return withPgTransaction(async (client) => {
    const meeting = await getMeetingRow(client, input.organizationId, input.meetingId);
    if (!meeting) throw new MeetingNotFoundError();
    assertMeetingIsWritable(meeting.lifecycleStatus);

    const role = await getParticipantRoleRow(
      client,
      input.organizationId,
      input.meetingId,
      input.actorUserId
    );
    if (!role || !PREP_EDIT_ROLES.includes(role as (typeof PREP_EDIT_ROLES)[number])) {
      throw new ForbiddenError('Only the meeting owner or facilitator may archive notes.');
    }

    const note = await archiveNoteRow(client, input.organizationId, input.meetingId, input.noteId);
    if (!note) throw new MeetingNotFoundError('Active meeting note not found');

    await writeAuditEvent(client, {
      actorId: input.actorUserId,
      action: 'MEETING_NOTE_ARCHIVED',
      resourceType: 'meeting_note_entry',
      resourceId: note.id,
      organizationId: input.organizationId,
      metadata: { meetingId: input.meetingId },
    });
    return note;
  }, pool);
}

// ==========================================
// Aggregate read
// ==========================================

export async function getMeetingAggregate(
  input: { organizationId: string; meetingId: string },
  pool?: Pool
): Promise<MeetingAggregate | null> {
  const p = await resolvePgPool(pool);
  const meeting = await getMeetingRow(p, input.organizationId, input.meetingId);
  if (!meeting) return null;
  const [participants, notes, outputs] = await Promise.all([
    listParticipantRows(p, input.organizationId, input.meetingId),
    listNoteRows(p, input.organizationId, input.meetingId),
    listOutputRows(p, input.organizationId, input.meetingId),
  ]);
  return { meeting, participants, notes, outputs };
}

export async function getParticipantRole(
  input: { organizationId: string; meetingId: string; userId: string },
  pool?: Pool
): Promise<MeetingRole | null> {
  const p = await resolvePgPool(pool);
  return getParticipantRoleRow(p, input.organizationId, input.meetingId, input.userId);
}
