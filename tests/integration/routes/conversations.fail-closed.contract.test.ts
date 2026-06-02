// @vitest-environment node

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbGetMock = vi.fn();
const dbAllMock = vi.fn();
const dbRunMock = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'ADMIN' };
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    next();
  },
}));

vi.mock('../../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: any) => next(),
  validateParams: () => (_req: any, _res: any, next: any) => next(),
  validateQuery: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/services/chatPermissionService.js', () => ({
  checkChatPermission: vi.fn(async () => ({ allowed: true })),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGetMock(...args),
  all: (...args: any[]) => dbAllMock(...args),
  run: (...args: any[]) => dbRunMock(...args),
}));

vi.mock('../../../server/src/services/organizationContext/OrganizationContextService.js', () => ({
  default: { recordChatMessage: vi.fn(async () => ({ itemId: 'ctx-1' })) },
}));

const aiProcessMock = vi.fn();
vi.mock('../../../server/src/services/ai/AIPipeline.js', () => ({
  AIPipeline: class {
    process(...args: any[]) {
      return aiProcessMock(...args);
    }
  },
}));

import conversationsRoutes from '../../../server/src/routes/conversations.routes.ts';
import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

describe('conversations fail-closed contract', () => {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.use('/api/conversations', conversationsRoutes);
  app.use(errorHandlerMiddleware);

  beforeEach(() => {
    vi.clearAllMocks();
    dbAllMock.mockResolvedValue([]);
    dbRunMock.mockResolvedValue({ changes: 1 });
    aiProcessMock.mockResolvedValue({ text: 'Generated conversation title' });
  });

  it('returns coded envelope without details leak when title generation cannot use AI', async () => {
    dbGetMock.mockResolvedValueOnce({
      id: '11111111-1111-4111-8111-111111111111',
      user_id: 'user-1',
      title_source: 'auto',
      message_count: 2,
    });
    dbAllMock.mockResolvedValueOnce([{ role: 'user', content: 'a' }, { role: 'ai', content: 'b' }]);
    aiProcessMock.mockRejectedValueOnce(new Error('INTERNAL_SECRET_DB_MESSAGE'));

    const res = await request(app)
      .post('/api/conversations/11111111-1111-4111-8111-111111111111/title/generate')
      .set('X-Correlation-ID', 'pack10s3-conversations-title-fail-1');

    expect([200, 500]).toContain(res.status);
    if (res.status === 500) {
      expect(res.body.status).toBe('error');
      expect(res.body.error.code).toBe('CONVERSATIONS_TITLE_GENERATION_FAILED');
      expect(res.body.error.message).toBe('Failed to generate conversation title.');
      expect(res.body.correlationId).toBe('pack10s3-conversations-title-fail-1');
    }
    expect(res.body.details).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('INTERNAL_SECRET_DB_MESSAGE');
  });

  it('returns coded 404 for bulk when no owned conversations exist', async () => {
    dbAllMock.mockResolvedValueOnce([]);
    const res = await request(app)
      .post('/api/conversations/bulk')
      .send({ ids: ['11111111-1111-4111-8111-111111111111'], action: 'archive' })
      .set('X-Correlation-ID', 'pack10s3-conversations-bulk-empty-1');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('CONVERSATIONS_BULK_NOT_FOUND');
    expect(res.body.error.message).toBe('No conversations were found for this bulk request.');
    expect(res.body.correlationId).toBe('pack10s3-conversations-bulk-empty-1');
  });

  it('returns coded 500 for bulk operation failures', async () => {
    dbAllMock.mockResolvedValueOnce([{ id: '11111111-1111-4111-8111-111111111111' }]);
    dbRunMock.mockRejectedValueOnce(new Error('BULK_INTERNAL_CRASH'));
    const res = await request(app)
      .post('/api/conversations/bulk')
      .send({ ids: ['11111111-1111-4111-8111-111111111111'], action: 'archive' })
      .set('X-Correlation-ID', 'pack10s3-conversations-bulk-fail-1');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('CONVERSATIONS_BULK_OPERATION_FAILED');
    expect(res.body.error.message).toBe('Bulk conversation operation failed.');
    expect(res.body.correlationId).toBe('pack10s3-conversations-bulk-fail-1');
  });

  it('returns coded 500 for auto-archive failures', async () => {
    dbRunMock.mockRejectedValueOnce(new Error('AUTO_ARCHIVE_INTERNAL_FAIL'));
    const res = await request(app)
      .post('/api/conversations/auto-archive')
      .send({ daysOld: 30 })
      .set('X-Correlation-ID', 'pack10s3-conversations-auto-archive-fail-1');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('CONVERSATIONS_AUTO_ARCHIVE_FAILED');
    expect(res.body.error.message).toBe('Failed to auto-archive conversations.');
    expect(res.body.correlationId).toBe('pack10s3-conversations-auto-archive-fail-1');
  });
});

