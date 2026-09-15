/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { reminders, escalations } = vi.hoisted(() => ({
  reminders: vi.fn(),
  escalations: vi.fn(),
}));

vi.mock('../../services/InterviewAssignmentService.js', () => ({
  default: {
    checkAndSendReminders: reminders,
    checkAndEscalate: escalations,
  },
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { runJob } from '../interviewReminderJob.js';

describe('interview escalation scheduler gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reminders.mockResolvedValue({ sent: 0, errors: 0 });
    escalations.mockResolvedValue({ escalated: 1, errors: 0 });
  });

  it('keeps escalation default OFF while reminders continue', async () => {
    const result = await runJob();
    expect(reminders).toHaveBeenCalledOnce();
    expect(escalations).not.toHaveBeenCalled();
    expect(result.escalations).toEqual({ escalated: 0, errors: 0 });
  });

  it('passes a bounded scope only after explicit enablement', async () => {
    await runJob({ enableEscalation: true, escalationLimit: 12, recentDays: 14 });
    expect(escalations).toHaveBeenCalledWith({ limit: 12, recentDays: 14 });
  });
});
