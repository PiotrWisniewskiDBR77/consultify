/**
 * DEC-91 / TRI-MUST-12 — a suspended tenant's API KEYS stop working too.
 *
 * `apiKeyAuth` is a second front door: it resolves the caller entirely on its
 * own and never touches `verifyToken`, so the enforcement added to `attachUser`
 * does not reach `/api/v1/*`. Before this, suspending a tenant closed the
 * browser session and left its programmatic access untouched.
 *
 * The suite drives the REAL exported `apiKeyAuth`; only the key-resolution
 * service and the status lookup are doubles. The negative control is a valid
 * key of an ACTIVE tenant taking the identical path: it passes, which is what
 * makes the 403 attributable to the suspension rather than to the harness.
 */

import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_STATUS: Record<string, string> = {
  'org-suspended': 'suspended',
  'org-active': 'active',
};

/** The key resolver is mocked so no real key material or hashing is involved. */
const validateKey = vi.fn();
vi.mock('../../services/apiKeyService.js', () => ({
  API_KEY_PERMISSIONS: { FULL_ACCESS: '*' },
  ApiKeyService: {
    validateKey: (...args: unknown[]) => validateKey(...args),
    recordUsage: vi.fn(),
    trackUsage: vi.fn(),
  },
}));

/** The status lookup answers from the table above, through the real guard. */
vi.mock('../../utils/DbPromise.js', () => ({
  get: vi.fn(async (sql: string, params?: unknown[]) => {
    if (String(sql).includes('FROM organizations')) {
      const status = ORG_STATUS[String((params || [])[0])];
      return status ? { status } : undefined;
    }
    return undefined;
  }),
  run: vi.fn(async () => undefined),
  all: vi.fn(async () => []),
}));

const { apiKeyAuth } = await import('../apiKeyAuth.middleware.js');
const { __testing__ } = await import('../../services/organizationSuspensionGuard.js');

interface Captured {
  status: number | null;
  body: Record<string, unknown> | null;
  passed: boolean;
}

const runWithKey = async (organizationId: string): Promise<Captured> => {
  validateKey.mockResolvedValue({
    id: 'key-1',
    organizationId,
    permissions: ['*'],
    rateLimit: 1000,
    name: 'test key',
  });

  const captured: Captured = { status: null, body: null, passed: false };
  const req = {
    headers: { 'x-api-key': 'ck_testkeytestkeytestkeytestkey12' },
    method: 'GET',
    path: '/api/v1/initiatives',
    originalUrl: '/api/v1/initiatives',
    url: '/api/v1/initiatives',
    ip: '127.0.0.1',
    get: () => undefined,
  } as unknown as Request;

  const res = {
    headersSent: false,
    writableEnded: false,
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return this;
    },
    setHeader() {
      return this;
    },
    getHeader() {
      return undefined;
    },
  } as unknown as Response;

  const next: NextFunction = () => {
    captured.passed = true;
  };

  await apiKeyAuth(req as never, res, next);
  return captured;
};

describe('DEC-91 API-key auth refuses a suspended organization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __testing__.reset();
  });

  afterEach(() => {
    __testing__.reset();
  });

  it('refuses a valid key belonging to a SUSPENDED tenant', async () => {
    const result = await runWithKey('org-suspended');

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({
      code: 'ORG_SUSPENDED',
      messageKey: 'errors.organizationSuspended',
    });
    expect(result.passed).toBe(false);
  });

  it('NEGATIVE CONTROL: the same key shape for an ACTIVE tenant passes', async () => {
    const result = await runWithKey('org-active');

    expect(result.status).toBeNull();
    expect(result.passed).toBe(true);
  });

  it('the refusal body matches the JWT path byte for byte', async () => {
    const { buildOrgSuspendedResponseBody } = await import(
      '../../services/organizationSuspensionGuard.js'
    );
    const result = await runWithKey('org-suspended');

    expect(result.body).toEqual(buildOrgSuspendedResponseBody());
  });

  it('has no exemptions — the public API has no superadmin surface to spare', async () => {
    // Every path a key can reach is refused; there is no allowlist to consult.
    for (const path of ['/api/v1/initiatives', '/api/v1/health', '/api/v1/superadmin/tenants']) {
      __testing__.reset();
      validateKey.mockResolvedValue({
        id: 'key-1',
        organizationId: 'org-suspended',
        permissions: ['*'],
        rateLimit: 1000,
        name: 'test key',
      });
      const captured: Captured = { status: null, body: null, passed: false };
      const req = {
        headers: { 'x-api-key': 'ck_testkeytestkeytestkeytestkey12' },
        method: 'GET',
        path,
        originalUrl: path,
        url: path,
        ip: '127.0.0.1',
        get: () => undefined,
      } as unknown as Request;
      const res = {
        headersSent: false,
        writableEnded: false,
        status(code: number) {
          captured.status = code;
          return this;
        },
        json(body: Record<string, unknown>) {
          captured.body = body;
          return this;
        },
        setHeader() {
          return this;
        },
        getHeader() {
          return undefined;
        },
      } as unknown as Response;
      await apiKeyAuth(req as never, res, () => {
        captured.passed = true;
      });

      expect(captured.status, path).toBe(403);
      expect(captured.passed, path).toBe(false);
    }
  });
});
