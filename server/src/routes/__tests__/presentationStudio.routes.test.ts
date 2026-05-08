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

describe('presentationStudio.routes — POST /narrative-plan/preview', () => {
  beforeEach(() => {
    setAuth({
      user: { id: 'user-1', organizationId: 'org-A', role: 'OWNER' },
      userRole: 'OWNER',
    });
  });

  it('returns 200 with a ready narrative plan when outline + source pack are provided', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/narrative-plan/preview',
      path: '/narrative-plan/preview',
      body: {
        setup: {
          title: 'VTS Steering Committee',
          audience: 'executive',
          goal: 'decide',
          sourceArtifacts: [
            {
              type: 'assessment',
              id: 'art-1',
              label: 'VTS readiness',
              confidence: 0.8,
              readiness: 'ready',
            },
          ],
        },
        outline: [
          { intent: 'cover', title: 'Cover', enabled: true },
          { intent: 'executive_summary', title: 'Executive thesis', enabled: true },
          { intent: 'risk_management', title: 'Risks', enabled: true },
          { intent: 'next_steps', title: 'Decisions', enabled: true },
        ],
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/narrative-plan/preview', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        narrativePlan: {
          status: 'ready',
          goal: 'decide',
        },
      },
    });
    expect(res.body.data.narrativePlan.slidePlan.length).toBe(4);
    expect(res.body.data.narrativePlan.decisionContext).toBeTruthy();
    expect(res.body.data.previewId).toMatch(/^pssp_org-A_/);
  });

  it('returns needs_sources status when no source artifacts are provided', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/narrative-plan/preview',
      path: '/narrative-plan/preview',
      body: {
        setup: {
          title: 'Prompt-only deck',
          audience: 'executive',
          goal: 'inform',
          sourceArtifacts: [],
        },
        outline: [
          { intent: 'cover', title: 'Cover', enabled: true },
          { intent: 'key_messages', title: 'Hypotheses', enabled: true },
        ],
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/narrative-plan/preview', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.narrativePlan.status).toBe('needs_sources');
    expect(res.body.data.warnings.length).toBeGreaterThan(0);
    for (const slide of res.body.data.narrativePlan.slidePlan) {
      expect(slide.requiredEvidence).toEqual([]);
    }
  });

  it('returns 403 PERMISSION_DENIED for VIEWER on narrative-plan/preview', async () => {
    setAuth({
      user: { id: 'user-2', organizationId: 'org-A', role: 'VIEWER' },
      userRole: 'VIEWER',
    });
    const router = await importRouter();
    const req = createMockReq({
      url: '/narrative-plan/preview',
      path: '/narrative-plan/preview',
      body: { setup: { title: 't', audience: 'executive', goal: 'inform' } },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/narrative-plan/preview', req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      success: false,
      code: 'PERMISSION_DENIED',
      requiredCapability: 'presentation_create',
    });
  });

  it('returns 401 when verifyToken rejects on narrative-plan/preview', async () => {
    setAuth(null);
    const router = await importRouter();
    const req = createMockReq({
      url: '/narrative-plan/preview',
      path: '/narrative-plan/preview',
      body: {},
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/narrative-plan/preview', req, res);

    expect(res.statusCode).toBe(401);
  });

  it('ignores body-supplied organizationId on narrative-plan/preview', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/narrative-plan/preview',
      path: '/narrative-plan/preview',
      body: {
        organizationId: 'org-B',
        setup: {
          title: 'Spoof attempt',
          audience: 'executive',
          goal: 'inform',
          organizationId: 'org-B',
        },
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/narrative-plan/preview', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.previewId).toMatch(/^pssp_org-A_/);
    expect(res.body.data.previewId).not.toContain('org-B');
  });
});

describe('presentationStudio.routes — POST /template-architect/preview', () => {
  beforeEach(() => {
    setAuth({
      user: { id: 'user-1', organizationId: 'org-A', role: 'OWNER' },
      userRole: 'OWNER',
    });
  });

  it('returns 200 with a draft template plan (approvalRequired=true, governance.initialStatus=draft)', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/template-architect/preview',
      path: '/template-architect/preview',
      body: {
        setup: {
          title: 'VTS Steering Committee',
          audience: 'executive',
          goal: 'decide',
          sourceArtifacts: [
            {
              type: 'assessment',
              id: 'art-1',
              label: 'VTS readiness',
              confidence: 0.8,
              readiness: 'ready',
            },
          ],
        },
        outline: [
          { intent: 'cover', title: 'Cover', enabled: true },
          { intent: 'executive_summary', title: 'Executive thesis', enabled: true },
          { intent: 'risk_management', title: 'Risks', enabled: true },
          { intent: 'next_steps', title: 'Decisions', enabled: true },
        ],
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/template-architect/preview', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        approvalRequired: true,
        templatePlan: {
          governance: {
            initialStatus: 'draft',
            approvalRequired: true,
            auditEvent: 'template_architect_plan_created',
          },
        },
      },
    });
    expect(['draft', 'ready_for_review']).toContain(res.body.data.templatePlan.status);
    expect(Array.isArray(res.body.data.templatePlan.sections)).toBe(true);
    expect(res.body.data.templatePlan.sections.length).toBeGreaterThan(0);
    expect(res.body.data.previewId).toMatch(/^pssp_org-A_/);
  });

  it('returns needs_sources status when no source artifacts are provided (empty source pack)', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/template-architect/preview',
      path: '/template-architect/preview',
      body: {
        setup: {
          title: 'Prompt-only deck',
          audience: 'executive',
          goal: 'inform',
          sourceArtifacts: [],
        },
        outline: [{ intent: 'cover', title: 'Cover', enabled: true }],
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/template-architect/preview', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.templatePlan.status).toBe('needs_sources');
    expect(res.body.data.approvalRequired).toBe(true);
    expect(res.body.data.warnings.length).toBeGreaterThan(0);
  });

  it('returns 403 PERMISSION_DENIED for VIEWER on template-architect/preview', async () => {
    setAuth({
      user: { id: 'user-2', organizationId: 'org-A', role: 'VIEWER' },
      userRole: 'VIEWER',
    });
    const router = await importRouter();
    const req = createMockReq({
      url: '/template-architect/preview',
      path: '/template-architect/preview',
      body: { setup: { title: 't', audience: 'executive', goal: 'inform' } },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/template-architect/preview', req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      success: false,
      code: 'PERMISSION_DENIED',
      requiredCapability: 'presentation_create',
    });
  });

  it('returns 401 when verifyToken rejects on template-architect/preview', async () => {
    setAuth(null);
    const router = await importRouter();
    const req = createMockReq({
      url: '/template-architect/preview',
      path: '/template-architect/preview',
      body: {},
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/template-architect/preview', req, res);

    expect(res.statusCode).toBe(401);
  });

  it('ignores body-supplied organizationId on template-architect/preview', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/template-architect/preview',
      path: '/template-architect/preview',
      body: {
        organizationId: 'org-B',
        setup: {
          title: 'Spoof attempt',
          audience: 'executive',
          goal: 'inform',
          organizationId: 'org-B',
        },
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/template-architect/preview', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.previewId).toMatch(/^pssp_org-A_/);
    expect(res.body.data.previewId).not.toContain('org-B');
  });
});

describe('presentationStudio.routes — POST /generate/preview', () => {
  beforeEach(() => {
    setAuth({
      user: { id: 'user-1', organizationId: 'org-A', role: 'OWNER' },
      userRole: 'OWNER',
    });
  });

  it('returns 200 with outline preview + canProceed=true for a healthy decision deck', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/generate/preview',
      path: '/generate/preview',
      body: {
        setup: {
          title: 'VTS Steering Committee',
          audience: 'executive',
          goal: 'decide',
          deckType: 'steering_committee',
          sourceArtifacts: [
            {
              type: 'assessment',
              id: 'art-1',
              label: 'VTS readiness',
              confidence: 0.8,
              readiness: 'ready',
            },
          ],
        },
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate/preview', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.outlinePreview)).toBe(true);
    expect(res.body.data.outlinePreview.length).toBeGreaterThan(0);
    expect(res.body.data.estimatedSlideCount).toBeGreaterThan(0);
    expect(res.body.data.usedTemplate.family).toBeTruthy();
    expect(res.body.data.usedTemplate.runtime).toBeTruthy();
    expect(res.body.data.wouldGenerate.canProceed).toBe(true);
    expect(res.body.data.wouldGenerate.blockingReasons).toEqual([]);
    expect(res.body.data.previewId).toMatch(/^pssp_org-A_/);
  });

  it('returns canProceed=false for a decision deck with empty source pack', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/generate/preview',
      path: '/generate/preview',
      body: {
        setup: {
          title: 'Empty decision deck',
          audience: 'executive',
          goal: 'decide',
          sourceArtifacts: [],
        },
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate/preview', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.wouldGenerate.canProceed).toBe(false);
    expect(res.body.data.wouldGenerate.blockingReasons.length).toBeGreaterThan(0);
    expect(
      res.body.data.wouldGenerate.blockingReasons.some((reason: string) =>
        reason.toLowerCase().includes('decision')
      )
    ).toBe(true);
  });

  it('blocks in strict mode when source pack has missing inputs', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/generate/preview',
      path: '/generate/preview',
      body: {
        setup: {
          title: 'Strict deck',
          audience: 'executive',
          goal: 'inform',
          sourceArtifacts: [],
          sourcePackStrict: true,
        },
        strict: true,
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate/preview', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.wouldGenerate.strict).toBe(true);
    expect(res.body.data.wouldGenerate.canProceed).toBe(false);
    expect(
      res.body.data.wouldGenerate.blockingReasons.some((reason: string) =>
        reason.toLowerCase().includes('strict')
      )
    ).toBe(true);
  });

  it('uses narrative-plan fallback outline when no template family or outline is provided', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/generate/preview',
      path: '/generate/preview',
      body: {
        setup: {
          title: 'Free generation',
          audience: 'executive',
          goal: 'inform',
          sourceArtifacts: [
            {
              type: 'meeting_note',
              id: 'm-1',
              label: 'Stand-up',
              confidence: 0.6,
              readiness: 'ready',
            },
          ],
        },
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate/preview', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.usedTemplate.family).toBeNull();
    expect(['narrative_fallback', 'default']).toContain(res.body.data.usedTemplate.source);
    expect(res.body.data.outlinePreview.length).toBeGreaterThan(0);
  });

  it('returns 403 PERMISSION_DENIED for VIEWER on generate/preview', async () => {
    setAuth({
      user: { id: 'user-2', organizationId: 'org-A', role: 'VIEWER' },
      userRole: 'VIEWER',
    });
    const router = await importRouter();
    const req = createMockReq({
      url: '/generate/preview',
      path: '/generate/preview',
      body: { setup: { title: 't', audience: 'executive', goal: 'inform' } },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate/preview', req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      success: false,
      code: 'PERMISSION_DENIED',
      requiredCapability: 'presentation_create',
    });
  });

  it('returns 401 when verifyToken rejects on generate/preview', async () => {
    setAuth(null);
    const router = await importRouter();
    const req = createMockReq({
      url: '/generate/preview',
      path: '/generate/preview',
      body: {},
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate/preview', req, res);

    expect(res.statusCode).toBe(401);
  });

  it('ignores body-supplied organizationId on generate/preview', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/generate/preview',
      path: '/generate/preview',
      body: {
        organizationId: 'org-B',
        setup: {
          title: 'Spoof attempt',
          audience: 'executive',
          goal: 'inform',
          deckType: 'steering_committee',
          organizationId: 'org-B',
        },
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate/preview', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.previewId).toMatch(/^pssp_org-A_/);
    expect(res.body.data.previewId).not.toContain('org-B');
  });
});
