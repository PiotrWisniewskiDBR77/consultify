import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

import rolesRouter from '../../../server/src/routes/security/roles.routes.js';
import policiesRouter from '../../../server/src/routes/securityPolicies.routes.js';
import { getDatabase, resetConnection } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  process.env.TEST_TYPE = 'integration';
  process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const runId = process.env.VITEST_RUN_ID || Date.now().toString(36);
  process.env.SQLITE_PATH = `./test-integration-security-${workerId}-${runId}.db`;
});

describe('Security Roles + Policies Integration (L3)', () => {
  const db = getDatabase();
  const app = express();
  app.use('/api/security/roles', rolesRouter);
  app.use('/api/security-policies', policiesRouter);

  const dispatch = async ({ method, url, body, headers = {}, user }) => {
    const req = new EventEmitter();
    Object.assign(req, {
      method,
      url,
      headers,
      body,
      socket: { remoteAddress: '127.0.0.1' },
    });
    if (user) req.user = user;

    const res = new EventEmitter();
    const chunks = [];
    const response = {
      status: 200,
      headers: {},
      body: undefined,
      text: '',
    };

    Object.assign(res, {
      statusCode: 200,
      setHeader(name, value) {
        response.headers[String(name).toLowerCase()] = value;
      },
      getHeader(name) {
        return response.headers[String(name).toLowerCase()];
      },
      removeHeader(name) {
        delete response.headers[String(name).toLowerCase()];
      },
      writeHead(code, hdrs) {
        res.statusCode = code;
        response.status = code;
        if (hdrs) {
          for (const [k, v] of Object.entries(hdrs)) res.setHeader(k, v);
        }
        return res;
      },
      write(chunk) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        return true;
      },
      end(chunk) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        response.status = res.statusCode || 200;
        response.text = Buffer.concat(chunks).toString('utf8');
        try {
          response.body = response.text ? JSON.parse(response.text) : undefined;
        } catch {
          response.body = undefined;
        }
        res.emit('finish');
        return res;
      },
    });

    return await new Promise((resolve, reject) => {
      res.on('finish', () => resolve(response));
      app.handle(req, res, (err) => {
        if (err) reject(err);
      });
    });
  };

  const dbRun = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, (err) => (err ? reject(err) : resolve()));
    });

  beforeAll(async () => {
    await initializeDatabase();
    if (db.initPromise) await db.initPromise;
  });

  afterAll(async () => {
    await resetConnection();
  });

  it('CRUDs security roles under /api/security/roles', async () => {
    const list0 = await dispatch({ method: 'GET', url: '/api/security/roles' });
    expect(list0.status).toBe(200);
    expect(Array.isArray(list0.body.roles)).toBe(true);

    const createRes = await dispatch({
      method: 'POST',
      url: '/api/security/roles',
      body: { name: 'My Role', permissions: ['project:read'] },
    });
    expect(createRes.status).toBe(200);
    expect(createRes.body.success).toBe(true);
    const roleId = createRes.body.id;
    expect(roleId).toBeTruthy();

    const updateRes = await dispatch({
      method: 'PUT',
      url: `/api/security/roles/${roleId}`,
      body: { name: 'My Role Updated', permissions: ['project:read', 'project:delete'] },
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);

    const list1 = await dispatch({ method: 'GET', url: '/api/security/roles' });
    expect(list1.status).toBe(200);
    expect(list1.body.roles.some((r) => r.id === roleId && r.name === 'My Role Updated')).toBe(
      true
    );

    const delRes = await dispatch({ method: 'DELETE', url: `/api/security/roles/${roleId}` });
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
  });

  it('handles security roles edge cases (defaults, 404, invalid json)', async () => {
    const orgId = `org-${randomUUID()}`;
    const user = { id: `user-${randomUUID()}`, organizationId: orgId };

    // POST defaults when body missing
    const create0 = await dispatch({ method: 'POST', url: '/api/security/roles', user });
    expect(create0.status).toBe(200);
    expect(create0.body.success).toBe(true);
    expect(create0.body.id).toBeTruthy();

    const list1 = await dispatch({ method: 'GET', url: '/api/security/roles', user });
    const created = list1.body.roles.find((r) => r.id === create0.body.id);
    expect(created.name).toBe('Custom Role');
    expect(created.permissions).toEqual([]);

    // PUT updates: name undefined, permissions invalid type -> []
    const putBadPermissions = await dispatch({
      method: 'PUT',
      url: `/api/security/roles/${create0.body.id}`,
      body: { permissions: 'bad' },
      user,
    });
    expect(putBadPermissions.status).toBe(200);
    expect(putBadPermissions.body.success).toBe(true);

    // PUT updates: name changes, permissions omitted (COALESCE keeps existing)
    const putNameOnly = await dispatch({
      method: 'PUT',
      url: `/api/security/roles/${create0.body.id}`,
      body: { name: 123 },
      user,
    });
    expect(putNameOnly.status).toBe(200);
    expect(putNameOnly.body.success).toBe(true);

    const listAfterPuts = await dispatch({ method: 'GET', url: '/api/security/roles', user });
    const updated = listAfterPuts.body.roles.find((r) => r.id === create0.body.id);
    expect(updated.name).toBe('123');
    expect(updated.permissions).toEqual([]);

    // PUT 404 branch
    const missing = await dispatch({
      method: 'PUT',
      url: `/api/security/roles/${randomUUID()}`,
      body: { name: 'x' },
      user,
    });
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe('Role not found');

    // Corrupt permissions_json to hit JSON.parse catch
    const now = new Date().toISOString();
    const badRoleId = `role-${randomUUID()}`;
    await dbRun(
      `
        INSERT INTO security_roles (id, organization_id, name, permissions_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [badRoleId, orgId, 'Bad JSON Role', '{', now, now]
    );

    const nullRoleId = `role-${randomUUID()}`;
    await dbRun(
      `
        INSERT INTO security_roles (id, organization_id, name, permissions_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [nullRoleId, orgId, 'Empty Permissions', '', now, now]
    );

    const list2 = await dispatch({ method: 'GET', url: '/api/security/roles', user });
    const bad = list2.body.roles.find((r) => r.id === badRoleId);
    expect(bad).toBeTruthy();
    expect(bad.permissions).toEqual([]);

    const nul = list2.body.roles.find((r) => r.id === nullRoleId);
    expect(nul).toBeTruthy();
    expect(nul.permissions).toEqual([]);
  });

  it('seeds + updates security policies under /api/security-policies', async () => {
    const listRes = await dispatch({ method: 'GET', url: '/api/security-policies' });
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.policies)).toBe(true);
    expect(listRes.body.policies.length).toBeGreaterThan(0);

    const passwordPolicy = listRes.body.policies.find((p) => p.id === 'password-policy');
    expect(passwordPolicy).toBeTruthy();

    const putRes = await dispatch({
      method: 'PUT',
      url: '/api/security-policies/password-policy',
      body: {
        enabled: false,
        settings: {
          minLength: 16,
          requireUppercase: true,
          requireNumber: true,
          requireSpecial: true,
        },
      },
    });
    expect(putRes.status).toBe(200);
    expect(putRes.body.success).toBe(true);

    const listRes2 = await dispatch({ method: 'GET', url: '/api/security-policies' });
    expect(listRes2.status).toBe(200);
    const updated = listRes2.body.policies.find((p) => p.id === 'password-policy');
    expect(updated.enabled).toBe(false);
    expect(updated.settings.minLength).toBe(16);
  });

  it('handles security policies edge cases (invalid json, enabled fallback, defaults skip)', async () => {
    // 1) ensureDefaults early-return when any row exists
    const orgExisting = `org-${randomUUID()}`;
    const userExisting = { id: `user-${randomUUID()}`, organizationId: orgExisting };
    const now = new Date().toISOString();
    await dbRun(
      `
        INSERT INTO security_policies (id, organization_id, name, category, settings_json, enabled, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      ['custom-policy', orgExisting, 'Custom', 'Custom', '{', 1, now]
    );
    await dbRun(
      `
        INSERT INTO security_policies (id, organization_id, name, category, settings_json, enabled, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      ['empty-settings', orgExisting, 'Empty', 'Custom', '', 1, now]
    );

    const listExisting = await dispatch({
      method: 'GET',
      url: '/api/security-policies',
      user: userExisting,
    });
    expect(listExisting.status).toBe(200);
    expect(listExisting.body.policies.some((p) => p.id === 'password-policy')).toBe(false);
    const custom = listExisting.body.policies.find((p) => p.id === 'custom-policy');
    expect(custom).toBeTruthy();
    expect(custom.settings).toEqual({});
    const empty = listExisting.body.policies.find((p) => p.id === 'empty-settings');
    expect(empty).toBeTruthy();
    expect(empty.settings).toEqual({});

    // 2) enabled fallback branch (non-boolean -> keeps existing)
    const putBadEnabled = await dispatch({
      method: 'PUT',
      url: '/api/security-policies/custom-policy',
      body: { enabled: 'yes' },
      user: userExisting,
    });
    expect(putBadEnabled.status).toBe(200);
    expect(putBadEnabled.body.success).toBe(true);

    const listAfter = await dispatch({
      method: 'GET',
      url: '/api/security-policies',
      user: userExisting,
    });
    const custom2 = listAfter.body.policies.find((p) => p.id === 'custom-policy');
    expect(custom2.enabled).toBe(true);

    // 3) update name/category/settings branches
    const putUpdate = await dispatch({
      method: 'PUT',
      url: '/api/security-policies/custom-policy',
      body: { enabled: false, name: 'Custom2', category: 'Updated', settings: { a: 1 } },
      user: userExisting,
    });
    expect(putUpdate.status).toBe(200);
    expect(putUpdate.body.success).toBe(true);

    const listAfter2 = await dispatch({
      method: 'GET',
      url: '/api/security-policies',
      user: userExisting,
    });
    const custom3 = listAfter2.body.policies.find((p) => p.id === 'custom-policy');
    expect(custom3.enabled).toBe(false);
    expect(custom3.name).toBe('Custom2');
    expect(custom3.category).toBe('Updated');
    expect(custom3.settings).toEqual({ a: 1 });
  });

  it('returns 404 when updating unknown policy', async () => {
    // NOTE: defaults are created on GET; ensure at least one seed happened
    const putRes = await dispatch({
      method: 'PUT',
      url: '/api/security-policies/unknown-policy',
      body: { enabled: false },
    });
    expect(putRes.status).toBe(404);
  });
});
