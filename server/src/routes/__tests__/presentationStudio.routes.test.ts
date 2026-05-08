/**
 * Integration test for `presentationStudio.routes` (Sprint S1).
 *
 * Module: Consultify Presentation Studio.
 * Source of truth: .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *
 * Verifies:
 *   - POST /source-pack/preview returns 200 for an authenticated owner
 *   - 403 PERMISSION_DENIED when capability matrix forbids the role
 *   - 403 NO_ORG_CONTEXT when authenticated user has no organization
 *   - 401 when no authenticated user is on req (verifyToken middleware)
 *   - tenant scoping: previewId is bound to req.user.organizationId, not body
 *   - strict mode blocks the preview when required inputs are missing
 *
 * The router uses `router.use(verifyToken)` as middleware. We mock the
 * middleware to be configurable per test, then drive the full router stack
 * (middleware + route handlers) via `runFullChain`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMockState = vi.hoisted(() => ({
  current: {
    user: { id: 'user-1', organizationId: 'org-A', role: 'OWNER' } as any,
    userRole: 'OWNER' as string | undefined,
  } as { user: any; userRole?: string } | null,
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: any) => {
    const state = authMockState.current;
    if (!state) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = state.user;
    req.userId = state.user?.id;
    req.userRole = state.userRole;
    req.organizationId = state.user?.organizationId;
    next();
  },
}));

function setAuth(next: { user: any; userRole?: string } | null) {
  authMockState.current = next;
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

function createMockReq(overrides: Record<string, unknown> = {}): any {
  return {
    method: 'POST',
    url: '/source-pack/preview',
    originalUrl: '/api/presentation-studio/source-pack/preview',
    path: '/source-pack/preview',
    params: {},
    body: {},
    query: {},
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  };
}

async function importRouter(): Promise<any> {
  const mod = await import('../presentationStudio.routes.js');
  return mod.default;
}

/**
 * Runs the full router middleware + matching route handler chain.
 * Stops as soon as a handler does NOT call next() (response sent),
 * or as soon as a handler signals an error.
 */
async function runRouter(
  router: any,
  method: string,
  path: string,
  req: any,
  res: any
): Promise<void> {
  const stack: any[] = router.stack;
  for (const layer of stack) {
    if (layer.route) {
      // Skip non-matching routes
      if (layer.route.path !== path) continue;
      const methods = layer.route.methods || {};
      if (!methods[method.toLowerCase()]) continue;
      // Run the matching route's handlers in order
      for (const handler of layer.route.stack) {
        const continued = await runOne(handler.handle, req, res);
        if (!continued) return;
      }
      return;
    }

    // Router-level middleware (e.g. router.use(verifyToken))
    const continued = await runOne(layer.handle, req, res);
    if (!continued) return;
  }
}

function runOne(
  handle: (req: any, res: any, next: (err?: unknown) => void) => any,
  req: any,
  res: any
): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    let nextCalled = false;
    try {
      const result = handle(req, res, (err?: unknown) => {
        nextCalled = true;
        if (err) reject(err as Error);
        else resolve(true);
      });
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        (result as Promise<unknown>).then(
          () => {
            if (!nextCalled) resolve(false);
          },
          (err) => reject(err)
        );
      } else if (!nextCalled) {
        // Synchronous handler that did not call next: response was sent.
        setImmediate(() => {
          if (!nextCalled) resolve(false);
        });
      }
    } catch (err) {
      reject(err as Error);
    }
  });
}

describe('presentationStudio.routes — POST /source-pack/preview', () => {
  beforeEach(() => {
    setAuth({
      user: { id: 'user-1', organizationId: 'org-A', role: 'OWNER' },
      userRole: 'OWNER',
    });
  });

  it('returns 200 with source pack preview for an authenticated owner', async () => {
    const router = await importRouter();
    const req = createMockReq({
      body: {
        title: 'VTS interview executive deck',
        audience: 'executive',
        goal: 'inform',
        sourceArtifacts: [
          {
            type: 'interview_study',
            id: 'art-1',
            label: 'VTS interview',
            confidence: 0.7,
            readiness: 'ready',
          },
        ],
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/source-pack/preview', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        ok: true,
        sourcePack: { status: 'ready' },
      },
    });
    // Tenant scoping: previewId must be derived from the authenticated org-A,
    // not from anything in the request body.
    expect(res.body.data.previewId).toMatch(/^pssp_org-A_/);
  });

  it('returns 403 PERMISSION_DENIED for a VIEWER role (no presentation_create)', async () => {
    setAuth({
      user: { id: 'user-2', organizationId: 'org-A', role: 'VIEWER' },
      userRole: 'VIEWER',
    });
    const router = await importRouter();
    const req = createMockReq({ body: { title: 't', audience: 'executive', goal: 'inform' } });
    const res = createMockRes();
    await runRouter(router, 'POST', '/source-pack/preview', req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      success: false,
      code: 'PERMISSION_DENIED',
      requiredCapability: 'presentation_create',
    });
  });

  it('returns 403 NO_ORG_CONTEXT when authenticated user has no organization', async () => {
    setAuth({
      user: { id: 'user-3', organizationId: '', role: 'OWNER' },
      userRole: 'OWNER',
    });
    const router = await importRouter();
    const req = createMockReq({ body: { title: 't', audience: 'executive', goal: 'inform' } });
    const res = createMockRes();
    await runRouter(router, 'POST', '/source-pack/preview', req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      success: false,
      code: 'NO_ORG_CONTEXT',
    });
  });

  it('returns 401 when verifyToken rejects (no authenticated user)', async () => {
    setAuth(null);
    const router = await importRouter();
    const req = createMockReq({ body: {} });
    const res = createMockRes();
    await runRouter(router, 'POST', '/source-pack/preview', req, res);

    expect(res.statusCode).toBe(401);
  });

  it('ignores body-supplied organizationId; previewId is bound to authenticated tenant', async () => {
    setAuth({
      user: { id: 'user-1', organizationId: 'org-A', role: 'OWNER' },
      userRole: 'OWNER',
    });
    const router = await importRouter();
    const req = createMockReq({
      body: {
        title: 'attempt to spoof tenant',
        audience: 'executive',
        goal: 'inform',
        organizationId: 'org-B', // attempt to override tenant via body
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/source-pack/preview', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.previewId).toMatch(/^pssp_org-A_/);
    expect(res.body.data.previewId).not.toContain('org-B');
  });

  it('blocks generation in strict mode when required inputs are missing', async () => {
    setAuth({
      user: { id: 'user-1', organizationId: 'org-A', role: 'OWNER' },
      userRole: 'OWNER',
    });
    const router = await importRouter();
    const req = createMockReq({
      body: {
        title: 'Decision deck without sources',
        audience: 'executive',
        goal: 'decide',
        sourceArtifacts: [],
        sourcePackStrict: true,
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/source-pack/preview', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.ok).toBe(false);
    expect(res.body.data.missingInputs.length).toBeGreaterThan(0);
  });
});
