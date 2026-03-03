import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';

import router from '../../../server/src/routes/results-kpi-reports.routes.ts';
import { getDatabase, resetConnection } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  process.env.TEST_TYPE = 'integration';
  process.env.NODE_ENV = 'test';
  process.env.MOCK_REDIS = 'true';
  process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

  const workerId = process.env.VITEST_WORKER_ID || '0';
  const runId = process.env.VITEST_RUN_ID || Date.now().toString(36);
  process.env.SQLITE_PATH = `./test-results-kpi-reports-l3-${workerId}-${runId}.db`;
});

const RUN_DB_TESTS = process.env.RUN_DB_TESTS === '1';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('Results KPI reports routes (L3)', () => {
  const db = getDatabase();
  const app = express();
  app.use(express.json());
  app.use('/api/results', router);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  });

  const dispatch = async ({
    method,
    url,
    body,
    headers = {},
    user,
    query,
  }: {
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
    user?: any;
    query?: Record<string, any>;
  }) => {
    const req = new EventEmitter();
    Object.assign(req, {
      method,
      url,
      headers,
      body,
      cookies: {},
      path: url,
      query: query || {},
      socket: { remoteAddress: '127.0.0.1' },
    });
    if (user) (req as any).user = user;

    const res = new EventEmitter();
    const chunks: Buffer[] = [];
    const response = {
      status: 200,
      headers: {} as Record<string, string>,
      body: undefined as any,
      text: '',
    };

    Object.assign(res, {
      statusCode: 200,
      setHeader(name: string, value: any) {
        response.headers[String(name).toLowerCase()] = String(value);
      },
      writeHead(code: number, hdrs?: Record<string, any>) {
        (res as any).statusCode = code;
        response.status = code;
        if (hdrs) {
          for (const [k, v] of Object.entries(hdrs)) (res as any).setHeader(k, v);
        }
        return res;
      },
      end(chunk: any) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        response.status = (res as any).statusCode || 200;
        response.text = Buffer.concat(chunks).toString('utf8');
        try {
          response.body = response.text ? JSON.parse(response.text) : undefined;
        } catch {
          response.body = undefined;
        }
        res.emit('finish');
        return res;
      },
      json(obj: any) {
        (res as any).setHeader('content-type', 'application/json');
        (res as any).end(JSON.stringify(obj));
      },
      status(code: number) {
        (res as any).statusCode = code;
        response.status = code;
        return res;
      },
    });

    return await new Promise<typeof response>((resolve, reject) => {
      res.on('finish', () => resolve(response));
      app.handle(req as any, res as any, (err: any) => {
        if (err) reject(err);
      });
    });
  };

  const dbRun = (sql: string, params: any[] = []) =>
    new Promise<void>((resolve, reject) => {
      db.run(sql, params, (err: any) => (err ? reject(err) : resolve()));
    });

  const dbGet = <T,>(sql: string, params: any[] = []) =>
    new Promise<T | null>((resolve, reject) => {
      db.get(sql, params, (err: any, row: any) => (err ? reject(err) : resolve((row as T) || null)));
    });

  beforeAll(async () => {
    await initializeDatabase();
    if ((db as any).initPromise) await (db as any).initPromise;

    await dbRun(
      `INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
      ['test-org-id', 'Test Org', 'enterprise', 'active']
    );
    await dbRun(
      `INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['test-user-id', 'test-org-id', 'test@example.com', 'x', 'ADMIN', 'active', 'Test', 'User']
    );

    // Minimal KPI seed (global KPI)
    await dbRun(
      `INSERT OR IGNORE INTO initiative_kpis (
        id, initiative_id, organization_id, name, unit, target_value, measurement_frequency,
        direction, threshold_mode, amber_threshold_pct, red_threshold_pct, owner_user_id,
        created_at, updated_at
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        'kpi-1',
        'test-org-id',
        'OEE',
        '%',
        85,
        'MONTHLY',
        'HIGHER_IS_BETTER',
        'PERCENT_FROM_TARGET',
        0.1,
        0.2,
        'test-user-id',
      ]
    );

    await dbRun(
      `INSERT OR IGNORE INTO kpi_deviation_cases (
        kpi_id, organization_id, period_start, period_end, severity, status, owner_user_id, deviation_summary,
        detected_by, detected_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'system', datetime('now'), datetime('now'), datetime('now'))`,
      [
        'kpi-1',
        'test-org-id',
        '2026-02-01',
        '2026-02-28',
        'RED',
        'OPEN',
        'test-user-id',
        'RED: value 80 deviates from target 85',
      ]
    );

    const caseRow = await dbGet<{ id: string }>(
      `SELECT id FROM kpi_deviation_cases WHERE organization_id = ? AND kpi_id = ? LIMIT 1`,
      ['test-org-id', 'kpi-1']
    );
    const caseId = caseRow?.id;
    if (caseId) {
      await dbRun(
        `INSERT OR IGNORE INTO kpi_deviation_actions (id, case_id, title, owner_user_id, due_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'OPEN', datetime('now'), datetime('now'))`,
        ['act-1', caseId, 'Fix downtime root cause', 'test-user-id', '2026-03-05']
      );
    }
  });

  afterAll(async () => {
    await resetConnection();
  });

  it('POST creates snapshot + report builder report', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/results/kpi-reports',
      body: { periodStart: '2026-02-01', periodEnd: '2026-02-28', title: 'Monthly KPI Review' },
    });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.snapshotId).toBeTruthy();
    expect(res.body?.data?.reportId).toBeTruthy();

    const snap = await dbGet<any>(
      `SELECT id, snapshot_json FROM results_kpi_report_snapshots WHERE id = ? AND organization_id = ?`,
      [res.body.data.snapshotId, 'test-org-id']
    );
    expect(snap?.id).toBe(res.body.data.snapshotId);

    const rpt = await dbGet<any>(
      `SELECT id, source_type, source_id FROM report_builder_reports WHERE id = ?`,
      [res.body.data.reportId]
    );
    expect(rpt?.source_type).toBe('RESULTS_KPI_REPORT');
    expect(rpt?.source_id).toBe(res.body.data.snapshotId);
  });

  it('GET list returns created report', async () => {
    const res = await dispatch({ method: 'GET', url: '/api/results/kpi-reports' });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(Array.isArray(res.body?.data)).toBe(true);
  });

  it('GET snapshot returns action plan', async () => {
    const list = await dispatch({ method: 'GET', url: '/api/results/kpi-reports' });
    const snapId = list.body?.data?.[0]?.snapshotId;
    expect(snapId).toBeTruthy();

    const res = await dispatch({ method: 'GET', url: `/api/results/kpi-reports/${snapId}` });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.snapshot?.actionPlan?.length).toBeGreaterThan(0);
  });
});

