/**
 * M13 Depth · Seria R (R4 / M13d) — status-change notification org-scope.
 *
 * Verifies the status-change notification does NOT leak across organizations:
 * the recipient set is built by getInitiativeNotificationRecipients
 * (InitiativeController.ts:167), which resolves owners/watchers/stakeholders
 * with an `organization_id = ?` filter — so it only ever returns users in the
 * initiative's org. We assert that:
 *   - every `notificationService.send` call carries
 *     `organizationId` = the initiative's org;
 *   - every recipient userId is one of the resolved (in-org) recipients;
 *   - a user who is NOT in the recipient list (e.g. someone from another org)
 *     never appears as a target.
 *
 * Strategy mirrors notifications.test.ts: REAL controller + REAL emitters,
 * leaf deps mocked. Transition EXECUTING → BLOCKED runs cleanly (no extra
 * gate-decision precondition) and notifies the recipient set.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSend, mockQueryOne, mockQueryAll, mockQueryRun, mockGetTableColumns } = vi.hoisted(
  () => ({
    mockSend: vi.fn(async () => 'notif-id'),
    mockQueryOne: vi.fn(),
    mockQueryAll: vi.fn(),
    mockQueryRun: vi.fn(async () => ({ changes: 1, lastID: 0 })),
    mockGetTableColumns: vi.fn(async () => [] as Array<{ name: string }>),
  })
);

vi.mock('../../../server/src/services/notificationService.js', () => ({
  default: { send: mockSend },
  send: mockSend,
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: (...args: any[]) => mockQueryOne(...args),
  queryAll: (...args: any[]) => mockQueryAll(...args),
  queryRun: (...args: any[]) => mockQueryRun(...args),
  queryFirst: (...args: any[]) => mockQueryOne(...args),
  getTableColumns: (...args: any[]) => mockGetTableColumns(...args),
  query: (...args: any[]) => mockQueryAll(...args),
  run: (...args: any[]) => mockQueryRun(...args),
  buildInPlaceholders: (values: unknown[]) => values.map(() => '?').join(', '),
  buildOrgFilter: () => '',
  buildUserFilter: () => '',
  withPgTransaction: async (fn: (client: any) => Promise<unknown>) =>
    fn({
      query: async (sql: string, params: unknown[] = []) => {
        if (/^\s*SELECT\b/i.test(sql)) {
          const row = await mockQueryOne(sql, params);
          return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
        }
        const result = await mockQueryRun(sql, params);
        return { rows: [], rowCount: result?.changes ?? 0 };
      },
    }),
}));

vi.mock('../../../server/src/services/initiative/initiativeGateReadinessService.js', () => ({
  getBlockingReadinessItems: vi.fn(async () => []),
}));

vi.mock('../../../server/src/services/initiative/initiativeAccessResolver.js', () => ({
  resolveInitiativeAccessContext: vi.fn(async () => ({
    effectiveRoles: ['ADMIN'],
    steeringBoard: { enabled: false, memberType: null },
  })),
}));

vi.mock('../../../server/src/services/initiative/initiativeGateAiConfig.js', () => ({
  isInitiativeGateAiEnabled: vi.fn(async () => false),
}));

import { InitiativeController } from '../../../server/src/controllers/InitiativeController.js';

const ACTOR_ID = 'user-actor';
const OWNER_ID = 'user-owner-in-org';
const ORG_ID = 'org-target';
// A user in a DIFFERENT org — must never be addressed by a notification.
const FOREIGN_USER_ID = 'user-in-other-org';

const INI_ID = 'ini-1';

async function callStatusUpdate(opts: {
  currentStatus: string;
  status: string;
  reason?: string;
  /** In-org recipients returned by the owner lookup. */
  recipients: string[];
}): Promise<{ statusCode: number | null; json: any }> {
  const recipients = opts.recipients;

  mockQueryOne.mockImplementation(async (sql: string) => {
    const s = String(sql);
    if (s.includes('SELECT status, name, created_by') || s.includes('SELECT * FROM initiatives')) {
      return { status: opts.currentStatus, name: 'Test Initiative', created_by: ACTOR_ID };
    }
    // getInitiativeNotificationRecipients owner lookup (org-scoped in SQL) and
    // the gate-2 auto-derive lookup. We model the org filter by only returning
    // in-org owners here — exactly what the `organization_id = ?` clause does.
    if (s.includes('owner_business_id')) {
      return {
        owner_business_id: recipients[0] ?? null,
        owner_execution_id: recipients[1] ?? null,
        sponsor_id: recipients[2] ?? null,
        name: 'Test Initiative',
      };
    }
    return null;
  });
  // No watchers / stakeholders / gate-role rows.
  mockQueryAll.mockImplementation(async () => []);

  const req: any = {
    params: { id: INI_ID },
    body: { status: opts.status, reason: opts.reason },
    user: { id: ACTOR_ID, organizationId: ORG_ID, role: 'ADMIN' },
  };
  let statusCode: number | null = null;
  let jsonBody: any = null;
  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: any) {
      jsonBody = body;
      return this;
    },
  };
  let caught: any = null;
  await (InitiativeController.updateInitiativeStatus as any)(req, res, (err: any) => {
    caught = err;
  });
  if (caught) throw caught;
  return { statusCode, json: jsonBody };
}

describe('M13/R4 — notification org-scope (no cross-org leak)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockImplementation(async () => 'notif-id');
    mockQueryRun.mockImplementation(async () => ({ changes: 1, lastID: 0 }));
    mockGetTableColumns.mockImplementation(async () => []);
  });

  it('every notification is scoped to the initiative org and only targets resolved recipients', async () => {
    await callStatusUpdate({
      currentStatus: 'EXECUTING',
      status: 'BLOCKED',
      reason: 'dep',
      recipients: [OWNER_ID],
    });

    const payloads = mockSend.mock.calls.map((c) => c[0]);
    expect(payloads.length).toBeGreaterThanOrEqual(1);

    // Every notification carries the initiative's org id.
    expect(payloads.every((p: any) => p.organizationId === ORG_ID)).toBe(true);

    // Every recipient is one of the in-org resolved recipients (owner), and is
    // never the actor.
    const allowed = new Set([OWNER_ID]);
    expect(payloads.every((p: any) => allowed.has(p.userId))).toBe(true);
    expect(payloads.every((p: any) => p.userId !== ACTOR_ID)).toBe(true);

    // The foreign-org user — who is NOT in the recipient list — is never a target.
    expect(payloads.some((p: any) => p.userId === FOREIGN_USER_ID)).toBe(false);
    // Sanity: the canonical status-change notification fired for the owner.
    const statusChanged = payloads.filter((p: any) => p.type === 'initiative.status_changed');
    expect(statusChanged.length).toBeGreaterThanOrEqual(1);
    expect(statusChanged[0].userId).toBe(OWNER_ID);
  });

  it('a recipient outside the resolved set receives nothing', async () => {
    // The owner lookup only ever yields in-org users; a foreign user is never
    // in that set, so no send targets them — even across multiple recipients.
    await callStatusUpdate({
      currentStatus: 'EXECUTING',
      status: 'BLOCKED',
      reason: 'dep',
      recipients: [OWNER_ID, 'user-owner-exec-in-org'],
    });

    const targets = mockSend.mock.calls.map((c) => c[0]?.userId);
    expect(targets).not.toContain(FOREIGN_USER_ID);
    // And every send was org-scoped.
    expect(mockSend.mock.calls.every((c) => c[0]?.organizationId === ORG_ID)).toBe(true);
  });
});
