import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbGetMock = vi.fn();
const dbAllMock = vi.fn();
const analyzeFeedbackMock = vi.fn();

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
    analyzeFeedback: (...args: unknown[]) => analyzeFeedbackMock(...args),
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

const VALID_ID = '11111111-1111-4111-8111-111111111111';

describe('feedback analyze trigger fail-closed contract', () => {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.use('/api/feedback', feedbackRoutes);
  app.use(errorHandlerMiddleware);

  beforeEach(() => {
    vi.clearAllMocks();
    dbGetMock.mockResolvedValue(null);
    dbAllMock.mockResolvedValue([]);
    analyzeFeedbackMock.mockResolvedValue({ score: 0.8 });
  });

  it('returns coded 400 for invalid feedback id', async () => {
    const res = await request(app)
      .post('/api/feedback/not-a-uuid/analyze')
      .set('X-Correlation-ID', 'pack09s4-analyze-invalid-id');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('FEEDBACK_ANALYZE_FEEDBACK_ID_INVALID');
    expect(res.body.error.message).toBe('Feedback id must be a valid UUID.');
    expect(res.body.correlationId).toBe('pack09s4-analyze-invalid-id');
  });

  it('returns coded 404 when source feedback is missing', async () => {
    dbGetMock.mockResolvedValueOnce(null);

    const res = await request(app)
      .post(`/api/feedback/${VALID_ID}/analyze`)
      .set('X-Correlation-ID', 'pack09s4-analyze-not-found');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('FEEDBACK_ANALYZE_NOT_FOUND');
    expect(res.body.error.message).toBe('Feedback was not found.');
    expect(res.body.correlationId).toBe('pack09s4-analyze-not-found');
  });

  it('returns coded non-leaking 500 when analyze runtime fails', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    dbGetMock.mockResolvedValueOnce({
      id: VALID_ID,
      message: 'Need analysis',
      type: 'BUG',
    });
    analyzeFeedbackMock.mockRejectedValueOnce(new Error('SECRET_INTERNAL_AI_ANALYZE_FAILURE'));

    try {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .post(`/api/feedback/${VALID_ID}/analyze`)
        .set('X-Correlation-ID', 'pack09s4-analyze-fail');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error.code).toBe('FEEDBACK_ANALYZE_FAILED');
      expect(res.body.error.message).toBe('Failed to analyze feedback.');
      expect(Number.isNaN(Date.parse(res.body.error.timestamp))).toBe(false);
      expect(res.body.correlationId).toBe('pack09s4-analyze-fail');
      expect(JSON.stringify(res.body)).not.toContain('SECRET_INTERNAL_AI_ANALYZE_FAILURE');
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it('preserves success envelope when analysis succeeds', async () => {
    dbGetMock.mockResolvedValueOnce({
      id: VALID_ID,
      message: 'Need analysis',
      type: 'BUG',
    });
    analyzeFeedbackMock.mockResolvedValueOnce({ score: 0.9, sentiment: 'negative' });

    const res = await request(app)
      .post(`/api/feedback/${VALID_ID}/analyze`)
      .set('X-Correlation-ID', 'pack09s4-analyze-success');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.analysis).toEqual({ score: 0.9, sentiment: 'negative' });
  });
});
