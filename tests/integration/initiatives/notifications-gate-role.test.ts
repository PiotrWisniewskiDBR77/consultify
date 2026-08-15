/**
 * M13 Depth · Seria R (R4 / M13d) — gate-role notification wiring.
 *
 * Verifies block "2. Gate-specific notification" in
 * InitiativeController.updateInitiativeStatus (~lines 2093-2189): after a
 * successful transition that OPENS the next gate, the users who hold the role
 * required by that next gate receive a dedicated
 * `initiative.gate_action_required` notification ("this initiative is now
 * waiting for your decision"). The acting user is never notified.
 *
 * Transition chosen: SCHEDULED → EXECUTING (gate START, no extra
 * gate-decision precondition so the path runs cleanly). Once the initiative
 * is in EXECUTING, its VALID_TRANSITIONS are [BLOCKED, DONE, CANCELLED] →
 * getGateForTransition derives the next gates BLOCK and COMPLETE, both of
 * which require GATE_PERMISSIONS = [INITIATIVE_OWNER, PMO]. The controller
 * auto-derives the INITIATIVE_OWNER role from the initiative's
 * owner_business_id / owner_execution_id, so an owner who is NOT the actor is
 * a next-gate approver and must receive `initiative.gate_action_required`.
 *
 * Strategy mirrors notifications.test.ts: exercise the REAL controller method
 * with the REAL emitters, mocking only the leaf deps (DB helpers SQL-aware,
 * notificationService.send, access resolver → ADMIN, readiness gate → empty,
 * AI gate flag → off). We assert on the real `send` payloads.
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
  // The canonical transition executes under one row-locked PostgreSQL
  // transaction. Keep this notification characterization test on the same
  // call shape while routing SQL through its deterministic leaf mocks.
  withPgTransaction: async (work: (client: any) => Promise<unknown>) =>
    work({
      query: async (sql: string, params: unknown[] = []) => {
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

// START is now governed by a current GO/NO-GO lifecycle decision. The test is
// about downstream recipient selection, so provide that prerequisite rather
// than exercising the independent decision-currency failure path.
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

/**
 * Build a fake (req,res,next) and invoke updateInitiativeStatus.
 *
 * The owner lookups (both getInitiativeNotificationRecipients and the gate-2
 * auto-derive query) return owner_business_id = OWNER_ID, so OWNER_ID holds the
 * auto-derived INITIATIVE_OWNER role for the next gate.
 */
async function callStatusUpdate(opts: {
  currentStatus: string;
  status: string;
  ownerId?: string | null;
  /** Optional explicit initiative_gate_roles rows (queryAll). */
  gateRoleRows?: Array<{ gateRole: string; userId: string }>;
}): Promise<{ statusCode: number | null; json: any }> {
  const ownerId = opts.ownerId === undefined ? OWNER_ID : opts.ownerId;

  mockQueryOne.mockImplementation(async (sql: string) => {
    const s = String(sql);
    // Initial lookup in updateInitiativeStatus.
    if (s.includes('SELECT status, name, created_by') || /^\s*SELECT \* FROM initiatives/i.test(s)) {
      return { status: opts.currentStatus, name: 'Test Initiative', created_by: ACTOR_ID };
    }
    // Recipients lookup AND gate-2 auto-derive lookup both select owner columns.
    if (s.includes('owner_business_id')) {
      return {
        owner_business_id: ownerId,
        owner_execution_id: null,
        sponsor_id: null,
        name: 'Test Initiative',
      };
    }
    return null;
  });

  // initiative_gate_roles rows (gate-2 block) + watchers/stakeholders (none).
  mockQueryAll.mockImplementation(async (sql: string) => {
    const s = String(sql);
    if (s.includes('initiative_gate_roles')) {
      return (opts.gateRoleRows ?? []) as any[];
    }
    return [];
  });

  const req: any = {
    params: { id: INI_ID },
    body: { status: opts.status },
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

function sentOfType(type: string): any[] {
  return mockSend.mock.calls.map((c) => c[0]).filter((p: any) => p?.type === type);
}

describe('M13/R4 — gate-role action-required notification (real controller)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockImplementation(async () => 'notif-id');
    mockQueryRun.mockImplementation(async () => ({ changes: 1, lastID: 0 }));
    mockGetTableColumns.mockImplementation(async () => []);
  });

  it('SCHEDULED → EXECUTING notifies the next-gate role holder (auto-derived owner)', async () => {
    const { statusCode } = await callStatusUpdate({
      currentStatus: 'SCHEDULED',
      status: 'EXECUTING',
      ownerId: OWNER_ID,
    });
    // No explicit error status was set → transition succeeded (res.json path).
    expect(statusCode).toBeNull();

    const gate = sentOfType('initiative.gate_action_required');
    expect(gate.length).toBeGreaterThanOrEqual(1);
    expect(gate[0]).toEqual(
      expect.objectContaining({
        userId: OWNER_ID,
        organizationId: ORG_ID,
        entityType: 'initiative',
        entityId: INI_ID,
        isActionable: true,
      })
    );
    // The next gate carried in metadata is one of EXECUTING's outgoing gates.
    expect(['BLOCK', 'COMPLETE']).toContain(gate[0].metadata?.nextGate);
    // The actor never receives a gate-action-required notification.
    expect(gate.every((p: any) => p.userId !== ACTOR_ID)).toBe(true);
  });

  it('explicit initiative_gate_roles row for the next gate is also notified', async () => {
    // Owner is the actor (so auto-derive yields no eligible approver), but an
    // explicit gate-role row assigns INITIATIVE_OWNER to a distinct user.
    const APPROVER_ID = 'user-gate-approver';
    await callStatusUpdate({
      currentStatus: 'SCHEDULED',
      status: 'EXECUTING',
      ownerId: ACTOR_ID,
      gateRoleRows: [{ gateRole: 'INITIATIVE_OWNER', userId: APPROVER_ID }],
    });

    const gate = sentOfType('initiative.gate_action_required');
    expect(gate.some((p: any) => p.userId === APPROVER_ID)).toBe(true);
    expect(gate.every((p: any) => p.userId !== ACTOR_ID)).toBe(true);
  });

  it('does not emit gate_action_required when no role holder matches the next gate', async () => {
    // Only the actor is the owner → auto-derived approver is filtered out, and
    // no explicit gate-role rows exist → zero next-gate approvers.
    await callStatusUpdate({
      currentStatus: 'SCHEDULED',
      status: 'EXECUTING',
      ownerId: ACTOR_ID,
      gateRoleRows: [],
    });
    expect(sentOfType('initiative.gate_action_required')).toHaveLength(0);
  });
});
