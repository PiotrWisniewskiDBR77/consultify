/**
 * REGRESJA R1 — ślad audytowy AI dla POST /api/ai/generate.
 *
 * Kontekst: noc naprawcza przepięła wywołania narzędzi z /ai/chat (który
 * logował przez AIAuditLogger.logSuggestion) na /ai/generate, który audytu NIE
 * prowadził — przez co wpisy zniknęły z rejestru w panelu administratora.
 * Audyt jest per-handler (nie w warstwie middleware), więc /generate musi
 * logować sam. Ten test montuje PRAWDZIWY router ai.routes i dowodzi, że
 * udane wywołanie /generate tworzy wpis audytu przez tę samą funkcję
 * (logSuggestion → logInteraction → INSERT INTO ai_audit_logs), którą czyta
 * panel admina (getAuditLogs).
 *
 * Wzorzec montażu (real router + supertest + zamockowane zależności) 1:1 z
 * tests/unit/backend/routes/h64-failsoft-batch2.test.ts.
 */
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// cheerio jest importowane na górze ai.routes.ts, a w tym worktree nie ma go
// w node_modules — mockujemy, żeby router w ogóle się załadował (nie dotyka
// ścieżki /generate).
vi.mock('cheerio', () => ({ load: vi.fn(() => ({})) }));

const logSuggestion = vi.fn(async () => ({ id: 'audit-1' }));
const selectModel = vi.fn(async () => ({
  id: 'test-model',
  provider: 'openrouter',
  endpoint: 'https://example/api',
  apiKey: 'k',
}));
const callText = vi.fn(async () => ({
  content: 'WYNIK-AI-DO-AUDYTU',
  usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
}));
const checkAccess = vi.fn(async () => ({ allowed: true }));
const incrementUsage = vi.fn(async () => undefined);

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

// ensureAiProviderAndAccess() reads a provider row via DbPromise.get; return a
// truthy row so the "no provider" branch is skipped.
vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: vi.fn(async () => ({ ok: 1 })),
  all: vi.fn(async () => []),
  run: vi.fn(async () => ({ success: true, changes: 1 })),
}));

vi.mock('../../../../server/src/services/accessPolicyService.js', () => ({
  default: {
    checkAccess: (...a: any[]) => checkAccess(...a),
    incrementUsage: (...a: any[]) => incrementUsage(...a),
  },
}));

vi.mock('../../../../server/src/services/ai/modelRouter.js', () => ({
  modelRouter: { select: (...a: any[]) => selectModel(...a) },
}));

vi.mock('../../../../server/src/services/ai/llmService.js', () => ({
  llmService: { callText: (...a: any[]) => callText(...a) },
}));

vi.mock('../../../../server/src/services/aiAuditLogger.js', () => ({
  default: { logSuggestion: (...a: any[]) => logSuggestion(...a) },
}));

describe('ai.routes.ts — POST /api/ai/generate zapisuje ślad audytowy (R1)', () => {
  const origKey = process.env.OPENROUTER_API_KEY;
  let router: any;

  beforeAll(async () => {
    process.env.OPENROUTER_API_KEY = 'test-key'; // hasEnvProvider === true
    router = (await import('../../../../server/src/routes/ai.routes.ts')).default;
  });

  afterAll(() => {
    if (origKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = origKey;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.correlationId = 'r1-generate-corr-1';
      next();
    });
    app.use('/api/ai', router);
    return app;
  }

  it('udane /generate → 200 { text } I dokładnie jeden wpis audytu z właściwymi polami', async () => {
    const res = await request(makeApp()).post('/api/ai/generate').send({
      message: 'Przeanalizuj to powiadomienie',
      systemInstruction: 'Zwróć tylko JSON',
      roleName: 'Notification Context Builder',
    });

    // Kontrakt endpointu nietknięty.
    expect(res.status).toBe(200);
    expect(res.body.text).toBe('WYNIK-AI-DO-AUDYTU');

    // Ślad audytowy powstał — dokładnie raz.
    expect(logSuggestion).toHaveBeenCalledTimes(1);

    const [userId, orgId, projectId, role, suggestion, context] = logSuggestion.mock.calls[0];
    expect(userId).toBe('user-1'); // KTO
    expect(orgId).toBe('org-1');
    expect(projectId).toBeNull();
    expect(role).toBe('Notification Context Builder'); // INTENCJA / rola
    expect(suggestion).toBe('WYNIK-AI-DO-AUDYTU'); // co AI zwróciło
    // Prompt + koszt tokenów w migawce kontekstu.
    expect(context).toMatchObject({
      source: 'ai/generate',
      userMessage: 'Przeanalizuj to powiadomienie',
      tokenUsage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
    });
  });

  it('awaria audytu NIE psuje odpowiedzi narzędzia (best-effort)', async () => {
    logSuggestion.mockRejectedValueOnce(new Error('AUDIT_DB_DOWN'));

    const res = await request(makeApp()).post('/api/ai/generate').send({
      message: 'x',
      roleName: 'Tool',
    });

    expect(res.status).toBe(200);
    expect(res.body.text).toBe('WYNIK-AI-DO-AUDYTU');
    expect(JSON.stringify(res.body)).not.toContain('AUDIT_DB_DOWN');
  });
});
