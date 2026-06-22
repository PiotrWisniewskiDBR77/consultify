/**
 * M13 Depth · Seria R (R4 / M13d) — status-change notification wiring.
 *
 * Verifies the FRESH R4 wiring in InitiativeController.updateInitiativeStatus
 * (added 2026-06-22, previously only tsc-clean, runtime never asserted):
 *   - a transition → BLOCKED fires the dedicated CRITICAL `notifyBlocker`
 *     (type `initiative_blocked`, carries the reason) — NOT the generic
 *     INFO status-change (no dubel WITHIN the R4 block);
 *   - any other transition fires `notifyStatusChange` (type
 *     `initiative_status_change`, INFO) — NOT the blocker;
 *   - the acting user is never notified about their own transition.
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
    if (s.includes('SELECT status, name, created_by')) {
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

  it('→ BLOCKED fires a CRITICAL initiative_blocked notification carrying the reason', async () => {
    const reason = 'Vendor delay on critical dependency';
    await callStatusUpdate({ currentStatus: 'EXECUTING', status: 'BLOCKED', reason });

    const blocked = sentOfType('initiative_blocked');
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

    // No dubel WITHIN the R4 block: the generic INFO status-change emitter must
    // NOT also fire for a → BLOCKED transition.
    expect(sentOfType('initiative_status_change')).toHaveLength(0);
  });

  it('non-blocked transition fires INFO initiative_status_change, not the blocker', async () => {
    await callStatusUpdate({ currentStatus: 'BLOCKED', status: 'EXECUTING' });

    const status = sentOfType('initiative_status_change');
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

    const blocked = sentOfType('initiative_blocked');
    expect(blocked.length).toBeGreaterThanOrEqual(1);
    expect(blocked.every((p: any) => p.userId !== ACTOR_ID)).toBe(true);
    expect(blocked.some((p: any) => p.userId === OWNER_ID)).toBe(true);
  });

  // KNOWN ISSUE (2026-06-22) — cross-block duplication, NOT yet fixed.
  // The R4 wiring at InitiativeController.ts:1953 fires the new
  // `initiative_blocked` / `initiative_status_change` notifications, but the
  // PRE-EXISTING block at ~2069 ALSO fires the legacy dotted
  // `initiative.status_changed` to the same recipients on every successful
  // status change. Empirically a single → BLOCKED transition delivers TWO
  // notifications to the same owner (initiative_blocked + initiative.status_changed).
  // The legacy dotted types are the canonical ones (registered in the
  // integration catalog / FE); the R4 underscore types have no FE/integration
  // consumers. Fixing requires a notification-architecture decision (which
  // system is canonical / register R4 types / revert R4) — tracked separately,
  // owner: Piotr decision. Un-skip once resolved.
  it.skip('[post-fix] a → BLOCKED transition delivers exactly one status notification per recipient', async () => {
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
