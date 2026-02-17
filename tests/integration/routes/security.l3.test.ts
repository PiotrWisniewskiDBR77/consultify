import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';

import router from '../../../server/src/routes/security.routes.ts';
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
  process.env.SQLITE_PATH = `./test-l3-${workerId}-${runId}.db`;
});

describe('Security routes integration (L3)', () => {
  const db = getDatabase();
  const app = express();
  app.use(express.json());
  app.use('/api/security', router);
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
      getHeader(name: string) {
        return response.headers[String(name).toLowerCase()];
      },
      writeHead(code: number, hdrs?: Record<string, any>) {
        (res as any).statusCode = code;
        response.status = code;
        if (hdrs) {
          for (const [k, v] of Object.entries(hdrs)) (res as any).setHeader(k, v);
        }
        return res;
      },
      write(chunk: any) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        return true;
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
      send(obj: any) {
        (res as any).end(obj);
      },
      status(code: number) {
        (res as any).statusCode = code;
        response.status = code;
        return res;
      },
      set(name: string, value: any) {
        (res as any).setHeader(name, value);
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

  const dbAll = <T,>(sql: string, params: any[] = []) =>
    new Promise<T[]>((resolve, reject) => {
      db.all(sql, params, (err: any, rows: any[]) => (err ? reject(err) : resolve(rows as T[])));
    });

  const ownerUser = { id: 'u-owner', organizationId: 'org-1', role: 'owner' };
  const adminUser = { id: 'u-admin', organizationId: 'org-1', role: 'administrator' };
  const otherOrgUser = { id: 'u-other', organizationId: 'org-2', role: 'owner' };

  beforeAll(async () => {
    await initializeDatabase();
    if ((db as any).initPromise) await (db as any).initPromise;

    for (const orgId of ['org-1', 'org-2']) {
      await dbRun(
        `INSERT OR IGNORE INTO organizations (id, name, plan, status, is_active) VALUES (?, ?, ?, ?, 1)`,
        [orgId, `Org ${orgId}`, 'enterprise', 'active']
      );
    }

    const users = [
      { id: ownerUser.id, org: 'org-1', email: 'owner@example.com', role: 'OWNER', first: 'Owner' },
      { id: adminUser.id, org: 'org-1', email: 'admin@example.com', role: 'ADMINISTRATOR', first: 'Admin' },
      { id: 'u-member', org: 'org-1', email: 'member@example.com', role: 'TEAM_MEMBER', first: null as any },
      { id: otherOrgUser.id, org: 'org-2', email: 'other@example.com', role: 'OWNER', first: 'Other' },
    ];

    for (const u of users) {
      await dbRun(
        `INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [u.id, u.org, u.email, 'x', u.role, 'active', u.first, u.id === 'u-member' ? null : u.id]
      );
      await dbRun(
        `INSERT OR REPLACE INTO organization_members (id, organization_id, user_id, role, status)
         VALUES (?, ?, ?, ?, 'ACTIVE')`,
        [`om-${u.id}`, u.org, u.id, u.role]
      );
    }
  });

  afterAll(async () => {
    await resetConnection();
  });

  it('GET /settings seeds defaults when missing', async () => {
    await dbRun(`DELETE FROM security_settings WHERE organization_id = ?`, ['org-1']);
    const res = await dispatch({ method: 'GET', url: '/api/security/settings', user: ownerUser });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        organizationId: 'org-1',
        require2fa: false,
        passwordMinLength: 8,
        passwordRequireUppercase: true,
        passwordRequireNumber: true,
        passwordRequireSpecial: false,
        passwordExpiryDays: 0,
        sessionTimeoutMinutes: 30,
        maxSessionsPerUser: 5,
        ipWhitelist: expect.any(Array),
      })
    );
    expect(res.body.ipWhitelist.length).toBeGreaterThan(0);

    await dbRun(`UPDATE security_settings SET ip_whitelist = NULL WHERE organization_id = ?`, ['org-1']);
    const nullWhitelist = await dispatch({
      method: 'GET',
      url: '/api/security/settings',
      user: ownerUser,
    });
    expect(nullWhitelist.status).toBe(200);
    expect(nullWhitelist.body.ipWhitelist).toEqual([]);
  });

  it('PUT /settings upserts and GET returns updated payload', async () => {
    await dbRun(`DELETE FROM security_settings WHERE organization_id = ?`, ['org-1']);
    const putRes = await dispatch({
      method: 'PUT',
      url: '/api/security/settings',
      user: ownerUser,
      body: {
        require2fa: true,
        passwordMinLength: 12,
        passwordRequireUppercase: false,
        passwordRequireNumber: true,
        passwordRequireSpecial: true,
        passwordExpiryDays: 90,
        sessionTimeoutMinutes: 10,
        maxSessionsPerUser: 2,
        ipWhitelist: ['10.0.0.0/8'],
      },
    });
    expect(putRes.status).toBe(200);
    expect(putRes.body).toEqual(expect.objectContaining({ success: true }));

    const getRes = await dispatch({ method: 'GET', url: '/api/security/settings', user: ownerUser });
    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(
      expect.objectContaining({
        require2fa: true,
        passwordMinLength: 12,
        passwordRequireUppercase: false,
        passwordRequireNumber: true,
        passwordRequireSpecial: true,
        passwordExpiryDays: 90,
        sessionTimeoutMinutes: 10,
        maxSessionsPerUser: 2,
        ipWhitelist: ['10.0.0.0/8'],
      })
    );

    const defaultsRes = await dispatch({
      method: 'PUT',
      url: '/api/security/settings',
      user: ownerUser,
    });
    expect(defaultsRes.status).toBe(200);
    expect(defaultsRes.body).toEqual(expect.objectContaining({ success: true }));

    const defaultsGet = await dispatch({ method: 'GET', url: '/api/security/settings', user: ownerUser });
    expect(defaultsGet.status).toBe(200);
    expect(defaultsGet.body).toEqual(
      expect.objectContaining({
        require2fa: false,
        passwordMinLength: 8,
        passwordRequireUppercase: false,
        passwordRequireNumber: false,
        passwordRequireSpecial: false,
        passwordExpiryDays: 0,
        sessionTimeoutMinutes: 30,
        maxSessionsPerUser: 5,
        ipWhitelist: [],
      })
    );
  });

  it('GET /sessions returns only current user sessions', async () => {
    await dbRun(`DELETE FROM user_sessions`);
    await dbRun(
      `INSERT INTO user_sessions (id, user_id, device_info, ip_address, user_agent, location, created_at, is_current)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-1 hour'), 1)`,
      ['s-1', ownerUser.id, 'Mac', '1.1.1.1', 'UA', 'PL']
    );
    await dbRun(
      `INSERT INTO user_sessions (id, user_id, device_info, ip_address, user_agent, location, created_at, is_current)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-2 hour'), 0)`,
      ['s-2', 'u-member', null, null, null, null]
    );

    const res = await dispatch({ method: 'GET', url: '/api/security/sessions', user: ownerUser });
    expect(res.status).toBe(200);
    expect(res.body.sessions.map((s: any) => s.id)).toEqual(['s-1']);
    expect(res.body.sessions[0]).toEqual(
      expect.objectContaining({
        userId: ownerUser.id,
        userEmail: 'owner@example.com',
        deviceInfo: 'Mac',
        ipAddress: '1.1.1.1',
        isCurrent: true,
      })
    );
  });

  it('GET /sessions/all returns org sessions across users', async () => {
    const res = await dispatch({ method: 'GET', url: '/api/security/sessions/all', user: adminUser });
    expect(res.status).toBe(200);
    expect(res.body.sessions.map((s: any) => s.id).sort()).toEqual(['s-1', 's-2'].sort());
    expect(new Set(res.body.sessions.map((s: any) => s.userId))).toEqual(new Set([ownerUser.id, 'u-member']));
  });

  it('DELETE /sessions/:sessionId removes a single session', async () => {
    const delRes = await dispatch({ method: 'DELETE', url: '/api/security/sessions/s-2', user: adminUser });
    expect(delRes.status).toBe(200);
    expect(delRes.body).toEqual(expect.objectContaining({ success: true }));

    const rows = await dbAll<{ id: string }>(`SELECT id FROM user_sessions ORDER BY id`, []);
    expect(rows.map((r) => r.id)).toEqual(['s-1']);
  });

  it('DELETE /sessions/user/:userId removes all sessions for a user', async () => {
    await dbRun(`DELETE FROM user_sessions`);
    await dbRun(
      `INSERT INTO user_sessions (id, user_id, created_at) VALUES (?, ?, datetime('now'))`,
      ['s-3', ownerUser.id]
    );
    await dbRun(
      `INSERT INTO user_sessions (id, user_id, created_at) VALUES (?, ?, datetime('now'))`,
      ['s-4', ownerUser.id]
    );
    await dbRun(
      `INSERT INTO user_sessions (id, user_id, created_at) VALUES (?, ?, datetime('now'))`,
      ['s-keep', 'u-member']
    );

    const delRes = await dispatch({
      method: 'DELETE',
      url: `/api/security/sessions/user/${ownerUser.id}`,
      user: adminUser,
    });
    expect(delRes.status).toBe(200);
    expect(delRes.body).toEqual(expect.objectContaining({ success: true }));

    const rows = await dbAll<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM user_sessions ORDER BY id`,
      []
    );
    expect(rows.map((r) => `${r.id}:${r.user_id}`)).toEqual(['s-keep:u-member']);
  });

  it('GET /login-history respects limit and maps failed status/failureReason', async () => {
    await dbRun(`DELETE FROM login_history WHERE organization_id = ?`, ['org-1']);
    await dbRun(
      `INSERT INTO login_history (id, user_id, organization_id, ip_address, user_agent, location, status, failure_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-10 minutes'))`,
      ['lh-1', ownerUser.id, 'org-1', '1.1.1.1', 'UA', 'PL', 'success', null]
    );
    await dbRun(
      `INSERT INTO login_history (id, user_id, organization_id, ip_address, user_agent, location, status, failure_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-5 minutes'))`,
      ['lh-2', ownerUser.id, 'org-1', '2.2.2.2', 'UA2', 'US', 'failed', 'bad_password']
    );
    await dbRun(
      `INSERT INTO login_history (id, user_id, organization_id, ip_address, user_agent, location, status, failure_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 minutes'))`,
      ['lh-3', adminUser.id, 'org-1', '3.3.3.3', 'UA3', 'DE', 'success', null]
    );
    await dbRun(
      `INSERT INTO login_history (id, user_id, organization_id, ip_address, user_agent, location, status, failure_reason, created_at)
       VALUES (?, ?, ?, NULL, NULL, NULL, ?, NULL, datetime('now', '-30 minutes'))`,
      ['lh-4', 'u-member', 'org-1', 'success']
    );

    const res = await dispatch({
      method: 'GET',
      url: '/api/security/login-history',
      user: adminUser,
      query: { limit: '2' },
    });
    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(2);
    expect(res.body.history[0]).toEqual(
      expect.objectContaining({
        id: 'lh-3',
        status: 'success',
      })
    );
    expect(res.body.history[1]).toEqual(
      expect.objectContaining({
        id: 'lh-2',
        status: 'failed',
        failureReason: 'bad_password',
      })
    );

    const defaultLimit = await dispatch({
      method: 'GET',
      url: '/api/security/login-history',
      user: adminUser,
    });
    expect(defaultLimit.status).toBe(200);
    const legacy = defaultLimit.body.history.find((h: any) => h.id === 'lh-4');
    expect(legacy).toEqual(
      expect.objectContaining({
        userName: '',
        ipAddress: 'unknown',
        userAgent: 'unknown',
        location: 'unknown',
      })
    );
  });

  it('GET /2fa/org-status returns summary counts + percentage', async () => {
    await dbRun(`DELETE FROM user_2fa`);
    await dbRun(`INSERT OR REPLACE INTO user_2fa (user_id, is_enabled, enabled_at) VALUES (?, 1, datetime('now'))`, [
      ownerUser.id,
    ]);
    await dbRun(`INSERT OR REPLACE INTO user_2fa (user_id, is_enabled, enabled_at) VALUES (?, 0, NULL)`, [
      adminUser.id,
    ]);

    const res = await dispatch({ method: 'GET', url: '/api/security/2fa/org-status', user: ownerUser });
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual(
      expect.objectContaining({
        total: 3,
        enabled: 1,
        disabled: 2,
        percentage: 33,
      })
    );
    expect(res.body.users.find((u: any) => u.id === ownerUser.id)).toEqual(
      expect.objectContaining({ has2fa: true })
    );

    const emptyOrg = await dispatch({
      method: 'GET',
      url: '/api/security/2fa/org-status',
      user: { id: 'u-empty', organizationId: 'org-empty', role: 'owner' },
    });
    expect(emptyOrg.status).toBe(200);
    expect(emptyOrg.body.summary).toEqual(
      expect.objectContaining({ total: 0, enabled: 0, disabled: 0, percentage: 0 })
    );
  });

  it('GET /audit-logs returns logs + stats derived from activity_logs', async () => {
    await dbRun(`DELETE FROM activity_logs`);
    await dbRun(
      `INSERT INTO activity_logs (id, organization_id, user_id, action, entity_type, entity_id, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 minutes'))`,
      ['al-1', 'org-1', ownerUser.id, 'UPDATE', 'security_settings', 'org-1', '1.1.1.1']
    );
    await dbRun(
      `INSERT INTO activity_logs (id, organization_id, user_id, action, entity_type, entity_id, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 minutes'))`,
      ['al-2', 'org-1', null, 'SYSTEM', '', 'cleanup', null]
    );

    const res = await dispatch({ method: 'GET', url: '/api/security/audit-logs', user: adminUser });
    expect(res.status).toBe(200);
    expect(res.body.logs).toHaveLength(2);
    expect(res.body.stats).toEqual(
      expect.objectContaining({ total: 2, high: 0, medium: 0, low: 2, unresolved: 0 })
    );
    expect(res.body.logs[0]).toEqual(
      expect.objectContaining({
        id: 'al-1',
        action: 'UPDATE',
        resource: 'security_settings',
        ip_address: '1.1.1.1',
      })
    );
  });

  it('GET /api-keys/usage aggregates api_logs by api_key_id', async () => {
    await dbRun(`DELETE FROM api_logs`);
    await dbRun(`INSERT INTO api_logs (id, api_key_id, tokens_used, cost, created_at) VALUES (?, ?, ?, ?, datetime('now'))`, [
      'log-1',
      'k-1',
      100,
      0.2,
    ]);
    await dbRun(`INSERT INTO api_logs (id, api_key_id, tokens_used, cost, created_at) VALUES (?, ?, ?, ?, datetime('now'))`, [
      'log-2',
      'k-1',
      300,
      0.7,
    ]);
    await dbRun(`INSERT INTO api_logs (id, api_key_id, tokens_used, cost, created_at) VALUES (?, ?, ?, ?, datetime('now'))`, [
      'log-3',
      'k-2',
      50,
      0.1,
    ]);

    const res = await dispatch({ method: 'GET', url: '/api/security/api-keys/usage', user: ownerUser });
    expect(res.status).toBe(200);
    expect(res.body.usage).toEqual(expect.any(Array));
    const k1 = res.body.usage.find((u: any) => u.api_key_id === 'k-1');
    expect(k1).toBeTruthy();
    expect(Number(k1.total_calls)).toBe(2);
    expect(Number(k1.tokens)).toBe(400);
    expect(Number(k1.cost)).toBeCloseTo(0.9, 6);
  });

  it('GET /workflows returns sample workflows', async () => {
    const res = await dispatch({ method: 'GET', url: '/api/security/workflows', user: ownerUser });
    expect(res.status).toBe(200);
    expect(res.body.workflows).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'wf-1', resourceType: 'api_key' })])
    );

    const reqRes = await dispatch({
      method: 'GET',
      url: '/api/security/workflows/requests',
      user: ownerUser,
    });
    expect(reqRes.status).toBe(200);
    expect(reqRes.body.requests).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'req-1', status: 'pending' })])
    );
  });

  it('GET /permissions/definitions returns stable permission catalog', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/security/permissions/definitions',
      user: otherOrgUser,
    });
    expect(res.status).toBe(200);
    expect(res.body.permissions).toEqual(expect.any(Array));
    expect(res.body.permissions.map((p: any) => p.id)).toContain('admin:billing');

    const incidents = await dispatch({ method: 'GET', url: '/api/security/incidents', user: otherOrgUser });
    expect(incidents.status).toBe(200);
    expect(incidents.body.incidents[0]).toEqual(expect.objectContaining({ id: 'inc-1' }));

    const threats = await dispatch({ method: 'GET', url: '/api/security/threats', user: otherOrgUser });
    expect(threats.status).toBe(200);
    expect(threats.body.threats[0]).toEqual(expect.objectContaining({ id: 'thr-1', severity: 'high' }));

    const dlp = await dispatch({ method: 'GET', url: '/api/security/dlp', user: otherOrgUser });
    expect(dlp.status).toBe(200);
    expect(dlp.body.alerts[0]).toEqual(expect.objectContaining({ id: 'dlp-1', status: 'open' }));

    const aiBudgets = await dispatch({ method: 'GET', url: '/api/security/ai-budgets', user: otherOrgUser });
    expect(aiBudgets.status).toBe(200);
    expect(aiBudgets.body).toEqual(
      expect.objectContaining({ overview: expect.any(Object), budgets: expect.any(Array), pricing: expect.any(Array) })
    );
  });
});
