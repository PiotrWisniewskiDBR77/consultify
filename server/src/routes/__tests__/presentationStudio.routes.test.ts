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

  // ---------------------------------------------------------------------
  // Sprint S10 — Visual layout audit surfaces in /generate/preview
  // ---------------------------------------------------------------------

  it('exposes layoutAudit shape on /generate/preview responses (S10)', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/generate/preview',
      path: '/generate/preview',
      body: {
        setup: {
          title: 'Healthy steering deck',
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
    expect(res.body.data.layoutAudit).toBeTruthy();
    expect(Array.isArray(res.body.data.layoutAudit.warnings)).toBe(true);
    expect(Array.isArray(res.body.data.layoutAudit.slideAudits)).toBe(true);
    expect(res.body.data.layoutAudit.flagCounts).toEqual(
      expect.objectContaining({
        layout_overflow_title: expect.any(Number),
        layout_overflow_key_message: expect.any(Number),
        layout_overflow_blocks: expect.any(Number),
        missing_source_for_evidence_intent: expect.any(Number),
        unsupported_intent_for_pptx_export: expect.any(Number),
      })
    );
    expect(res.body.data.layoutAudit.slideAudits.length).toBe(res.body.data.outlinePreview.length);
  });

  it('flags caller-supplied outline overflows in layoutAudit and merges warnings (S10)', async () => {
    const router = await importRouter();
    const longTitle = 'Steering committee preview — very long banner '.repeat(5);
    const req = createMockReq({
      url: '/generate/preview',
      path: '/generate/preview',
      body: {
        setup: {
          title: 'overflow probe',
          audience: 'executive',
          goal: 'inform',
          deckType: 'steering_committee',
          sourceArtifacts: [
            {
              type: 'assessment',
              id: 'art-1',
              label: 'a',
              confidence: 0.7,
              readiness: 'ready',
            },
          ],
        },
        outline: [
          {
            intent: 'recommendation_single',
            title: longTitle,
            enabled: true,
            density: 'visual',
          },
        ],
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate/preview', req, res);

    expect(res.statusCode).toBe(200);
    const audit = res.body.data.layoutAudit;
    expect(audit.flagCounts.layout_overflow_title).toBeGreaterThanOrEqual(1);
    expect(audit.flagCounts.missing_source_for_evidence_intent).toBeGreaterThanOrEqual(1);
    expect(res.body.data.warnings.some((w: string) => w.includes('[layout_overflow_title]'))).toBe(
      true
    );
    expect(
      res.body.data.warnings.some((w: string) => w.includes('[missing_source_for_evidence_intent]'))
    ).toBe(true);
  });

  it('flags an unsupported PPTX intent on caller-supplied outline (S10)', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/generate/preview',
      path: '/generate/preview',
      body: {
        setup: {
          title: 'unsupported intent probe',
          audience: 'executive',
          goal: 'inform',
          deckType: 'steering_committee',
          sourceArtifacts: [
            {
              type: 'assessment',
              id: 'art-1',
              label: 'a',
              confidence: 0.7,
              readiness: 'ready',
            },
          ],
        },
        outline: [
          {
            intent: 'mystery_intent',
            title: 'Mystery slide',
            enabled: true,
            density: 'balanced',
          },
        ],
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate/preview', req, res);

    expect(res.statusCode).toBe(200);
    const audit = res.body.data.layoutAudit;
    expect(audit.flagCounts.unsupported_intent_for_pptx_export).toBeGreaterThanOrEqual(1);
    expect(
      res.body.data.warnings.some((w: string) => w.includes('[unsupported_intent_for_pptx_export]'))
    ).toBe(true);
  });

  // -----------------------------------------------------------------
  // Sprint S11 — per-family overrides + PDF parity flag flow through
  // /generate/preview
  // -----------------------------------------------------------------

  it('applies the steering_committee family override to the layout audit (S11)', async () => {
    const router = await importRouter();
    // 100-char title sits above the canonical balanced cap (90) but below
    // the Steering Committee override (110).
    const longTitle = 'X'.repeat(100);
    const req = createMockReq({
      url: '/generate/preview',
      path: '/generate/preview',
      body: {
        setup: {
          title: 'family override probe',
          audience: 'executive',
          goal: 'inform',
          deckType: 'steering_committee',
          sourceArtifacts: [
            {
              type: 'assessment',
              id: 'art-1',
              label: 'a',
              confidence: 0.7,
              readiness: 'ready',
            },
          ],
        },
        outline: [
          {
            intent: 'executive_summary',
            title: longTitle,
            enabled: true,
            density: 'balanced',
            sourceRef: 'assessment:art-1',
          },
        ],
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate/preview', req, res);

    expect(res.statusCode).toBe(200);
    const audit = res.body.data.layoutAudit;
    expect(audit.flagCounts.layout_overflow_title).toBe(0);
  });

  it('threads slotDensities from the request body through to the audit (S12)', async () => {
    const router = await importRouter();
    // Slide-level density 'document' (cap 110) would NOT flag a 90-char
    // title. With slotDensities.title='visual' the visual cap (80)
    // applies and the title MUST flag.
    const req = createMockReq({
      url: '/generate/preview',
      path: '/generate/preview',
      body: {
        setup: {
          title: 'slot densities probe',
          audience: 'executive',
          goal: 'inform',
          deckType: 'steering_committee',
          sourceArtifacts: [
            {
              type: 'assessment',
              id: 'art-1',
              label: 'a',
              confidence: 0.7,
              readiness: 'ready',
            },
          ],
        },
        outline: [
          {
            intent: 'cover',
            title: 'X'.repeat(90),
            enabled: true,
            density: 'document',
            slotDensities: { title: 'visual' },
          },
        ],
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate/preview', req, res);

    expect(res.statusCode).toBe(200);
    const audit = res.body.data.layoutAudit;
    expect(audit.flagCounts.layout_overflow_title).toBe(1);
    expect(
      res.body.data.warnings.some((w: string) => w.startsWith('[layout_overflow_title]'))
    ).toBe(true);
  });

  it('flags PDF parity in addition to PPTX parity for an unsupported intent (S11)', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/generate/preview',
      path: '/generate/preview',
      body: {
        setup: {
          title: 'pdf parity probe',
          audience: 'executive',
          goal: 'inform',
          deckType: 'steering_committee',
          sourceArtifacts: [
            {
              type: 'assessment',
              id: 'art-1',
              label: 'a',
              confidence: 0.7,
              readiness: 'ready',
            },
          ],
        },
        outline: [
          {
            intent: 'mystery_intent',
            title: 'Mystery slide',
            enabled: true,
            density: 'balanced',
          },
        ],
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate/preview', req, res);

    expect(res.statusCode).toBe(200);
    const audit = res.body.data.layoutAudit;
    expect(audit.flagCounts.unsupported_intent_for_pptx_export).toBeGreaterThanOrEqual(1);
    expect(audit.flagCounts.unsupported_intent_for_pdf_export).toBeGreaterThanOrEqual(1);
    expect(
      res.body.data.warnings.some((w: string) => w.includes('[unsupported_intent_for_pdf_export]'))
    ).toBe(true);
  });
});

import {
  _approvalTicketStoreSizeForTests,
  _clearApprovalTicketStoreForTests,
} from '../../services/presentationStudioApprovalTicketService';
import { _setStudioGenerateDependenciesForTests } from '../../services/presentationStudioOrchestrationService';

describe('presentationStudio.routes — POST /generate/request-approval', () => {
  beforeEach(() => {
    _clearApprovalTicketStoreForTests();
    _setStudioGenerateDependenciesForTests(null);
    setAuth({
      user: { id: 'user-1', organizationId: 'org-A', role: 'OWNER' },
      userRole: 'OWNER',
    });
  });

  it('returns 200 with a fresh approval ticket for a healthy decision deck', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/generate/request-approval',
      path: '/generate/request-approval',
      body: {
        setup: {
          title: 'Steering Approval',
          audience: 'executive',
          goal: 'decide',
          deckType: 'steering_committee',
          sourceArtifacts: [
            {
              type: 'assessment',
              id: 'art-1',
              label: 'Readiness',
              confidence: 0.8,
              readiness: 'ready',
            },
          ],
        },
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate/request-approval', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ticket.ticketId).toMatch(/^pssa_/);
    expect(res.body.data.ticket.organizationId).toBe('org-A');
    expect(res.body.data.ticket.userId).toBe('user-1');
    expect(res.body.data.ticket.consumedAt).toBeNull();
    expect(typeof res.body.data.payloadFingerprint).toBe('string');
    expect(_approvalTicketStoreSizeForTests()).toBe(1);
  });

  it('returns 412 PRECONDITION_NOT_MET for a decision deck with empty source pack', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/generate/request-approval',
      path: '/generate/request-approval',
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
    await runRouter(router, 'POST', '/generate/request-approval', req, res);

    expect(res.statusCode).toBe(412);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('PRECONDITION_NOT_MET');
    expect(res.body.preview.wouldGenerate.canProceed).toBe(false);
    expect(_approvalTicketStoreSizeForTests()).toBe(0);
  });

  it('returns 403 for a VIEWER on /generate/request-approval', async () => {
    setAuth({
      user: { id: 'user-2', organizationId: 'org-A', role: 'VIEWER' },
      userRole: 'VIEWER',
    });
    const router = await importRouter();
    const req = createMockReq({
      url: '/generate/request-approval',
      path: '/generate/request-approval',
      body: { setup: { title: 't', audience: 'executive', goal: 'inform' } },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate/request-approval', req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });
});

describe('presentationStudio.routes — POST /generate', () => {
  const generateOutlineMock = vi.fn();
  const recordAuditMock = vi.fn();

  beforeEach(() => {
    _clearApprovalTicketStoreForTests();
    generateOutlineMock.mockReset();
    recordAuditMock.mockReset();
    generateOutlineMock.mockResolvedValue({
      outline: [
        { intent: 'cover', title: 'Cover', enabled: true },
        { intent: 'executive_summary', title: 'Executive thesis', enabled: true },
      ],
      deckId: 'deck-deadbeef',
      validationWarnings: [],
    });
    recordAuditMock.mockResolvedValue(undefined);
    _setStudioGenerateDependenciesForTests({
      generateOutline: generateOutlineMock as any,
      recordAudit: recordAuditMock as any,
    });
    setAuth({
      user: { id: 'user-1', organizationId: 'org-A', role: 'OWNER' },
      userRole: 'OWNER',
    });
  });

  function buildHealthyBody() {
    return {
      setup: {
        title: 'Steering Approval',
        audience: 'executive',
        goal: 'decide',
        deckType: 'steering_committee',
        sourceArtifacts: [
          {
            type: 'assessment',
            id: 'art-1',
            label: 'Readiness',
            confidence: 0.8,
            readiness: 'ready',
          },
        ],
      },
    };
  }

  async function mintTicket(router: any, body: Record<string, unknown>): Promise<string> {
    const req = createMockReq({
      url: '/generate/request-approval',
      path: '/generate/request-approval',
      body,
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate/request-approval', req, res);
    expect(res.statusCode).toBe(200);
    return res.body.data.ticket.ticketId as string;
  }

  it('returns 403 PRECONDITION_REQUIRED when no ticket id is supplied', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/generate',
      path: '/generate',
      body: buildHealthyBody(),
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('PRECONDITION_REQUIRED');
    expect(generateOutlineMock).not.toHaveBeenCalled();
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it('redeems a valid ticket, invokes generator, and emits audit', async () => {
    const router = await importRouter();
    const body = buildHealthyBody();
    const ticketId = await mintTicket(router, body);

    const req = createMockReq({
      url: '/generate',
      path: '/generate',
      body: { ...body, approvalTicket: ticketId },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        deckId: 'deck-deadbeef',
        slideCount: 2,
        ticketId,
        auditEvent: 'presentation_generated_via_studio',
      },
    });
    expect(generateOutlineMock).toHaveBeenCalledTimes(1);
    expect(recordAuditMock).toHaveBeenCalledTimes(1);
    const auditPayload = recordAuditMock.mock.calls[0][0];
    expect(auditPayload).toMatchObject({
      userId: 'user-1',
      organizationId: 'org-A',
      actionType: 'presentation_generated_via_studio',
      resourceType: 'presentation_deck',
      resourceId: 'deck-deadbeef',
    });
    expect(auditPayload.details.ticketId).toBe(ticketId);
  });

  it('rejects a re-redemption of the same ticket with INVALID_APPROVAL_TICKET (consumed)', async () => {
    const router = await importRouter();
    const body = buildHealthyBody();
    const ticketId = await mintTicket(router, body);

    const firstReq = createMockReq({
      url: '/generate',
      path: '/generate',
      body: { ...body, approvalTicket: ticketId },
    });
    const firstRes = createMockRes();
    await runRouter(router, 'POST', '/generate', firstReq, firstRes);
    expect(firstRes.statusCode).toBe(200);

    const secondReq = createMockReq({
      url: '/generate',
      path: '/generate',
      body: { ...body, approvalTicket: ticketId },
    });
    const secondRes = createMockRes();
    await runRouter(router, 'POST', '/generate', secondReq, secondRes);
    expect(secondRes.statusCode).toBe(403);
    expect(secondRes.body.code).toBe('INVALID_APPROVAL_TICKET');
    expect(secondRes.body.reason).toBe('consumed');
    expect(generateOutlineMock).toHaveBeenCalledTimes(1);
    expect(recordAuditMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a ticket whose payload was swapped after minting (payload_mismatch)', async () => {
    const router = await importRouter();
    const body = buildHealthyBody();
    const ticketId = await mintTicket(router, body);

    const tamperedBody = {
      setup: { ...body.setup, title: 'Different title — should NOT generate' },
      approvalTicket: ticketId,
    };
    const req = createMockReq({
      url: '/generate',
      path: '/generate',
      body: tamperedBody,
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('INVALID_APPROVAL_TICKET');
    expect(res.body.reason).toBe('payload_mismatch');
    expect(generateOutlineMock).not.toHaveBeenCalled();
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it('rejects a cross-tenant redemption with INVALID_APPROVAL_TICKET (tenant_mismatch)', async () => {
    const router = await importRouter();
    const body = buildHealthyBody();
    const ticketId = await mintTicket(router, body);

    setAuth({
      user: { id: 'user-1', organizationId: 'org-B', role: 'OWNER' },
      userRole: 'OWNER',
    });
    const req = createMockReq({
      url: '/generate',
      path: '/generate',
      body: { ...body, approvalTicket: ticketId },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('INVALID_APPROVAL_TICKET');
    expect(res.body.reason).toBe('tenant_mismatch');
    expect(generateOutlineMock).not.toHaveBeenCalled();
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it('returns 403 for a VIEWER on /generate', async () => {
    setAuth({
      user: { id: 'user-2', organizationId: 'org-A', role: 'VIEWER' },
      userRole: 'VIEWER',
    });
    const router = await importRouter();
    const req = createMockReq({
      url: '/generate',
      path: '/generate',
      body: { approvalTicket: 'pssa_does-not-exist', ...buildHealthyBody() },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
    expect(generateOutlineMock).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------
  // Sprint S10 — layout audit warnings merge into validationWarnings on
  // the mutating /generate path and are recorded into the audit row.
  // ---------------------------------------------------------------------

  it('merges layout audit warnings into validationWarnings and audit details (S10)', async () => {
    generateOutlineMock.mockResolvedValueOnce({
      outline: [
        { intent: 'cover', title: 'Cover', enabled: true },
        // Evidence-required intent with no source ref + a long title -> two flags.
        {
          intent: 'recommendation_single',
          title: 'X'.repeat(220),
          enabled: true,
          density: 'visual',
        },
      ],
      deckId: 'deck-with-flags',
      validationWarnings: ['baseline_generator_warning'],
    });
    const router = await importRouter();
    const body = buildHealthyBody();
    const ticketId = await mintTicket(router, body);

    const req = createMockReq({
      url: '/generate',
      path: '/generate',
      body: { ...body, approvalTicket: ticketId },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/generate', req, res);

    expect(res.statusCode).toBe(200);
    const warnings = res.body.data.validationWarnings as string[];
    expect(warnings).toContain('baseline_generator_warning');
    expect(warnings.some((w) => w.startsWith('[layout_overflow_title]'))).toBe(true);
    expect(warnings.some((w) => w.startsWith('[missing_source_for_evidence_intent]'))).toBe(true);

    expect(recordAuditMock).toHaveBeenCalledTimes(1);
    const auditDetails = recordAuditMock.mock.calls[0][0].details;
    expect(auditDetails.layoutAuditFlagCounts).toEqual(
      expect.objectContaining({
        layout_overflow_title: 1,
        missing_source_for_evidence_intent: 1,
      })
    );
  });
});

import { _setSourceArtifactsDependenciesForTests } from '../../services/presentationStudioSourceArtifactsService';

describe('presentationStudio.routes — GET /source-artifacts', () => {
  beforeEach(() => {
    _setSourceArtifactsDependenciesForTests(null);
    setAuth({
      user: { id: 'user-1', organizationId: 'org-A', role: 'OWNER' },
      userRole: 'OWNER',
    });
  });

  it('returns 200 with the tenant-scoped artifact list for a user with presentation_create', async () => {
    _setSourceArtifactsDependenciesForTests({
      queryAssessments: vi.fn().mockResolvedValue([
        {
          id: 'a-1',
          organization_id: 'org-A',
          status: 'COMPLETED',
          framework: 'SIRI',
          assessment_type: 'maturity',
          overall_score: 0.91,
          updated_at: '2026-05-01T10:00:00Z',
          created_at: null,
          title: 'Q3 readiness review',
          project_id: 'proj-1',
          score_summary: null,
          answers_json: '{}',
        },
      ]),
    });
    const router = await importRouter();
    const req = createMockReq({
      method: 'GET',
      url: '/source-artifacts',
      path: '/source-artifacts',
      query: {},
      body: undefined,
    });
    const res = createMockRes();
    await runRouter(router, 'GET', '/source-artifacts', req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.artifacts).toHaveLength(1);
    expect(res.body.data.artifacts[0]).toMatchObject({
      type: 'assessment',
      id: 'a-1',
      readiness: 'ready',
    });
    expect(res.body.data.byType.assessment).toBe(1);
    expect(res.body.data.warnings).toEqual([]);
  });

  it('forwards organizationId from the session and ignores query overrides', async () => {
    const queryAssessments = vi.fn().mockResolvedValue([]);
    _setSourceArtifactsDependenciesForTests({ queryAssessments });
    const router = await importRouter();
    const req = createMockReq({
      method: 'GET',
      url: '/source-artifacts',
      path: '/source-artifacts',
      query: { organizationId: 'org-EVIL' },
      body: undefined,
    });
    const res = createMockRes();
    await runRouter(router, 'GET', '/source-artifacts', req, res);
    expect(res.statusCode).toBe(200);
    expect(queryAssessments).toHaveBeenCalledWith('org-A', 50);
  });

  it('respects the limit query param within bounds', async () => {
    const queryAssessments = vi.fn().mockResolvedValue([]);
    _setSourceArtifactsDependenciesForTests({ queryAssessments });
    const router = await importRouter();
    const req = createMockReq({
      method: 'GET',
      url: '/source-artifacts',
      path: '/source-artifacts',
      query: { limit: '12' },
      body: undefined,
    });
    const res = createMockRes();
    await runRouter(router, 'GET', '/source-artifacts', req, res);
    expect(queryAssessments).toHaveBeenCalledWith('org-A', 12);
  });

  it('returns 200 with honest degraded warning when the underlying query fails', async () => {
    _setSourceArtifactsDependenciesForTests({
      queryAssessments: vi.fn().mockRejectedValue(new Error('connection lost')),
    });
    const router = await importRouter();
    const req = createMockReq({
      method: 'GET',
      url: '/source-artifacts',
      path: '/source-artifacts',
      query: {},
      body: undefined,
    });
    const res = createMockRes();
    await runRouter(router, 'GET', '/source-artifacts', req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.artifacts).toEqual([]);
    expect(res.body.data.warnings[0]).toContain('assessments_query_failed');
  });

  it('returns 403 PERMISSION_DENIED for a VIEWER', async () => {
    setAuth({
      user: { id: 'user-2', organizationId: 'org-A', role: 'VIEWER' },
      userRole: 'VIEWER',
    });
    const router = await importRouter();
    const req = createMockReq({
      method: 'GET',
      url: '/source-artifacts',
      path: '/source-artifacts',
      query: {},
      body: undefined,
    });
    const res = createMockRes();
    await runRouter(router, 'GET', '/source-artifacts', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });
});

// ---------------------------------------------------------------------------
// Sprint S17 — SuperAdmin layout-capacity admin route tests
// ---------------------------------------------------------------------------

import { _clearApprovalTicketStoreForTests } from '../../services/presentationStudioApprovalTicketService';
import { _setLayoutCapacityAdminDependenciesForTests } from '../../services/presentationStudioLayoutCapacityAdminService';
import {
  applyOverrides as applyLayoutCapacityOverrides,
  getCurrentRegistrySnapshot as getLayoutCapacitySnapshot,
  resetToDefaults as resetLayoutCapacityRegistry,
} from '../../services/presentationStudioLayoutCapacityRegistryService';

describe('presentationStudio.routes — GET /admin/layout-capacity (S17)', () => {
  beforeEach(() => {
    resetLayoutCapacityRegistry();
    _clearApprovalTicketStoreForTests();
    _setLayoutCapacityAdminDependenciesForTests(null);
    setAuth({
      user: { id: 'admin-1', organizationId: 'org-Sys', role: 'SUPERADMIN' },
      userRole: 'SUPERADMIN',
    });
  });

  it('returns 200 with current + defaults snapshot for a SUPERADMIN', async () => {
    const router = await importRouter();
    const req = createMockReq({
      method: 'GET',
      url: '/admin/layout-capacity',
      path: '/admin/layout-capacity',
      body: undefined,
    });
    const res = createMockRes();
    await runRouter(router, 'GET', '/admin/layout-capacity', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scope).toBe('tenant');
    expect(res.body.data.current.densityBudgets.balanced).toBeDefined();
    expect(res.body.data.defaults.densityBudgets.balanced).toEqual(
      res.body.data.current.densityBudgets.balanced
    );
  });

  it('reflects an applied override in the current snapshot but not in defaults', async () => {
    applyLayoutCapacityOverrides(
      {
        densityBudgets: { balanced: { titleMaxChars: 137 } },
      },
      'org-Sys'
    );
    const router = await importRouter();
    const req = createMockReq({
      method: 'GET',
      url: '/admin/layout-capacity',
      path: '/admin/layout-capacity',
      body: undefined,
    });
    const res = createMockRes();
    await runRouter(router, 'GET', '/admin/layout-capacity', req, res);

    expect(res.body.data.current.densityBudgets.balanced.titleMaxChars).toBe(137);
    expect(res.body.data.defaults.densityBudgets.balanced.titleMaxChars).not.toBe(137);
  });

  it('returns the authenticated tenant snapshot, not another tenant override (S23)', async () => {
    applyLayoutCapacityOverrides(
      {
        densityBudgets: { balanced: { titleMaxChars: 137 } },
      },
      'org-Other'
    );
    const router = await importRouter();
    const req = createMockReq({
      method: 'GET',
      url: '/admin/layout-capacity',
      path: '/admin/layout-capacity',
      body: undefined,
    });
    const res = createMockRes();
    await runRouter(router, 'GET', '/admin/layout-capacity', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.current.densityBudgets.balanced.titleMaxChars).toBe(90);
    expect(res.body.data.scope).toBe('tenant');
  });

  it('returns 403 PERMISSION_DENIED for OWNER (process-global registry is SUPERADMIN-only)', async () => {
    setAuth({
      user: { id: 'owner-1', organizationId: 'org-A', role: 'OWNER' },
      userRole: 'OWNER',
    });
    const router = await importRouter();
    const req = createMockReq({
      method: 'GET',
      url: '/admin/layout-capacity',
      path: '/admin/layout-capacity',
      body: undefined,
    });
    const res = createMockRes();
    await runRouter(router, 'GET', '/admin/layout-capacity', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
    expect(res.body.requiredCapability).toBe('presentation_admin_layout_capacity');
  });

  it('returns 403 PERMISSION_DENIED for ADMIN', async () => {
    setAuth({
      user: { id: 'admin-1', organizationId: 'org-A', role: 'ADMIN' },
      userRole: 'ADMIN',
    });
    const router = await importRouter();
    const req = createMockReq({
      method: 'GET',
      url: '/admin/layout-capacity',
      path: '/admin/layout-capacity',
      body: undefined,
    });
    const res = createMockRes();
    await runRouter(router, 'GET', '/admin/layout-capacity', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });

  it('returns 401 when no authenticated user is present', async () => {
    setAuth(null);
    const router = await importRouter();
    const req = createMockReq({
      method: 'GET',
      url: '/admin/layout-capacity',
      path: '/admin/layout-capacity',
      body: undefined,
    });
    const res = createMockRes();
    await runRouter(router, 'GET', '/admin/layout-capacity', req, res);
    expect(res.statusCode).toBe(401);
  });
});

describe('presentationStudio.routes — POST /admin/layout-capacity/propose (S17)', () => {
  beforeEach(() => {
    resetLayoutCapacityRegistry();
    _clearApprovalTicketStoreForTests();
    _setLayoutCapacityAdminDependenciesForTests(null);
    setAuth({
      user: { id: 'admin-1', organizationId: 'org-Sys', role: 'SUPERADMIN' },
      userRole: 'SUPERADMIN',
    });
  });

  it('returns 200 + ticket for a valid override payload', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/admin/layout-capacity/propose',
      path: '/admin/layout-capacity/propose',
      body: {
        overrides: {
          densityBudgets: { balanced: { titleMaxChars: 100 } },
        },
        reason: 'tightening title cap',
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/propose', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ticket.organizationId).toBe('org-Sys');
    expect(res.body.data.ticket.userId).toBe('admin-1');
    expect(res.body.data.payloadFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns 412 INVALID_OVERRIDES_PAYLOAD for an invalid payload', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/admin/layout-capacity/propose',
      path: '/admin/layout-capacity/propose',
      body: {
        overrides: {
          densityBudgets: { balanced: { titleMaxChars: -5 } },
        },
        reason: 'broken',
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/propose', req, res);

    expect(res.statusCode).toBe(412);
    expect(res.body.code).toBe('INVALID_OVERRIDES_PAYLOAD');
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('returns 403 PERMISSION_DENIED for non-SUPERADMIN (e.g. OWNER)', async () => {
    setAuth({
      user: { id: 'owner-1', organizationId: 'org-A', role: 'OWNER' },
      userRole: 'OWNER',
    });
    const router = await importRouter();
    const req = createMockReq({
      url: '/admin/layout-capacity/propose',
      path: '/admin/layout-capacity/propose',
      body: { overrides: {}, reason: 'test' },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/propose', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });

  it('does NOT mutate the registry when proposal is accepted (dry-run + roll-back)', async () => {
    const before = getLayoutCapacitySnapshot('org-Sys');
    const router = await importRouter();
    const req = createMockReq({
      url: '/admin/layout-capacity/propose',
      path: '/admin/layout-capacity/propose',
      body: {
        overrides: { densityBudgets: { balanced: { titleMaxChars: 100 } } },
        reason: 'rationale',
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/propose', req, res);
    expect(res.statusCode).toBe(200);
    expect(getLayoutCapacitySnapshot('org-Sys')).toEqual(before);
  });
});

describe('presentationStudio.routes — POST /admin/layout-capacity/execute (S17)', () => {
  beforeEach(() => {
    resetLayoutCapacityRegistry();
    _clearApprovalTicketStoreForTests();
    _setLayoutCapacityAdminDependenciesForTests(null);
    setAuth({
      user: { id: 'admin-1', organizationId: 'org-Sys', role: 'SUPERADMIN' },
      userRole: 'SUPERADMIN',
    });
  });

  async function proposeViaRoute(
    router: any,
    body: Record<string, unknown>
  ): Promise<{ ticketId: string; fingerprint: string }> {
    const req = createMockReq({
      url: '/admin/layout-capacity/propose',
      path: '/admin/layout-capacity/propose',
      body,
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/propose', req, res);
    if (res.statusCode !== 200) {
      throw new Error(`propose failed: ${JSON.stringify(res.body)}`);
    }
    return {
      ticketId: res.body.data.ticket.ticketId,
      fingerprint: res.body.data.payloadFingerprint,
    };
  }

  it('redeems a fresh ticket and applies the override end-to-end', async () => {
    const audit = vi.fn().mockResolvedValue(undefined);
    _setLayoutCapacityAdminDependenciesForTests({ recordAudit: audit });

    const router = await importRouter();
    const overrides = { densityBudgets: { balanced: { titleMaxChars: 100 } } };
    const reason = 'tightening title cap for executive decks';
    const { ticketId } = await proposeViaRoute(router, { overrides, reason });

    const req = createMockReq({
      url: '/admin/layout-capacity/execute',
      path: '/admin/layout-capacity/execute',
      body: { approvalTicket: ticketId, overrides, reason },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/execute', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ticketId).toBe(ticketId);
    expect(res.body.data.auditEvent).toBe('presentation_studio_layout_capacity_overrides_applied');
    expect(res.body.data.registrySnapshotAfter.densityBudgets.balanced.titleMaxChars).toBe(100);

    expect(audit).toHaveBeenCalledTimes(1);
    expect(getLayoutCapacitySnapshot('org-Sys').densityBudgets.balanced.titleMaxChars).toBe(100);
    expect(getLayoutCapacitySnapshot('org-Other').densityBudgets.balanced.titleMaxChars).toBe(90);
  });

  it('returns 403 PRECONDITION_REQUIRED when no ticket id is supplied', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/admin/layout-capacity/execute',
      path: '/admin/layout-capacity/execute',
      body: {
        overrides: { densityBudgets: { balanced: { titleMaxChars: 100 } } },
        reason: 'rationale',
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/execute', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('PRECONDITION_REQUIRED');
  });

  it('returns 403 INVALID_APPROVAL_TICKET when the ticket id is unknown', async () => {
    const audit = vi.fn().mockResolvedValue(undefined);
    _setLayoutCapacityAdminDependenciesForTests({ recordAudit: audit });
    const router = await importRouter();
    const req = createMockReq({
      url: '/admin/layout-capacity/execute',
      path: '/admin/layout-capacity/execute',
      body: {
        approvalTicket: 'pssa_does_not_exist',
        overrides: { densityBudgets: { balanced: { titleMaxChars: 100 } } },
        reason: 'rationale',
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/execute', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('INVALID_APPROVAL_TICKET');
    expect(res.body.reason).toBe('not_found');
    expect(audit).not.toHaveBeenCalled();
  });

  it('returns 403 payload_mismatch when overrides change between propose and execute', async () => {
    const audit = vi.fn().mockResolvedValue(undefined);
    _setLayoutCapacityAdminDependenciesForTests({ recordAudit: audit });
    const router = await importRouter();
    const { ticketId } = await proposeViaRoute(router, {
      overrides: { densityBudgets: { balanced: { titleMaxChars: 100 } } },
      reason: 'rationale',
    });
    const req = createMockReq({
      url: '/admin/layout-capacity/execute',
      path: '/admin/layout-capacity/execute',
      body: {
        approvalTicket: ticketId,
        overrides: { densityBudgets: { balanced: { titleMaxChars: 999 } } }, // CHANGED
        reason: 'rationale',
      },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/execute', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('INVALID_APPROVAL_TICKET');
    expect(res.body.reason).toBe('payload_mismatch');
    expect(audit).not.toHaveBeenCalled();
    // Registry state untouched.
    expect(getLayoutCapacitySnapshot('org-Sys').densityBudgets.balanced.titleMaxChars).not.toBe(
      999
    );
  });

  it('returns 403 PERMISSION_DENIED for OWNER trying to execute', async () => {
    setAuth({
      user: { id: 'owner-1', organizationId: 'org-A', role: 'OWNER' },
      userRole: 'OWNER',
    });
    const router = await importRouter();
    const req = createMockReq({
      url: '/admin/layout-capacity/execute',
      path: '/admin/layout-capacity/execute',
      body: { approvalTicket: 'pssa_x', overrides: {}, reason: 'r' },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/execute', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });
});

// ---------------------------------------------------------------------------
// Sprint S18 — admin GET surfaces loadWarning channel
// ---------------------------------------------------------------------------

import { setRegistryLoadWarning } from '../../services/presentationStudioLayoutCapacityRegistryService';

describe('presentationStudio.routes — GET /admin/layout-capacity loadWarning (S18)', () => {
  beforeEach(() => {
    resetLayoutCapacityRegistry();
    _clearApprovalTicketStoreForTests();
    _setLayoutCapacityAdminDependenciesForTests(null);
    setRegistryLoadWarning(null);
    setAuth({
      user: { id: 'admin-1', organizationId: 'org-Sys', role: 'SUPERADMIN' },
      userRole: 'SUPERADMIN',
    });
  });

  afterEach(() => {
    setRegistryLoadWarning(null);
  });

  it('returns null loadWarning when persistence load was clean', async () => {
    const router = await importRouter();
    const req = createMockReq({
      method: 'GET',
      url: '/admin/layout-capacity',
      path: '/admin/layout-capacity',
      body: undefined,
    });
    const res = createMockRes();
    await runRouter(router, 'GET', '/admin/layout-capacity', req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.loadWarning).toBeNull();
  });

  it('surfaces a corrupt loadWarning via the GET when persistence raised one', async () => {
    setRegistryLoadWarning({
      reason: 'corrupt',
      sourcePath: '/tmp/some-broken-file.json',
      details: 'Unexpected token in JSON at position 0',
      raisedAt: '2026-05-09T00:00:00.000Z',
    });
    const router = await importRouter();
    const req = createMockReq({
      method: 'GET',
      url: '/admin/layout-capacity',
      path: '/admin/layout-capacity',
      body: undefined,
    });
    const res = createMockRes();
    await runRouter(router, 'GET', '/admin/layout-capacity', req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.loadWarning).toMatchObject({
      reason: 'corrupt',
      sourcePath: '/tmp/some-broken-file.json',
      details: expect.stringContaining('Unexpected token'),
    });
  });

  it('surfaces a rejected_by_validator loadWarning via the GET', async () => {
    setRegistryLoadWarning({
      reason: 'rejected_by_validator',
      sourcePath: '/tmp/file.json',
      details: 'densityBudgets.balanced.titleMaxChars: must be a finite positive number',
      raisedAt: '2026-05-09T00:00:00.000Z',
    });
    const router = await importRouter();
    const req = createMockReq({
      method: 'GET',
      url: '/admin/layout-capacity',
      path: '/admin/layout-capacity',
      body: undefined,
    });
    const res = createMockRes();
    await runRouter(router, 'GET', '/admin/layout-capacity', req, res);
    expect(res.body.data.loadWarning.reason).toBe('rejected_by_validator');
    expect(res.body.data.loadWarning.details).toContain('titleMaxChars');
  });
});

// ---------------------------------------------------------------------------
// Sprint S19 — SuperAdmin reset-to-defaults admin route tests
// ---------------------------------------------------------------------------

describe('presentationStudio.routes — POST /admin/layout-capacity/reset/propose (S19)', () => {
  beforeEach(() => {
    resetLayoutCapacityRegistry();
    _clearApprovalTicketStoreForTests();
    _setLayoutCapacityAdminDependenciesForTests(null);
    setAuth({
      user: { id: 'admin-1', organizationId: 'org-Sys', role: 'SUPERADMIN' },
      userRole: 'SUPERADMIN',
    });
  });

  it('returns 200 with a fresh ticket for a SUPERADMIN (no payload required)', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/admin/layout-capacity/reset/propose',
      path: '/admin/layout-capacity/reset/propose',
      body: { reason: 'returning to defaults after S17 experiment' },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/reset/propose', req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ticket).toBeDefined();
    expect(res.body.data.ticket.organizationId).toBe('org-Sys');
    expect(res.body.data.ticket.userId).toBe('admin-1');
    expect(res.body.data.ticket.consumedAt).toBeNull();
    expect(res.body.data.payloadFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('does NOT mutate the registry on a successful proposal', async () => {
    applyLayoutCapacityOverrides(
      { densityBudgets: { balanced: { titleMaxChars: 100 } } },
      'org-Sys'
    );
    const before = getLayoutCapacitySnapshot('org-Sys');
    const router = await importRouter();
    const req = createMockReq({
      url: '/admin/layout-capacity/reset/propose',
      path: '/admin/layout-capacity/reset/propose',
      body: { reason: 'rationale' },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/reset/propose', req, res);
    expect(res.statusCode).toBe(200);
    expect(getLayoutCapacitySnapshot('org-Sys')).toEqual(before);
  });

  it('returns 403 PERMISSION_DENIED for OWNER trying to propose a reset', async () => {
    setAuth({
      user: { id: 'owner-1', organizationId: 'org-A', role: 'OWNER' },
      userRole: 'OWNER',
    });
    const router = await importRouter();
    const req = createMockReq({
      url: '/admin/layout-capacity/reset/propose',
      path: '/admin/layout-capacity/reset/propose',
      body: { reason: 'rationale' },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/reset/propose', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });

  it('returns 403 PERMISSION_DENIED for ADMIN trying to propose a reset', async () => {
    setAuth({
      user: { id: 'admin-org', organizationId: 'org-A', role: 'ADMIN' },
      userRole: 'ADMIN',
    });
    const router = await importRouter();
    const req = createMockReq({
      url: '/admin/layout-capacity/reset/propose',
      path: '/admin/layout-capacity/reset/propose',
      body: { reason: 'rationale' },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/reset/propose', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });
});

describe('presentationStudio.routes — POST /admin/layout-capacity/reset/execute (S19)', () => {
  beforeEach(() => {
    resetLayoutCapacityRegistry();
    _clearApprovalTicketStoreForTests();
    _setLayoutCapacityAdminDependenciesForTests(null);
    setAuth({
      user: { id: 'admin-1', organizationId: 'org-Sys', role: 'SUPERADMIN' },
      userRole: 'SUPERADMIN',
    });
  });

  async function proposeResetViaRoute(
    router: any,
    body: Record<string, unknown>
  ): Promise<{ ticketId: string; fingerprint: string }> {
    const req = createMockReq({
      url: '/admin/layout-capacity/reset/propose',
      path: '/admin/layout-capacity/reset/propose',
      body,
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/reset/propose', req, res);
    if (res.statusCode !== 200) {
      throw new Error(`reset propose failed: ${JSON.stringify(res.body)}`);
    }
    return {
      ticketId: res.body.data.ticket.ticketId,
      fingerprint: res.body.data.payloadFingerprint,
    };
  }

  it('redeems a fresh ticket and resets the registry end-to-end', async () => {
    const audit = vi.fn().mockResolvedValue(undefined);
    _setLayoutCapacityAdminDependenciesForTests({ recordAudit: audit });

    // Apply an override so the reset has work to do.
    applyLayoutCapacityOverrides(
      { densityBudgets: { balanced: { titleMaxChars: 100 } } },
      'org-Sys'
    );
    applyLayoutCapacityOverrides(
      { densityBudgets: { balanced: { titleMaxChars: 140 } } },
      'org-Other'
    );
    expect(getLayoutCapacitySnapshot('org-Sys').densityBudgets.balanced.titleMaxChars).toBe(100);

    const router = await importRouter();
    const reason = 'returning to defaults after S17 experiment';
    const { ticketId } = await proposeResetViaRoute(router, { reason });

    const req = createMockReq({
      url: '/admin/layout-capacity/reset/execute',
      path: '/admin/layout-capacity/reset/execute',
      body: { approvalTicket: ticketId, reason },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/reset/execute', req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ticketId).toBe(ticketId);
    expect(res.body.data.auditEvent).toBe('presentation_studio_layout_capacity_overrides_reset');
    expect(res.body.data.registrySnapshotBefore.densityBudgets.balanced.titleMaxChars).toBe(100);
    // Post-state matches canonical defaults.
    expect(res.body.data.registrySnapshotAfter.densityBudgets.balanced.titleMaxChars).not.toBe(100);

    expect(audit).toHaveBeenCalledTimes(1);
    expect(getLayoutCapacitySnapshot('org-Sys').densityBudgets.balanced.titleMaxChars).not.toBe(
      100
    );
    expect(getLayoutCapacitySnapshot('org-Other').densityBudgets.balanced.titleMaxChars).toBe(140);
  });

  it('returns 403 PRECONDITION_REQUIRED when no ticket id is supplied', async () => {
    const router = await importRouter();
    const req = createMockReq({
      url: '/admin/layout-capacity/reset/execute',
      path: '/admin/layout-capacity/reset/execute',
      body: { reason: 'rationale' },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/reset/execute', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('PRECONDITION_REQUIRED');
  });

  it('returns 403 INVALID_APPROVAL_TICKET when the ticket id is unknown', async () => {
    const audit = vi.fn().mockResolvedValue(undefined);
    _setLayoutCapacityAdminDependenciesForTests({ recordAudit: audit });
    const router = await importRouter();
    const req = createMockReq({
      url: '/admin/layout-capacity/reset/execute',
      path: '/admin/layout-capacity/reset/execute',
      body: { approvalTicket: 'pssa_does_not_exist', reason: 'rationale' },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/reset/execute', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('INVALID_APPROVAL_TICKET');
    expect(res.body.reason).toBe('not_found');
    expect(audit).not.toHaveBeenCalled();
  });

  it('returns 403 payload_mismatch when reason changes between propose and execute', async () => {
    const audit = vi.fn().mockResolvedValue(undefined);
    _setLayoutCapacityAdminDependenciesForTests({ recordAudit: audit });
    applyLayoutCapacityOverrides(
      { densityBudgets: { balanced: { titleMaxChars: 100 } } },
      'org-Sys'
    );
    const router = await importRouter();
    const { ticketId } = await proposeResetViaRoute(router, { reason: 'rationale A' });
    const req = createMockReq({
      url: '/admin/layout-capacity/reset/execute',
      path: '/admin/layout-capacity/reset/execute',
      body: { approvalTicket: ticketId, reason: 'rationale B' }, // CHANGED
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/reset/execute', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('INVALID_APPROVAL_TICKET');
    expect(res.body.reason).toBe('payload_mismatch');
    expect(audit).not.toHaveBeenCalled();
    // Registry was NOT reset.
    expect(getLayoutCapacitySnapshot('org-Sys').densityBudgets.balanced.titleMaxChars).toBe(100);
  });

  it('returns 403 PERMISSION_DENIED for OWNER trying to execute a reset', async () => {
    setAuth({
      user: { id: 'owner-1', organizationId: 'org-A', role: 'OWNER' },
      userRole: 'OWNER',
    });
    const router = await importRouter();
    const req = createMockReq({
      url: '/admin/layout-capacity/reset/execute',
      path: '/admin/layout-capacity/reset/execute',
      body: { approvalTicket: 'pssa_x', reason: 'r' },
    });
    const res = createMockRes();
    await runRouter(router, 'POST', '/admin/layout-capacity/reset/execute', req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });
});
