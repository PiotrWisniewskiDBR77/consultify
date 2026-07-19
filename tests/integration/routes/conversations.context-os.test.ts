import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbGet = vi.fn();
const mockDbRun = vi.fn();
const mockDbAll = vi.fn();
const recordChatMessage = vi.fn();

vi.mock('uuid', () => ({
  v4: () => '11111111-1111-4111-8111-111111111111',
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', async () => {
  const actual = (await vi.importActual('../../../server/src/middleware/auth.middleware.js')) as any;
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      req.user = {
        id: 'user-1',
        organizationId: 'org-1',
        role: 'ADMIN',
      };
      req.userId = 'user-1';
      req.organizationId = 'org-1';
      next();
    },
  };
});

vi.mock('../../../server/src/utils/DbPromise.js', async () => {
  const actual = (await vi.importActual('../../../server/src/utils/DbPromise.js')) as any;
  return {
    ...actual,
    get: (...args: any[]) => mockDbGet(...args),
    run: (...args: any[]) => mockDbRun(...args),
    all: (...args: any[]) => mockDbAll(...args),
  };
});

vi.mock('../../../server/src/services/organizationContext/OrganizationContextService.js', () => ({
  default: {
    recordChatMessage: (...args: any[]) => recordChatMessage(...args),
  },
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const { default: conversationsRouter } = await import('../../../server/src/routes/conversations.routes.ts');

describe('Conversations Context OS routes', () => {
  const makeApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/conversations', conversationsRouter);
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbRun.mockResolvedValue(undefined);
    recordChatMessage.mockResolvedValue({ itemId: 'ctx-item-1' });
  });

  it('captures a new user message into Context OS when capture flag is true', async () => {
    // The insert is the first dbRun call; the route reads insertResult.success,
    // so it needs a faithful RunResult rather than the beforeEach `undefined` default.
    mockDbRun.mockResolvedValueOnce({ success: true, lastID: 1, changes: 1 });
    mockDbGet
      .mockResolvedValueOnce({
        id: '22222222-2222-4222-8222-222222222222',
        user_id: 'user-1',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: '11111111-1111-4111-8111-111111111111',
        role: 'user',
        content: 'Important org fact',
      });

    const res = await request(makeApp())
      .post('/api/conversations/22222222-2222-4222-8222-222222222222/messages')
      .send({
        role: 'user',
        content: 'Important org fact',
        metadata: { captureOrganizationContext: true },
      });

    expect(res.status).toBe(201);
    expect(recordChatMessage).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'user-1',
      payload: {
        conversationId: '22222222-2222-4222-8222-222222222222',
        messageId: '11111111-1111-4111-8111-111111111111',
        content: 'Important org fact',
      },
    });
  });

  it('saves an existing AI message to Context OS explicitly', async () => {
    mockDbGet
      .mockResolvedValueOnce({
        id: '22222222-2222-4222-8222-222222222222',
        user_id: 'user-1',
      })
      .mockResolvedValueOnce({
        id: '33333333-3333-4333-8333-333333333333',
        conversation_id: '22222222-2222-4222-8222-222222222222',
        role: 'ai',
        content: 'AI answer worth saving',
        metadata: '{"foo":"bar"}',
        author_user_id: null,
      })
      .mockResolvedValueOnce(null);

    const res = await request(makeApp()).post(
      '/api/conversations/22222222-2222-4222-8222-222222222222/messages/33333333-3333-4333-8333-333333333333/save-to-context'
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, itemId: 'ctx-item-1', alreadyCaptured: false });
    expect(recordChatMessage).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'user-1',
      payload: {
        conversationId: '22222222-2222-4222-8222-222222222222',
        messageId: '33333333-3333-4333-8333-333333333333',
        role: 'ai',
        content: 'AI answer worth saving',
        metadata: { foo: 'bar' },
      },
    });
  });
});
