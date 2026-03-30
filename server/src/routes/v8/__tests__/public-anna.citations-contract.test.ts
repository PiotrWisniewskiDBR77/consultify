import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildAnnaKnowledgeContext = vi.fn();
vi.mock('../../../services/ai/annaKnowledgeService.js', () => ({
  buildAnnaKnowledgeContext,
  buildAnnaVoiceBootstrap: vi.fn().mockResolvedValue({
    contextText: 'Voice bootstrap',
    sources: [],
    matchedProducts: [],
    primaryProducts: [],
  }),
}));

vi.mock('../../../services/ai/virtualWorkerService.js', () => ({
  getWorkerWithProfile: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../services/ai/virtualWorkerConversationLogger.js', () => ({
  findOrCreateConversation: vi.fn(),
  logMessage: vi.fn(),
}));

vi.mock('../../../services/annaAnalyticsService.js', () => ({
  PUBLIC_ANNA_FUNNEL_EVENT_NAMES: [
    'landing_anna_widget_opened',
    'landing_anna_message_sent',
    'landing_anna_fallback_shown',
    'landing_anna_handoff_clicked',
  ],
  recordPublicAnnaFunnelEvent: vi.fn().mockResolvedValue(undefined),
}));

const getApiKeyFromEnv = vi.fn().mockReturnValue('test-google-key');
vi.mock('../../../services/ai/llmConfigService.js', () => ({
  default: { getApiKeyFromEnv },
}));

async function importRouter() {
  const mod = await import('../../public-anna.routes.js');
  return mod.default;
}

async function createApp(): Promise<Express> {
  const app = express();
  app.use(express.json());
  const router = await importRouter();
  app.use('/api/public/anna', router);
  return app;
}

describe('Public Anna chat — citations/uncertainty contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: { parts: [{ text: 'Consultify helps structure transformation decisions.' }] },
            },
          ],
        }),
        text: async () => '',
      })
    );
  });

  it('appends Sources when knowledge sources are present', async () => {
    buildAnnaKnowledgeContext.mockResolvedValue({
      contextText: 'Public knowledge context',
      sources: ['landing-doc', 'pricing-page'],
      matchedProducts: ['consultify'],
      primaryProducts: ['consultify'],
    });

    const app = await createApp();
    const res = await request(app)
      .post('/api/public/anna/chat')
      .send({ message: 'What is Consultify?', sessionId: 'sess-1', locale: 'en' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Sources: landing-doc, pricing-page');
  });

  it('adds an explicit uncertainty marker when knowledge sources are empty', async () => {
    buildAnnaKnowledgeContext.mockResolvedValue({
      contextText: 'Public knowledge context',
      sources: [],
      matchedProducts: ['consultify'],
      primaryProducts: ['consultify'],
    });

    const app = await createApp();
    const res = await request(app)
      .post('/api/public/anna/chat')
      .send({ message: 'What is Consultify?', sessionId: 'sess-2', locale: 'en' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('I may be mistaken');
  });
});

