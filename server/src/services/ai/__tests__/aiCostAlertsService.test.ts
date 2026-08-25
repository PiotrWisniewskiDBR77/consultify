/** @vitest-environment node */

/**
 * DEC-2026-08-25-21 (N2): `ai_cost_budget_alert` must go through the
 * notification engine, not a direct EmailService.send() call.
 *
 * The audit (notyfikacje-audyt.md §1C) found sendEmailToOrgAdmins() emailed
 * every org admin directly, with zero read of preferences. Migration 960
 * registers `ai_cost_budget_alert` with default_channels=["email"],
 * matching that function's exact prior behavior — this test proves the
 * redirect calls notificationService.send() with that type, once per org
 * admin, without an explicit `channels` override (so the registry decides),
 * while leaving the Slack alert path (a separate, env-configured webhook,
 * not the per-org engine Slack integration) untouched.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbGet, mockDbAll, mockDbRun, mockSend, mockSlackAlert } = vi.hoisted(() => ({
  mockDbGet: vi.fn(),
  mockDbAll: vi.fn(),
  mockDbRun: vi.fn(),
  mockSend: vi.fn(),
  mockSlackAlert: vi.fn(),
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../../notificationService.js', () => ({
  send: (...args: unknown[]) => mockSend(...args),
}));

vi.mock('../../slackService.js', () => ({
  SlackServiceClass: class {
    sendSystemAlert(...args: unknown[]) {
      return mockSlackAlert(...args);
    }
  },
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { runAiCostBudgetAlerts } from '../aiCostAlertsService.js';

function sqlOf(call: unknown[]): string {
  return String(call[0] ?? '');
}

describe('runAiCostBudgetAlerts -> sendEmailToOrgAdmins (N2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue('notif-id');
    mockSlackAlert.mockResolvedValue(undefined);
    mockDbRun.mockResolvedValue({ changes: 1 });
    process.env.AI_COST_SLACK_WEBHOOK_URL = 'https://hooks.example/slack';

    mockDbAll.mockImplementation((...args: unknown[]) => {
      const sql = sqlOf(args);
      if (sql.includes('FROM organizations') && !sql.includes('WHERE id')) {
        return Promise.resolve([{ id: 'org-1' }]);
      }
      if (sql.includes('FROM users')) {
        return Promise.resolve([
          { id: 'admin-1', email: 'a1@acme.test', first_name: 'Ada' },
          { id: 'admin-2', email: 'a2@acme.test', first_name: 'Bo' },
        ]);
      }
      return Promise.resolve([]);
    });

    mockDbGet.mockImplementation((...args: unknown[]) => {
      const sql = sqlOf(args);
      if (sql.includes('monthly_budget_usd')) return Promise.resolve({ monthly_budget_usd: 100 });
      if (sql.includes('ai_usage_logs')) return Promise.resolve({ cost: 95 });
      if (sql.includes('ai_cost_alerts_sent')) return Promise.resolve(null); // not sent yet
      if (sql.includes('FROM organizations WHERE id')) return Promise.resolve({ name: 'Acme Inc' });
      return Promise.resolve(null);
    });
  });

  it('sends ai_cost_budget_alert through the notification engine for every org admin', async () => {
    const result = await runAiCostBudgetAlerts();

    expect(result.sent).toBe(1);
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        organizationId: 'org-1',
        type: 'ai_cost_budget_alert',
        entityType: 'ai_budget',
      })
    );
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin-2', type: 'ai_cost_budget_alert' })
    );
  });

  it('does not pass explicit channels — relies on the registry default of email-only', async () => {
    await runAiCostBudgetAlerts();

    const call = mockSend.mock.calls[0][0];
    expect(call.channels).toBeUndefined();
  });

  it('still fires the separate env-configured Slack alert unchanged', async () => {
    await runAiCostBudgetAlerts();

    expect(mockSlackAlert).toHaveBeenCalledTimes(1);
  });

  it('skips send() when the per-org/threshold/period dedup already fired', async () => {
    mockDbGet.mockImplementation((...args: unknown[]) => {
      const sql = sqlOf(args);
      if (sql.includes('monthly_budget_usd')) return Promise.resolve({ monthly_budget_usd: 100 });
      if (sql.includes('ai_usage_logs')) return Promise.resolve({ cost: 95 });
      if (sql.includes('ai_cost_alerts_sent')) return Promise.resolve({ id: 'already-sent' });
      return Promise.resolve(null);
    });

    const result = await runAiCostBudgetAlerts();

    expect(result.sent).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not send when no org has a configured monthly budget cap', async () => {
    mockDbGet.mockImplementation((...args: unknown[]) => {
      const sql = sqlOf(args);
      if (sql.includes('monthly_budget_usd')) return Promise.resolve({ monthly_budget_usd: null });
      return Promise.resolve(null);
    });

    const result = await runAiCostBudgetAlerts();

    expect(result.sent).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
