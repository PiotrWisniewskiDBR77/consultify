import { createMeeting } from '../../services/meetingService.js';

export interface ExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface MeetingPayload {
  meeting_id?: string;
  title?: string;
  description?: string;
  attendees?: string[];
  start_time?: string;
  end_time?: string;
  project_id?: string;
}

export const MeetingExecutor = {
  async execute(
    payload: MeetingPayload,
    metadata: Record<string, unknown> = {}
  ): Promise<ExecutionResult> {
    const organizationId = String(metadata.organizationId || '').trim();
    const createdBy = String(metadata.userId || metadata.executedBy || 'SYSTEM').trim();
    const title = String(payload.title || '').trim();
    const startAt = String(payload.start_time || '').trim();

    if (!organizationId) {
      throw new Error('Meeting execution requires organizationId');
    }
    if (!title || !startAt) {
      throw new Error('Meeting execution requires title and start_time');
    }

    const meeting = await createMeeting({
      organizationId,
      createdBy,
      projectId: payload.project_id || null,
      title,
      startAt,
      endAt: String(payload.end_time || payload.start_time || '').trim() || startAt,
      location: payload.description || '',
      attendees: Array.isArray(payload.attendees) ? payload.attendees : [],
      preRead: [],
      agenda: [],
      decisions: [],
    });

    return {
      success: true,
      result: {
        action: 'schedule_meeting',
        meetingId: meeting.id,
        meeting,
      },
    };
  },

  async dryRun(
    payload: MeetingPayload,
    metadata: Record<string, unknown> = {}
  ): Promise<ExecutionResult> {
    return {
      success: true,
      result: {
        action: 'schedule_meeting',
        payload,
        metadata,
        message: 'Dry run: would schedule meeting',
      },
    };
  },
};

export default MeetingExecutor;
