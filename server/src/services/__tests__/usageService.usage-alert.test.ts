/** @vitest-environment node */

/**
 * DEC-2026-08-25-21 (N2): `usage_alert` must go through the notification
 * engine, not a direct EmailService.send() call.
 *
 * The audit (notyfikacje-audyt.md §1C) found checkAndSendUsageAlert()
 * emailed every org admin directly via EmailService.send(), with zero
 * read of preferences/opt-out — even though `usage_alert` is already
 * seeded in the notification_types registry as is_critical with default
 * channels ["in_app","email"] (server/migrations/257_notification_system.sql:60).
 * This test proves the threshold-crossing path now calls
 * notificationService.send() with that registry type instead, once per
 * org admin, without an explicit `channels` override — and that the
 * existing daily per-org/per-threshold dedup (via `usage_alerts_sent`)
 * still gates whether it fires at all.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbGet, mockDbAll, mockDbRun, mockSend } = vi.hoisted(() => ({
  mockDbGet: vi.fn(),
  mockDbAll: vi.fn(),
  mockDbRun: vi.fn(),
  mockSend: vi.fn(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../notificationService.js', () => ({
  send: (...args: unknown[]) => mockSend(...args),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({}),
  default: {},
}));

import { checkAndSendUsageAlert, setDependencies } from '../usageService.js';

function sqlOf(call: unknown[]): string {
  // DbPromise.get/all are called as (db, sql, params) from usageService.
  return String(call[1] ?? '');
}

describe('checkAndSendUsageAlert (N2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue('notif-id');
    mockDbRun.mockResolvedValue({ changes: 1 });

    setDependencies({
      uuidv4: () => 'alert-test-id',
      billingService: {
        getOrganizationBilling: vi.fn().mockResolvedValue({
          subscription_plan_id: 'plan-1',
          current_period_start: new Date('2026-08-01').toISOString(),
          current_period_end: new Date('2026-08-31').toISOString(),
        }),
        getPlanById: vi.fn().mockResolvedValue({ token_limit: 1000, storage_limit_gb: 10, name: 'Pro' }),
      },
      payAsYouGoService: {},
      budgetManagementService: {},
    } as any);

    mockDbGet.mockImplementation((...args: unknown[]) => {
      const sql = sqlOf(args);
      if (sql.includes('usage_records')) {
        return Promise.resolve({ tokens_used: 950, storage_bytes: 0 });
      }
      if (sql.includes('billing_alerts')) {
        return Promise.resolve({
          token_threshold_80: 1,
          token_threshold_90: 1,
          token_threshold_100: 1,
          storage_threshold_80: 1,
          storage_threshold_90: 1,
          storage_threshold_100: 1,
        });
      }
      if (sql.includes('usage_alerts_sent')) {
        return Promise.resolve(null); // no alert sent yet today
      }
      if (sql.includes('FROM organizations')) {
        return Promise.resolve({ name: 'Acme Inc' });
      }
      return Promise.resolve(null);
    });

    mockDbAll.mockImplementation((...args: unknown[]) => {
      const sql = sqlOf(args);
      if (sql.includes('FROM users')) {
        return Promise.resolve([
          { id: 'admin-1', email: 'a1@acme.test', first_name: 'Ada' },
          { id: 'admin-2', email: 'a2@acme.test', first_name: 'Bo' },
        ]);
      }
      return Promise.resolve([]);
    });
  });

  it('sends usage_alert through the notification engine for every org admin (95% -> 90% threshold)', async () => {
    await checkAndSendUsageAlert('org-1', 'token');

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        organizationId: 'org-1',
        type: 'usage_alert',
        entityType: 'billing',
      })
    );
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ userId: 'admin-2', type: 'usage_alert' }));
  });

  it('does not pass explicit channels — relies on the usage_alert registry default of in_app+email', async () => {
    await checkAndSendUsageAlert('org-1', 'token');

    const call = mockSend.mock.calls[0][0];
    expect(call.channels).toBeUndefined();
  });

  it('skips send() entirely when the daily per-threshold dedup already fired', async () => {
    mockDbGet.mockImplementation((...args: unknown[]) => {
      const sql = sqlOf(args);
      if (sql.includes('usage_records')) return Promise.resolve({ tokens_used: 950, storage_bytes: 0 });
      if (sql.includes('billing_alerts'))
        return Promise.resolve({
          token_threshold_80: 1,
          token_threshold_90: 1,
          token_threshold_100: 1,
          storage_threshold_80: 1,
          storage_threshold_90: 1,
          storage_threshold_100: 1,
        });
      if (sql.includes('usage_alerts_sent'))
        return Promise.resolve({ threshold: 90, sent_at: new Date().toISOString() });
      return Promise.resolve(null);
    });

    await checkAndSendUsageAlert('org-1', 'token');

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not send when usage is below every threshold', async () => {
    mockDbGet.mockImplementation((...args: unknown[]) => {
      const sql = sqlOf(args);
      if (sql.includes('usage_records')) return Promise.resolve({ tokens_used: 100, storage_bytes: 0 });
      if (sql.includes('billing_alerts'))
        return Promise.resolve({
          token_threshold_80: 1,
          token_threshold_90: 1,
          token_threshold_100: 1,
          storage_threshold_80: 1,
          storage_threshold_90: 1,
          storage_threshold_100: 1,
        });
      return Promise.resolve(null);
    });

    await checkAndSendUsageAlert('org-1', 'token');

    expect(mockSend).not.toHaveBeenCalled();
  });
});
