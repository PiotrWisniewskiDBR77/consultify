/** @vitest-environment node */

/**
 * DEC-2026-08-25-21 (N2): the four remaining Stripe lifecycle
 * notifications — subscription_created, subscription_canceled,
 * invoice_paid, invoice_finalized — must go through the notification
 * engine, not the direct-SQL createNotification() helper.
 *
 * The audit (notyfikacje-audyt.md §1B) found these were emitted via a
 * direct `INSERT INTO notifications` — bypassing preferences, dedup, and
 * every channel but in-app, with no registry row at all (unlike
 * payment_failed, which N1.2 already fixed). Migration 959 registers all
 * four with `default_channels: ["in_app"]` — matching the direct-SQL
 * helper's actual prior behavior exactly, so this change is preference
 * plumbing only, not a behavior change on its own.
 *
 * This test exercises notifyOrgAdmins() — the generic helper that
 * replaced createNotification() at all four call sites (and that
 * notifyPaymentFailedAdmins() itself now delegates to) — and proves it
 * calls notificationService.send() once per org admin/superadmin, with
 * the given type, and without an explicit `channels` override (so the
 * registry's default_channels decides).
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

import { notifyOrgAdmins, notifyPaymentFailedAdmins } from '../stripe.routes.js';

describe('notifyOrgAdmins (N2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue('notif-id');
  });

  it.each([
    ['subscription_created', 'Subscription Activated'],
    ['subscription_canceled', 'Subscription Canceled'],
    ['invoice_paid', 'Payment Successful'],
    ['invoice_finalized', 'Invoice Ready'],
  ])('sends %s through the notification engine for every org admin/superadmin', async (type, title) => {
    mockDbAll.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);

    await notifyOrgAdmins('org-1', type, title, 'message body');

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
        type,
        title,
        body: 'message body',
      })
    );
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ userId: 'admin-2', type }));
  });

  it('does not pass explicit channels — relies on the registry default_channels for the type', async () => {
    mockDbAll.mockResolvedValue([{ id: 'admin-1' }]);

    await notifyOrgAdmins('org-1', 'subscription_created', 'Subscription Activated', 'message');

    const call = mockSend.mock.calls[0][0];
    expect(call.channels).toBeUndefined();
  });

  it('defaults priority to normal when not given', async () => {
    mockDbAll.mockResolvedValue([{ id: 'admin-1' }]);

    await notifyOrgAdmins('org-1', 'invoice_paid', 'Payment Successful', 'message');

    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ priority: 'normal' }));
  });

  it('never throws when the org has no admins', async () => {
    mockDbAll.mockResolvedValue([]);
    await expect(
      notifyOrgAdmins('org-1', 'subscription_created', 'Subscription Activated', 'message')
    ).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('swallows send() failures so the webhook keeps processing', async () => {
    mockDbAll.mockResolvedValue([{ id: 'admin-1' }]);
    mockSend.mockRejectedValue(new Error('email provider down'));

    await expect(
      notifyOrgAdmins('org-1', 'invoice_finalized', 'Invoice Ready', 'message')
    ).resolves.toBeUndefined();
  });

  it('notifyPaymentFailedAdmins still delegates to notifyOrgAdmins with type=payment_failed, priority=high', async () => {
    mockDbAll.mockResolvedValue([{ id: 'admin-1' }]);

    await notifyPaymentFailedAdmins('org-1', 'payment message');

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'payment_failed',
        title: 'Payment Failed',
        body: 'payment message',
        priority: 'high',
      })
    );
  });
});
