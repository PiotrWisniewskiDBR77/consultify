import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbGetMock = vi.fn();
const dbAllMock = vi.fn();

vi.mock('../../../server/src/middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: any, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: unknown, next: () => void) => next(),
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
  default: {
    getPulseSummary: vi.fn(async () => ({ period: '30d', average: 4.2 })),
  },
}));

vi.mock('../../../server/src/services/AlertEmailService.js', () => ({
  getAlertEmailService: () => ({
    sendAlert: vi.fn(),
    sendCriticalAlert: vi.fn(),
  }),
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
  all: (...args: unknown[]) => dbAllMock(...args),
  run: vi.fn(async () => ({ success: true })),
}));

vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: vi.fn(async () => new Set<string>()),
}));

import feedbackRoutes from '../../../server/src/routes/feedback.routes.ts';
import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

describe('feedback stats-summary fail-closed contract', () => {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.use('/api/feedback', feedbackRoutes);
  app.use(errorHandlerMiddleware);

  beforeEach(() => {
    vi.clearAllMocks();
    dbGetMock.mockResolvedValue({ count: 1 });
    dbAllMock.mockResolvedValue([]);
  });

  it('returns coded non-leaking 500 envelope when stats query fails', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    dbGetMock.mockRejectedValueOnce(new Error('SECRET_INTERNAL_DB_FAILURE_SHOULD_NOT_LEAK'));

    try {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .get('/api/feedback/stats/summary')
        .set('X-Correlation-ID', 'pack09s3-feedback-stats-1');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error.code).toBe('FEEDBACK_STATS_SUMMARY_READ_FAILED');
      expect(res.body.error.message).toBe('Failed to read feedback statistics.');
      expect(Number.isNaN(Date.parse(res.body.error.timestamp))).toBe(false);
      expect(res.body.correlationId).toBe('pack09s3-feedback-stats-1');
      expect(JSON.stringify(res.body)).not.toContain('SECRET_INTERNAL_DB_FAILURE_SHOULD_NOT_LEAK');
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });
});
