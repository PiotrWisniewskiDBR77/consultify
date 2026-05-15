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

const VALID_ID = '11111111-1111-4111-8111-111111111111';

describe('feedback ai-analysis fail-closed contract', () => {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.use('/api/feedback', feedbackRoutes);
  app.use(errorHandlerMiddleware);

  beforeEach(() => {
    vi.clearAllMocks();
    dbGetMock.mockResolvedValue(null);
    dbAllMock.mockResolvedValue([]);
  });

  it('returns coded 400 for invalid feedback id', async () => {
    const res = await request(app)
      .get('/api/feedback/ai-analysis/not-a-uuid')
      .set('X-Correlation-ID', 'pack09s3-ai-analysis-bad-id');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('FEEDBACK_AI_ANALYSIS_FEEDBACK_ID_INVALID');
    expect(res.body.error.message).toBe('Feedback id must be a valid UUID.');
    expect(res.body.correlationId).toBe('pack09s3-ai-analysis-bad-id');
  });

  it('returns coded 404 for missing analysis row', async () => {
    dbGetMock.mockResolvedValueOnce(null);

    const res = await request(app)
      .get(`/api/feedback/ai-analysis/${VALID_ID}`)
      .set('X-Correlation-ID', 'pack09s3-ai-analysis-not-found');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('FEEDBACK_AI_ANALYSIS_NOT_FOUND');
    expect(res.body.error.message).toBe('Feedback analysis was not found.');
    expect(res.body.correlationId).toBe('pack09s3-ai-analysis-not-found');
  });

  it('returns coded non-leaking 500 when read fails', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    dbGetMock.mockRejectedValueOnce(new Error('SECRET_INTERNAL_DB_FAILURE_SHOULD_NOT_LEAK'));

    try {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .get(`/api/feedback/ai-analysis/${VALID_ID}`)
        .set('X-Correlation-ID', 'pack09s3-ai-analysis-read-fail');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error.code).toBe('FEEDBACK_AI_ANALYSIS_READ_FAILED');
      expect(res.body.error.message).toBe('Failed to read feedback analysis.');
      expect(Number.isNaN(Date.parse(res.body.error.timestamp))).toBe(false);
      expect(res.body.correlationId).toBe('pack09s3-ai-analysis-read-fail');
      expect(JSON.stringify(res.body)).not.toContain('SECRET_INTERNAL_DB_FAILURE_SHOULD_NOT_LEAK');
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it('returns coded non-leaking 500 when analysis payload JSON is corrupted', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    dbGetMock.mockResolvedValueOnce({
      id: 'row-1',
      feedback_id: VALID_ID,
      categories_json: '{not-json',
      keywords_json: '[]',
      similar_feedback_ids_json: '[]',
      suggested_actions_json: '[]',
    });

    try {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .get(`/api/feedback/ai-analysis/${VALID_ID}`)
        .set('X-Correlation-ID', 'pack09s3-ai-analysis-invalid-json');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error.code).toBe('FEEDBACK_AI_ANALYSIS_READ_FAILED');
      expect(res.body.error.message).toBe('Failed to read feedback analysis.');
      expect(Number.isNaN(Date.parse(res.body.error.timestamp))).toBe(false);
      expect(res.body.correlationId).toBe('pack09s3-ai-analysis-invalid-json');
      expect(JSON.stringify(res.body)).not.toContain('{not-json');
      expect(JSON.stringify(res.body)).not.toContain('SyntaxError');
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });
});
