/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

type EvidenceRoute = { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; registeredPath: string };
const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';

describe('Day 55 B.2 — write-surface membership, tenant and self matrix', NO_RETRY, () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const readbackPool = new Pool({ connectionString: databaseUrl, max: 1 });
  const orgA = randomUUID();
  const orgB = randomUUID();
  const actor = randomUUID();
  const victim = randomUUID();
  const foreign = randomUUID();
  const revoked = randomUUID();
  const app = express();
  let actorToken = '';
  let revokedToken = '';
  let routes: EvidenceRoute[] = [];

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    const [{ ApiGateway }, { default: config }] = await Promise.all([
      import('../../../server/src/Gateway.js'),
      import('../../../server/src/config/Config.js'),
    ]);
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    await pool.query(
      `INSERT INTO organizations(id,name,status) VALUES($1,$1,'active'),($2,$2,'active')`,
      [orgA, orgB]
    );
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status)
       VALUES($1,$2,$3,'unused','MEMBER','active'),($4,$2,$5,'unused','MEMBER','active'),
             ($6,$7,$8,'unused','MEMBER','active'),($9,$2,$10,'unused','ADMIN','active')`,
      [
        actor,
        orgA,
        `${actor}@test.invalid`,
        victim,
        `${victim}@test.invalid`,
        foreign,
        orgB,
        `${foreign}@test.invalid`,
        revoked,
        `${revoked}@test.invalid`,
      ]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'MEMBER','ACTIVE'),($4,$2,$5,'MEMBER','ACTIVE'),
             ($6,$7,$8,'MEMBER','ACTIVE'),($9,$2,$10,'ADMIN','REVOKED')`,
      [
        randomUUID(),
        orgA,
        actor,
        randomUUID(),
        victim,
        randomUUID(),
        orgB,
        foreign,
        randomUUID(),
        revoked,
      ]
    );
    const sign = (userId: string, organizationId: string, role: string) =>
      jwt.sign(
        { id: userId, userId, organizationId, organization_id: organizationId, role },
        config.JWT_SECRET,
        { expiresIn: '10m', jwtid: randomUUID() }
      );
    actorToken = sign(actor, orgA, 'MEMBER');
    revokedToken = sign(revoked, orgA, 'ADMIN');
    const evidence = JSON.parse(
      readFileSync(
        'docs/program/waves/WAVE_03_ACCEPTANCE/SETTINGS_DAY55_B1_ROUTE_EVIDENCE.json',
        'utf8'
      )
    ) as { rows: Array<Record<string, unknown>> };
    routes = evidence.rows.filter(
      (row): row is EvidenceRoute =>
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(row.method)) &&
        row.registeredPath !== '/api/auth/change-password' &&
        !String(row.registeredPath).startsWith('/api/notifications/settings')
    );
  }, 60_000);

  afterAll(async () => {
    for (const table of [
      'gdpr_requests',
      'settings_audit_log',
      'developer_settings',
      'user_webhooks',
      'user_api_keys',
      'settings_templates',
      'email_signatures',
      'user_preferences',
      'integration_oauth_tokens',
      'notification_settings',
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE user_id=ANY($1::text[])`, [
        [actor, victim, foreign, revoked],
      ]);
    }
    await pool.query(`DELETE FROM organization_members WHERE organization_id=ANY($1::text[])`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM users WHERE id=ANY($1::text[])`, [
      [actor, victim, foreign, revoked],
    ]);
    await pool.query(`DELETE FROM organizations WHERE id=ANY($1::text[])`, [[orgA, orgB]]);
    await pool.end();
    await readbackPool.end();
    const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  const concrete = (registeredPath: string) =>
    registeredPath
      .replace(/:userId\b/g, victim)
      .replace(/:id\b/g, randomUUID())
      .replace(/:[A-Za-z][A-Za-z0-9_]*/g, 'day55-boundary');
  const send = (route: EvidenceRoute, token: string, orgHeader: string, body: object) => {
    const verb = route.method.toLowerCase() as 'post' | 'put' | 'patch' | 'delete';
    return request(app)
      [verb](concrete(route.registeredPath))
      .query({ userId: victim, orgId: orgHeader })
      .set('Authorization', `Bearer ${token}`)
      .set('x-org-context', orgHeader)
      .send(body);
  };
  const protectedSnapshot = async () => {
    const tables = [
      'user_preferences',
      'gdpr_requests',
      'email_signatures',
      'settings_templates',
      'settings_audit_log',
      'user_api_keys',
      'user_webhooks',
      'developer_settings',
      'integration_oauth_tokens',
    ];
    const snapshot: Record<string, string[]> = {};
    for (const table of tables) {
      snapshot[table] = (
        await pool.query(
          `SELECT row_to_json(t)::text AS row FROM ${table} t WHERE user_id=ANY($1::text[]) ORDER BY 1`,
          [[victim, foreign]]
        )
      ).rows.map((row) => String(row.row));
    }
    snapshot.users = (
      await pool.query(
        `SELECT row_to_json(t)::text AS row FROM users t WHERE id=ANY($1::text[]) ORDER BY id`,
        [[victim, foreign]]
      )
    ).rows.map((row) => String(row.row));
    return snapshot;
  };

  it('denies a REVOKED ADMIN on the delegated organization notification write', async () => {
    expect(routes.length).toBe(80);
    const response = await request(app)
      .post('/api/settings/notifications')
      .set('Authorization', `Bearer ${revokedToken}`)
      .set('x-org-context', orgA)
      .send({ userId: victim, preferences: { email: false } });
    expect(response.status).toBe(403);
    expect(response.body?.code).toBe('ORG_MEMBERSHIP_REVOKED');
  }, 60_000);

  it('rejects a foreign organization header with an exact code on every /api/settings write', async () => {
    const before = await protectedSnapshot();
    for (const route of routes.filter(({ registeredPath }) =>
      registeredPath.startsWith('/api/settings')
    )) {
      const response = await send(route, actorToken, orgB, {
        userId: victim,
        organizationId: orgB,
      });
      expect(response.status, `${route.method} ${route.registeredPath}`).toBe(403);
      expect(response.body?.code, `${route.method} ${route.registeredPath}`).toBe(
        'ORG_CONTEXT_MISMATCH'
      );
    }
    expect(await protectedSnapshot()).toEqual(before);
  }, 60_000);

  it('rejects cross-user claims with an exact code on every non-delegated /api/settings write', async () => {
    const before = await protectedSnapshot();
    for (const route of routes.filter(
      ({ registeredPath }) =>
        registeredPath.startsWith('/api/settings') &&
        registeredPath !== '/api/settings/notifications'
    )) {
      const response = await send(route, actorToken, orgA, {
        userId: victim,
        organizationId: orgA,
      });
      expect(response.status, `${route.method} ${route.registeredPath}`).toBe(403);
      expect(response.body?.code, `${route.method} ${route.registeredPath}`).toBe(
        'SETTINGS_SELF_SCOPE_FORBIDDEN'
      );
      expect(await protectedSnapshot(), `${route.method} ${route.registeredPath}`).toEqual(before);
    }
  }, 120_000);

  it('allows only the durable same-tenant delegated notification exception', async () => {
    await pool.query(
      `UPDATE organization_members SET role='OWNER' WHERE organization_id=$1 AND user_id=$2`,
      [orgA, actor]
    );
    try {
      const sameTenant = await request(app)
        .post('/api/settings/notifications')
        .set('Authorization', `Bearer ${actorToken}`)
        .set('x-org-context', orgA)
        .send({ userId: victim, preferences: { email: false } });
      expect(sameTenant.status, JSON.stringify(sameTenant.body)).toBe(200);
      expect(
        Number(
          (
            await pool.query(
              `SELECT count(*)::int AS n FROM user_preferences WHERE user_id=$1 AND key='settings:notifications-channel-admin'`,
              [victim]
            )
          ).rows[0]?.n ?? 0
        )
      ).toBe(1);

      const foreignBefore = await protectedSnapshot();
      const foreignTenant = await request(app)
        .post('/api/settings/notifications')
        .set('Authorization', `Bearer ${actorToken}`)
        .set('x-org-context', orgB)
        .send({ userId: foreign, preferences: { email: false } });
      expect(foreignTenant.status).toBe(403);
      expect(await protectedSnapshot()).toEqual(foreignBefore);
    } finally {
      await pool.query(
        `DELETE FROM user_preferences WHERE user_id=$1 AND key='settings:notifications-channel-admin'`,
        [victim]
      );
      await pool.query(
        `UPDATE organization_members SET role='MEMBER' WHERE organization_id=$1 AND user_id=$2`,
        [orgA, actor]
      );
    }
  });

  it('keeps all 12 personal writes outside /api/settings bound to the authenticated actor', async () => {
    const personalWritesOutsideSettings = routes.filter(
      ({ registeredPath }) => !registeredPath.startsWith('/api/settings')
    );
    expect(personalWritesOutsideSettings.map(({ registeredPath }) => registeredPath)).toEqual([
      '/api/preferences/',
      '/api/preferences/ui',
      '/api/gdpr/consents',
      '/api/gdpr/retention',
      '/api/gdpr/export-request',
      '/api/gdpr/deletion-request',
      '/api/gdpr/cancel-deletion',
      '/api/auth/login-history/',
      '/api/user/contact-information/',
      '/api/user/availability/',
      '/api/user/security/sessions/:sessionId',
      '/api/user/security/trusted-devices/:deviceId',
    ]);
    const expectedStatus = new Map<string, number>([
      ['PUT /api/preferences/', 200],
      ['PUT /api/preferences/ui', 200],
      ['PUT /api/gdpr/consents', 400],
      ['PUT /api/gdpr/retention', 400],
      ['POST /api/gdpr/export-request', 200],
      ['POST /api/gdpr/deletion-request', 400],
      ['POST /api/gdpr/cancel-deletion', 400],
      ['POST /api/auth/login-history/', 200],
      ['PUT /api/user/contact-information/', 200],
      ['PUT /api/user/availability/', 200],
      ['DELETE /api/user/security/sessions/:sessionId', 200],
      ['DELETE /api/user/security/trusted-devices/:deviceId', 200],
    ]);
    for (const route of personalWritesOutsideSettings) {
      const victimBefore = await protectedSnapshot();
      const response = await send(route, actorToken, orgA, {
        userId: victim,
        organizationId: orgB,
        key: 'day55-boundary',
        value: true,
      });
      const routeName = `${route.method} ${route.registeredPath}`;
      expect(response.status, routeName).toBe(expectedStatus.get(routeName));
      expect(await protectedSnapshot(), `${route.method} ${route.registeredPath}`).toEqual(victimBefore);
    }
  }, 120_000);

  const notificationWrites = [
    { method: 'put', path: '/api/notification-settings', body: { email: { enabled: false } } },
    { method: 'patch', path: '/api/notification-settings/email', body: { digest: 'weekly' } },
    { method: 'post', path: '/api/notification-settings/reset', body: {} },
    { method: 'post', path: '/api/notification-settings/test/email', body: {} },
  ] as const;

  it('notificationSettings allows own writes without membership but rejects foreign tenant context', async () => {
    for (const route of notificationWrites) {
      const revokedResponse = await request(app)
        [route.method](route.path)
        .set('Authorization', `Bearer ${revokedToken}`)
        .set('x-org-context', orgA)
        .send(route.body);
      expect(revokedResponse.status, `${route.method.toUpperCase()} ${route.path} own`).toBe(200);

      const before = await readbackPool.query(
        `SELECT settings, updated_at::text AS updated_at FROM notification_settings WHERE user_id=$1`,
        [actor]
      );
      const foreignResponse = await request(app)
        [route.method](route.path)
        .set('Authorization', `Bearer ${actorToken}`)
        .set('x-org-context', orgB)
        .send(route.body);
      expect(
        foreignResponse.status,
        `${route.method.toUpperCase()} ${route.path} foreign tenant`
      ).toBe(403);
      expect(foreignResponse.body?.code).toBe('ORG_CONTEXT_MISMATCH');
      const after = await readbackPool.query(
        `SELECT settings, updated_at::text AS updated_at FROM notification_settings WHERE user_id=$1`,
        [actor]
      );
      expect(after.rows).toEqual(before.rows);
    }
  });

  it('notificationSettings executes all four writes through Gateway with independent SQL readback', async () => {
    const sendOwn = (method: 'put' | 'patch' | 'post', path: string, body: object) =>
      request(app)
        [method](path)
        .set('Authorization', `Bearer ${actorToken}`)
        .set('x-org-context', orgA)
        .send(body);

    const putResponse = await sendOwn('put', '/api/notification-settings', {
      email: { enabled: false, digest: 'daily' },
    });
    expect(putResponse.status, JSON.stringify(putResponse.body)).toBe(200);
    const afterPut = await readbackPool.query(
      `SELECT settings FROM notification_settings WHERE user_id=$1`,
      [actor]
    );
    expect(JSON.parse(String(afterPut.rows[0]?.settings))).toEqual({
      email: { enabled: false, digest: 'daily' },
    });

    const patchResponse = await sendOwn('patch', '/api/notification-settings/email', {
      enabled: true,
      digest: 'weekly',
    });
    expect(patchResponse.status, JSON.stringify(patchResponse.body)).toBe(200);
    const afterPatch = await readbackPool.query(
      `SELECT settings, updated_at::text AS updated_at FROM notification_settings WHERE user_id=$1`,
      [actor]
    );
    expect(JSON.parse(String(afterPatch.rows[0]?.settings)).email).toEqual({
      enabled: true,
      digest: 'weekly',
    });

    const beforeTest = afterPatch.rows;
    const testResponse = await sendOwn('post', '/api/notification-settings/test/email', {});
    expect(testResponse.status, JSON.stringify(testResponse.body)).toBe(200);
    const afterTest = await readbackPool.query(
      `SELECT settings, updated_at::text AS updated_at FROM notification_settings WHERE user_id=$1`,
      [actor]
    );
    expect(afterTest.rows).toEqual(beforeTest);

    const resetResponse = await sendOwn('post', '/api/notification-settings/reset', {});
    expect(resetResponse.status, JSON.stringify(resetResponse.body)).toBe(200);
    const afterReset = await readbackPool.query(
      `SELECT count(*)::int AS count FROM notification_settings WHERE user_id=$1`,
      [actor]
    );
    expect(afterReset.rows[0]?.count).toBe(0);
  });
});
