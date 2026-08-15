/**
 * M13 Depth · Seria R (R4 / M13d) — status-change notification wiring.
 *
 * Verifies the canonical status-change notification in
 * InitiativeController.updateInitiativeStatus (Wariant A dedup, 2026-06-22 —
 * see finding_initiative_status_notification_dubel):
 *   - every transition emits a SINGLE `initiative.status_changed` (the dotted
 *     type registered in the integration catalog) per recipient;
 *   - a → BLOCKED transition is escalated to severity CRITICAL and carries the
 *     blocker reason in the body;
 *   - a non-blocked transition is INFO;
 *   - the acting user is never notified about their own transition;
 *   - the removed R4 underscore emitter (`initiative_blocked` /
 *     `initiative_status_change`) no longer fires (no dubel).
 *
 * Strategy: exercise the REAL controller method (no controller mock) with the
 * REAL initiative notification emitters, mocking only the leaf dependencies
 * (DB query helpers, gate/readiness/access services and the underlying
 * notificationService.send). We assert on the real `send` payloads so the
 * whole chain (controller → emitter → send) is covered, not just a spy.
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

// Underlying notification sink — mocked. Both the default export (used by the
// controller's legacy block) and the named `send` (used by the R4 emitters)
// route to the same spy so we can see every notification the path produces.
vi.mock('../../../server/src/services/notificationService.js', () => ({
  default: { send: mockSend },
  send: mockSend,
}));

// DB layer — SQL-aware mock so the real controller traverses the BLOCKED /
// UNBLOCK path cleanly without a live Postgres.
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
  withPgTransaction: async (work: (client: any) => Promise<unknown>) =>
    work({
      query: async (sql: string, params: unknown[]) => {
        const statement = String(sql);
        if (/^\s*select\s+\*\s+from\s+initiatives/i.test(statement)) {
          const row = await mockQueryOne(statement, params);
          return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
        }
        if (/^\s*select/i.test(statement)) {
          const rows = await mockQueryAll(statement, params);
          return { rows: rows ?? [], rowCount: rows?.length ?? 0 };
        }
        const result = await mockQueryRun(statement, params);
        return { rows: [], rowCount: result?.changes ?? 0 };
      },
    }),
}));

// Readiness gate — never block (we test notification wiring, not gating).
vi.mock('../../../server/src/services/initiative/initiativeGateReadinessService.js', () => ({
  getBlockingReadinessItems: vi.fn(async () => []),
}));

// Access resolver — actor is an ADMIN so any gate (BLOCK / UNBLOCK) passes RBAC.
vi.mock('../../../server/src/services/initiative/initiativeAccessResolver.js', () => ({
  resolveInitiativeAccessContext: vi.fn(async () => ({
    effectiveRoles: ['ADMIN'],
    steeringBoard: { enabled: false, memberType: null },
  })),
}));

// AI gate flag OFF → AI soft-block path is skipped (fail-safe default).
vi.mock('../../../server/src/services/initiative/initiativeGateAiConfig.js', () => ({
  isInitiativeGateAiEnabled: vi.fn(async () => false),
}));

// The notification contract is downstream of lifecycle governance. Supply a
// current approved decision so the real BLOCKED -> EXECUTING transition can
// commit and reach the notification side effect under test.
vi.mock('../../../server/src/services/initiative/initiativeLifecycleGateDecisionService.js', () => ({
  assertCurrentApprovedInitiativeLifecycleGateDecision: vi.fn(async () => ({
    decisionId: 'decision-current-go',
  })),
}));

import { InitiativeController } from '../../../server/src/controllers/InitiativeController.js';

const ACTOR_ID = 'user-actor';
const OWNER_ID = 'user-owner';
const ORG_ID = 'org-1';
const INI_ID = 'ini-1';

/** Build a fake (req,res,next) and invoke the asyncHandler-wrapped method. */
async function callStatusUpdate(opts: {
  currentStatus: string;
  status: string;
  reason?: string;
  recipients?: string[];
}): Promise<{ statusCode: number | null; json: any }> {
  const recipients = opts.recipients ?? [OWNER_ID];

  mockQueryOne.mockImplementation(async (sql: string) => {
    const s = String(sql);
    // Initial lookup in updateInitiativeStatus.
    if (s.includes('SELECT status, name, created_by') || s.includes('FOR UPDATE')) {
      return { status: opts.currentStatus, name: 'Test Initiative', created_by: ACTOR_ID };
    }
    // getInitiativeNotificationRecipients owner lookup.
    if (s.includes('owner_business_id') && s.includes('owner_execution_id')) {
      return {
        owner_business_id: recipients[0] ?? null,
        owner_execution_id: recipients[1] ?? null,
        sponsor_id: recipients[2] ?? null,
        name: 'Test Initiative',
      };
    }
    return null;
  });
  // Watchers / stakeholders / gate-role rows: none.
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

/** All `send` payloads whose type matches (across both notification blocks). */
function sentOfType(type: string): any[] {
  return mockSend.mock.calls.map((c) => c[0]).filter((p: any) => p?.type === type);
}

describe('M13/R4 — status-change notification wiring (real controller)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockImplementation(async () => 'notif-id');
    mockQueryRun.mockImplementation(async () => ({ changes: 1, lastID: 0 }));
    mockGetTableColumns.mockImplementation(async () => []);
  });

  it('→ BLOCKED fires a single CRITICAL initiative.status_changed carrying the reason', async () => {
    const reason = 'Vendor delay on critical dependency';
    await callStatusUpdate({ currentStatus: 'EXECUTING', status: 'BLOCKED', reason });

    const blocked = sentOfType('initiative.status_changed');
    expect(blocked.length).toBeGreaterThanOrEqual(1);
    expect(blocked[0]).toEqual(
      expect.objectContaining({
        userId: OWNER_ID,
        organizationId: ORG_ID,
        entityType: 'initiative',
        entityId: INI_ID,
        severity: 'CRITICAL',
      })
    );
    expect(String(blocked[0].body)).toContain(reason);

    // Dedup: the removed R4 underscore emitter must NOT fire anymore.
    expect(sentOfType('initiative_blocked')).toHaveLength(0);
    expect(sentOfType('initiative_status_change')).toHaveLength(0);
  });

  it('non-blocked transition fires INFO initiative.status_changed', async () => {
    await callStatusUpdate({ currentStatus: 'BLOCKED', status: 'EXECUTING' });

    const status = sentOfType('initiative.status_changed');
    expect(status.length).toBeGreaterThanOrEqual(1);
    expect(status[0]).toEqual(
      expect.objectContaining({
        userId: OWNER_ID,
        organizationId: ORG_ID,
        entityType: 'initiative',
        entityId: INI_ID,
        severity: 'INFO',
      })
    );
    expect(sentOfType('initiative_blocked')).toHaveLength(0);
  });

  it('never notifies the actor about their own status change', async () => {
    // Actor is also an owner → must be filtered out of recipients.
    await callStatusUpdate({
      currentStatus: 'EXECUTING',
      status: 'BLOCKED',
      reason: 'self-block',
      recipients: [ACTOR_ID, OWNER_ID],
    });

    const blocked = sentOfType('initiative.status_changed');
    expect(blocked.length).toBeGreaterThanOrEqual(1);
    expect(blocked.every((p: any) => p.userId !== ACTOR_ID)).toBe(true);
    expect(blocked.some((p: any) => p.userId === OWNER_ID)).toBe(true);
  });

  // Regression guard for the dubel fix (2026-06-22, Wariant A): the dedicated
  // R4 underscore emitter was removed so a → BLOCKED transition now delivers
  // EXACTLY ONE status/blocker notification per recipient (the canonical
  // `initiative.status_changed`). See finding_initiative_status_notification_dubel.
  it('a → BLOCKED transition delivers exactly one status notification per recipient', async () => {
    await callStatusUpdate({
      currentStatus: 'EXECUTING',
      status: 'BLOCKED',
      reason: 'dep',
      recipients: [OWNER_ID],
    });
    const toOwner = mockSend.mock.calls
      .map((c) => c[0])
      .filter((p: any) => p?.userId === OWNER_ID && /status|block/i.test(String(p?.type)));
    expect(toOwner).toHaveLength(1);
  });
});
