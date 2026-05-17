import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbGetMock = vi.fn();
const dbRunMock = vi.fn();

vi.mock('../../../server/src/middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    if (req.get('x-test-auth') === 'none') {
      req.user = undefined;
    } else {
      req.user = { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' };
    }
    next();
  },
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/rateLimiting.middleware.js'
  )) as any;
  return {
    ...actual,
    apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
    feedbackRateLimiter: (_req: any, _res: any, next: any) => next(),
  };
});

vi.mock('../../../server/src/services/feedbackAIService.js', () => ({
  default: { getPulseSummary: vi.fn(async () => ({ period: '30d', average: 4.2 })) },
}));
vi.mock('../../../server/src/services/AlertEmailService.js', () => ({
  getAlertEmailService: () => ({ sendAlert: vi.fn(), sendCriticalAlert: vi.fn() }),
}));
vi.mock('../../../server/src/services/slackService.js', () => ({
  default: { sendNewFeedbackAlert: vi.fn() },
}));
vi.mock('../../../server/src/services/WhatsAppService.js', () => ({
  default: { sendNewFeedbackAlert: vi.fn() },
}));
vi.mock('../../../server/src/services/notificationService.js', () => ({
  default: { send: vi.fn() },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => dbGetMock(...args),
  all: vi.fn(async () => []),
  run: (...args: unknown[]) => dbRunMock(...args),
}));

vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: vi.fn(async () => new Set<string>()),
}));

import feedbackRoutes from '../../../server/src/routes/feedback.routes.ts';
import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

const VALID_ID = '11111111-1111-4111-8111-111111111111';

describe('feedback vote and cursor-brief fail-closed contract', () => {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.use('/api/feedback', feedbackRoutes);
  app.use(errorHandlerMiddleware);

  beforeEach(() => {
    vi.clearAllMocks();
    dbGetMock.mockResolvedValue(null);
    dbRunMock.mockResolvedValue({ success: true });
  });

  it('returns coded 401 for feature vote when auth is missing', async () => {
    const res = await request(app)
      .post(`/api/feedback/features/${VALID_ID}/vote`)
      .set('x-test-auth', 'none')
      .set('X-Correlation-ID', 'pack10s2-feedback-vote-unauth-1');

    expect(res.status).toBe(401);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('FEEDBACK_FEATURE_VOTE_UNAUTHORIZED');
    expect(res.body.error.message).toBe('Authentication is required to vote for features.');
    expect(res.body.correlationId).toBe('pack10s2-feedback-vote-unauth-1');
  });

  it('returns coded 400 for duplicate feature vote', async () => {
    dbGetMock.mockResolvedValueOnce({ id: 'vote-1' });
    const res = await request(app)
      .post(`/api/feedback/features/${VALID_ID}/vote`)
      .set('X-Correlation-ID', 'pack10s2-feedback-vote-duplicate-1');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('FEEDBACK_FEATURE_VOTE_DUPLICATE');
    expect(res.body.error.message).toBe('Feature vote already exists for this user.');
    expect(res.body.correlationId).toBe('pack10s2-feedback-vote-duplicate-1');
  });

  it('returns coded 400 for cursor brief invalid id', async () => {
    const res = await request(app)
      .get('/api/feedback/not-a-uuid/cursor-brief')
      .set('X-Correlation-ID', 'pack10s2-feedback-brief-invalid-1');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('FEEDBACK_CURSOR_BRIEF_ID_INVALID');
    expect(res.body.error.message).toBe('Feedback id must be a valid UUID.');
    expect(res.body.correlationId).toBe('pack10s2-feedback-brief-invalid-1');
  });

  it('returns coded 404 for cursor brief not found', async () => {
    dbGetMock.mockResolvedValueOnce(null);
    const res = await request(app)
      .get(`/api/feedback/${VALID_ID}/cursor-brief`)
      .set('X-Correlation-ID', 'pack10s2-feedback-brief-not-found-1');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('FEEDBACK_CURSOR_BRIEF_NOT_FOUND');
    expect(res.body.error.message).toBe('Feedback item was not found.');
    expect(res.body.correlationId).toBe('pack10s2-feedback-brief-not-found-1');
  });
});

