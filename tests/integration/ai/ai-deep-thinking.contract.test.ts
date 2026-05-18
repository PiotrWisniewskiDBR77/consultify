import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
const mockDbGet = vi.fn();
const mockDbRun = vi.fn();
const mockCallStructured = vi.fn();
const mockSelectModel = vi.fn();
const mockCheckAccess = vi.fn();
const mockIncrementUsage = vi.fn();

type StoredConfirm = {
  token: string;
  user_id: string;
  organization_id: string | null;
  conversation_id: string | null;
  message_hash: string;
  confirm_payload: string;
  expires_at: string;
  consumed_at: string | null;
};

const storedConfirms = new Map<string, StoredConfirm>();
let exportedMessages: any[] = [];

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'ADMIN' };
    next();
  },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../../../server/src/services/ai/modelRouter.js', () => ({
  modelRouter: {
    select: (...args: unknown[]) => mockSelectModel(...args),
    getProviderConfig: (...args: unknown[]) => mockSelectModel(...args),
  },
}));

vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  llmService: {
    callStructured: (...args: unknown[]) => mockCallStructured(...args),
  },
}));

vi.mock('../../../server/src/services/accessPolicyService.js', () => ({
  default: {
    checkAccess: (...args: unknown[]) => mockCheckAccess(...args),
    incrementUsage: (...args: unknown[]) => mockIncrementUsage(...args),
  },
}));

function createApp(router: any): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/ai', router);
  return app;
}

describe('AI deep thinking contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedConfirms.clear();
    exportedMessages = [];

    mockSelectModel.mockResolvedValue({
      provider: 'openrouter',
      id: 'test-model',
      endpoint: 'https://example.test',
      apiKey: 'key',
    });
    mockCallStructured.mockResolvedValue({
      object: {
        understanding: {
          goal: 'Recommend a market move',
          context: 'Board review',
          constraints: ['Stay profitable'],
          expectedOutput: 'Decision',
          decisionHorizon: 'Q3',
        },
        isClearEnoughToProceed: true,
        missingInfoQuestions: [],
        researchPlanItems: [],
        suggestedDepth: 'Hard',
      },
    });
    mockCheckAccess.mockResolvedValue({ allowed: true });
    mockIncrementUsage.mockResolvedValue(undefined);

    mockDbGet.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM llm_providers')) {
        return { ok: 1 };
      }
      if (sql.includes('FROM ai_deep_thinking_confirms')) {
        return storedConfirms.get(String(params?.[0] || '')) || null;
      }
      return null;
    });

    mockDbRun.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('INSERT INTO ai_deep_thinking_confirms')) {
        const [token, userId, organizationId, conversationId, messageHash, confirmPayload, expiresAt] =
          params as [string, string, string | null, string | null, string, string, string];
        storedConfirms.set(token, {
          token,
          user_id: userId,
          organization_id: organizationId,
          conversation_id: conversationId,
          message_hash: messageHash,
          confirm_payload: confirmPayload,
          expires_at: expiresAt,
          consumed_at: null,
        });
      }
      if (sql.includes('SET consumed_at = CURRENT_TIMESTAMP')) {
        const token = String(params?.[0] || '');
        const existing = storedConfirms.get(token);
        if (existing) {
          existing.consumed_at = new Date().toISOString();
          storedConfirms.set(token, existing);
        }
      }
      return { success: true, changes: 1 };
    });

    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM conversation_messages')) {
        return exportedMessages;
      }
      return [];
    });
  });

  it('returns a confirm token and stores a server-side marker', async () => {
    const { default: router } = await import('../../../server/src/routes/ai.routes.ts');
    const res = await request(createApp(router)).post('/api/ai/chat/confirm').send({
      message: 'Should we expand to a new market?',
      context: { conversationId: 'conv-1' },
      aiModes: { deepResearch: true },
    });

    expect(res.status).toBe(200);
    expect(res.body.confirmToken).toEqual(expect.any(String));
    expect(storedConfirms.has(res.body.confirmToken)).toBe(true);
    expect(storedConfirms.get(res.body.confirmToken)).toEqual(
      expect.objectContaining({
        conversation_id: 'conv-1',
      })
    );
  });

  it('rejects a deep thinking stream when the confirm token does not match the message', async () => {
    const { default: router } = await import('../../../server/src/routes/ai.routes.ts');
    const app = createApp(router);

    const confirmRes = await request(app).post('/api/ai/chat/confirm').send({
      message: 'Assess the acquisition timing',
      context: { conversationId: 'conv-2' },
      aiModes: { deepResearch: true },
    });

    expect(confirmRes.status).toBe(200);

    const streamRes = await request(app).post('/api/ai/chat/stream').send({
      message: 'Different follow-up message',
      context: {
        conversationId: 'conv-2',
        deepThinkingConfirmed: true,
        deepThinkingConfirmToken: confirmRes.body.confirmToken,
      },
      aiModes: { deepResearch: true },
    });

    expect(streamRes.status).toBe(400);
    expect(streamRes.body.code).toBe('DEEP_THINKING_CONFIRM_INVALID');
  });

  it('exports the structured deep thinking report instead of the latest plain AI message', async () => {
    exportedMessages = [
      {
        content: 'Latest short reply',
        metadata: JSON.stringify({}),
        role: 'ai',
        created_at: '2026-04-18T12:00:00.000Z',
      },
      {
        content: 'Fallback DT content',
        metadata: JSON.stringify({
          deepThinking: { kind: 'report', expectedOutput: 'StructuredAnalysis' },
          deepThinkingReport: 'Structured exported report body',
        }),
        role: 'ai',
        created_at: '2026-04-18T11:00:00.000Z',
      },
    ];

    const { default: router } = await import('../../../server/src/routes/ai.routes.ts');
    const res = await request(createApp(router)).post('/api/ai/deep-research/export').send({
      conversationId: 'conv-export-1',
    });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe('Structured exported report body');
    expect(res.body.report).toEqual(
      expect.objectContaining({
        expectedOutput: 'StructuredAnalysis',
        metadata: expect.objectContaining({ kind: 'report' }),
      })
    );
  });
});
