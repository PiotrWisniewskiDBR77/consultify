import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbGetMock = vi.fn();
const dbAllMock = vi.fn();
const generateInsightsMock = vi.fn();
const getTrendingTopicsMock = vi.fn();
const llmCallMock = vi.fn();
const accessCheckMock = vi.fn();
const accessIncrementMock = vi.fn();

vi.mock('../../../server/src/middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: any, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: unknown, next: () => void) => {
    _req.user = { id: 'user-1', organizationId: 'org-1' };
    _req.organizationId = 'org-1';
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
  default: {
    getPulseSummary: vi.fn(async () => ({ period: '30d', average: 4.2 })),
    generateInsights: (...args: unknown[]) => generateInsightsMock(...args),
    getTrendingTopics: (...args: unknown[]) => getTrendingTopicsMock(...args),
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

vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  llmService: {
    call: (...args: unknown[]) => llmCallMock(...args),
  },
}));

vi.mock('../../../server/src/services/accessPolicyService.js', () => ({
  default: {
    checkAccess: (...args: unknown[]) => accessCheckMock(...args),
    incrementUsage: (...args: unknown[]) => accessIncrementMock(...args),
  },
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

describe('feedback llm aggregate fail-closed contract', () => {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.use('/api/feedback', feedbackRoutes);
  app.use(errorHandlerMiddleware);

  beforeEach(() => {
    vi.clearAllMocks();
    dbGetMock.mockResolvedValue({ ok: 1 });
    dbAllMock.mockResolvedValue([]);
    generateInsightsMock.mockResolvedValue([]);
    getTrendingTopicsMock.mockResolvedValue([]);
    llmCallMock.mockResolvedValue({ object: { title: 't', summary: 's', steps: [], expected: 'e', actual: 'a', impact: 'i', isLikelyBug: true, questionsToClarify: [] } });
    accessCheckMock.mockResolvedValue({ allowed: true });
    accessIncrementMock.mockResolvedValue(undefined);
  });

  it('returns coded 400 when compose message is missing', async () => {
    const res = await request(app)
      .post('/api/feedback/compose')
      .send({})
      .set('X-Correlation-ID', 'pack09s5-compose-missing-message');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('FEEDBACK_COMPOSE_MESSAGE_REQUIRED');
    expect(res.body.error.message).toBe('Message is required.');
    expect(res.body.correlationId).toBe('pack09s5-compose-missing-message');
  });

  it('returns coded 500 when compose has no LLM provider configured', async () => {
    dbGetMock.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/feedback/compose')
      .send({ message: 'Need help with an export bug' })
      .set('X-Correlation-ID', 'pack09s5-compose-no-provider');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('FEEDBACK_COMPOSE_NO_LLM_PROVIDER');
    expect(res.body.error.message).toBe('Compose service is temporarily unavailable.');
    expect(res.body.correlationId).toBe('pack09s5-compose-no-provider');
  });

  it('returns coded 500 non-leaking envelope when compose llm returns empty payload', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    llmCallMock.mockResolvedValueOnce({});

    try {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .post('/api/feedback/compose')
        .send({ message: 'Need help with an export bug' })
        .set('X-Correlation-ID', 'pack09s5-compose-empty-llm');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error.code).toBe('FEEDBACK_COMPOSE_LLM_EMPTY');
      expect(res.body.error.message).toBe('Failed to compose feedback draft.');
      expect(res.body.correlationId).toBe('pack09s5-compose-empty-llm');
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it('returns coded 500 non-leaking envelope when ai insights generation fails', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    generateInsightsMock.mockRejectedValueOnce(new Error('SECRET_AI_INSIGHTS_FAILURE_SHOULD_NOT_LEAK'));

    try {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .post('/api/feedback/ai-insights')
        .send({ context: '/feedback' })
        .set('X-Correlation-ID', 'pack09s5-ai-insights-fail');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error.code).toBe('FEEDBACK_AI_INSIGHTS_FAILED');
      expect(res.body.error.message).toBe('Failed to generate AI insights.');
      expect(res.body.correlationId).toBe('pack09s5-ai-insights-fail');
      expect(JSON.stringify(res.body)).not.toContain('SECRET_AI_INSIGHTS_FAILURE_SHOULD_NOT_LEAK');
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it('returns coded 500 non-leaking envelope when trending read fails', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    getTrendingTopicsMock.mockRejectedValueOnce(new Error('SECRET_TRENDING_FAILURE_SHOULD_NOT_LEAK'));

    try {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .get('/api/feedback/trending')
        .set('X-Correlation-ID', 'pack09s5-trending-fail');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error.code).toBe('FEEDBACK_TRENDING_READ_FAILED');
      expect(res.body.error.message).toBe('Failed to read trending feedback topics.');
      expect(res.body.correlationId).toBe('pack09s5-trending-fail');
      expect(JSON.stringify(res.body)).not.toContain('SECRET_TRENDING_FAILURE_SHOULD_NOT_LEAK');
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });
});
