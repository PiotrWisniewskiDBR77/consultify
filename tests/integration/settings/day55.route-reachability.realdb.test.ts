/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

type RouteLayer = {
  route?: {
    path?: string | string[];
    methods?: Record<string, boolean>;
    stack?: Array<{ name?: string }>;
  };
};

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';

describe('Day 55 B.1 — real HTTP reachability inventory', NO_RETRY, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const otherUserId = randomUUID();
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();
  let authorization = '';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    const [{ ApiGateway }, { default: config }] = await Promise.all([
      import('../../../server/src/Gateway.js'),
      import('../../../server/src/config/Config.js'),
    ]);
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$1,'active')`, [
      organizationId,
    ]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
       VALUES($1,$2,$3,'unused','OWNER','active',1),($4,$2,$5,'unused','MEMBER','active',1)`,
      [
        userId,
        organizationId,
        `day55-routes-${userId}@test.invalid`,
        otherUserId,
        `day55-routes-${otherUserId}@test.invalid`,
      ]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE'),($4,$2,$5,'MEMBER','ACTIVE')`,
      [randomUUID(), organizationId, userId, randomUUID(), otherUserId]
    );
    authorization = `Bearer ${jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { expiresIn: '10m', jwtid: randomUUID() }
    )}`;
  }, 30_000);

  afterAll(async () => {
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM users WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await pool.end();
    const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  it('requests every registered GET address through the real Gateway', async () => {
    const modules: Array<[string, string, Promise<unknown>]> = [
      [
        'server/src/routes/settings.routes.ts',
        '/api/settings',
        import('../../../server/src/routes/settings.routes.js'),
      ],
      [
        'server/src/routes/user/preferences.routes.ts',
        '/api/preferences',
        import('../../../server/src/routes/user/preferences.routes.js'),
      ],
      [
        'server/src/routes/gdpr.routes.ts',
        '/api/gdpr',
        import('../../../server/src/routes/gdpr.routes.js'),
      ],
      [
        'server/src/routes/user/loginHistory.routes.ts',
        '/api/auth/login-history',
        import('../../../server/src/routes/user/loginHistory.routes.js'),
      ],
      [
        'server/src/routes/notifications/notificationSettings.routes.ts',
        '/api/notifications/settings',
        import('../../../server/src/routes/notifications/notificationSettings.routes.js'),
      ],
      [
        'server/src/routes/user/user-contact.routes.ts',
        '/api/user/contact-information',
        import('../../../server/src/routes/user/user-contact.routes.js'),
      ],
      [
        'server/src/routes/user/user-availability.routes.ts',
        '/api/user/availability',
        import('../../../server/src/routes/user/user-availability.routes.js'),
      ],
      [
        'server/src/routes/user/user-profile-completeness.routes.ts',
        '/api/user/profile-completeness',
        import('../../../server/src/routes/user/user-profile-completeness.routes.js'),
      ],
      [
        'server/src/routes/user/user-professional-profile.routes.ts',
        '/api/user/professional-profile',
        import('../../../server/src/routes/user/user-professional-profile.routes.js'),
      ],
      [
        'server/src/routes/user/user-security-advanced.routes.ts',
        '/api/user/security',
        import('../../../server/src/routes/user/user-security-advanced.routes.js'),
      ],
      [
        'server/src/routes/user/user-privacy-extended.routes.ts',
        '/api/user/privacy-settings',
        import('../../../server/src/routes/user/user-privacy-extended.routes.js'),
      ],
      [
        'server/src/routes/user/user-data-controls.routes.ts',
        '/api/user/data-controls',
        import('../../../server/src/routes/user/user-data-controls.routes.js'),
      ],
    ];
    const results: Array<Record<string, unknown>> = [];
    const writeResults: Array<Record<string, unknown>> = [];
    const inventory: Array<Record<string, unknown>> = [];
    for (const [file, prefix, modulePromise] of modules) {
      const imported = (await modulePromise) as { default?: { stack?: RouteLayer[] } };
      for (const layer of imported.default?.stack ?? []) {
        if (!layer.route) continue;
        const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path ?? ''];
        for (const routePath of paths) {
          for (const method of Object.keys(layer.route?.methods ?? {})) {
            inventory.push({
              method: method.toUpperCase(),
              registeredPath: `${prefix}${routePath}`,
              file,
              guards: (layer.route?.stack ?? []).map((handler) => handler.name || 'anonymous'),
            });
          }
          if (!layer.route?.methods?.get) continue;
          const concrete = `${prefix}${routePath}`
            .replace(/:userId\b/g, otherUserId)
            .replace(/:id\b/g, otherUserId)
            .replace(/:requestId\b/g, randomUUID())
            .replace(/:templateId\b/g, randomUUID())
            .replace(/:integrationId\b/g, randomUUID())
            .replace(/:[A-Za-z][A-Za-z0-9_]*/g, 'day55-probe');
          const response = await request(app)
            .get(concrete)
            .set('Authorization', authorization)
            .set('x-org-context', organizationId);
          results.push({
            method: 'GET',
            path: concrete,
            registeredPath: `${prefix}${routePath}`,
            file,
            status: response.status,
          });
        }
      }
    }
    for (const route of inventory.filter((entry) => entry.method !== 'GET')) {
      const concrete = String(route.registeredPath)
        .replace(/:userId\b/g, otherUserId)
        .replace(/:id\b/g, randomUUID())
        .replace(/:[A-Za-z][A-Za-z0-9_]*/g, 'day55-probe');
      const verb = String(route.method).toLowerCase() as 'post' | 'put' | 'patch' | 'delete';
      const response = await request(app)
        [verb](concrete)
        .set('Authorization', authorization)
        .set('x-org-context', organizationId)
        .send({});
      writeResults.push({ ...route, path: concrete, status: response.status });
    }
    writeFileSync(
      '/private/tmp/consultify-settings-day55-artefakty/b1-get-results.json',
      `${JSON.stringify(results, null, 2)}\n`
    );
    writeFileSync(
      '/private/tmp/consultify-settings-day55-artefakty/b1-route-inventory.json',
      `${JSON.stringify(inventory, null, 2)}\n`
    );
    writeFileSync(
      '/private/tmp/consultify-settings-day55-artefakty/b1-write-results.json',
      `${JSON.stringify(writeResults, null, 2)}\n`
    );
    expect(results.length).toBeGreaterThan(0);
  }, 60_000);
});
