/**
 * lifecycle.ts — the Meeting Core state machine.
 *
 * DRAFT -> PREPARING -> READY -> LIVE -> CLOSING -> CLOSED, plus CANCELLED
 * (reachable from every non-terminal state). CLOSED and CANCELLED are
 * terminal: no transition in MEETING_TRANSITIONS has either as a `from`
 * state, so there is no code path that can move a meeting out of CLOSED —
 * "CLOSED nie może po cichu wrócić do LIVE" is enforced by construction, not
 * by a runtime check.
 *
 * Status NEVER comes from the client as an arbitrary string — only these six
 * NAMED transitions exist, each with a fixed `from` set and a fixed `to`
 * state. See server/src/routes/meeting.routes.ts for how transitions are
 * invoked (POST .../transitions/:transition, never PATCH { status: any }).
 */

import { ForbiddenError, IllegalTransitionError } from './errors.js';
import type { MeetingLifecycleStatus, MeetingRole } from './types.js';

export type MeetingTransitionName =
  | 'START_PREPARING'
  | 'MARK_READY'
  | 'START_LIVE'
  | 'START_CLOSING'
  | 'CLOSE'
  | 'CANCEL';

export const MEETING_TRANSITION_NAMES: readonly MeetingTransitionName[] = [
  'START_PREPARING',
  'MARK_READY',
  'START_LIVE',
  'START_CLOSING',
  'CLOSE',
  'CANCEL',
];

export interface MeetingTransitionRule {
  from: readonly MeetingLifecycleStatus[];
  to: MeetingLifecycleStatus;
  /** Meeting-scoped roles allowed to perform this transition. */
  allowedRoles: readonly MeetingRole[];
}

/**
 * The transition matrix. This IS the lifecycle — see module docstring for
 * why CLOSED/CANCELLED never appear in any `from` array.
 *
 * | Transition      | From                                  | To         | Roles                 |
 * |-----------------|----------------------------------------|------------|------------------------|
 * | START_PREPARING | DRAFT                                   | PREPARING  | owner, facilitator    |
 * | MARK_READY      | PREPARING                               | READY      | owner, facilitator    |
 * | START_LIVE      | READY                                   | LIVE       | owner, facilitator    |
 * | START_CLOSING   | LIVE                                    | CLOSING    | owner, facilitator    |
 * | CLOSE           | CLOSING                                 | CLOSED     | owner, facilitator    |
 * | CANCEL          | DRAFT, PREPARING, READY, LIVE, CLOSING  | CANCELLED  | owner                 |
 */
export const MEETING_TRANSITIONS: Record<MeetingTransitionName, MeetingTransitionRule> = {
  START_PREPARING: {
    from: ['DRAFT'],
    to: 'PREPARING',
    allowedRoles: ['owner', 'facilitator'],
  },
  MARK_READY: {
    from: ['PREPARING'],
    to: 'READY',
    allowedRoles: ['owner', 'facilitator'],
  },
  START_LIVE: {
    from: ['READY'],
    to: 'LIVE',
    allowedRoles: ['owner', 'facilitator'],
  },
  START_CLOSING: {
    from: ['LIVE'],
    to: 'CLOSING',
    allowedRoles: ['owner', 'facilitator'],
  },
  CLOSE: {
    from: ['CLOSING'],
    to: 'CLOSED',
    allowedRoles: ['owner', 'facilitator'],
  },
  // Only `owner` (not facilitator) may cancel the whole meeting — a
  // deliberately narrower gate than close/start/etc, since cancelling
  // discards the meeting outright rather than progressing it.
  CANCEL: {
    from: ['DRAFT', 'PREPARING', 'READY', 'LIVE', 'CLOSING'],
    to: 'CANCELLED',
    allowedRoles: ['owner'],
  },
};

/**
 * Validates that `name` may run from `currentStatus` by `actingRole`.
 * Throws IllegalTransitionError (state) or ForbiddenError (role) — never
 * silently no-ops. Returns the matched rule on success.
 */
export function assertTransitionAllowed(
  name: MeetingTransitionName,
  currentStatus: MeetingLifecycleStatus | null,
  actingRole: MeetingRole | null
): MeetingTransitionRule {
  const rule = MEETING_TRANSITIONS[name];

  if (currentStatus === null) {
    throw new IllegalTransitionError(
      `Meeting has no core lifecycle (lifecycle_status is NULL) — it was not created via meetingCore; transitions are unavailable.`
    );
  }
  if (!rule.from.includes(currentStatus)) {
    throw new IllegalTransitionError(
      `Cannot ${name}: meeting is in ${currentStatus}, allowed source states are [${rule.from.join(', ')}].`
    );
  }
  if (!actingRole || !rule.allowedRoles.includes(actingRole)) {
    throw new ForbiddenError(
      `Cannot ${name}: role '${actingRole ?? 'none'}' is not authorized; allowed roles are [${rule.allowedRoles.join(', ')}].`
    );
  }
  return rule;
}

/** Terminal states — no writes (notes, outputs, prep edits, further transitions) are allowed once reached. */
export const WRITE_LOCKED_STATUSES: readonly MeetingLifecycleStatus[] = ['CLOSED', 'CANCELLED'];

export function assertMeetingIsWritable(status: MeetingLifecycleStatus | null): void {
  if (status && WRITE_LOCKED_STATUSES.includes(status)) {
    throw new IllegalTransitionError(`Meeting is ${status} — no further writes are allowed.`);
  }
}
