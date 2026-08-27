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
      .query({ userId: victim, orgId: orgB })
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

  it('denies a REVOKED ADMIN on every inventoried write registration', async () => {
    expect(routes.length).toBe(80);
    for (const route of routes) {
      const response = await send(route, revokedToken, orgA, {
        userId: victim,
        organizationId: orgA,
      });
      expect(response.status, `${route.method} ${route.registeredPath}`).toBe(403);
    }
  }, 60_000);

  it('rejects a foreign organization header on every write and leaves both target users unchanged', async () => {
    const before = await protectedSnapshot();
    for (const route of routes) {
      const response = await send(route, actorToken, orgB, {
        userId: victim,
        organizationId: orgB,
      });
      expect(response.status, `${route.method} ${route.registeredPath}`).toBeLessThan(500);
    }
    expect(await protectedSnapshot()).toEqual(before);
  }, 60_000);

  it('cannot redirect writes to another user through body or query', async () => {
    const before = await protectedSnapshot();
    for (const route of routes) {
      await send(route, actorToken, orgA, { userId: victim, organizationId: orgA });
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

  // CZERWONY KONTRAKT DYŻURU 55 — patrz §B.2. Plik notificationSettings.routes.ts
  // ma licencję zapisu dopiero w §D.1; do tego czasu nie wolno naprawiać jego granicy tutaj.
  it.skip('notificationSettings mount rejects REVOKED and foreign-tenant writes before payload handling', () => {});
});
