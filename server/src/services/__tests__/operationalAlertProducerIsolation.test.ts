import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ runs: [] as Array<{ sql: string; params: unknown[] }>, sendCalls: 0, signalCalls: 0, dispatchCalls: 0 }));
vi.mock('../../utils/DbPromise.js', () => ({
  all: vi.fn(async (sql: string) => sql.includes("WHERE status = 'PENDING'") ? [{ id: 'notification-1', user_id: 'user-1', organization_id: 'org-1', type: 'INFO', payload_json: '{}', status: 'PENDING', dedupe_key: null, created_at: new Date().toISOString() }] : []),
  run: vi.fn(async (sql: string, params: unknown[]) => { state.runs.push({ sql, params }); return { changes: 1 }; }),
}));
vi.mock('../notificationService.js', () => ({ default: { send: vi.fn(async () => { state.sendCalls++; }) } }));
vi.mock('../operationalAlertSignalDeliveryService.js', () => ({
  durableOperationalAlertsEnabled: () => true,
  recordOperationalAlertSignal: vi.fn(async () => { state.signalCalls++; throw new Error('forced alert store down'); }),
}));
vi.mock('../caseWorkspace/eventOutboxService.js', () => ({
  dispatchPendingEvents: vi.fn(async () => { state.dispatchCalls++; return { claimed: 1, delivered: 1, failed: 0, failedEventIds: [] }; }),
  countDeadLetterEvents: vi.fn(async () => 0),
  getOutboxBacklog: vi.fn(async () => ({ pending: 0, oldestPendingAgeSeconds: null })),
  listDeadLetterEvents: vi.fn(async () => []),
}));
vi.mock('../caseWorkspace/eventInboxService.js', () => ({ runInboxReconciliationSweep: vi.fn(async () => ({ scanned: 0 })) }));

import NotificationOutboxService, { getMissedNotificationDurableAlertSignals } from '../notificationOutboxService.js';
import { getMissedCaseWorkspaceDurableAlertSignals, runOutboxWorkerTick } from '../caseWorkspace/outboxWorker.js';

describe('OPS alert producer failure isolation', () => {
  beforeEach(() => { state.runs.length = 0; state.sendCalls = 0; state.signalCalls = 0; state.dispatchCalls = 0; });

  it('Notification commits SENT and calls business send once despite forced signal failure', async () => {
    const missed = getMissedNotificationDurableAlertSignals();
    await expect(NotificationOutboxService.drainOnce({ limit: 1 })).resolves.toMatchObject({ processed: 1, sent: 1, failed: 0 });
    expect(state.sendCalls).toBe(1);
    expect(state.runs.filter((entry) => entry.sql.includes("status = 'SENT'"))).toHaveLength(1);
    expect(state.runs.some((entry) => entry.sql.includes("status = 'FAILED'"))).toBe(false);
    expect(getMissedNotificationDurableAlertSignals()).toBe(missed + 1);
  });

  it('Case preserves the primary tick result and dispatches once despite forced signal failure', async () => {
    const missed = getMissedCaseWorkspaceDurableAlertSignals();
    await expect(runOutboxWorkerTick({ organizationId: 'org-1' })).resolves.toMatchObject({ claimed: 1, delivered: 1, failed: 0, timedOut: false });
    expect(state.dispatchCalls).toBe(1);
    expect(getMissedCaseWorkspaceDurableAlertSignals()).toBe(missed + 1);
  });
});
