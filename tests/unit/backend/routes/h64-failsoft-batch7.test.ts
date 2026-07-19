/**
 * H6.4 batch 7 — 500-leak sweep (this session).
 *
 * Closes the remaining bare
 *   res.status(500).json({ error: 'Failed to X', message: err.message })
 * handlers that batches 1-6 (see h64-failsoft*.test.ts, knowledge-failsoft.test.ts)
 * did NOT cover — different endpoints within the same or sibling routers, per
 * docs/standards/ERROR_HANDLING_STANDARD.md §1/§3 ("Zero wycieku wnętrza"):
 *   - assessment/assessments.routes.ts (11 catch blocks)
 *   - assessment/assessment-ai.routes.ts (26)
 *   - assessment-reports.routes.ts (23, incl. 3x notConfigured(details.message))
 *   - assessment/assessment-workflow.routes.ts (21)
 *   - assessment-workflow-v2.routes.ts (17, additional to batch6's access-request/role slice)
 *   - assessment/assessment-hub.routes.ts (6)
 *   - report-builder-public.routes.ts (3 — PUBLIC unauthenticated surface)
 *
 * This file proves the fix on 3 representative routers (one per shape of the
 * anti-pattern): a plain authenticated CRUD read, an AI-partner POST, and the
 * public (no-auth) PDF export. Services/DB are mocked (subsystem-down
 * simulation) — fast unit tests, not the tests/acceptance/ real-DB harness.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

const SECRET_LEAK = 'password authentication failed for user "consultinity_prod" at 10.0.0.7:5432';

// ============================================================================
// 1. assessment/assessments.routes.ts — GET /my-assessments
// ============================================================================
describe('/api/assessments/my-assessments — read stays fail-closed (H6.4 batch7)', () => {
  beforeEach(() => {
    vi.doMock('../../../../server/src/database/index.js', () => ({
      getDatabase: () => ({
        all: (_sql: string, _params: unknown[], cb: (err: Error | null, rows?: unknown[]) => void) => {
          cb(new Error(SECRET_LEAK));
        },
      }),
    }));
  });

  it('GET /my-assessments: 500 with stable code, no err.message leak, logged server-side', async () => {
    const loggerErrorSpy = vi.fn();
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: { error: loggerErrorSpy, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    }));

    const { default: assessmentsRouter } = await import(
      '../../../../server/src/routes/assessment/assessments.routes.js'
    );
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' };
      next();
    });
    app.use('/api/assessments', assessmentsRouter);

    const res = await request(app).get('/api/assessments/my-assessments');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('code', 'ASSESSMENTS_FETCH_ASSESSMENTS_FAILED');

    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain(SECRET_LEAK);
    expect(bodyText).not.toContain('consultinity_prod');

    expect(loggerErrorSpy).toHaveBeenCalled();
    const [, meta] = loggerErrorSpy.mock.calls[0];
    expect(meta.err).toBeInstanceOf(Error);
    expect(meta.err.message).toBe(SECRET_LEAK);
  });
});

// ============================================================================
// 2. assessment/assessment-ai.routes.ts — POST suggest-justification
// ============================================================================
describe('/api/assessment/:projectId/ai/suggest-justification — AI POST stays fail-closed (H6.4 batch7)', () => {
  it('500 with stable code, no err.message leak, logged server-side', async () => {
    const loggerErrorSpy = vi.fn();
    vi.doMock('../../../../server/src/services/aiAssessmentPartnerService.js', () => ({
      aiAssessmentPartner: {
        suggestJustification: vi.fn().mockRejectedValue(new Error(SECRET_LEAK)),
      },
    }));
    vi.doMock('../../../../server/src/services/aiAssessmentFormHelper.js', () => ({
      aiAssessmentFormHelper: {},
    }));
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: { error: loggerErrorSpy, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    }));

    const { default: assessmentAiRouter } = await import(
      '../../../../server/src/routes/assessment/assessment-ai.routes.js'
    );
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' };
      next();
    });
    app.use('/api/assessment', assessmentAiRouter);

    const res = await request(app)
      .post('/api/assessment/proj-1/ai/suggest-justification')
      .send({ axisId: 'axis-1', score: 3 });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('code', 'ASSESSMENT_AI_GENERATE_SUGGESTION_FAILED');

    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain(SECRET_LEAK);
    expect(bodyText).not.toContain('consultinity_prod');

    expect(loggerErrorSpy).toHaveBeenCalled();
    const [, meta] = loggerErrorSpy.mock.calls[0];
    expect(meta.err).toBeInstanceOf(Error);
    expect(meta.err.message).toBe(SECRET_LEAK);
  });
});

// ============================================================================
// 3. report-builder-public.routes.ts — GET /:token/pdf (PUBLIC, no auth)
// ============================================================================
describe('/api/public/report/:token/pdf — public download stays fail-closed (H6.4 batch7)', () => {
  it('500 with stable code, no err.message leak, logged server-side (unauthenticated caller)', async () => {
    const loggerErrorSpy = vi.fn();
    vi.doMock('../../../../server/src/services/reportBuilderService.js', () => ({
      default: {
        getPublicLinkByToken: vi.fn().mockRejectedValue(new Error(SECRET_LEAK)),
      },
    }));
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: { error: loggerErrorSpy, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    }));

    const { default: reportBuilderPublicRouter } = await import(
      '../../../../server/src/routes/report-builder-public.routes.js'
    );
    const app = express();
    app.use(express.json());
    // NOTE: intentionally no auth middleware mounted — this route is public.
    app.use('/api/public/report', reportBuilderPublicRouter);

    const res = await request(app).get('/api/public/report/tok-123/pdf');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('code', 'REPORT_BUILDER_PUBLIC_GENERATE_PDF_FAILED');

    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain(SECRET_LEAK);
    expect(bodyText).not.toContain('consultinity_prod');

    expect(loggerErrorSpy).toHaveBeenCalled();
    const [, meta] = loggerErrorSpy.mock.calls[0];
    expect(meta.err).toBeInstanceOf(Error);
    expect(meta.err.message).toBe(SECRET_LEAK);
  });
});
