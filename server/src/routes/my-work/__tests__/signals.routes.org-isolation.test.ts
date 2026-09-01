import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryAllMock, queryOneMock, queryRunMock } = vi.hoisted(() => ({
  queryAllMock: vi.fn(),
  queryOneMock: vi.fn(),
  queryRunMock: vi.fn(),
}));

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryAll: queryAllMock,
  queryOne: queryOneMock,
  queryRun: queryRunMock,
}));

import signalsRouter from '../signals.routes.js';

const USER_ID = 'user-a';
const ORG_A = 'org-a';
const ORG_B = 'org-b';
const OWN_SIGNAL = '11111111-1111-4111-8111-111111111111';
const FOREIGN_SIGNAL = '22222222-2222-4222-8222-222222222222';

const feedRow = (overrides: Record<string, unknown> = {}) => ({
  signal_id: OWN_SIGNAL,
  organization_id: ORG_A,
  dedupe_key: 'fixture:own',
  domain: 'EXECUTION',
  signal_type: 'task_overdue',
  origin: 'DETERMINISTIC',
  severity: 'warning',
  subject_type: 'task',
  subject_id: 'task-a',
  project_id: null,
  audience_user_id: USER_ID,
  audience_role: null,
  title_key: 'signals.exec.task.overdue.title',
  title_params: {},
  body_key: 'signals.exec.task.overdue.body',
  body_params: {},
  evidence: [
    {
      ref: 'task-a',
      refType: 'task',
      version: null,
      observedValue: 4,
      observedAt: '2026-08-26T00:00:00Z',
    },
  ],
  action: { kind: 'OPEN_TASK', route: '/tasks/task-a', params: {}, permission: 'tasks.read' },
  rule_id: 'exec.task.overdue',
  rule_version: 1,
  provenance: null,
  source_signal_ids: [],
  status: 'OPEN',
  first_observed_at: '2026-08-26T00:00:00Z',
  last_observed_at: '2026-08-26T00:00:00Z',
  resolved_at: null,
  resolved_reason: null,
  expires_at: null,
  run_id: '33333333-3333-4333-8333-333333333333',
  created_at: '2026-08-26T00:00:00Z',
  updated_at: '2026-08-26T00:00:00Z',
  project_name: null,
  run_at: '2026-08-26T00:00:00Z',
  ...overrides,
});

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  Object.assign(req, { userId: USER_ID, organizationId: ORG_A, userRole: 'MEMBER' });
  next();
});
app.use('/my-work', signalsRouter);

beforeEach(() => {
  queryAllMock.mockReset();
  queryOneMock.mockReset();
  queryRunMock.mockReset();
  queryAllMock.mockResolvedValue([]);
  queryOneMock.mockResolvedValue(null);
  queryRunMock.mockResolvedValue({ changes: 0 });
});

describe('GET /my-work/signals — organization isolation', () => {
  it('returns the own-org canonical signal and never a same-user foreign-org signal', async () => {
    queryAllMock.mockImplementation(async (sql: string, params: unknown[]) => {
      if (!sql.includes('FROM work_signals w')) return [];
      expect(params[0]).toBe(ORG_A);
      return [feedRow()];
    });
    const response = await request(app).get('/my-work/signals');
    expect(response.status).toBe(200);
    const keys = response.body.signals.map((signal: { key: string }) => signal.key);
    expect(keys).toContain(OWN_SIGNAL);
    expect(keys).not.toContain(FOREIGN_SIGNAL);
    expect(
      response.body.signals.every((signal: { key: string }) => signal.key !== FOREIGN_SIGNAL)
    ).toBe(true);
  });

  it('preserves the role filter and does not trust a query role', async () => {
    queryAllMock.mockImplementation(async (sql: string, params: unknown[]) => {
      if (!sql.includes('FROM work_signals w')) return [];
      expect(params).toContain('MEMBER');
      expect(params).not.toContain('ADMIN');
      return [];
    });
    const response = await request(app).get('/my-work/signals?role=ADMIN');
    expect(response.status).toBe(200);
    expect(response.body.signals).toEqual([]);
  });
});

describe('POST /my-work/signals/:key mutations — cross-org guard', () => {
  // FIX-6 (day18 layer-1 acceptance): these three tests used to assert only
  // on the 404/200 status with `queryOneMock.mockResolvedValue(null)` (or a
  // fixed sequence), which never inspected what was actually sent to the
  // `ownedSignal` query. A mutation that deleted `organization_id = ?` from
  // that query would still pass every one of them. Each `ownedSignal` call
  // is now asserted to carry `organization_id = ?` in its SQL and ORG_A in
  // its params — proof the org comes from the token, not from the key.
  const expectOwnedSignalScopedToOrgA = (sql: string, params: unknown[]) => {
    expect(sql).toContain('organization_id = ?');
    expect(params).toContain(ORG_A);
  };

  it('snooze on a foreign-org key returns 404 and performs no write', async () => {
    queryOneMock.mockImplementation(async (sql: string, params: unknown[]) => {
      expectOwnedSignalScopedToOrgA(sql, params);
      return null;
    });
    const response = await request(app)
      .post(`/my-work/signals/${FOREIGN_SIGNAL}/snooze`)
      .send({ preset: '1h' });
    expect(response.status).toBe(404);
    expect(queryRunMock).not.toHaveBeenCalled();
    expect(queryOneMock).toHaveBeenCalled();
  });

  it('dismiss on a foreign-org key returns 404 and performs no write', async () => {
    queryOneMock.mockImplementation(async (sql: string, params: unknown[]) => {
      expectOwnedSignalScopedToOrgA(sql, params);
      return null;
    });
    const response = await request(app).post(`/my-work/signals/${FOREIGN_SIGNAL}/dismiss`);
    expect(response.status).toBe(404);
    expect(queryRunMock).not.toHaveBeenCalled();
    expect(queryOneMock).toHaveBeenCalled();
  });

  it('the same mutations succeed for a key proven to belong to the token org', async () => {
    queryOneMock.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM work_signals')) {
        expectOwnedSignalScopedToOrgA(sql, params);
        return { signal_id: OWN_SIGNAL };
      }
      if (sql.includes('my_work_signal_snoozes')) return { snoozed_until: '2026-08-27T00:00:00Z' };
      if (sql.includes('my_work_signal_dismissals'))
        return { dismissed_at: '2026-08-26T00:00:00Z' };
      return null;
    });
    expect(
      (await request(app).post(`/my-work/signals/${OWN_SIGNAL}/snooze`).send({ preset: '1h' }))
        .status
    ).toBe(200);
    expect((await request(app).post(`/my-work/signals/${OWN_SIGNAL}/dismiss`)).status).toBe(200);
    expect(queryRunMock).toHaveBeenCalledTimes(2);
  });

  it('a legacy notification key is handled as not found, never as a server error', async () => {
    const response = await request(app).post('/my-work/signals/notification:legacy/snooze');
    expect(response.status).toBe(404);
    expect(queryRunMock).not.toHaveBeenCalled();
  });
});
