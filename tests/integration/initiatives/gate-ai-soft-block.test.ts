/**
 * M13 Depth · Seria G (G4/G5) — AI gate soft-block + override ENFORCEMENT.
 *
 * Covers the enforcement branch inside InitiativeController.updateInitiativeStatus
 * (lines ~1302-1357) that the G5 UI modal drives. Existing tests cover the
 * read-only `getGateAiCheck` endpoint and the pure `gateAiSoftBlocks` decision;
 * this asserts the PATCH /status behaviour end-to-end through the real method:
 *
 *   - below-threshold readiness on a forward AI gate WITHOUT an overrideReason
 *     → HTTP 422 (code INITIATIVE_GATE_AI_SOFT_BLOCK) + a telemetry event
 *       recorded with blocked:true, overridden:false;
 *   - the SAME transition WITH an overrideReason → proceeds (no 422) + a
 *     telemetry event with blocked:false, overridden:true, overrideReason set;
 *   - above-threshold readiness → proceeds + telemetry blocked:false.
 *
 * A headless UI e2e is not viable (the override modal does not mount headless,
 * and MOCK_DB cannot produce a deterministic soft-block), so this integration
 * test is the deterministic gate for the G5 server flow.
 *
 * Strategy mirrors notifications.test.ts: exercise the REAL controller, mocking
 * only leaf deps (DB helpers, readiness/timeline/telemetry/flag services).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockQueryOne,
  mockQueryAll,
  mockQueryRun,
  mockGetTableColumns,
  mockGateEnabled,
  mockGetReadiness,
  mockGetTimeline,
  mockRecordEvent,
  mockSend,
} = vi.hoisted(() => ({
  mockQueryOne: vi.fn(),
  mockQueryAll: vi.fn(async () => []),
  mockQueryRun: vi.fn(async () => ({ changes: 1, lastID: 0 })),
  mockGetTableColumns: vi.fn(async () => [] as Array<{ name: string }>),
  mockGateEnabled: vi.fn(async () => true),
  mockGetReadiness: vi.fn(),
  mockGetTimeline: vi.fn(async () => ({ flags: [] })),
  mockRecordEvent: vi.fn(async () => undefined),
  mockSend: vi.fn(async () => 'notif-id'),
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: (...a: any[]) => mockQueryOne(...a),
  queryAll: (...a: any[]) => mockQueryAll(...a),
  queryRun: (...a: any[]) => mockQueryRun(...a),
  queryFirst: (...a: any[]) => mockQueryOne(...a),
  getTableColumns: (...a: any[]) => mockGetTableColumns(...a),
  query: (...a: any[]) => mockQueryAll(...a),
  run: (...a: any[]) => mockQueryRun(...a),
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
  isInitiativeGateAiEnabled: (...a: any[]) => mockGateEnabled(...a),
}));

vi.mock('../../../server/src/services/initiative/gateAiReadinessService.js', () => ({
  getGateReadiness: (...a: any[]) => mockGetReadiness(...a),
}));

vi.mock('../../../server/src/services/initiative/gateTimelineService.js', () => ({
  getTimelineFlags: (...a: any[]) => mockGetTimeline(...a),
}));

vi.mock('../../../server/src/services/initiative/gateAiTelemetryService.js', () => ({
  recordGateAiEvent: (...a: any[]) => mockRecordEvent(...a),
}));

vi.mock('../../../server/src/services/notificationService.js', () => ({
  default: { send: mockSend },
  send: mockSend,
}));

import { InitiativeController } from '../../../server/src/controllers/InitiativeController.js';

const ACTOR_ID = 'user-actor';
const ORG_ID = 'org-1';
const INI_ID = 'ini-1';

const readyAt = (score: number) => ({
  score,
  threshold: 75,
  verdict: score >= 75 ? 'ready' : 'below',
  gaps: [],
  fixes: [],
});

/** DRAFT → PENDING_REVIEW is the SUBMIT_FOR_REVIEW forward AI gate. */
async function patchStatus(body: Record<string, unknown>): Promise<{
  statusCode: number | null;
  json: any;
}> {
  mockQueryOne.mockImplementation(async (sql: string) => {
    const s = String(sql);
    if (s.includes('SELECT status, name, created_by') || s.includes('SELECT * FROM initiatives')) {
      return { status: 'DRAFT', name: 'Test Initiative', created_by: ACTOR_ID };
    }
    if (s.includes('owner_business_id') && s.includes('owner_execution_id')) {
      return { owner_business_id: null, owner_execution_id: null, sponsor_id: null, name: 'X' };
    }
    return null;
  });

  const req: any = {
    params: { id: INI_ID },
    body: { status: 'PENDING_REVIEW', ...body },
    user: { id: ACTOR_ID, organizationId: ORG_ID, role: 'ADMIN' },
  };
  let statusCode: number | null = null;
  let jsonBody: any = null;
  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(b: any) {
      jsonBody = b;
      return this;
    },
  };
  let caught: any = null;
  await (InitiativeController.updateInitiativeStatus as any)(req, res, (e: any) => {
    caught = e;
  });
  if (caught) throw caught;
  return { statusCode, json: jsonBody };
}

describe('M13/G5 — AI gate soft-block + override (real controller)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryAll.mockImplementation(async () => []);
    mockQueryRun.mockImplementation(async () => ({ changes: 1, lastID: 0 }));
    mockGetTableColumns.mockImplementation(async () => []);
    mockGateEnabled.mockImplementation(async () => true);
    mockGetTimeline.mockImplementation(async () => ({ flags: [] }));
    mockRecordEvent.mockImplementation(async () => undefined);
    mockSend.mockImplementation(async () => 'notif-id');
  });

  it('below threshold without overrideReason → 422 soft-block + telemetry blocked', async () => {
    mockGetReadiness.mockResolvedValue(readyAt(40));

    const res = await patchStatus({});

    expect(res.statusCode).toBe(422);
    expect(res.json).toEqual(expect.objectContaining({ code: 'INITIATIVE_GATE_AI_SOFT_BLOCK' }));
    expect(mockRecordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ blocked: true, overridden: false, score: 40 })
    );
  });

  it('below threshold WITH overrideReason → proceeds + telemetry overridden', async () => {
    mockGetReadiness.mockResolvedValue(readyAt(40));

    const res = await patchStatus({ overrideReason: 'CEO escalation — proceed at risk' });

    expect(res.statusCode).not.toBe(422);
    expect(mockRecordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        blocked: false,
        overridden: true,
        overrideReason: 'CEO escalation — proceed at risk',
      })
    );
  });

  it('above threshold → proceeds with no soft-block + telemetry blocked:false', async () => {
    mockGetReadiness.mockResolvedValue(readyAt(90));

    const res = await patchStatus({});

    expect(res.statusCode).not.toBe(422);
    expect(mockRecordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ blocked: false, overridden: false })
    );
  });

  it('flag OFF → no AI check, no telemetry, transition proceeds', async () => {
    mockGateEnabled.mockResolvedValue(false);
    mockGetReadiness.mockResolvedValue(readyAt(10)); // would block if consulted

    const res = await patchStatus({});

    expect(res.statusCode).not.toBe(422);
    expect(mockGetReadiness).not.toHaveBeenCalled();
    expect(mockRecordEvent).not.toHaveBeenCalled();
  });
});
