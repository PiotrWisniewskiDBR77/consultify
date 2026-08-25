/** @vitest-environment node */

/**
 * DEC-2026-08-25-21 (N2): interview reminder/escalation emails must not be
 * sent a second time outside the notification engine.
 *
 * The audit (notyfikacje-audyt.md §1C) found dispatchReminder() and
 * checkAndEscalate() each called notificationService.send() (which
 * already emails the recipient, since `interview_${reminderType}` and
 * `interview_escalation` are registered with an "email" channel for
 * 48h/24h reminders and escalations — server/migrations/303_interview_assignments_extended.sql:89-98)
 * AND THEN called a second, direct emailService.send() — an unconditional,
 * preference-blind duplicate of the email the engine had just sent.
 *
 * This test proves both call sites now call notificationService.send()
 * exactly once per recipient and never call emailService.send() directly.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSend, mockEmailSend, mockDbAll } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockEmailSend: vi.fn(),
  mockDbAll: vi.fn(),
}));

function makeFakeDb() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    get: vi.fn().mockResolvedValue(null),
    all: (...args: unknown[]) => mockDbAll(...args),
    run: vi.fn().mockResolvedValue({ changes: 1 }),
  };
}

vi.mock('../../database/Database.js', () => ({
  getDatabase: vi.fn().mockResolvedValue(makeFakeDb()),
}));

vi.mock('../notificationService.js', () => ({
  default: { send: (...args: unknown[]) => mockSend(...args) },
}));

vi.mock('../emailService.js', () => ({
  default: { send: (...args: unknown[]) => mockEmailSend(...args) },
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import interviewAssignmentService, { checkAndEscalate } from '../InterviewAssignmentService.js';

describe('InterviewAssignmentService reminders/escalation (N2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue('notif-id');
    mockDbAll.mockResolvedValue([]);
  });

  it('dispatchReminder sends the engine notification once per recipient and never calls emailService directly', async () => {
    const assignment = {
      id: 'assign-1',
      organizationId: 'org-1',
      dueAt: new Date().toISOString(),
      template: { name: 'Discovery Interview' },
    } as any;

    await (interviewAssignmentService as any).dispatchReminder(
      assignment,
      ['user-1', 'user-2'],
      'reminder_48h',
      'sender-1'
    );

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        organizationId: 'org-1',
        type: 'interview_reminder_48h',
        entityType: 'interview_assignment',
        entityId: 'assign-1',
      })
    );
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-2' }));
    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('checkAndEscalate sends the engine notification once per overdue assignment and never calls emailService directly', async () => {
    mockDbAll.mockResolvedValue([
      {
        id: 'assign-2',
        organization_id: 'org-1',
        due_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        template_name: 'Discovery Interview',
        assignee_name: 'Jamie Assignee',
        escalation_user_id: 'manager-1',
        escalation_email: 'manager@acme.test',
        escalation_name: 'Manager One',
      },
    ]);

    const result = await checkAndEscalate();

    expect(result.escalated).toBe(1);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'manager-1',
        organizationId: 'org-1',
        type: 'interview_escalation',
        entityType: 'interview_assignment',
        entityId: 'assign-2',
      })
    );
    expect(mockEmailSend).not.toHaveBeenCalled();
  });
});
