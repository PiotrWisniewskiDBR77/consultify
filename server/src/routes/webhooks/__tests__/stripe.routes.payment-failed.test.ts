/** @vitest-environment node */

/**
 * DEC-2026-08-25-21 (N1.2): payment_failed must go through the
 * notification engine, not the direct-SQL createNotification() helper.
 *
 * The audit (notyfikacje-audyt.md §1B) found `payment_failed` is seeded
 * in the notification_types registry as is_critical with default
 * channels ["in_app","email"] (257_notification_system.sql:60), but the
 * webhook handler emitted it via a direct `INSERT INTO notifications` —
 * bypassing preferences, dedup, and every channel except in-app. A user
 * with a failed payment never got an email; they'd only find out by
 * opening the app.
 *
 * This test exercises notifyPaymentFailedAdmins() directly (the unit
 * that replaced the direct-SQL call at the payment_failed call site) and
 * proves it calls notificationService.send() — the only path that
 * actually queues an email — once per org admin/superadmin, with the
 * registry type.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbAll, mockSend } = vi.hoisted(() => ({
  mockDbAll: vi.fn(),
  mockSend: vi.fn(),
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../../services/notificationService.js', () => ({
  send: (...args: unknown[]) => mockSend(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { notifyPaymentFailedAdmins } from '../stripe.routes.js';

describe('notifyPaymentFailedAdmins (N1.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue('notif-id');
  });

  it('sends payment_failed through the notification engine for every org admin/superadmin', async () => {
    mockDbAll.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);

    await notifyPaymentFailedAdmins('org-1', 'Your payment could not be processed.');

    expect(mockDbAll).toHaveBeenCalledWith(expect.stringContaining('FROM users'), [
      'org-1',
      'ADMIN',
      'SUPERADMIN',
    ]);
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        organizationId: 'org-1',
        type: 'payment_failed',
        title: 'Payment Failed',
        body: 'Your payment could not be processed.',
        priority: 'high',
      })
    );
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin-2', type: 'payment_failed' })
    );
  });

  it('does not pass explicit channels — relies on the payment_failed registry default of in_app+email', async () => {
    mockDbAll.mockResolvedValue([{ id: 'admin-1' }]);

    await notifyPaymentFailedAdmins('org-1', 'message');

    const call = mockSend.mock.calls[0][0];
    expect(call.channels).toBeUndefined();
  });

  it('never throws when the org has no admins', async () => {
    mockDbAll.mockResolvedValue([]);
    await expect(notifyPaymentFailedAdmins('org-1', 'message')).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('swallows send() failures so the webhook keeps processing', async () => {
    mockDbAll.mockResolvedValue([{ id: 'admin-1' }]);
    mockSend.mockRejectedValue(new Error('email provider down'));

    await expect(
      notifyPaymentFailedAdmins('org-1', 'message')
    ).resolves.toBeUndefined();
  });
});
