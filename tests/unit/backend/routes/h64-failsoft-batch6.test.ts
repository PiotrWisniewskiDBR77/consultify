/**
 * H6.4 batch 6 (FINAŁ) — closes out the remaining bare
 * `res.status(500).json({ error: err.message })` handlers across 13 routers,
 * per docs/standards/ERROR_HANDLING_STANDARD.md:
 *   - assessment-workflow-v2.routes.ts, assessment/assessment-hub.routes.ts,
 *     assessment/assessment-workflow.routes.ts, billing/billing.routes.ts,
 *     helpChat.routes.ts, my-work.routes.ts, my-work/calendar.routes.ts,
 *     organization/branding.routes.ts, syncHub.routes.ts,
 *     table-platform.routes.ts, user/users.routes.ts, users.routes.ts,
 *     v8/sync.routes.ts.
 *
 * Classification:
 *   - writes (access-request create/approve/reject/cancel, role assign/
 *     update/remove, manual initiative create, billing subscribe/change-plan/
 *     cancel, help feedback, chat-actions, branding update/delete/clone/
 *     verify-domain, sync trigger, table batch records, avatar upload/
 *     remove, user update/delete) and primary-content reads (branding list/
 *     get, users list/get, unified calendar) stay fail-closed: real 5xx with
 *     a stable `code`, WITHOUT leaking `err.message`.
 *   - enrichment (AI suggestions/table-action/fill/generate panels, presence
 *     broadcast, typeahead user search) degrades to 200 + a safe default
 *     (`degraded: true`) instead of a bare 500.
 *
 * Services/DB are mocked (subsystem-down simulation) — fast unit tests, not
 * the tests/acceptance/ real-DB parity harness.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

// ============================================================================
// 1. assessment-workflow-v2.routes.ts
// ============================================================================
describe('/api/assessment-workflow-v2/* — access-request/role writes fail-closed (H6.4 batch6)', () => {
  const assessmentPermissionService = {
    createAccessRequest: vi.fn(),
    getAssessmentAdmins: vi.fn().mockResolvedValue([]),
    approveAccessRequest: vi.fn(),
    rejectAccessRequest: vi.fn(),
    cancelAccessRequest: vi.fn(),
    hasPermission: vi.fn().mockResolvedValue(true),
    getUserRole: vi.fn(),
    assignRole: vi.fn(),
    removeRole: vi.fn(),
    getAccessRequests: vi.fn(),
  };

  beforeEach(() => {
    Object.values(assessmentPermissionService).forEach((fn) => fn.mockClear?.());
    assessmentPermissionService.hasPermission.mockResolvedValue(true);
    assessmentPermissionService.getAssessmentAdmins.mockResolvedValue([]);

    vi.doMock('../../../../server/src/controllers/AssessmentController.js', () => ({
      default: new Proxy(
        {},
        { get: () => (_req: any, res: any) => res.status(200).json({ ok: true }) }
      ),
    }));
    vi.doMock('../../../../server/src/middleware/auth.middleware.js', () => ({
      verifyToken: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' };
        req.userId = 'user-1';
        req.userRole = 'ADMIN';
        req.organizationId = 'org-1';
        next();
      },
    }));
    vi.doMock('../../../../server/src/middleware/demoGuard.middleware.js', () => ({
      demoContextMiddleware: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/middleware/validation.middleware.js', () => ({
      validateBody: () => (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/database/index.js', () => ({ getDatabase: vi.fn() }));
    vi.doMock('../../../../server/src/services/ActivityService.js', () => ({
      default: { log: vi.fn().mockResolvedValue(undefined) },
    }));
    vi.doMock('../../../../server/src/services/ai/industryBenchmarkService.js', () => ({
      default: {},
    }));
    vi.doMock(
      '../../../../server/src/services/assessmentInitiativeGenerationRunService.js',
      () => ({ default: {} })
    );
    vi.doMock('../../../../server/src/services/assessmentPermissionService.js', () => ({
      default: assessmentPermissionService,
    }));
    vi.doMock('../../../../server/src/services/benchmarkingService.js', () => ({ default: {} }));
    vi.doMock('../../../../server/src/services/notificationService.js', () => ({
      default: { send: vi.fn().mockResolvedValue(undefined) },
    }));
    vi.doMock('../../../../server/src/utils/queryHelpers.js', () => ({
      queryAll: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn().mockResolvedValue(null),
      queryRun: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('../../../../server/src/validators/assessment.validators.js', () => ({
      CreateAssessmentSchema: {},
      UpdateAssessmentSchema: {},
      RequestReviewSchema: {},
      GenerateReportSchema: {},
      ApproveReportSchema: {},
      ApproveAssessmentSchema: {},
      SendBackSchema: {},
      GenerateInitiativesSchema: {},
      UpsertAssignmentSchema: {},
      AssignAssessmentRoleSchema: {},
      UpsertAssessmentRoleSchema: {},
      UpdateUserStateSchema: {},
      CreateInitiativeGenerationRunSchema: {},
      CreateManualInitiativeFromAssessmentSchema: {},
      ApproveAssessmentAccessRequestSchema: {},
      RejectAssessmentAccessRequestSchema: {},
    }));
  });

  async function loadApp() {
    const { default: router } = await import(
      '../../../../server/src/routes/assessment-workflow-v2.routes.js'
    );
    const app = express();
    app.use(express.json());
    app.use('/api/assessment-workflow-v2', router);
    return app;
  }

  it('POST /:id/access-requests (write) stays fail-closed: 500 + code, no err.message leak', async () => {
    assessmentPermissionService.createAccessRequest.mockRejectedValue(
      new Error('duplicate key value violates unique constraint xyz')
    );
    const app = await loadApp();

    const res = await request(app)
      .post('/api/assessment-workflow-v2/asmt-1/access-requests')
      .send({ requestedRole: 'manager' });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('ASSESSMENT_ACCESS_REQUEST_CREATE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('duplicate key');
  });

  it('DELETE /:id/roles/:userId (write) stays fail-closed: 500 + code, no err.message leak', async () => {
    assessmentPermissionService.removeRole.mockRejectedValue(
      new Error('db unreachable at 10.0.0.5')
    );
    const app = await loadApp();

    const res = await request(app).delete(
      '/api/assessment-workflow-v2/asmt-1/roles/target-user'
    );

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('ASSESSMENT_ROLE_REMOVE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });
});

// ============================================================================
// 2. assessment/assessment-hub.routes.ts
// ============================================================================
describe('/api/assessments/canonical-index — read stays fail-closed (H6.4 batch6)', () => {
  beforeEach(() => {
    vi.doMock('../../../../server/src/middleware/auth.middleware.js', () => ({
      verifyToken: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-1', organizationId: 'org-1' };
        next();
      },
    }));
    vi.doMock('../../../../server/src/middleware/demoGuard.middleware.js', () => ({
      demoContextMiddleware: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/utils/requestOrganization.js', () => ({
      requireRequestOrganizationId: (req: any) => req.user?.organizationId || null,
    }));
    vi.doMock('../../../../server/src/database/index.js', () => ({
      // The route's inner query promise is already locally fail-soft
      // (`.catch(() => [])`), so a DB-callback error alone never reaches the
      // outer catch this batch hardened — force a synchronous throw instead,
      // simulating a genuinely unexpected failure (e.g. no DB pool available).
      getDatabase: () => {
        throw new Error('relation "assessment_reports" does not exist');
      },
    }));
  });

  async function loadApp() {
    const { default: router } = await import(
      '../../../../server/src/routes/assessment/assessment-hub.routes.js'
    );
    const app = express();
    app.use(express.json());
    app.use('/api/assessments', router);
    return app;
  }

  it('GET /canonical-index stays fail-closed: 500 + code, no err.message leak', async () => {
    const app = await loadApp();
    const res = await request(app).get('/api/assessments/canonical-index');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('ASSESSMENT_CANONICAL_INDEX_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('does not exist');
  });
});

// ============================================================================
// 3. assessment/assessment-workflow.routes.ts
// ============================================================================
describe('/api/assessment-workflow/* — access-request writes fail-closed (H6.4 batch6)', () => {
  const assessmentPermissionService = {
    createAccessRequest: vi.fn(),
    getAssessmentAdmins: vi.fn().mockResolvedValue([]),
    hasPermission: vi.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    Object.values(assessmentPermissionService).forEach((fn) => fn.mockClear?.());
    assessmentPermissionService.hasPermission.mockResolvedValue(true);
    assessmentPermissionService.getAssessmentAdmins.mockResolvedValue([]);

    vi.doMock('../../../../server/src/middleware/auth.middleware.js', () => ({
      verifyToken: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-1', organizationId: 'org-1', role: 'ADMIN' };
        next();
      },
    }));
    vi.doMock('../../../../server/src/services/assessmentPermissionService.js', () => ({
      default: assessmentPermissionService,
    }));
    vi.doMock('../../../../server/src/services/notificationService.js', () => ({
      default: { send: vi.fn().mockResolvedValue(undefined) },
    }));
    vi.doMock('../../../../server/src/database/index.js', () => ({
      getDatabase: () => ({
        get: (_sql: string, _params: any[], cb: (err: Error | null, row: any) => void) =>
          cb(null, { name: 'Assessment X' }),
      }),
    }));
  });

  async function loadApp() {
    const { default: router } = await import(
      '../../../../server/src/routes/assessment/assessment-workflow.routes.js'
    );
    const app = express();
    app.use(express.json());
    app.use('/api/assessment-workflow', router);
    return app;
  }

  it('POST /:id/access-requests (write) stays fail-closed: 500 + code, no err.message leak', async () => {
    assessmentPermissionService.createAccessRequest.mockRejectedValue(
      new Error('constraint violation xyz')
    );
    const app = await loadApp();

    const res = await request(app)
      .post('/api/assessment-workflow/asmt-1/access-requests')
      .send({ requestedRole: 'manager', justification: 'Need access for onboarding' });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('ASSESSMENT_ACCESS_REQUEST_CREATE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('constraint violation');
  });
});

// ============================================================================
// 4. billing/billing.routes.ts
// ============================================================================
describe('/api/billing/* — subscription writes fail-closed (H6.4 batch6)', () => {
  const billingService = {
    changePlan: vi.fn(),
    createSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
  };

  beforeEach(() => {
    Object.values(billingService).forEach((fn) => fn.mockClear?.());
    vi.doMock('../../../../server/src/middleware/auth.middleware.js', () => ({
      verifyToken: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-1', organizationId: 'org-1' };
        next();
      },
      requireSuperAdmin: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/middleware/validation.middleware.js', () => ({
      validateBody: () => (_req: any, _res: any, next: any) => next(),
      validateParams: () => (_req: any, _res: any, next: any) => next(),
      validateQuery: () => (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/services/BillingWebhookService.js', () => ({
      default: {},
      BILLING_EVENT_TYPES: {},
    }));
    vi.doMock('../../../../server/src/services/BillingService.js', () => billingService);
  });

  async function loadApp() {
    const { default: router } = await import(
      '../../../../server/src/routes/billing/billing.routes.js'
    );
    const app = express();
    app.use(express.json());
    app.use('/api/billing', router);
    return app;
  }

  it('POST /change-plan (write) stays fail-closed: 500 + code, no err.message leak', async () => {
    billingService.changePlan.mockRejectedValue(
      new Error('Stripe: no such subscription sub_secret123')
    );
    const app = await loadApp();

    const res = await request(app)
      .post('/api/billing/change-plan')
      .send({ newPlanId: 'plan-pro' });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('BILLING_CHANGE_PLAN_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('sub_secret123');
  });
});

// ============================================================================
// 5. helpChat.routes.ts
// ============================================================================
describe('/api/help/feedback — write stays fail-closed (H6.4 batch6)', () => {
  beforeEach(() => {
    vi.doMock('../../../../server/src/middleware/auth.middleware.js', () => ({
      verifyToken: (req: any, _res: any, next: any) => {
        req.userId = 'user-1';
        req.organizationId = 'org-1';
        req.user = { id: 'user-1', organizationId: 'org-1' };
        next();
      },
    }));
    vi.doMock('../../../../server/src/middleware/validation.middleware.js', () => ({
      validateBody: () => (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/services/ai/helpDocsContext.js', () => ({
      buildHelpDocsContext: vi.fn().mockResolvedValue({ citations: [] }),
      isProductOrHowToQuery: vi.fn().mockReturnValue(false),
    }));
    // Force the try block to throw deterministically (logger.info explodes).
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: {
        info: vi.fn(() => {
          throw new Error('log sink unreachable at 10.0.0.9');
        }),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    }));
  });

  afterEach(() => {
    // vi.doMock registrations outlive vi.resetModules() (only the module
    // cache is cleared, not the mock factory) — undo the throwing Logger
    // mock so later describe blocks in this file don't inherit it.
    vi.doUnmock('../../../../server/src/utils/Logger.js');
  });

  async function loadApp() {
    const { default: router } = await import(
      '../../../../server/src/routes/helpChat.routes.js'
    );
    const app = express();
    app.use(express.json());
    app.use('/api/help', router);
    return app;
  }

  it('POST /feedback (write) stays fail-closed: 500 + code, no err.message leak', async () => {
    const app = await loadApp();

    const res = await request(app)
      .post('/api/help/feedback')
      .send({ content_type: 'article', content_id: 'a1', is_helpful: true });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('HELP_FEEDBACK_SUBMIT_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.9');
  });
});

// ============================================================================
// 6. my-work.routes.ts — chat-actions (write) + ai-suggestions (enrichment)
// ============================================================================
describe('/api/my-work/* — chat-actions write fail-closed, ai-suggestions degrade (H6.4 batch6)', () => {
  const queryAllMock = vi.fn().mockResolvedValue([]);
  const queryRunMock = vi.fn().mockResolvedValue(undefined);
  const queryOneMock = vi.fn().mockResolvedValue(null);
  const orgContextBuildMock = vi.fn().mockResolvedValue({
    profile: {},
    strategic: { priorities: [] },
    operations: { constraints: [] },
  });

  beforeEach(() => {
    queryAllMock.mockClear();
    queryRunMock.mockClear();
    queryOneMock.mockClear();

    vi.doMock('../../../../server/src/middleware/auth.middleware.js', () => ({
      verifyToken: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-1', organizationId: 'org-1', role: 'ADMIN' };
        req.userId = 'user-1';
        req.organizationId = 'org-1';
        next();
      },
      validateOrgMembership: (_req: any, _res: any, next: any) => next(),
      requireRole:
        (..._roles: string[]) =>
        (_req: any, _res: any, next: any) =>
          next(),
    }));
    vi.doMock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/middleware/demoGuard.middleware.js', () => ({
      demoContextMiddleware: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/middleware/requireAudit.middleware.js', () => ({
      requireAudit: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/utils/queryHelpers.js', () => ({
      queryAll: (...args: any[]) => queryAllMock(...args),
      queryRun: (...args: any[]) => queryRunMock(...args),
      queryOne: (...args: any[]) => queryOneMock(...args),
    }));
    vi.doMock('../../../../server/src/utils/dbSchema.js', () => ({
      getTableColumns: vi.fn(async () => new Set(['id', 'organization_id', 'title'])),
    }));
    vi.doMock('../../../../server/src/services/AuditEventsService.js', () => ({
      default: { log: vi.fn(async () => 'audit-event-1') },
    }));
    vi.doMock('../../../../server/src/services/inboxService.js', () => ({
      default: { getInboxStats: vi.fn(async () => ({})) },
    }));
    vi.doMock(
      '../../../../server/src/services/organizationContext/OrganizationContextService.js',
      () => ({
        default: {
          buildResolvedContext: (...args: any[]) => orgContextBuildMock(...args),
          recordChatMessage: vi.fn(async () => ({ itemId: 'ctx-1' })),
        },
      })
    );
    vi.doMock('../../../../server/src/services/v8/artifactRegistryService.js', () => ({
      listMyWorkArtifacts: vi.fn(async () => ({ mine: [], review: [], recent: [] })),
    }));
    vi.doMock('../../../../server/src/services/homeCoverFeedService.js', () => ({
      getAiNews: vi.fn(async () => []),
      pickTipOfDay: vi.fn(() => ({ appTip: 'tip', aiPlaybookTip: 'playbook' })),
    }));
    vi.doMock('../../../../server/src/services/v8/executionVisibilityService.js', () => ({
      rollupSignals: vi.fn(async () => ({ byType: new Map(), byInitiative: new Map(), total: 0 })),
    }));
    vi.doMock('../../../../server/src/services/v8/collaborationRoomService.js', () => ({
      getActiveRoomsByOrg: vi.fn(async () => []),
      getRoomHealth: vi.fn(async () => null),
    }));
    vi.doMock('../../../../server/src/services/v8/planningContinuityService.js', () => ({
      default: {},
    }));
    vi.doMock('../../../../server/src/services/ideaClusterService.js', () => ({
      createOutcomeFromCluster: vi.fn(),
      materializeClusters: vi.fn(),
    }));
    vi.doMock('../../../../server/src/services/tablePlatform/ProjectionService.js', () => ({
      default: {},
    }));
    vi.doMock('../../../../server/src/validators/ideaWorkspaceGraph.validators.js', () => ({
      ensureLatestSchema: vi.fn(async () => ({})),
      normalizeGraphForStorage: vi.fn((v: any) => v),
      validateAndNormalizeGraph: vi.fn((v: any) => v),
    }));
    vi.doMock('../../../../server/src/services/ideaAISuggestionsService.js', () => ({
      generateSuggestions: vi.fn().mockRejectedValue(new Error('LLM_API_KEY=sk-secret-abc123')),
      generateTableAction: vi.fn(),
      generateAIFill: vi.fn(),
    }));
  });

  async function loadApp() {
    const { default: router } = await import(
      '../../../../server/src/routes/my-work.routes.js'
    );
    const app = express();
    app.use(express.json());
    app.use('/api/my-work', router);
    return app;
  }

  it('POST /chat-actions is retired with 410 and performs no direct write', async () => {
    const app = await loadApp();

    const res = await request(app)
      .post('/api/my-work/chat-actions')
      .send({ action: 'create_task', payload: { title: 'Test task' } });

    expect(res.status).toBe(410);
    expect(res.body).toMatchObject({
      code: 'MY_WORK_CHAT_DIRECT_WRITE_RETIRED',
      successor: '/my-work?tab=agent',
      directWritePerformed: false,
    });
    expect(queryRunMock).not.toHaveBeenCalled();
  });

  it('POST /my-ideas/:id/ai-suggestions degrades to 200 + degraded:true when the LLM call throws', async () => {
    queryOneMock.mockResolvedValue({ ok: 1 }); // ownership check passes
    const app = await loadApp();

    const res = await request(app)
      .post('/api/my-work/my-ideas/idea-1/ai-suggestions')
      .send({ context: { title: 'Idea' }, mode: 'passive' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ suggestions: [], companyContextUsed: false, degraded: true });
    expect(JSON.stringify(res.body)).not.toContain('sk-secret-abc123');
  });
});

// ============================================================================
// 7. my-work/calendar.routes.ts
// ============================================================================
describe('/api/my-work/calendar/unified — read stays fail-closed (H6.4 batch6)', () => {
  beforeEach(() => {
    vi.doMock('../../../../server/src/utils/dbSchema.js', () => ({
      getTableColumns: vi.fn().mockRejectedValue(new Error('relation "tasks" does not exist')),
    }));
    vi.doMock('../../../../server/src/utils/queryHelpers.js', () => ({
      queryAll: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn().mockResolvedValue(null),
      queryRun: vi.fn().mockResolvedValue(undefined),
    }));
  });

  async function loadApp() {
    const { default: router } = await import(
      '../../../../server/src/routes/my-work/calendar.routes.js'
    );
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.userId = 'user-1';
      req.organizationId = 'org-1';
      req.user = { id: 'user-1', organizationId: 'org-1' };
      next();
    });
    app.use('/api/my-work', router);
    return app;
  }

  it('GET /calendar/unified stays fail-closed: 500 + code, no err.message leak', async () => {
    const app = await loadApp();
    const res = await request(app).get('/api/my-work/calendar/unified');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('MY_WORK_CALENDAR_UNIFIED_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('does not exist');
  });
});

// ============================================================================
// 8. organization/branding.routes.ts
// ============================================================================
describe('/api/branding/* — read + delete write fail-closed (H6.4 batch6)', () => {
  const dbGet = vi.fn();
  const dbAll = vi.fn();
  const dbRun = vi.fn();

  beforeEach(() => {
    dbGet.mockReset();
    dbAll.mockReset();
    dbRun.mockReset();
    dbRun.mockResolvedValue({ changes: 1 });

    vi.doMock('../../../../server/src/middleware/auth.middleware.js', () => ({
      verifyToken: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-1', organizationId: 'org-1', role: 'SUPERADMIN' };
        next();
      },
    }));
    vi.doMock('../../../../server/src/middleware/requestAccess.js', () => ({
      isRequestSuperAdmin: () => true,
      getRequestAccessRole: () => 'superadmin',
    }));
    vi.doMock('../../../../server/src/middleware/superAdmin.middleware.js', () => ({
      verifySuperAdmin: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/services/organizationService.js', () => ({
      normalizeOrganizationRole: (r: string) => r,
    }));
    vi.doMock('../../../../server/src/utils/DbPromise.js', () => ({
      get: dbGet,
      all: dbAll,
      run: dbRun,
    }));
  });

  async function loadApp() {
    const { default: router } = await import(
      '../../../../server/src/routes/organization/branding.routes.js'
    );
    const app = express();
    app.use(express.json());
    app.use('/api/branding', router);
    return app;
  }

  it('GET /:orgId (primary content) stays fail-closed: 500 + code, no err.message leak', async () => {
    dbGet.mockRejectedValue(new Error('relation "organization_branding" does not exist'));
    const app = await loadApp();

    const res = await request(app).get('/api/branding/org-1');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('BRANDING_GET_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('does not exist');
  });

  it('DELETE /:orgId (write) stays fail-closed: 500 + code, no err.message leak', async () => {
    dbRun.mockRejectedValue(new Error('db unreachable at 10.0.0.5'));
    const app = await loadApp();

    const res = await request(app).delete('/api/branding/org-1');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('BRANDING_DELETE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });
});

// ============================================================================
// 9. syncHub.routes.ts
// ============================================================================
describe('/api/sync-hub/sync/:integrationId — write stays fail-closed (H6.4 batch6)', () => {
  const dbAll = vi.fn();
  const dbRun = vi.fn();
  const guardrails = {
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, warnings: [] }),
    recordRequest: vi.fn().mockResolvedValue(undefined),
    logSyncError: vi.fn().mockResolvedValue(undefined),
    getUnresolvedErrors: vi.fn().mockResolvedValue([]),
    resolveError: vi.fn(),
    getIntegrationHealth: vi.fn(),
  };
  const hub = {
    syncIntegration: vi.fn(),
    CONNECTORS: {},
    connectIntegration: vi.fn(),
    disconnectIntegration: vi.fn(),
    getConnectedIntegrations: vi.fn().mockResolvedValue([]),
    getSyncHistory: vi.fn().mockResolvedValue([]),
    updateIntegrationStatus: vi.fn(),
  };

  beforeEach(() => {
    dbAll.mockReset();
    dbRun.mockReset();
    dbRun.mockResolvedValue(undefined);
    guardrails.checkRateLimit.mockResolvedValue({ allowed: true, warnings: [] });
    guardrails.recordRequest.mockResolvedValue(undefined);
    guardrails.logSyncError.mockResolvedValue(undefined);
    hub.syncIntegration.mockReset();

    vi.doMock('../../../../server/src/middleware/auth.middleware.js', () => ({
      verifyToken: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-1', organizationId: 'org-1', firstName: 'Test', lastName: 'User' };
        next();
      },
      isAuthenticated: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/middleware/validation.middleware.js', () => ({
      validateBody: () => (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/services/integrationConnectionLogService.js', () => ({
      logIntegrationConnectionEvent: vi.fn(),
    }));
    vi.doMock('../../../../server/src/services/integrationHubService.js', () => hub);
    vi.doMock('../../../../server/src/services/integrationOwnershipService.js', () => ({
      setIntegrationOwner: vi.fn(),
    }));
    vi.doMock('../../../../server/src/services/syncExternalAuthSessionService.js', () => ({
      consumeSyncExternalAuthSession: vi.fn(),
    }));
    vi.doMock('../../../../server/src/services/syncGuardrailsService.js', () => guardrails);
    vi.doMock(
      '../../../../server/src/services/v8/pmSyncExternalAuthMaterializationService.js',
      () => ({
        materializeGovernedExternalAuthCallback: vi.fn(),
        shouldMaterializeCallbackDrivenAuth: vi.fn().mockReturnValue(false),
      })
    );
    vi.doMock('../../../../server/src/services/v8/pmSyncTruthService.js', () => ({
      setConnectorAuthState: vi.fn(),
    }));
    vi.doMock('../../../../server/src/utils/DbPromise.js', () => ({
      all: dbAll,
      run: dbRun,
    }));
  });

  async function loadApp() {
    const { default: router } = await import(
      '../../../../server/src/routes/syncHub.routes.js'
    );
    const app = express();
    app.use(express.json());
    app.use('/api/sync-hub', router);
    return app;
  }

  it('POST /sync/:integrationId (write) stays fail-closed: 500 + code, no err.message leak', async () => {
    dbAll.mockResolvedValue([{ connector_id: 'gmail', is_paused: false, status: 'connected' }]);
    hub.syncIntegration.mockRejectedValue(new Error('OAuth token leaked: ya29.secretXYZ'));
    const app = await loadApp();

    const res = await request(app).post('/api/sync-hub/sync/int-1');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('SYNC_HUB_SYNC_FAILED');
    expect(res.body.syncRunId).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain('ya29.secretXYZ');
  });
});

// ============================================================================
// 10. table-platform.routes.ts
// ============================================================================
describe('/api/table-platform/tables/:tableId/records/batch — write stays fail-closed (H6.4 batch6)', () => {
  const permissionsService = {
    requireBaseAccess: (_req: any, _res: any, next: any) => next(),
    requireTableAccess: (_req: any, _res: any, next: any) => next(),
    requireFieldAccess: (_req: any, _res: any, next: any) => next(),
    requireRecordAccess: (_req: any, _res: any, next: any) => next(),
    requireViewAccess: (_req: any, _res: any, next: any) => next(),
    requireGovernedModelAccess: (_req: any, _res: any, next: any) => next(),
    requireRoles: () => (_req: any, _res: any, next: any) => next(),
    requireRole: () => (_req: any, _res: any, next: any) => next(),
    SCHEMA_ROLES: ['owner'],
    DATA_ROLES: ['owner'],
    VIEW_ROLES: ['owner'],
    INTERFACE_ROLES: ['owner'],
    ALL_ROLES: ['owner'],
  };

  beforeEach(() => {
    vi.doMock('../../../../server/src/middleware/auth.middleware.js', () => ({
      verifyToken: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-1', organizationId: 'org-1' };
        req.userId = 'user-1';
        req.organizationId = 'org-1';
        next();
      },
      requireSuperAdmin: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/middleware/requireAudit.middleware.js', () => ({
      requireAudit: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/services/tablePlatform/PermissionsService.js', () => ({
      default: permissionsService,
    }));
  });

  async function loadApp(opts?: { corruptOperations?: boolean }) {
    const { default: router } = await import(
      '../../../../server/src/routes/table-platform.routes.js'
    );
    const app = express();
    app.use(express.json());
    if (opts?.corruptOperations) {
      // Force the route's OUTER catch (not the per-op inner catch): body-parser
      // always hands the handler a plain array, so the only in-process way to
      // exercise "something throws outside the inner try" is to swap in a
      // custom iterable *after* JSON parsing, before the router sees it — an
      // HTTP client can never smuggle a live iterator through the wire, this
      // simulates a corrupt/exotic runtime value reaching the loop.
      app.use('/api/table-platform/tables/:tableId/records/batch', (req: any, _res, next) => {
        // Still a real Array (Array.isArray must pass the route's guard), but
        // its iterator throws — the for..of loop invokes the iterator OUTSIDE
        // the per-op inner try/catch, so this reaches the route's outer catch.
        const operations: any = [];
        Object.defineProperty(operations, Symbol.iterator, {
          value: () => {
            throw new Error('internal secret db.query() failure at 10.0.0.7');
          },
          configurable: true,
        });
        req.body = { operations };
        next();
      });
    }
    app.use('/api/table-platform', router);
    return app;
  }

  it('POST /tables/:tableId/records/batch (write) stays fail-closed on an outer-scope throw: 500 + code, no err.message leak', async () => {
    const app = await loadApp({ corruptOperations: true });

    const res = await request(app)
      .post('/api/table-platform/tables/tbl-1/records/batch')
      .send({ operations: [] });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('TABLE_PLATFORM_BATCH_RECORDS_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.7');
  });

  it('POST /tables/:tableId/records/batch — per-item failure stays inside results (200), no crash', async () => {
    vi.doMock('../../../../server/src/services/tablePlatform/RecordsService.js', () => ({
      default: {
        createRecord: vi.fn().mockRejectedValue(new Error('constraint violation secret-xyz')),
      },
    }));
    const app = await loadApp();

    const res = await request(app)
      .post('/api/table-platform/tables/tbl-1/records/batch')
      .send({ operations: [{ type: 'create', data: { name: 'Row 1' } }] });

    expect(res.status).toBe(200);
    expect(res.body.results[0].error).toBeTruthy();
  });
});

// ============================================================================
// 11. user/users.routes.ts
// ============================================================================
describe('/api/users/:id/avatar (nested router) — remove-avatar write fail-closed (H6.4 batch6)', () => {
  const dbGet = vi.fn();
  const dbRun = vi.fn();

  beforeEach(() => {
    dbGet.mockReset();
    dbRun.mockReset();

    vi.doMock('../../../../server/src/controllers/UserController.js', () => ({
      default: new Proxy(
        {},
        { get: () => (_req: any, res: any) => res.status(200).json({ ok: true }) }
      ),
    }));
    vi.doMock('../../../../server/src/middleware/auth.middleware.js', () => ({
      verifyToken: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' };
        next();
      },
    }));
    vi.doMock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/middleware/validation.middleware.js', () => ({
      validateBody: () => (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/validators/user.validators.js', () => ({
      UpdateUserRoleSchema: {},
      UpdateUserSchema: {},
    }));
    vi.doMock('../../../../server/src/utils/DbPromise.js', () => ({
      get: dbGet,
      run: dbRun,
    }));
  });

  async function loadApp() {
    const { default: router } = await import(
      '../../../../server/src/routes/user/users.routes.js'
    );
    const app = express();
    app.use(express.json());
    app.use('/api/users', router);
    return app;
  }

  it('DELETE /:id/avatar (write) stays fail-closed: 500 + code, no err.message leak', async () => {
    dbGet.mockResolvedValue({ avatar_url: null });
    dbRun.mockRejectedValue(new Error('constraint violation secret-abc'));
    const app = await loadApp();

    const res = await request(app).delete('/api/users/user-1/avatar');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('USER_AVATAR_REMOVE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('secret-abc');
  });
});

// ============================================================================
// 12. users.routes.ts (top-level legacy router)
// ============================================================================
describe('/api/users — list read fail-closed, search degrades (H6.4 batch6)', () => {
  const dbAll = vi.fn();

  beforeEach(() => {
    dbAll.mockReset();
    vi.doMock('../../../../server/src/middleware/auth.middleware.js', () => ({
      verifyToken: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' };
        next();
      },
      requireRole:
        (..._roles: string[]) =>
        (_req: any, _res: any, next: any) =>
          next(),
    }));
    vi.doMock('../../../../server/src/utils/DbPromise.js', () => ({
      all: dbAll,
      get: vi.fn(),
      run: vi.fn(),
    }));
  });

  async function loadApp() {
    const { default: router } = await import(
      '../../../../server/src/routes/users.routes.js'
    );
    const app = express();
    app.use(express.json());
    app.use('/api/users', router);
    return app;
  }

  it('GET / (primary content) stays fail-closed: 500 + code, no err.message leak', async () => {
    dbAll.mockRejectedValue(new Error('relation "users" does not exist'));
    const app = await loadApp();

    const res = await request(app).get('/api/users/');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('USERS_LIST_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('does not exist');
  });

  it('GET /search degrades to 200 + empty array when the DB subsystem throws', async () => {
    dbAll.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432'));
    const app = await loadApp();

    const res = await request(app).get('/api/users/search?q=jo');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ users: [], degraded: true });
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });
});

// ============================================================================
// 13. v8/sync.routes.ts
// ============================================================================
describe('/api/v8/sync/integrations/:id/sync — write stays fail-closed (H6.4 batch6)', () => {
  const dbAll = vi.fn();
  const dbRun = vi.fn();
  const dbGet = vi.fn();
  const guardrails = {
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, warnings: [] }),
    recordRequest: vi.fn().mockResolvedValue(undefined),
    logSyncError: vi.fn().mockResolvedValue(undefined),
    getUnresolvedErrors: vi.fn().mockResolvedValue([]),
    resolveError: vi.fn(),
    getIntegrationHealth: vi.fn(),
  };
  const hub = {
    syncIntegration: vi.fn(),
    disconnectIntegration: vi.fn(),
    getConnectedIntegrations: vi.fn().mockResolvedValue([]),
    updateIntegrationStatus: vi.fn(),
    CONNECTORS: {
      apple_calendar: { id: 'apple_calendar', authType: 'token', name: 'Apple Calendar' },
    },
  };

  beforeEach(() => {
    dbAll.mockReset();
    dbRun.mockReset();
    dbGet.mockReset();
    dbRun.mockResolvedValue(undefined);
    guardrails.checkRateLimit.mockResolvedValue({ allowed: true, warnings: [] });
    guardrails.recordRequest.mockResolvedValue(undefined);
    guardrails.logSyncError.mockResolvedValue(undefined);
    hub.syncIntegration.mockReset();

    vi.doMock('../../../../server/src/middleware/v8Auth.middleware.js', () => ({
      getV8Context: () => ({
        organizationId: 'org-1',
        userId: 'user-1',
        userRole: 'admin',
        isSuperAdmin: false,
      }),
      attachV8Context: (_req: any, _res: any, next: any) => next(),
      requireV8OrgContext: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/middleware/auth.middleware.js', () => ({
      verifyToken: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-1', organizationId: 'org-1' };
        next();
      },
    }));
    vi.doMock('../../../../server/src/services/integrationConnectionLogService.js', () => ({
      logIntegrationConnectionEvent: vi.fn(),
    }));
    vi.doMock('../../../../server/src/services/integrationHubService.js', () => hub);
    vi.doMock('../../../../server/src/services/integrationOwnershipService.js', () => ({
      setIntegrationOwner: vi.fn(),
    }));
    vi.doMock('../../../../server/src/services/syncGuardrailsService.js', () => guardrails);
    vi.doMock('../../../../server/src/services/v8/pmSyncAuthService.js', () => ({
      getActiveEscalations: vi.fn().mockResolvedValue([]),
      getCredential: vi.fn().mockResolvedValue(null),
      getCredentialHealth: vi.fn(),
      getRefreshTimingPolicy: vi.fn().mockResolvedValue(null),
      recordAuthEscalation: vi.fn(),
      recordRefreshResult: vi.fn(),
      resolveAuthEscalation: vi.fn(),
      resolveAuthEscalationsForConnector: vi.fn(),
      setRefreshTimingPolicy: vi.fn(),
      storeCredential: vi.fn(),
    }));
    vi.doMock(
      '../../../../server/src/services/v8/pmSyncExternalAuthMaterializationService.js',
      () => ({
        buildGovernedExternalAuthSession: vi.fn(),
        getGovernedExternalAuthConfigFields: vi.fn(),
      })
    );
    vi.doMock('../../../../server/src/services/v8/pmSyncInventoryService.js', () => ({
      listGovernedIntegrations: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('../../../../server/src/services/v8/pmSyncRefreshExecutionService.js', () => ({
      executeRefreshExecution: vi.fn(),
      storeRefreshExecutionSecret: vi.fn(),
    }));
    vi.doMock('../../../../server/src/services/v8/pmSyncTruthService.js', () => ({
      getConnectorHealth: vi.fn(),
      getProviderCatalogState: vi.fn(),
      getUnresolvedConflicts: vi.fn().mockResolvedValue([]),
      listProviderCatalogStates: vi.fn().mockResolvedValue([]),
      resolveConflict: vi.fn(),
      setConnectorAuthState: vi.fn(),
      setProviderCatalogState: vi.fn(),
    }));
    vi.doMock('../../../../server/src/utils/DbPromise.js', () => ({
      all: dbAll,
      run: dbRun,
      get: dbGet,
    }));
  });

  async function loadApp() {
    const { default: router } = await import(
      '../../../../server/src/routes/v8/sync.routes.js'
    );
    const app = express();
    app.use(express.json());
    // This router reads identity via getV8Context(req) (mocked above) — it
    // does not apply verifyToken itself (that's done by the parent v8/index
    // router's attachV8Context in production). actorId still falls back to
    // req.user?.id / req.userId, so set those directly.
    app.use((req: any, _res, next) => {
      req.user = { id: 'user-1', organizationId: 'org-1' };
      req.userId = 'user-1';
      next();
    });
    app.use('/api/v8/sync', router);
    return app;
  }

  it('POST /integrations/:id/sync (write) stays fail-closed: 500 + code, no err.message leak', async () => {
    dbAll.mockResolvedValue([
      { connector_id: 'apple_calendar', is_paused: false, status: 'connected' },
    ]);
    hub.syncIntegration.mockRejectedValue(new Error('CalDAV secret token abc123 rejected'));
    const app = await loadApp();

    const res = await request(app).post('/api/v8/sync/integrations/int-1/sync');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('SYNC_FAILED');
    expect(res.body.syncRunId).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain('abc123');
  });
});
