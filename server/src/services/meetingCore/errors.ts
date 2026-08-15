/**
 * errors.ts — typed errors for Meeting Core. Route handlers map these to
 * HTTP status codes (see server/src/routes/meeting.routes.ts).
 */

export class MeetingCoreError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'MeetingCoreError';
  }
}

/** Meeting not found OR found in a different organization — tenant isolation returns 404, never 403, to avoid leaking existence. */
export class MeetingNotFoundError extends MeetingCoreError {
  constructor(message = 'Meeting not found') {
    super(message, 'MEETING_NOT_FOUND');
    this.name = 'MeetingNotFoundError';
  }
}

export class ValidationError extends MeetingCoreError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/** Actor lacks the meeting-scoped role required for the operation. */
export class ForbiddenError extends MeetingCoreError {
  constructor(message: string) {
    super(message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

/** Requested state transition is not legal from the meeting's current lifecycle_status. */
export class IllegalTransitionError extends MeetingCoreError {
  constructor(message: string) {
    super(message, 'ILLEGAL_TRANSITION');
    this.name = 'IllegalTransitionError';
  }
}

/** Unique-constraint-shaped conflicts (e.g. participant already exists with a different invited_by). */
export class ConflictError extends MeetingCoreError {
  constructor(message: string) {
    super(message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}
