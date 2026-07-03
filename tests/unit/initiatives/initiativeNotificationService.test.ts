import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSend = vi.fn();

vi.mock('../../../server/src/services/notificationService.js', () => ({
  send: (...a: unknown[]) => mockSend(...a),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import {
  notifyAssignment,
  notifyBlocker,
  notifyDueBreach,
  notifyStatusChange,
} from '../../../server/src/services/initiative/initiativeNotificationService.js';

const ORG = 'org-1';

describe('initiativeNotificationService (R4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue('notif-id');
  });

  it('status change → one notification per recipient with correct type/entity/link', async () => {
    await notifyStatusChange(ORG, 'i1', 'PLANNING', 'APPROVED', ['u1', 'u2'], { actorId: 'a1' });
    expect(mockSend).toHaveBeenCalledTimes(2);
    const call = mockSend.mock.calls[0][0];
    expect(call).toMatchObject({
      organizationId: ORG,
      type: 'initiative_status_change',
      entityType: 'initiative',
      entityId: 'i1',
      actorId: 'a1',
    });
    expect(call.title).toContain('PLANNING');
    expect(call.title).toContain('APPROVED');
    expect(call.actionUrl).toContain('i1');
  });

  it('dedupes recipients and skips falsy ids', async () => {
    await notifyStatusChange(ORG, 'i1', 'A', 'B', ['u1', 'u1', null, undefined, '']);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('assignment targets only the assignee, severity INFO', async () => {
    await notifyAssignment(ORG, 'i1', 'u9', 'PROJECT_MANAGER', { actorId: 'a1' });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toMatchObject({
      userId: 'u9',
      type: 'initiative_assignment',
      severity: 'INFO',
    });
  });

  it('due breach → WARNING', async () => {
    await notifyDueBreach(ORG, 'i1', 'Spec', '2026-07-01', ['u1']);
    expect(mockSend.mock.calls[0][0]).toMatchObject({
      type: 'initiative_due_breach',
      severity: 'WARNING',
    });
  });

  it('blocker → CRITICAL', async () => {
    await notifyBlocker(ORG, 'i1', 'dependency missing', ['u1'], { actorId: 'a1' });
    expect(mockSend.mock.calls[0][0]).toMatchObject({
      type: 'initiative_blocked',
      severity: 'CRITICAL',
    });
  });

  it('a send error is swallowed (never throws into the caller)', async () => {
    mockSend.mockRejectedValueOnce(new Error('notif down'));
    await expect(notifyStatusChange(ORG, 'i1', 'A', 'B', ['u1'])).resolves.toBeUndefined();
  });

  it('no recipients → no send, no throw', async () => {
    await notifyStatusChange(ORG, 'i1', 'A', 'B', []);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
