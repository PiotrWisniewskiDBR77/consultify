/**
 * DEC-91 / TRI-MUST-12 — the `ik_` INTEGRATION keys (Zapier/Make backbone) are
 * refused for a suspended tenant.
 *
 * ===========================================================================
 * THE FIFTH FRONT DOOR
 * ===========================================================================
 * `integrationApiKeyAuth` is a SECOND, independent API-key implementation. It
 * never touches `verifyToken`, and it is not `apiKeyAuth.middleware.ts` either,
 * so neither of the earlier enforcement points reached it. An adversarial audit
 * of DEC-91 found this one still open: a Zapier/Make key belonging to a
 * suspended tenant kept working, and `POST /actions/tasks.create` still INSERTed
 * rows for an organization that had been cut off on every other surface.
 *
 * ===========================================================================
 * WHY THE WRITE IS ASSERTED, NOT JUST THE STATUS CODE
 * ===========================================================================
 * A 403 that arrives AFTER the handler has already written would be a cosmetic
 * fix. So the decisive assertion below is that no INSERT reached the database
 * on the refused request — that is the thing the audit actually complained
 * about. The active-tenant negative control performs the identical request and
 * DOES write, which is what makes the refusal attributable to the suspension.
 */

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => {
  const crypto = require('node:crypto') as typeof import('node:crypto');
  const RAW_KEY = 'ik_abcdefgh0000000000000000';
  return {
    RAW_KEY,
    KEY_HASH: crypto.createHash('sha256').update(RAW_KEY).digest('hex'),
    ORG_STATUS: { 'org-suspended': 'suspended', 'org-active': 'active' } as Record<string, string>,
    state: { keyOrg: 'org-active' },
    dbAll: vi.fn(),
    dbGet: vi.fn(),
    dbRun: vi.fn(),
  };
});

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => H.dbAll(...args),
  get: (...args: unknown[]) => H.dbGet(...args),
  run: (...args: unknown[]) => H.dbRun(...args),
}));

// The admin-facing half of this router is irrelevant here; stub its guards so
// importing the module does not drag the whole auth stack in.
vi.mock('../../../middleware/admin.middleware.js', () => ({
  verifyAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (_req: unknown, _res: unknown, next: () => void) => next(),
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const automationRoutes = (await import('../automation.routes.js')).default;
const { __testing__, buildOrgSuspendedResponseBody } = await import(
  '../../../services/organizationSuspensionGuard.js'
);

/** Every INSERT the action handler attempts, so a silent write cannot hide. */
let inserts: string[] = [];

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/integrations/automation', automationRoutes);
  return app;
};

beforeEach(() => {
  vi.clearAllMocks();
  __testing__.reset();
  inserts = [];

  H.dbAll.mockImplementation(async (sql: string) => {
    const text = String(sql);
    // tableExists('integration_api_keys')
    if (text.startsWith('PRAGMA table_info')) return [{ name: 'id' }];
    if (text.includes('FROM integration_api_keys')) {
      return [
        {
          id: 'key-1',
          organization_id: H.state.keyOrg,
          name: 'zapier',
          api_key_hash: H.KEY_HASH,
          key_prefix: 'abcdefgh',
          permissions: '[]',
          allowed_actions: '[]',
          is_active: 1,
          rate_limit_per_minute: 1000,
          rate_limit_per_day: 100000,
        },
      ];
    }
    return [];
  });

  H.dbGet.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (String(sql).includes('FROM organizations')) {
      const status = H.ORG_STATUS[String((params || [])[0])];
      return status ? { status } : undefined;
    }
    return undefined;
  });

  H.dbRun.mockImplementation(async (sql: string) => {
    if (/insert\s+into/i.test(String(sql))) inserts.push(String(sql));
    return undefined;
  });
});

afterEach(() => {
  __testing__.reset();
});

const callAction = async (organizationId: string) => {
  H.state.keyOrg = organizationId;
  return await request(buildApp())
    .post('/api/integrations/automation/actions/tasks.create')
    .set('x-api-key', H.RAW_KEY)
    .send({ title: 'Automated task' });
};

describe('DEC-91 integration (ik_) API keys and organization suspension', () => {
  it('refuses a valid ik_ key belonging to a SUSPENDED tenant', async () => {
    const res = await callAction('org-suspended');

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'ORG_SUSPENDED' });
  });

  it('writes NOTHING for the refused request — the point of the fix', async () => {
    await callAction('org-suspended');

    expect(inserts).toEqual([]);
  });

  it('NEGATIVE CONTROL: the identical call for an ACTIVE tenant succeeds and writes', async () => {
    const res = await callAction('org-active');

    expect(res.status).toBeLessThan(400);
    expect(inserts.length).toBeGreaterThan(0);
  });

  it('returns the same body as every other DEC-91 front door', async () => {
    const res = await callAction('org-suspended');

    expect(res.body).toEqual(buildOrgSuspendedResponseBody());
  });

  it('refuses before the action allowlist, so no handler is consulted', async () => {
    // The refusal must not depend on which action was asked for.
    H.state.keyOrg = 'org-suspended';
    const res = await request(buildApp())
      .post('/api/integrations/automation/actions/tasks.create')
      .set('authorization', `Bearer ${H.RAW_KEY}`)
      .send({});

    // A missing `title` would be a 400 from the handler; a suspended tenant
    // never gets that far, so the status proves ordering.
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'ORG_SUSPENDED' });
  });
});
