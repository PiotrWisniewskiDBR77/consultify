/**
 * L2 — Integracja: realny InitiativeController.updateInitiativeStatus (30 testów).
 *
 * Część systemu testów procesu inicjatyw (TESTY_M13_PROCES_STATUSOW, warstwa L2).
 * Ćwiczy PRAWDZIWY handler (walidacja przejść + RBAC bramek + kody błędów +
 * side-effecty) na mockowanej warstwie DB. Wzór: tests/unit/backend/controllers/
 * InitiativeController.test.ts. Dowód dla: WYNIKI_M13_INICJATYWY (L2).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockGetTableColumns = vi.fn();
const mockResolveAccess = vi.fn();
const mockGetBlockingReadinessItems = vi.fn();

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...a: unknown[]) => mockQueryAll(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  queryRun: (...a: unknown[]) => mockQueryRun(...a),
  getTableColumns: (...a: unknown[]) => mockGetTableColumns(...a),
  // The production transition is now one row-locked PostgreSQL transaction.
  // Adapt this controller characterization harness to the same call shape
  // while preserving its existing deterministic DB expectations.
  withPgTransaction: async (work: (client: { query: Function }) => unknown) =>
    work({
      query: async (sql: string, params: unknown[] = []) => {
        if (/^\s*SELECT \* FROM initiatives\b/i.test(sql)) {
          const row = await mockQueryOne(sql, params);
          return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
        }
        if (/^\s*SELECT\b/i.test(sql)) {
          const rows = await mockQueryAll(sql, params);
          return { rows: rows || [], rowCount: (rows || []).length };
        }
        const result = await mockQueryRun(sql, params);
        return { rows: [], rowCount: result?.changes || 0 };
      },
    }),
}));
vi.mock('../../../server/src/services/initiative/initiativeAccessResolver.js', () => ({
  resolveInitiativeAccessContext: (...a: unknown[]) => mockResolveAccess(...a),
}));
vi.mock(
  '../../../server/src/services/initiative/initiativeCapabilityMatrix.js',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('../../../server/src/services/initiative/initiativeCapabilityMatrix.js')
    >();
    return {
      ...actual,
      resolveInitiativeCapabilityContext: async (...a: unknown[]) => {
        const legacyShape = await mockResolveAccess(...a);
        return {
          effectiveRoles: legacyShape?.effectiveRoles || [],
          steeringBoardEnabled: Boolean(legacyShape?.steeringBoard?.enabled),
        };
      },
    };
  }
);
vi.mock('../../../server/src/services/initiative/initiativeGateAiConfig.js', () => ({
  isInitiativeGateAiEnabled: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../../server/src/services/initiative/initiativeGateReadinessService.js', () => ({
  getBlockingReadinessItems: (...a: unknown[]) => mockGetBlockingReadinessItems(...a),
}));
vi.mock('../../../server/src/services/initiative/stageHandoffService.js', () => ({
  recordHandoff: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../server/src/services/notificationService.js', () => ({
  default: { send: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../server/src/services/AuditEventsService.js', () => ({
  default: { log: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../server/src/services/closureDeliveryReceiptService.js', () => ({
  createReceiptOnClosure: vi.fn().mockResolvedValue(undefined),
  triggerImmediateDeliveryBestEffort: vi.fn(),
}));
vi.mock('../../../server/src/utils/asyncHandler.js', () => ({ asyncHandler: (fn: Function) => fn }));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('uuid', () => ({ v4: () => 'init-uuid-123' }));

const ALL_LIFECYCLE_COLS = [
  'status', 'updated_at', 'updated_by', 'review_requested_at', 'review_requested_by',
  'approved_at', 'approved_by', 'approval_comment', 'execution_started_at', 'blocked_at',
  'blocked_reason', 'unblocked_at', 'done_at', 'done_by', 'completed_at', 'cancelled_at',
  'cancelled_reason', 'archived_at', 'created_by', 'owner_business_id',
].map((name) => ({ name }));

describe('L2 — updateInitiativeStatus (realny handler, mock-DB)', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTableColumns.mockResolvedValue(ALL_LIFECYCLE_COLS);
    mockGetBlockingReadinessItems.mockResolvedValue([]);
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockQueryAll.mockResolvedValue([]);
    req = { user: { id: 'user-123', organizationId: 'org-123', role: 'ADMIN' }, params: {}, query: {}, body: {} };
    res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    next = vi.fn();
  });

  async function handler() {
    const { InitiativeController } = await import('../../../server/src/controllers/InitiativeController.js');
    return InitiativeController.updateInitiativeStatus(req, res, next);
  }
  const existing = (status: string, extra: Record<string, unknown> = {}) =>
    mockQueryOne.mockResolvedValue({ status, name: 'Init', created_by: 'user-123', ...extra });
  const roles = (effectiveRoles: string[], steeringEnabled = false) =>
    mockResolveAccess.mockResolvedValue({
      effectiveRoles, steeringBoard: { enabled: steeringEnabled, memberType: null }, roleAssignments: [], projectId: null,
    });
  const statusArg = () => (res.status.mock.calls[0]?.[0]);
  const updateRan = () => mockQueryRun.mock.calls.some((c) => String(c[0] || '').includes('UPDATE initiatives SET'));

  // ── O1/auth — 401/guard (2) ──
  it('L2-A1: brak uwierzytelnienia → 401', async () => {
    req.user = { id: 'user-123' }; // brak organizationId
    req.params.id = 'i1'; req.body = { status: 'PLANNING' };
    await handler();
    expect(res.status).toHaveBeenCalledWith(401);
  });
  it('L2-A2: inicjatywa nie istnieje → 404', async () => {
    req.params.id = 'i1'; req.body = { status: 'PENDING_REVIEW' };
    mockQueryOne.mockResolvedValue(undefined);
    roles(['ADMIN']);
    await handler();
    expect([404, 400]).toContain(statusArg());
  });

  // ── O3 invalid transitions → 400 (4) ──
  it('L2-09: skok DRAFT → APPROVED → 400', async () => {
    req.params.id = 'i1'; req.body = { status: 'APPROVED' };
    existing('DRAFT'); roles(['ADMIN']);
    await handler();
    expect(res.status).toHaveBeenCalledWith(400);
  });
  it('L2-10: cofnięcie DONE → EXECUTING → 400', async () => {
    req.params.id = 'i1'; req.body = { status: 'EXECUTING' };
    existing('DONE'); roles(['ADMIN']);
    await handler();
    expect(res.status).toHaveBeenCalledWith(400);
  });
  it('L2-11: mutacja ARCHIVED → 400', async () => {
    req.params.id = 'i1'; req.body = { status: 'DRAFT' };
    existing('ARCHIVED'); roles(['ADMIN']);
    await handler();
    expect(res.status).toHaveBeenCalledWith(400);
  });
  it('L2-12: nieznany status docelowy → 400', async () => {
    req.params.id = 'i1'; req.body = { status: 'WAT_IS_THIS' };
    existing('DRAFT'); roles(['ADMIN']);
    await handler();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ── O2 happy-path bez bramek governance → sukces (8) ──
  it('L2-01: DRAFT → PENDING_REVIEW (owner) → update wykonany', async () => {
    req.params.id = 'i1'; req.body = { status: 'PENDING_REVIEW', reason: 'gotowe' };
    existing('DRAFT', { owner_business_id: 'user-123' }); roles(['INITIATIVE_OWNER']);
    await handler();
    expect(updateRan()).toBe(true);
  });
  it('L2-02: PENDING_REVIEW → REVIEW (PM) → update', async () => {
    req.params.id = 'i1'; req.body = { status: 'REVIEW' };
    existing('PENDING_REVIEW'); roles(['PROJECT_MANAGER']);
    await handler();
    expect(updateRan()).toBe(true);
  });
  it('L2-03: PENDING_REVIEW → DRAFT (send-back, PMO) → update', async () => {
    req.params.id = 'i1'; req.body = { status: 'DRAFT', reason: 'do poprawy' };
    existing('PENDING_REVIEW'); roles(['PMO']);
    await handler();
    expect(updateRan()).toBe(true);
  });
  it('L2-04: REVIEW → DRAFT (reject, sponsor) → update', async () => {
    req.params.id = 'i1'; req.body = { status: 'DRAFT', reason: 'odrzucone' };
    existing('REVIEW'); roles(['PROJECT_SPONSOR']);
    await handler();
    expect(updateRan()).toBe(true);
  });
  it('L2-05: EXECUTING → BLOCKED z powodem (owner) → update', async () => {
    req.params.id = 'i1'; req.body = { status: 'BLOCKED', reason: 'czeka na dostawcę' };
    existing('EXECUTING'); roles(['INITIATIVE_OWNER']);
    await handler();
    expect(updateRan()).toBe(true);
  });
  it('L2-06: BLOCKED → EXECUTING requires a current Go/No-Go decision', async () => {
    req.params.id = 'i1'; req.body = { status: 'EXECUTING' };
    existing('BLOCKED'); roles(['STEERING_COMMITTEE'], true);
    await handler();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ rule: 'GATE_DECISION_REQUIRED' })
    );
  });
  it('L2-07: → CANCELLED z aktywnego (PMO, bypass bramek) → update', async () => {
    req.params.id = 'i1'; req.body = { status: 'CANCELLED', reason: 'rezygnacja' };
    existing('PLANNING'); roles(['PMO']);
    await handler();
    expect(updateRan()).toBe(true);
  });
  it('L2-08: ADMIN omija bramkę na dowolnym forward → update', async () => {
    req.params.id = 'i1'; req.body = { status: 'PENDING_REVIEW' };
    existing('DRAFT'); roles(['ADMIN']);
    await handler();
    expect(updateRan()).toBe(true);
  });

  // ── O4 bramka rozpoznana (3) ──
  it('L2-13: [DEF-1 naprawiony] BLOCKED bez powodu → 400 BLOCKED_REASON_REQUIRED', async () => {
    // DEF-1 hardening: handler egzekwuje teraz parytet z kanonicznym validateTransition
    // (L1 F2) — BLOCKED bez `reason` jest odrzucany przed zapisem.
    req.params.id = 'i1'; req.body = { status: 'BLOCKED' };
    existing('EXECUTING'); roles(['PMO']);
    await handler();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ rule: 'BLOCKED_REASON_REQUIRED' }));
    expect(updateRan()).toBe(false);
  });
  it('L2-14: zapis statusu trafia do UPDATE initiatives SET', async () => {
    req.params.id = 'i1'; req.body = { status: 'PENDING_REVIEW' };
    existing('DRAFT'); roles(['ADMIN']);
    await handler();
    const call = mockQueryRun.mock.calls.find((c) => String(c[0] || '').includes('UPDATE initiatives SET'));
    expect(call).toBeTruthy();
  });
  it('L2-15: odpowiedź sukcesu zawiera nowy status', async () => {
    req.params.id = 'i1'; req.body = { status: 'PENDING_REVIEW' };
    existing('DRAFT'); roles(['ADMIN']);
    await handler();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING_REVIEW' }));
  });

  // ── O5 RBAC bramek → 403/200 (7) ──
  it('L2-16: CONSULTANT próbuje APPROVE → 403', async () => {
    req.params.id = 'i1'; req.body = { status: 'APPROVED' };
    existing('PLANNING'); roles(['CONSULTANT']);
    await handler();
    expect(res.status).toHaveBeenCalledWith(403);
  });
  it('L2-17: PMO próbuje APPROVE (tylko steering) → 403', async () => {
    req.params.id = 'i1'; req.body = { status: 'APPROVED' };
    existing('PLANNING'); roles(['PMO']);
    await handler();
    expect(res.status).toHaveBeenCalledWith(403);
  });
  it('L2-18: STEERING APPROVE (board enabled) → przechodzi (update)', async () => {
    req.params.id = 'i1'; req.body = { status: 'APPROVED' };
    existing('PLANNING'); roles(['STEERING_COMMITTEE'], true);
    await handler();
    expect(updateRan()).toBe(true);
  });
  it('L2-19: brak steering-board → degradacja do PROJECT_SPONSOR dla APPROVE', async () => {
    req.params.id = 'i1'; req.body = { status: 'APPROVED' };
    existing('PLANNING'); roles(['PROJECT_SPONSOR'], false);
    await handler();
    expect(updateRan()).toBe(true);
  });
  it('L2-20: VIEWER (brak roli bramki) → 403', async () => {
    req.params.id = 'i1'; req.body = { status: 'PENDING_REVIEW' };
    existing('DRAFT'); roles(['VIEWER']);
    await handler();
    expect(res.status).toHaveBeenCalledWith(403);
  });
  it('L2-21: CONSULTANT submit CUDZEJ inicjatywy → 403 (created_by guard)', async () => {
    req.params.id = 'i1'; req.body = { status: 'PENDING_REVIEW' };
    existing('DRAFT', { created_by: 'someone-else' }); roles(['CONSULTANT']);
    await handler();
    expect(res.status).toHaveBeenCalledWith(403);
  });
  it('L2-22: BUSINESS_OWNER próbuje COMPLETE (nie jego bramka) → 403', async () => {
    req.params.id = 'i1'; req.body = { status: 'DONE' };
    existing('EXECUTING'); roles(['BUSINESS_OWNER']);
    await handler();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // ── O6/O7 reguły treści + governance + side-effecty (8) ──
  it('L2-23: EXECUTING → DONE first requires the canonical Closure decision', async () => {
    req.params.id = 'i1'; req.body = { status: 'DONE' };
    existing('EXECUTING'); roles(['PMO']);
    // tabela decisions musi mieć initiative_id, by scopeConditions nie były puste
    mockGetTableColumns.mockImplementation((t: string) =>
      t === 'decisions' ? [{ name: 'initiative_id' }, { name: 'status' }, { name: 'type' }] : ALL_LIFECYCLE_COLS);
    mockQueryAll.mockResolvedValue([{ id: 'd1' }]); // hasPendingExecutionGateDecisions → true
    await handler();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ rule: 'CLOSURE_GATE_DECISION_REQUIRED' })
    );
  });
  it('L2-24: DONE → TRACKING bez KPI korzyści → 400 BENEFITS_KPI_REQUIRED', async () => {
    req.params.id = 'i1'; req.body = { status: 'TRACKING' };
    mockQueryOne
      .mockResolvedValueOnce({
        status: 'DONE',
        name: 'Init',
        created_by: 'user-123',
        owner_business_id: 'bo-1',
      })
      .mockResolvedValueOnce({ c: 0 });
    roles(['BUSINESS_OWNER']);
    await handler();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ rule: 'BENEFITS_KPI_REQUIRED' }));
  });
  it('L2-25: readiness hard-block (blocking items) → 400 GATE_BLOCKED', async () => {
    req.params.id = 'i1'; req.body = { status: 'PENDING_REVIEW' };
    existing('DRAFT'); roles(['ADMIN']);
    mockGetBlockingReadinessItems.mockResolvedValue([{ id: 'x', label: 'brak właściciela' }]);
    await handler();
    expect(res.status).toHaveBeenCalledWith(400);
  });
  it('L2-26: CANCELLED omija readiness hard-block', async () => {
    req.params.id = 'i1'; req.body = { status: 'CANCELLED', reason: 'stop' };
    existing('PLANNING'); roles(['PMO']);
    mockGetBlockingReadinessItems.mockResolvedValue([{ id: 'x', label: 'cokolwiek' }]);
    await handler();
    expect(updateRan()).toBe(true);
  });
  it('L2-27: side-effect — wpis do initiative_status_history', async () => {
    req.params.id = 'i1'; req.body = { status: 'PENDING_REVIEW' };
    existing('DRAFT'); roles(['ADMIN']);
    await handler();
    const histInsert = mockQueryRun.mock.calls.some((c) => /status_history|initiative_history/i.test(String(c[0] || '')));
    expect(histInsert).toBe(true);
  });
  it('L2-28: side-effect — timestamp cyklu (review_requested_at) w UPDATE', async () => {
    req.params.id = 'i1'; req.body = { status: 'PENDING_REVIEW', reason: 'r' };
    existing('DRAFT'); roles(['ADMIN']);
    await handler();
    const upd = mockQueryRun.mock.calls.find((c) => String(c[0] || '').includes('UPDATE initiatives SET'));
    expect(String(upd?.[0] || '')).toContain('review_requested_at');
  });
  it('L2-29: BLOCKED zapisuje blocked_reason w UPDATE', async () => {
    req.params.id = 'i1'; req.body = { status: 'BLOCKED', reason: 'powód blokady' };
    existing('EXECUTING'); roles(['PMO']);
    await handler();
    const upd = mockQueryRun.mock.calls.find((c) => String(c[0] || '').includes('UPDATE initiatives SET'));
    expect(String(upd?.[0] || '')).toContain('blocked_reason');
  });
  it('L2-30: niepoprawny payload (brak status) → 400', async () => {
    req.params.id = 'i1'; req.body = {};
    existing('DRAFT'); roles(['ADMIN']);
    await handler();
    expect(statusArg()).toBeGreaterThanOrEqual(400);
  });
});
