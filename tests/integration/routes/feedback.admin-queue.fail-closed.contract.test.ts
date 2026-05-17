import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbGetMock = vi.fn();
const dbAllMock = vi.fn();
const dbRunMock = vi.fn();
const getTableColumnsMock = vi.fn();
let shouldFailFeedbackListRead = false;

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
    generateInsights: vi.fn(async () => []),
    getTrendingTopics: vi.fn(async () => []),
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
  run: (...args: unknown[]) => dbRunMock(...args),
}));

vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: (...args: unknown[]) => getTableColumnsMock(...args),
}));

import feedbackRoutes from '../../../server/src/routes/feedback.routes.ts';
import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';
import * as feedbackShapeModule from '../../../server/src/services/feedbackShape.ts';

const VALID_ID = '11111111-1111-4111-8111-111111111111';

describe('feedback admin queue fail-closed contract', () => {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.use('/api/feedback', feedbackRoutes);
  app.use(errorHandlerMiddleware);

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    shouldFailFeedbackListRead = false;
    dbGetMock.mockResolvedValue(null);
    dbAllMock.mockResolvedValue([]);
    dbRunMock.mockResolvedValue({ success: true });
    getTableColumnsMock.mockResolvedValue(
      new Set<string>(['admin_response', 'responded_at', 'responded_by', 'status', 'updated_at'])
    );
    vi.spyOn(feedbackShapeModule, 'shapeFeedbackRow').mockImplementation((row: any) => {
      if (shouldFailFeedbackListRead) {
        throw new Error('SECRET_LIST_DB_FAILURE_SHOULD_NOT_LEAK');
      }
      return row;
    });
  });

  it('returns coded non-leaking 500 when list read fails', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    shouldFailFeedbackListRead = true;
    dbGetMock.mockResolvedValueOnce({ count: 1 });
    dbAllMock.mockResolvedValueOnce([{}]);

    try {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .get('/api/feedback')
        .set('X-Correlation-ID', 'pack09s5-admin-list-fail');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error.code).toBe('FEEDBACK_LIST_READ_FAILED');
      expect(res.body.correlationId).toBe('pack09s5-admin-list-fail');
      expect(JSON.stringify(res.body)).not.toContain('SECRET_LIST_DB_FAILURE_SHOULD_NOT_LEAK');
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it('returns coded 400 for invalid feedback id on status update', async () => {
    const res = await request(app)
      .patch('/api/feedback/not-a-uuid/status')
      .send({ status: 'RESOLVED' })
      .set('X-Correlation-ID', 'pack09s5-status-invalid-id');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('FEEDBACK_STATUS_FEEDBACK_ID_INVALID');
    expect(res.body.error.message).toBe('Feedback id must be a valid UUID.');
    expect(res.body.correlationId).toBe('pack09s5-status-invalid-id');
  });

  it('returns coded 400 for invalid status value', async () => {
    const res = await request(app)
      .patch(`/api/feedback/${VALID_ID}/status`)
      .send({ status: 'NOT_A_REAL_STATUS' })
      .set('X-Correlation-ID', 'pack09s5-status-invalid-value');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('FEEDBACK_STATUS_VALUE_INVALID');
    expect(res.body.error.message).toBe('Status value is invalid.');
    expect(res.body.correlationId).toBe('pack09s5-status-invalid-value');
  });

  it('returns coded 404 when workflow target ticket is missing', async () => {
    dbGetMock.mockResolvedValueOnce(null);

    const res = await request(app)
      .patch(`/api/feedback/${VALID_ID}/workflow`)
      .send({ owner: 'ops-team' })
      .set('X-Correlation-ID', 'pack09s5-workflow-not-found');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('FEEDBACK_WORKFLOW_NOT_FOUND');
    expect(res.body.error.message).toBe('Feedback was not found.');
    expect(res.body.correlationId).toBe('pack09s5-workflow-not-found');
  });

  it('returns coded 400 for invalid id on admin response submit', async () => {
    const res = await request(app)
      .post('/api/feedback/not-a-uuid/respond')
      .send({ response: 'Thanks, we are on it.' })
      .set('X-Correlation-ID', 'pack09s5-respond-invalid-id');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('FEEDBACK_RESPOND_FEEDBACK_ID_INVALID');
    expect(res.body.error.message).toBe('Feedback id must be a valid UUID.');
    expect(res.body.correlationId).toBe('pack09s5-respond-invalid-id');
  });

  it('returns coded non-leaking 500 when admin response write fails', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    dbRunMock.mockResolvedValueOnce({
      success: false,
      error: 'SECRET_WRITE_FAILURE_SHOULD_NOT_LEAK',
    });

    try {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .post(`/api/feedback/${VALID_ID}/respond`)
        .send({ response: 'Thanks, we are on it.' })
        .set('X-Correlation-ID', 'pack09s5-respond-write-fail');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error.code).toBe('FEEDBACK_RESPOND_UPDATE_FAILED');
      expect(res.body.error.message).toBe('Failed to save feedback response.');
      expect(res.body.correlationId).toBe('pack09s5-respond-write-fail');
      expect(JSON.stringify(res.body)).not.toContain('SECRET_WRITE_FAILURE_SHOULD_NOT_LEAK');
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });
});
