/**
 * HTTP-shape tests for `table-platform.form-intake.routes.ts` (admin surface).
 *
 * Strategy: import the actual router and walk its handler stack directly
 * (same pattern as `table-platform.routes.test.ts`). Avoids `app.listen()`.
 *
 * Covers: happy path (get intake context), missing auth → 401, missing
 * org → 403, cross-org form (IDOR) → 403 via FormIntakeError('TENANT_VIOLATION'),
 * invalid body → 400.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetFormForAdmin = vi.fn();
const mockIssueJwtLink = vi.fn();
const mockSetFieldAllowList = vi.fn();

vi.mock('../../services/tablePlatform/FormIntakeService.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../services/tablePlatform/FormIntakeService.js')
  >('../../services/tablePlatform/FormIntakeService.js');
  return {
    ...actual,
    default: {
      getFormForAdmin: (...args: unknown[]) => mockGetFormForAdmin(...args),
      issueJwtLink: (...args: unknown[]) => mockIssueJwtLink(...args),
      setFieldAllowList: (...args: unknown[]) => mockSetFieldAllowList(...args),
    },
  };
});

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: any) => {
    if (req.__noAuth) {
      return res.status(401).json({ error: 'No token provided' });
    }
    next();
  },
  requireSuperAdmin: (_req: any, _res: any, next: any) => next(),
}));

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
    user: { id: 'user-1' },
    userId: 'user-1',
    organizationId: 'org-A',
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
  return res;
}

async function importRouter(): Promise<any> {
  const mod = await import('../table-platform.form-intake.routes.js');
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

describe('table-platform.form-intake.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /forms/:formId/intake', () => {
    it('happy path: returns 200 with intake context', async () => {
      const ctx = { formId: 'form-1', targetTableId: 'table-1', fieldAllowList: null };
      mockGetFormForAdmin.mockResolvedValue(ctx);

      const req = createMockReq({
        method: 'GET',
        params: { formId: 'form-1' },
      });
      const res = createMockRes();
      await runRoute('/forms/:formId/intake', 'GET', req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ data: ctx });
      expect(mockGetFormForAdmin).toHaveBeenCalledWith('form-1', 'org-A');
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'GET',
        params: { formId: 'form-1' },
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute('/forms/:formId/intake', 'GET', req, res);

      expect(res.statusCode).toBe(401);
      expect(mockGetFormForAdmin).not.toHaveBeenCalled();
    });

    it('missing organization context → 403', async () => {
      const req = createMockReq({
        method: 'GET',
        params: { formId: 'form-1' },
        organizationId: undefined,
      });
      const res = createMockRes();
      await runRoute('/forms/:formId/intake', 'GET', req, res);

      expect(res.statusCode).toBe(403);
      expect(mockGetFormForAdmin).not.toHaveBeenCalled();
    });

    it('form belonging to another org (IDOR) → 403 TENANT_VIOLATION', async () => {
      const { FormIntakeError } = await import('../../services/tablePlatform/FormIntakeService.js');
      mockGetFormForAdmin.mockRejectedValue(
        new FormIntakeError('TENANT_VIOLATION', 'Form not in actor organization', 403)
      );

      const req = createMockReq({
        method: 'GET',
        params: { formId: 'form-in-other-org' },
      });
      const res = createMockRes();
      await runRoute('/forms/:formId/intake', 'GET', req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toMatchObject({ code: 'TENANT_VIOLATION' });
    });
  });

  describe('POST /forms/:formId/intake/jwt', () => {
    it('happy path: returns 201 with issued jwt link', async () => {
      const issued = { token: 'jwt-token', publicUrl: 'https://example.test/f/jwt-token' };
      mockIssueJwtLink.mockResolvedValue(issued);

      const req = createMockReq({
        method: 'POST',
        params: { formId: 'form-1' },
        body: { subject: 'recipient@example.com' },
      });
      const res = createMockRes();
      await runRoute('/forms/:formId/intake/jwt', 'POST', req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({ data: issued });
      expect(mockIssueJwtLink).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: 'form-1',
          organizationId: 'org-A',
          subject: 'recipient@example.com',
        })
      );
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { formId: 'form-1' },
        body: { subject: 'recipient@example.com' },
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute('/forms/:formId/intake/jwt', 'POST', req, res);

      expect(res.statusCode).toBe(401);
      expect(mockIssueJwtLink).not.toHaveBeenCalled();
    });

    it('form belonging to another org (IDOR) → 403 TENANT_VIOLATION', async () => {
      const { FormIntakeError } = await import('../../services/tablePlatform/FormIntakeService.js');
      mockIssueJwtLink.mockRejectedValue(
        new FormIntakeError('TENANT_VIOLATION', 'Form not in actor organization', 403)
      );

      const req = createMockReq({
        method: 'POST',
        params: { formId: 'form-in-other-org' },
        body: { subject: 'recipient@example.com' },
      });
      const res = createMockRes();
      await runRoute('/forms/:formId/intake/jwt', 'POST', req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toMatchObject({ code: 'TENANT_VIOLATION' });
    });

    it('empty subject → service SUBJECT_REQUIRED error surfaces as 400', async () => {
      const { FormIntakeError } = await import('../../services/tablePlatform/FormIntakeService.js');
      mockIssueJwtLink.mockRejectedValue(
        new FormIntakeError('SUBJECT_REQUIRED', 'subject is required')
      );

      const req = createMockReq({
        method: 'POST',
        params: { formId: 'form-1' },
        body: {},
      });
      const res = createMockRes();
      await runRoute('/forms/:formId/intake/jwt', 'POST', req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ code: 'SUBJECT_REQUIRED' });
    });
  });

  describe('PUT /forms/:formId/intake/allow-list', () => {
    it('happy path: returns 200 with updated context', async () => {
      const ctx = { formId: 'form-1', fieldAllowList: ['name', 'email'] };
      mockSetFieldAllowList.mockResolvedValue(ctx);

      const req = createMockReq({
        method: 'PUT',
        params: { formId: 'form-1' },
        body: { allowList: ['name', 'email'] },
      });
      const res = createMockRes();
      await runRoute('/forms/:formId/intake/allow-list', 'PUT', req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ data: ctx });
      expect(mockSetFieldAllowList).toHaveBeenCalledWith('form-1', 'org-A', ['name', 'email']);
    });

    it('non-array, non-null allowList → 400', async () => {
      const req = createMockReq({
        method: 'PUT',
        params: { formId: 'form-1' },
        body: { allowList: 'not-an-array' },
      });
      const res = createMockRes();
      await runRoute('/forms/:formId/intake/allow-list', 'PUT', req, res);

      expect(res.statusCode).toBe(400);
      expect(mockSetFieldAllowList).not.toHaveBeenCalled();
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'PUT',
        params: { formId: 'form-1' },
        body: { allowList: null },
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute('/forms/:formId/intake/allow-list', 'PUT', req, res);

      expect(res.statusCode).toBe(401);
    });
  });
});
