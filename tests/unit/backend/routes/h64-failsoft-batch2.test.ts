/**
 * H6.4 — BATCH 2: fail-soft/fail-closed sanity tests for the handlers unified
 * in this pass (conversations.routes.ts — full file — + 4 hottest handlers
 * in ai.routes.ts: /context ×2, /chat, /trigger-notification).
 *
 * Proves the degrade-not-crash contract from docs/standards/ERROR_HANDLING_STANDARD.md:
 *   - reads that are side-panel enrichment (conversation sessions, message
 *     attachments, AI context assembly) degrade to 200 + `degraded: true` with a
 *     safe empty default when the underlying subsystem throws — never a bare 500.
 *   - writes and primary-content reads (get/update/delete a conversation, add a
 *     message, delete a conversation, trigger an AI notification, the AI chat
 *     endpoint itself) stay fail-closed: a real 5xx with a stable `code`, WITHOUT
 *     leaking `err.message`/raw DB errors to the client.
 *   - happy paths are unchanged (contract-preserving).
 *
 * Services are mocked (subsystem-down simulation) — this is a fast unit test, not
 * the tests/acceptance/ real-DB parity harness.
 *
 * NOTE: all `vi.mock(...)` calls (and the mock fns they close over) live at
 * module top-level, not inside `describe()` bodies — vi.mock is hoisted above
 * imports/const declarations, so a factory that closes over a variable declared
 * inside a describe callback throws "X is not defined" at import time.
 */
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// conversations.routes.ts mocks
// ---------------------------------------------------------------------------
const dbGetMock = vi.fn();
const dbAllMock = vi.fn();
const dbRunMock = vi.fn();

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'ADMIN' };
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    next();
  },
}));

vi.mock('../../../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: any) => next(),
  validateParams: () => (_req: any, _res: any, next: any) => next(),
  validateQuery: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../../server/src/services/chatPermissionService.js', () => ({
  checkChatPermission: vi.fn(async () => ({ allowed: true })),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGetMock(...args),
  all: (...args: any[]) => dbAllMock(...args),
  run: (...args: any[]) => dbRunMock(...args),
}));

vi.mock(
  '../../../../server/src/services/organizationContext/OrganizationContextService.js',
  () => ({
    default: { recordChatMessage: vi.fn(async () => ({ itemId: 'ctx-1' })) },
  })
);

vi.mock('../../../../server/src/services/ai/AIPipeline.js', () => ({
  AIPipeline: class {
    process() {
      return Promise.resolve({ text: 'irrelevant for this batch' });
    }
  },
}));

// ---------------------------------------------------------------------------
// ai.routes.ts mocks
// ---------------------------------------------------------------------------
const buildContext = vi.fn();
const processMessage = vi.fn();
const logSuggestion = vi.fn();
const triggerAIRiskDetected = vi.fn();

vi.mock('../../../../server/src/services/aiContextBuilder.js', () => ({
  default: { buildContext: (...args: any[]) => buildContext(...args) },
}));

vi.mock('../../../../server/src/services/aiOrchestrator.js', () => ({
  default: {
    processMessage: (...args: any[]) => processMessage(...args),
    getRoleDescription: (role: string) => `desc:${role}`,
  },
}));

vi.mock('../../../../server/src/services/aiAuditLogger.js', () => ({
  default: { logSuggestion: (...args: any[]) => logSuggestion(...args) },
}));

vi.mock('../../../../server/src/services/aiNotificationTriggers.js', () => ({
  triggerAIRiskDetected: (...args: any[]) => triggerAIRiskDetected(...args),
  triggerAIRecommendation: vi.fn(),
  triggerAIOverloadDetected: vi.fn(),
  triggerAIDependencyConflict: vi.fn(),
}));

// ============================================================================
// 1. conversations.routes.ts
// ============================================================================
describe('conversations.routes.ts — fail-soft/fail-closed batch 2 (H6.4)', () => {
  let app: express.Express;
  const CONV_ID = '11111111-1111-4111-8111-111111111111';

  beforeAll(async () => {
    const conversationsRoutes = (
      await import('../../../../server/src/routes/conversations.routes.ts')
    ).default;
    const { correlationMiddleware } = await import(
      '../../../../server/src/utils/RequestStore.js'
    );
    const { errorHandlerMiddleware } = await import('../../../../server/src/utils/ErrorHandler.js');

    app = express();
    app.use(correlationMiddleware);
    app.use(express.json());
    app.use('/api/conversations', conversationsRoutes);
    app.use(errorHandlerMiddleware);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /:id — main content read stays fail-closed: 500 + code, no err.message leak', async () => {
    dbGetMock.mockResolvedValueOnce({ id: CONV_ID, user_id: 'user-1', archived: false });
    dbAllMock.mockRejectedValueOnce(new Error('CONV_MESSAGES_DB_CRASH'));

    const res = await request(app)
      .get(`/api/conversations/${CONV_ID}`)
      .set('X-Correlation-ID', 'batch2-get-fail-1');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('CONVERSATIONS_GET_FAILED');
    expect(res.body.correlationId).toBe('batch2-get-fail-1');
    expect(JSON.stringify(res.body)).not.toContain('CONV_MESSAGES_DB_CRASH');
  });

  it('POST /:id/messages — core chat write stays fail-closed: 500 + code, no err.message leak', async () => {
    dbGetMock
      .mockResolvedValueOnce({ id: CONV_ID, user_id: 'user-1' }) // findAccessibleConversation
      .mockResolvedValueOnce(undefined) // getTeamProjectForConversation
      .mockResolvedValueOnce({ next: 1 }); // seqRow
    dbRunMock.mockRejectedValueOnce(new Error('INSERT_MESSAGE_DB_CRASH'));

    const res = await request(app)
      .post(`/api/conversations/${CONV_ID}/messages`)
      .send({ role: 'user', content: 'hello' })
      .set('X-Correlation-ID', 'batch2-addmsg-fail-1');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('CONVERSATIONS_ADD_MESSAGE_FAILED');
    expect(res.body.correlationId).toBe('batch2-addmsg-fail-1');
    expect(JSON.stringify(res.body)).not.toContain('INSERT_MESSAGE_DB_CRASH');
  });

  it('DELETE /:id?force=true — purge write stays fail-closed: 500 + code, no err.message leak', async () => {
    dbGetMock
      .mockResolvedValueOnce({
        id: CONV_ID,
        user_id: 'user-1',
        deleted_at: '2026-01-01T00:00:00Z',
      }) // findAccessibleConversation (already soft-deleted)
      .mockResolvedValueOnce(undefined) // getTeamProjectForConversation
      .mockResolvedValueOnce({ cnt: 0 }); // msgCountRow
    dbRunMock
      .mockRejectedValueOnce(new Error('AUDIT_INSERT_CRASH')) // audit insert (swallowed internally)
      .mockRejectedValueOnce(new Error('DELETE_MESSAGES_DB_CRASH')); // propagates to outer catch

    const res = await request(app)
      .delete(`/api/conversations/${CONV_ID}?force=true`)
      .set('X-Correlation-ID', 'batch2-delete-fail-1');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('CONVERSATIONS_DELETE_FAILED');
    expect(res.body.correlationId).toBe('batch2-delete-fail-1');
    expect(JSON.stringify(res.body)).not.toContain('DELETE_MESSAGES_DB_CRASH');
  });

  it('GET /:id/sessions — side-panel enrichment degrades to 200 + empty list (no 500)', async () => {
    dbGetMock.mockResolvedValueOnce({ id: CONV_ID, user_id: 'user-1' });
    dbAllMock.mockRejectedValueOnce(new Error('SESSIONS_TABLE_CRASH'));

    const res = await request(app).get(`/api/conversations/${CONV_ID}/sessions`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ sessions: [], degraded: true }));
    expect(JSON.stringify(res.body)).not.toContain('SESSIONS_TABLE_CRASH');
  });

  it('GET /:id/sessions — happy path unchanged (contract-preserving)', async () => {
    dbGetMock.mockResolvedValueOnce({ id: CONV_ID, user_id: 'user-1' });
    dbAllMock.mockResolvedValueOnce([{ id: 's1', model_id: 'x' }]);

    const res = await request(app).get(`/api/conversations/${CONV_ID}/sessions`);

    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(1);
    expect(res.body.degraded).toBeUndefined();
  });

  it('GET /:id/messages/:messageId/attachments — enrichment degrades to 200 + empty list (no 500)', async () => {
    dbGetMock.mockResolvedValueOnce({ id: CONV_ID, user_id: 'user-1' });
    dbAllMock.mockRejectedValueOnce(new Error('ATTACHMENTS_TABLE_CRASH'));

    const res = await request(app).get(
      `/api/conversations/${CONV_ID}/messages/msg-1/attachments`
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ attachments: [], degraded: true }));
    expect(JSON.stringify(res.body)).not.toContain('ATTACHMENTS_TABLE_CRASH');
  });
});

// ============================================================================
// 2. ai.routes.ts — /context (×2), /chat, /trigger-notification
// ============================================================================
describe('ai.routes.ts — fail-soft/fail-closed batch 2 (H6.4)', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origBypass = process.env.ENABLE_TEST_AUTH_BYPASS;

  let router: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    router = (await import('../../../../server/src/routes/ai.routes.ts')).default;
  });

  afterAll(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origBypass === undefined) delete process.env.ENABLE_TEST_AUTH_BYPASS;
    else process.env.ENABLE_TEST_AUTH_BYPASS = origBypass;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.correlationId = 'batch2-ai-corr-1';
      next();
    });
    app.use('/api/ai', router);
    return app;
  }

  it('GET /api/ai/context — non-critical enrichment degrades to 200 (no 500)', async () => {
    buildContext.mockRejectedValueOnce(new Error('CONTEXT_BUILDER_DB_CRASH'));

    const res = await request(makeApp()).get('/api/ai/context?screen=dashboard');

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('CONTEXT_BUILDER_DB_CRASH');
  });

  it('POST /api/ai/chat — core generation stays fail-closed: 500 + code, no err.message leak', async () => {
    processMessage.mockRejectedValueOnce(new Error('AIPipeline: provider secret leak test'));

    const res = await request(makeApp()).post('/api/ai/chat').send({ message: 'hello' });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('AI_CHAT_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('provider secret leak test');
  });

  it('POST /api/ai/chat — budget-exhausted path is unaffected by the refactor (403 + code)', async () => {
    const budgetErr: any = new Error('budget exhausted');
    budgetErr.isBudgetError = true;
    budgetErr.budgetStatus = { remaining: 0 };
    processMessage.mockRejectedValueOnce(budgetErr);

    const res = await request(makeApp()).post('/api/ai/chat').send({ message: 'hello' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AI_BUDGET_EXHAUSTED');
    expect(res.body.budgetStatus).toEqual({ remaining: 0 });
  });

  it('POST /api/ai/chat — happy path unchanged (contract-preserving)', async () => {
    processMessage.mockResolvedValueOnce({
      role: 'assistant',
      intent: 'chat',
      contextSummary: 'ctx',
      responseContext: { dataSources: [] },
      prompt: 'p',
    });

    const res = await request(makeApp()).post('/api/ai/chat').send({ message: 'hello' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('assistant');
  });

  it('POST /api/ai/trigger-notification — write stays fail-closed: 500 + code, no err.message leak', async () => {
    triggerAIRiskDetected.mockRejectedValueOnce(new Error('NOTIFICATION_INSERT_DB_CRASH'));

    const res = await request(makeApp()).post('/api/ai/trigger-notification').send({
      type: 'AI_RISK_DETECTED',
      title: 'Risk',
      description: 'desc',
    });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('AI_NOTIFICATION_TRIGGER_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('NOTIFICATION_INSERT_DB_CRASH');
  });
});
