import { API_URL, fetchWithRetry, getHeaders, handleResponse } from './baseClient';

export type MeetingLifecycleStatus =
  | 'DRAFT'
  | 'PREPARING'
  | 'READY'
  | 'LIVE'
  | 'CLOSING'
  | 'CLOSED'
  | 'CANCELLED';

export type MeetingOutputStatus =
  | 'PROPOSED'
  | 'APPROVED'
  | 'REJECTED'
  | 'MATERIALIZING'
  | 'MATERIALIZED'
  | 'MATERIALIZATION_FAILED';

export interface MeetingCoreNote {
  id: string;
  entryType: string;
  content: string;
  authorKind: 'human' | 'system';
  status: 'active' | 'archived';
  createdAt: string;
}

export interface MeetingCoreOutput {
  id: string;
  outputKind: 'task' | 'decision';
  proposedPayload: Record<string, unknown>;
  status: MeetingOutputStatus;
  canonicalId: string | null;
  idempotencyKey: string;
  failureReason: string | null;
}

export interface MeetingCoreAggregate {
  meeting: {
    id: string;
    title: string;
    lifecycleStatus: MeetingLifecycleStatus | null;
    purpose: string | null;
    expectedOutcomes: string | null;
  };
  notes: MeetingCoreNote[];
  outputs: MeetingCoreOutput[];
  participants: Array<{ id: string; meetingRole: string; userId: string }>;
}

const meetingCorePath = (meetingId: string): string =>
  `${API_URL}/meeting/core/${encodeURIComponent(meetingId)}`;

async function request<T>(
  path: string,
  init?: RequestInit,
  defaultError = 'Meeting request failed'
): Promise<T> {
  const response = await fetchWithRetry(path, {
    ...init,
    headers: { ...getHeaders(), ...((init?.headers as Record<string, string>) || {}) },
  });
  return handleResponse<T>(response, defaultError);
}

export const meetingCoreApi = {
  getAggregate(meetingId: string): Promise<MeetingCoreAggregate> {
    return request<MeetingCoreAggregate>(
      meetingCorePath(meetingId),
      undefined,
      'Could not load governed minutes'
    );
  },

  adopt(meetingId: string): Promise<{ meeting: MeetingCoreAggregate['meeting'] }> {
    return request(
      `${meetingCorePath(meetingId)}/adopt`,
      { method: 'POST' },
      'Could not enable governed minutes'
    );
  },

  addNote(meetingId: string, content: string): Promise<{ note: MeetingCoreNote }> {
    return request(
      `${meetingCorePath(meetingId)}/notes`,
      { method: 'POST', body: JSON.stringify({ entryType: 'discussion', content }) },
      'Could not save the note'
    );
  },

  archiveNote(meetingId: string, noteId: string): Promise<{ note: MeetingCoreNote }> {
    return request(
      `${meetingCorePath(meetingId)}/notes/${encodeURIComponent(noteId)}/archive`,
      { method: 'POST' },
      'Could not archive the note'
    );
  },

  transition(
    meetingId: string,
    transition: 'START_PREPARING' | 'MARK_READY' | 'START_LIVE' | 'START_CLOSING' | 'CANCEL'
  ): Promise<{ meeting: MeetingCoreAggregate['meeting'] }> {
    return request(
      `${meetingCorePath(meetingId)}/transitions/${transition}`,
      { method: 'POST' },
      'Could not change the meeting stage'
    );
  },

  close(meetingId: string): Promise<{ meeting: MeetingCoreAggregate['meeting'] }> {
    return request(
      `${meetingCorePath(meetingId)}/close`,
      { method: 'POST' },
      'Could not close the meeting'
    );
  },

  proposeOutput(
    meetingId: string,
    outputKind: 'task' | 'decision',
    title: string,
    idempotencyKey: string
  ): Promise<{ output: MeetingCoreOutput }> {
    return request(
      `${meetingCorePath(meetingId)}/outputs`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ outputKind, payload: { title } }),
      },
      'Could not propose the output'
    );
  },

  approveOutput(meetingId: string, outputId: string): Promise<{ output: MeetingCoreOutput }> {
    return request(
      `${meetingCorePath(meetingId)}/outputs/${encodeURIComponent(outputId)}/approve`,
      { method: 'POST' },
      'Could not approve the output'
    );
  },

  rejectOutput(meetingId: string, outputId: string): Promise<{ output: MeetingCoreOutput }> {
    return request(
      `${meetingCorePath(meetingId)}/outputs/${encodeURIComponent(outputId)}/reject`,
      { method: 'POST', body: JSON.stringify({ reason: 'Rejected by the meeting owner' }) },
      'Could not reject the output'
    );
  },

  materializeOutput(
    meetingId: string,
    outputId: string,
    idempotencyKey: string
  ): Promise<{ output: MeetingCoreOutput }> {
    return request(
      `${meetingCorePath(meetingId)}/outputs/${encodeURIComponent(outputId)}/materialize`,
      { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } },
      'Could not create the approved output'
    );
  },
};
