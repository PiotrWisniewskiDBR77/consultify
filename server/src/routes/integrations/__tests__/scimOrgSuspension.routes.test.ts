/**
 * DEC-91 / TRI-MUST-12 — the SEVENTH front door: SCIM provisioning.
 *
 * ===========================================================================
 * WHY THIS SUITE EXISTS
 * ===========================================================================
 * Every DEC-91 gate built before this one hangs off `verifyToken` (JWT),
 * `verifyApiKey` (`ik_` integration keys) or a collab WebSocket upgrade. The
 * SCIM router uses NONE of them: `verifyScimToken` authenticates against
 * `scim_tokens` with its own bearer scheme and takes the tenant straight from
 * `scim_tokens.organization_id`. So a suspended tenant's provisioning key kept
 * driving eleven routes — including `POST/PUT/PATCH/DELETE /Users` and
 * `/Groups`, i.e. CREATING, MODIFYING and DEACTIVATING accounts inside a tenant
 * that is supposed to be cut off entirely.
 *
 * ===========================================================================
 * WHAT MAKES THESE ASSERTIONS FALSIFIABLE
 * ===========================================================================
 * The suite mounts the REAL router and speaks real HTTP to it; only
 * `DbPromise` is a double, and it answers the org-status query from a per-test
 * tenant table, so the status is genuinely read through the code under test.
 *
 * The refusal is asserted by ABSENCE OF WRITES, not just by status code: every
 * `run()` the router attempts is recorded, and a refused call must leave the
 * log without an `INSERT INTO users` AND without the `usage_count` bump that
 * `verifyScimToken` performs on the way past. The `usage_count` assertion is
 * what pins the gate to the correct SIDE of that statement — a gate placed one
 * line later would still 403 and would still have written.
 *
 * The ACTIVE tenant taking each identical path is the negative control: it
 * reaches the handler and writes, which is what makes the 403 attributable to
 * the suspension rather than to the harness.
 */

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_STATUS: Record<string, string> = {
  'org-suspended': 'suspended',
  'org-active': 'active',
};

/** SCIM bearer token -> the tenant its `scim_tokens` row names. */
const TOKEN_ORG: Record<string, string> = {
  'scim-token-of-suspended': 'org-suspended',
  'scim-token-of-active': 'org-active',
};

/** Every write the router attempted, in order. */
let writes: string[] = [];

vi.mock('../../../utils/DbPromise.js', () => ({
  get: vi.fn(async (sql: string, params?: unknown[]) => {
    const text = String(sql).replace(/\s+/g, ' ');
    const first = String((params || [])[0] ?? '');

    if (text.includes('FROM organizations')) {
      const status = ORG_STATUS[first];
      return status ? { status } : undefined;
    }
    if (text.includes('FROM scim_tokens')) {
      // `first` is the sha256 of the presented bearer token; the harness keys
      // the table on the raw token instead, resolved in `callAs` below.
      const orgId = TOKEN_ORG[currentToken];
      return orgId ? { id: `tok-${orgId}`, is_active: 1, organization_id: orgId } : undefined;
    }
    // No pre-existing user, so `POST /Users` takes its INSERT branch.
    if (text.includes('FROM users')) return undefined;
    return undefined;
  }),
  run: vi.fn(async (sql: string) => {
    const text = String(sql).replace(/\s+/g, ' ').trim();
    // `ensureScimTables` runs on every request; it is scaffolding, not a write
    // that says anything about whether the caller was let in.
    if (!text.toUpperCase().startsWith('CREATE TABLE')) writes.push(text);
    return undefined;
  }),
  all: vi.fn(async () => []),
}));

let currentToken = '';

const scimRouter = (await import('../scim.routes.js')).default;
const { __testing__ } = await import('../../../services/organizationSuspensionGuard.js');

const app = express();
app.use(express.json());
app.use('/scim/v2', scimRouter);

/** Issue one SCIM call as the holder of `token`. */
const scim = (token: string) => {
  currentToken = token;
  const auth = `Bearer ${token}`;
  return {
    post: (path: string, body: unknown) =>
      request(app).post(`/scim/v2${path}`).set('Authorization', auth).send(body),
    put: (path: string, body: unknown) =>
      request(app).put(`/scim/v2${path}`).set('Authorization', auth).send(body),
    patch: (path: string, body: unknown) =>
      request(app).patch(`/scim/v2${path}`).set('Authorization', auth).send(body),
    del: (path: string) => request(app).delete(`/scim/v2${path}`).set('Authorization', auth),
    get: (path: string) => request(app).get(`/scim/v2${path}`).set('Authorization', auth),
  };
};

const wroteMatching = (pattern: RegExp): boolean => writes.some((sql) => pattern.test(sql));

const USAGE_COUNT_BUMP = /UPDATE scim_tokens SET .*usage_count = usage_count \+ 1/i;
const USER_INSERT = /INSERT INTO users/i;

describe('DEC-91 — SCIM provisioning is refused for a suspended tenant', () => {
  beforeEach(() => {
    writes = [];
    currentToken = '';
    __testing__.reset();
  });

  afterEach(() => {
    __testing__.reset();
  });

  it('refuses POST /Users BEFORE any write — no user row, and not even the token usage bump', async () => {
    const res = await scim('scim-token-of-suspended').post('/Users', {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      userName: 'newhire@suspended.example',
      name: { givenName: 'New', familyName: 'Hire' },
    });

    expect(res.status).toBe(403);
    // The refusal reached the caller BEFORE the router touched anything.
    expect(wroteMatching(USER_INSERT)).toBe(false);
    expect(wroteMatching(USAGE_COUNT_BUMP)).toBe(false);
    expect(writes).toEqual([]);
  });

  it('answers in the SCIM error envelope an IdP can parse, carrying the DEC-91 code', async () => {
    const res = await scim('scim-token-of-suspended').post('/Users', {
      userName: 'newhire@suspended.example',
    });

    expect(res.body).toMatchObject({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      scimType: 'ORG_SUSPENDED',
      status: '403',
    });
    expect(typeof res.body.detail).toBe('string');
    expect(res.body.detail.length).toBeGreaterThan(0);
  });

  it('NEGATIVE CONTROL: the identical POST /Users for an ACTIVE tenant reaches the handler and writes', async () => {
    const res = await scim('scim-token-of-active').post('/Users', {
      userName: 'newhire@active.example',
      name: { givenName: 'New', familyName: 'Hire' },
    });

    expect(res.status).toBe(201);
    expect(wroteMatching(USER_INSERT)).toBe(true);
    expect(wroteMatching(USAGE_COUNT_BUMP)).toBe(true);
  });

  // The gate lives in `verifyScimToken`, which every protocol route shares — so
  // these cases prove the mounting, not four separate gates. If someone later
  // adds a route that skips `verifyScimToken`, that route is unguarded and this
  // suite will not notice: the shared middleware is the contract.
  it.each([
    [
      'PUT /Users/:id (replace)',
      () =>
        scim('scim-token-of-suspended').put('/Users/user-1', {
          userName: 'renamed@suspended.example',
        }),
    ],
    [
      'PATCH /Users/:id (deactivate)',
      () =>
        scim('scim-token-of-suspended').patch('/Users/user-1', {
          Operations: [{ op: 'replace', path: 'active', value: false }],
        }),
    ],
    ['DELETE /Users/:id', () => scim('scim-token-of-suspended').del('/Users/user-1')],
    [
      'POST /Groups',
      () => scim('scim-token-of-suspended').post('/Groups', { displayName: 'Engineering' }),
    ],
    [
      'PATCH /Groups/:id',
      () =>
        scim('scim-token-of-suspended').patch('/Groups/group-1', {
          Operations: [{ op: 'add', path: 'members', value: [{ value: 'user-1' }] }],
        }),
    ],
    ['DELETE /Groups/:id', () => scim('scim-token-of-suspended').del('/Groups/group-1')],
    ['GET /Users (read)', () => scim('scim-token-of-suspended').get('/Users')],
  ])('refuses %s for a suspended tenant, writing nothing', async (_label, call) => {
    const res = await call();

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ scimType: 'ORG_SUSPENDED' });
    expect(writes).toEqual([]);
  });

  it('an UNKNOWN tenant is not invented into a suspension — the token is simply honoured', async () => {
    // `org-unknown` is deliberately absent from ORG_STATUS. An absent
    // `organizations` row means the guard says "not suspended" — it never
    // INFERS a suspension — so this must behave exactly like the active tenant.
    // That proves the 403s above come from the STATUS VALUE and not merely from
    // the status lookup returning nothing.
    TOKEN_ORG['scim-token-of-unknown'] = 'org-unknown';

    const res = await scim('scim-token-of-unknown').post('/Users', {
      userName: 'someone@unknown.example',
    });

    expect(res.status).toBe(201);
    expect(wroteMatching(USAGE_COUNT_BUMP)).toBe(true);
  });
});
