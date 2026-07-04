/**
 * HTTP-shape tests for `table-platform.form-public.routes.ts` — the
 * UNAUTHENTICATED public form intake surface (recipient-facing).
 *
 * Strategy: import the actual router and walk its handler stack directly
 * (same pattern as `table-platform.routes.test.ts`). Avoids `app.listen()`.
 *
 * Security priority: this surface has NO auth by design. The critical checks
 * are (a) the response body never leaks tenant/organization identifiers or
 * the JWT subject beyond what the form UI needs to render, and (b) a bad/
 * expired/foreign token is rejected before any data is returned.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockVerifyJwt = vi.fn();
const mockSubmitFromPublic = vi.fn();

vi.mock('../../services/tablePlatform/FormIntakeService.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../services/tablePlatform/FormIntakeService.js')
  >('../../services/tablePlatform/FormIntakeService.js');
  return {
    ...actual,
    default: {
      verifyJwt: (...args: unknown[]) => mockVerifyJwt(...args),
      submitFromPublic: (...args: unknown[]) => mockSubmitFromPublic(...args),
    },
  };
});

vi.mock('../../config/FeatureFlags.js', () => ({
  featureFlags: { ENABLE_TABLE_FORM_INTAKE_JWT: true },
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function createMockReq(overrides: Record<string, unknown> = {}): any {
  return {
    method: 'GET',
    params: {},
    body: {},
    query: {},
    headers: {},
    ip: '203.0.113.5',
    socket: { remoteAddress: '203.0.113.5' },
    app: { get: () => false },
    ...overrides,
  };
}

function createMockRes(): any {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  res.send = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  const headers: Record<string, unknown> = {};
  res.setHeader = vi.fn((name: string, value: unknown) => {
    headers[name] = value;
    return res;
  });
  res.getHeader = vi.fn((name: string) => headers[name]);
  res.removeHeader = vi.fn((name: string) => {
    delete headers[name];
  });
  return res;
}

async function importRouter(): Promise<any> {
  const mod = await import('../table-platform.form-public.routes.js');
  return mod.default;
}

async function runRoute(path: string, method: string, req: any, res: any): Promise<void> {
  const router = await importRouter();
  const stack = (router as any).stack as any[];
  for (const layer of stack) {
    if (res.body !== undefined) return;
    if (layer.route) {
      const routePath = layer.route.path as string;
      if (routePath !== path) continue;
      if (!layer.route.methods?.[method.toLowerCase()]) continue;
      for (const innerLayer of layer.route.stack) {
        if (res.body !== undefined) return;
        let nextCalled = false;
        await innerLayer.handle(req, res, (err?: unknown) => {
          nextCalled = true;
          if (err) throw err;
        });
        if (!nextCalled) return;
      }
    } else {
      let nextCalled = false;
      await layer.handle(req, res, (err?: unknown) => {
        nextCalled = true;
        if (err) throw err;
      });
      if (!nextCalled) return;
    }
  }
}

describe('table-platform.form-public.routes (unauthenticated surface)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /public/forms/jwt/:token', () => {
    it('happy path: returns 200 with only whitelisted fields', async () => {
      mockVerifyJwt.mockResolvedValue({
        formId: 'form-1',
        formSlug: 'my-form',
        targetTableId: 'table-1',
        fieldAllowList: ['name', 'email'],
        publicLinkExpiresAt: '2030-01-01T00:00:00.000Z',
        isPublished: true,
        jwtSubject: 'super-secret-recipient@example.com',
      });

      const req = createMockReq({
        method: 'GET',
        params: { token: 'valid-token' },
      });
      const res = createMockRes();
      await runRoute('/public/forms/jwt/:token', 'GET', req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        data: {
          formId: 'form-1',
          formSlug: 'my-form',
          targetTableId: 'table-1',
          fieldAllowList: ['name', 'email'],
          publicLinkExpiresAt: '2030-01-01T00:00:00.000Z',
        },
      });
    });

    it('SECURITY: response never leaks jwtSubject or isPublished, regardless of what the service returns', async () => {
      mockVerifyJwt.mockResolvedValue({
        formId: 'form-1',
        formSlug: 'my-form',
        targetTableId: 'table-1',
        fieldAllowList: null,
        publicLinkExpiresAt: null,
        isPublished: true,
        jwtSubject: 'leaking-this-would-be-a-bug@example.com',
        organizationId: 'org-should-not-leak', // defensive: even if service adds extra fields
      } as any);

      const req = createMockReq({
        method: 'GET',
        params: { token: 'valid-token' },
      });
      const res = createMockRes();
      await runRoute('/public/forms/jwt/:token', 'GET', req, res);

      const bodyKeys = Object.keys(res.body.data);
      expect(bodyKeys.sort()).toEqual(
        ['fieldAllowList', 'formId', 'formSlug', 'publicLinkExpiresAt', 'targetTableId'].sort()
      );
      expect(res.body.data.jwtSubject).toBeUndefined();
      expect(res.body.data.isPublished).toBeUndefined();
      expect(res.body.data.organizationId).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('leaking-this-would-be-a-bug');
      expect(JSON.stringify(res.body)).not.toContain('org-should-not-leak');
    });

    it('invalid/expired/foreign token → error propagated, no data leaked', async () => {
      const { FormIntakeError } = await import('../../services/tablePlatform/FormIntakeService.js');
      mockVerifyJwt.mockRejectedValue(
        new FormIntakeError('TOKEN_INVALID', 'Invalid or expired token', 401)
      );

      const req = createMockReq({
        method: 'GET',
        params: { token: 'garbage-token' },
      });
      const res = createMockRes();
      await runRoute('/public/forms/jwt/:token', 'GET', req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body).not.toHaveProperty('data');
    });

    it('missing token param → 400', async () => {
      const req = createMockReq({
        method: 'GET',
        params: { token: '' },
      });
      const res = createMockRes();
      await runRoute('/public/forms/jwt/:token', 'GET', req, res);

      expect(res.statusCode).toBe(400);
      expect(mockVerifyJwt).not.toHaveBeenCalled();
    });

    it('no Authorization header required: request with zero auth context still resolves to a real response (not 401)', async () => {
      // This route is publicly reachable by design — assert we do NOT
      // accidentally require auth (would be a regression, not a fix).
      mockVerifyJwt.mockResolvedValue({
        formId: 'form-1',
        formSlug: 'my-form',
        targetTableId: 'table-1',
        fieldAllowList: null,
        publicLinkExpiresAt: null,
        isPublished: true,
        jwtSubject: 'x',
      });
      const req = createMockReq({ method: 'GET', params: { token: 'valid-token' } });
      // No `user`, `userId`, `organizationId` set anywhere on req.
      const res = createMockRes();
      await runRoute('/public/forms/jwt/:token', 'GET', req, res);

      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /public/forms/jwt/:token/submit', () => {
    it('happy path: returns 201 with recordId only', async () => {
      mockVerifyJwt.mockResolvedValue({
        formId: 'form-1',
        formSlug: 'my-form',
        targetTableId: 'table-1',
        fieldAllowList: ['name'],
        publicLinkExpiresAt: null,
        isPublished: true,
        jwtSubject: 'recipient@example.com',
      });
      mockSubmitFromPublic.mockResolvedValue({
        submissionId: 'sub-1',
        recordId: 'rec-1',
        status: 'accepted',
        failureReason: null,
      });

      const req = createMockReq({
        method: 'POST',
        params: { token: 'valid-token' },
        body: { data: { name: 'Jane' } },
      });
      const res = createMockRes();
      await runRoute('/public/forms/jwt/:token/submit', 'POST', req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({ data: { recordId: 'rec-1' } });
      // submissionId / status must not leak in the response body.
      expect(res.body.data).not.toHaveProperty('submissionId');
      expect(mockSubmitFromPublic).toHaveBeenCalledWith(
        expect.objectContaining({
          intakeKind: 'jwt',
          formId: 'form-1',
          data: { name: 'Jane' },
          jwtSubject: 'recipient@example.com',
        })
      );
    });

    it('invalid/expired token on submit → error propagated before submitFromPublic is called', async () => {
      const { FormIntakeError } = await import('../../services/tablePlatform/FormIntakeService.js');
      mockVerifyJwt.mockRejectedValue(
        new FormIntakeError('TOKEN_INVALID', 'Invalid or expired token', 401)
      );

      const req = createMockReq({
        method: 'POST',
        params: { token: 'garbage-token' },
        body: { data: { name: 'Jane' } },
      });
      const res = createMockRes();
      await runRoute('/public/forms/jwt/:token/submit', 'POST', req, res);

      expect(res.statusCode).toBe(401);
      expect(mockSubmitFromPublic).not.toHaveBeenCalled();
    });

    it('missing data object → 400', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { token: 'valid-token' },
        body: {},
      });
      const res = createMockRes();
      await runRoute('/public/forms/jwt/:token/submit', 'POST', req, res);

      expect(res.statusCode).toBe(400);
      expect(mockVerifyJwt).not.toHaveBeenCalled();
      expect(mockSubmitFromPublic).not.toHaveBeenCalled();
    });

    it('non-object data (string) → 400', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { token: 'valid-token' },
        body: { data: 'not-an-object' },
      });
      const res = createMockRes();
      await runRoute('/public/forms/jwt/:token/submit', 'POST', req, res);

      expect(res.statusCode).toBe(400);
    });

    it('rate-limited submission → 429', async () => {
      mockVerifyJwt.mockResolvedValue({
        formId: 'form-1',
        formSlug: 'my-form',
        targetTableId: 'table-1',
        fieldAllowList: null,
        publicLinkExpiresAt: null,
        isPublished: true,
        jwtSubject: 'recipient@example.com',
      });
      mockSubmitFromPublic.mockResolvedValue({
        submissionId: 'sub-1',
        recordId: null,
        status: 'rate_limited',
        failureReason: null,
      });

      const req = createMockReq({
        method: 'POST',
        params: { token: 'valid-token' },
        body: { data: { name: 'Jane' } },
      });
      const res = createMockRes();
      await runRoute('/public/forms/jwt/:token/submit', 'POST', req, res);

      expect(res.statusCode).toBe(429);
      expect(res.body).toMatchObject({ code: 'RATE_LIMITED' });
    });

    it('rejected submission (allow-list violation etc.) → 400', async () => {
      mockVerifyJwt.mockResolvedValue({
        formId: 'form-1',
        formSlug: 'my-form',
        targetTableId: 'table-1',
        fieldAllowList: ['name'],
        publicLinkExpiresAt: null,
        isPublished: true,
        jwtSubject: 'recipient@example.com',
      });
      mockSubmitFromPublic.mockResolvedValue({
        submissionId: 'sub-1',
        recordId: null,
        status: 'rejected',
        failureReason: 'Field not allowed: ssn',
      });

      const req = createMockReq({
        method: 'POST',
        params: { token: 'valid-token' },
        body: { data: { ssn: '123-45-6789' } },
      });
      const res = createMockRes();
      await runRoute('/public/forms/jwt/:token/submit', 'POST', req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ code: 'REJECTED', error: 'Field not allowed: ssn' });
    });
  });
});
