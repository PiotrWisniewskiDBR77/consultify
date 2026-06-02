/**
 * SuperAdmin Audit Logs Controller — hardened contract tests
 *
 * These tests inject a stub `db` into the SuperAdmin controller's shared deps
 * to verify the controller never throws 5xx for the previously known failure
 * modes (malformed metadata_json, NaN params, missing table).
 */

import type { NextFunction, Request, Response } from 'express';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import SuperAdminController from '@/../server/src/controllers/SuperAdminController';
import { setDependencies } from '@/../server/src/controllers/superadmin/shared';

type StubRow = Record<string, unknown>;

interface StubDb {
  all: (sql: string, params: any[]) => Promise<StubRow[]> | StubRow[];
  get: (sql: string, params?: any[]) => Promise<StubRow | null> | StubRow | null;
  run?: (...args: any[]) => any;
  exec?: (...args: any[]) => any;
}

function buildRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnThis();
  const setHeader = vi.fn();
  const send = vi.fn();
  const res = { json, status, setHeader, send } as unknown as Response;
  return { res, json, status };
}

const buildReq = (query: Record<string, any> = {}): Request =>
  ({ query, headers: {}, get: () => undefined } as unknown as Request);

const next: NextFunction = (() => {}) as any;

describe('SuperAdminController.getAdminAuditLogs', () => {
  let originalDb: any;

  beforeAll(() => {
    originalDb = (SuperAdminController as any).deps?.db;
  });

  afterAll(() => {
    if (originalDb !== undefined) setDependencies({ db: originalDb });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the wrapped { logs, pagination, integrity } shape on the happy path', async () => {
    const db: StubDb = {
      all: async () => [
        {
          id: 'log-1',
          admin_id: 'admin-1',
          action_type: 'login',
          resource_type: 'session',
          resource_id: 'session-1',
          ip_address: '127.0.0.1',
          risk_score: 5,
          status: 'logged',
          metadata_json: JSON.stringify({ source: 'qa' }),
          created_at: '2026-04-26T00:00:00.000Z',
          admin_email: 'qa-admin@qa.consultify.local',
          first_name: 'QA',
          last_name: 'Admin',
        },
      ],
      get: async () => null,
    };
    setDependencies({ db: db as any });
    const { res, json } = buildRes();

    await SuperAdminController.getAdminAuditLogs(buildReq({ limit: 50 }), res, next);

    expect(json).toHaveBeenCalledTimes(1);
    const payload = json.mock.calls[0][0] as any;
    expect(Array.isArray(payload.logs)).toBe(true);
    expect(payload.logs[0].metadata_json).toEqual({ source: 'qa' });
    expect(payload.logs[0].metadataJson).toEqual({ source: 'qa' });
    expect(payload.logs[0].admin).toEqual({
      id: 'admin-1',
      email: 'qa-admin@qa.consultify.local',
      firstName: 'QA',
      lastName: 'Admin',
    });
    expect(payload.pagination).toEqual({
      limit: 50,
      offset: 0,
      count: 1,
      hasMore: false,
    });
    expect(payload.integrity.degraded).toBe(false);
    expect(payload.integrity.malformedMetadataCount).toBe(0);
  });

  it('does not throw when metadata_json is malformed; reports the count instead', async () => {
    const db: StubDb = {
      all: async () => [
        {
          id: 'log-2',
          admin_id: 'admin-2',
          action_type: 'export',
          resource_type: 'organization',
          metadata_json: '{not-json',
          created_at: '2026-04-26T00:00:00.000Z',
          admin_email: 'qa@qa.local',
          first_name: 'QA',
          last_name: 'Owner',
          risk_score: 80,
          status: 'logged',
        },
        {
          id: 'log-3',
          admin_id: 'admin-2',
          action_type: 'login',
          metadata_json: null,
          created_at: '2026-04-26T00:00:00.000Z',
        },
      ],
      get: async () => null,
    };
    setDependencies({ db: db as any });
    const { res, json } = buildRes();

    await SuperAdminController.getAdminAuditLogs(buildReq(), res, next);

    const payload = json.mock.calls[0][0] as any;
    expect(payload.logs).toHaveLength(2);
    expect(payload.logs[0].metadata_json).toMatchObject({ _parseError: true });
    expect(payload.logs[1].metadata_json).toEqual({});
    expect(payload.integrity.malformedMetadataCount).toBe(1);
    expect(payload.integrity.degraded).toBe(false);
  });

  it('clamps NaN/garbage limit and offset and rejects unknown status filter', async () => {
    const seenParams: any[][] = [];
    const db: StubDb = {
      all: async (_sql: string, params: any[]) => {
        seenParams.push(params);
        return [];
      },
      get: async () => null,
    };
    setDependencies({ db: db as any });
    const { res, json } = buildRes();

    await SuperAdminController.getAdminAuditLogs(
      buildReq({
        limit: 'NaN',
        offset: '-50',
        riskScoreMin: '999',
        status: 'pwned',
      }),
      res,
      next
    );

    const payload = json.mock.calls[0][0] as any;
    expect(payload.pagination.limit).toBe(100);
    expect(payload.pagination.offset).toBe(0);
    const lastParams = seenParams[seenParams.length - 1];
    expect(lastParams).not.toContain(NaN);
    expect(lastParams).not.toContain('pwned');
    expect(lastParams).toContain(100);
    expect(lastParams).toContain(0);
    expect(lastParams).toContain(100);
  });

  it('returns degraded payload when the audit table is missing instead of throwing 500', async () => {
    const db: StubDb = {
      all: async () => {
        throw new Error('SQLITE_ERROR: no such table: admin_audit_logs');
      },
      get: async () => null,
    };
    setDependencies({ db: db as any });
    const { res, json } = buildRes();

    await SuperAdminController.getAdminAuditLogs(buildReq(), res, next);

    const payload = json.mock.calls[0][0] as any;
    expect(payload.logs).toEqual([]);
    expect(payload.integrity.degraded).toBe(true);
    expect(payload.integrity.reason).toMatch(/not provisioned|query failed/i);
  });
});

describe('SuperAdminController.getAdminAuditStats', () => {
  let originalDb: any;

  beforeAll(() => {
    originalDb = (SuperAdminController as any).deps?.db;
  });

  afterAll(() => {
    if (originalDb !== undefined) setDependencies({ db: originalDb });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('coerces nullable numeric stats and counts unresolved as logged|escalated', async () => {
    let capturedSql = '';
    const db: StubDb = {
      all: async () => [],
      get: async (sql: string) => {
        capturedSql = sql;
        return {
          total_logs: '12',
          unresolved_count: 3,
          high_risk_count: null,
          medium_risk_count: '2',
          low_risk_count: 7,
          avg_risk_score: '34.5',
        };
      },
    };
    setDependencies({ db: db as any });
    const { res, json } = buildRes();

    await SuperAdminController.getAdminAuditStats(buildReq(), res, next);

    const payload = json.mock.calls[0][0] as any;
    expect(payload).toMatchObject({
      total_logs: 12,
      unresolved_count: 3,
      high_risk_count: 0,
      medium_risk_count: 2,
      low_risk_count: 7,
      avg_risk_score: 34.5,
      degraded: false,
    });
    expect(capturedSql).toMatch(/IN \('logged', 'escalated'\)/);
    expect(capturedSql).not.toMatch(/'unresolved'/);
  });

  it('returns degraded zero stats when DB throws missing-table error', async () => {
    const db: StubDb = {
      all: async () => [],
      get: async () => {
        throw new Error('relation "admin_audit_logs" does not exist');
      },
    };
    setDependencies({ db: db as any });
    const { res, json } = buildRes();

    await SuperAdminController.getAdminAuditStats(buildReq(), res, next);

    const payload = json.mock.calls[0][0] as any;
    expect(payload.total_logs).toBe(0);
    expect(payload.degraded).toBe(true);
    expect(payload.reason).toMatch(/not provisioned/i);
  });
});
