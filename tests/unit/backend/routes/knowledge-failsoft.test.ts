/**
 * E-KNOW-01 — knowledge.routes.ts fail-soft sweep.
 *
 * Prior to the fix, every `catch` block in this router did:
 *   const message = err instanceof Error ? err.message : 'Unknown error';
 *   return res.status(500).json({ error: message });
 * which leaks internal error text (SQL, paths, stack fragments) straight to
 * the client — 20 occurrences total, per docs/standards/ERROR_HANDLING_STANDARD.md
 * §1/§3 ("Zero wycieku wnętrza").
 *
 * This test mounts the real router (deps mocked: auth passes through as an
 * authenticated SUPERADMIN, KnowledgeService throws a message containing a
 * secret-shaped string) and asserts:
 *   1. The response is still a fail-closed 500 with a stable `code`.
 *   2. The thrown error's message text never appears anywhere in the body.
 *   3. A `logger.error` call was made server-side with the real error detail
 *      (so nothing is silently swallowed — it's moved to the log, not deleted).
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

const SECRET_LEAK =
  'password authentication failed for user "consultinity_prod" at /var/secrets/db.conf:42';

describe('/api/knowledge/* — bare 500 err.message leak closed (E-KNOW-01)', () => {
  const loggerErrorSpy = vi.fn();

  beforeEach(() => {
    loggerErrorSpy.mockClear();

    vi.doMock('../../../../server/src/middleware/auth.middleware.js', () => ({
      verifyToken: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-1', role: 'SUPERADMIN', organizationId: 'org-1' };
        next();
      },
      requireSuperAdmin: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/middleware/quotaMiddleware.js', () => ({
      enforceStorageQuota: (_req: any, _res: any, next: any) => next(),
      recordStorageAfterUpload: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('../../../../server/src/middleware/projectQuota.middleware.js', () => ({
      enforceProjectQuota: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../../server/src/services/documentTextExtractor.js', () => ({
      extractTextFromFile: vi.fn().mockResolvedValue(''),
      isSupportedIngest: vi.fn().mockReturnValue(true),
    }));
    vi.doMock('../../../../server/src/services/KnowledgeService.js', () => ({
      default: {
        getCandidates: vi.fn().mockRejectedValue(new Error(SECRET_LEAK)),
      },
    }));
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: {
        error: loggerErrorSpy,
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      },
    }));
  });

  it('GET /candidates: 500 with stable code, no err.message leak, logged server-side', async () => {
    const { default: knowledgeRouter } = await import(
      '../../../../server/src/routes/knowledge.routes.js'
    );
    const app = express();
    app.use(express.json());
    app.use('/api/knowledge', knowledgeRouter);

    const res = await request(app)
      .get('/api/knowledge/candidates')
      .set('Authorization', 'Bearer test-token');

    // Fail-closed: real 500, not a silently-swallowed 200.
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('code', 'KNOWLEDGE_CANDIDATES_LIST_FAILED');

    // Zero wycieku: the internal error text never reaches the client body.
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain(SECRET_LEAK);
    expect(bodyText).not.toContain('consultinity_prod');
    expect(bodyText).not.toContain('/var/secrets');

    // Not silently swallowed: the real detail went to the server log instead
    // (Error objects don't JSON.stringify their .message — inspect it directly).
    expect(loggerErrorSpy).toHaveBeenCalled();
    const [, meta] = loggerErrorSpy.mock.calls[0];
    expect(meta.err).toBeInstanceOf(Error);
    expect(meta.err.message).toBe(SECRET_LEAK);
  });
});
