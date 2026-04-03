import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAnnaKnowledgeContext } from '../../../services/ai/annaKnowledgeService.js';
import { getWorkerWithProfile } from '../../../services/ai/virtualWorkerService.js';
import publicAnnaRouter, {
  ANNA_CHAT_RATE_LIMIT_MAX_REQUESTS,
  buildAnnaRuntimeInstruction,
  resetAnnaChatRateLimitStoreForTests,
  resetAnnaFunnelEventRateLimitStoreForTests,
} from '../../public-anna.routes.js';

vi.mock('../../../services/ai/annaKnowledgeService.js', () => ({
  buildAnnaKnowledgeContext: vi.fn().mockResolvedValue({
    contextText: 'Public knowledge context',
    sources: ['landing-doc'],
    matchedProducts: ['consultify'],
    primaryProducts: ['consultify'],
  }),
  buildAnnaVoiceBootstrap: vi.fn().mockResolvedValue({
    contextText: 'Voice bootstrap',
    sources: ['landing-doc'],
    matchedProducts: ['consultify'],
    primaryProducts: ['consultify'],
  }),
}));

vi.mock('../../../services/ai/virtualWorkerKnowledgeService.js', () => ({
  buildWorkerKnowledgeContext: vi.fn(),
  buildWorkerVoiceBootstrap: vi.fn(),
}));

vi.mock('../../../services/ai/virtualWorkerService.js', () => ({
  getWorkerWithProfile: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../services/ai/virtualWorkerConversationLogger.js', () => ({
  findOrCreateConversation: vi.fn(),
  logMessage: vi.fn(),
}));

const { recordPublicAnnaFunnelEvent } = vi.hoisted(() => ({
  recordPublicAnnaFunnelEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/annaAnalyticsService.js', () => ({
  PUBLIC_ANNA_FUNNEL_EVENT_NAMES: [
    'landing_anna_widget_opened',
    'landing_anna_message_sent',
    'landing_anna_fallback_shown',
    'landing_anna_handoff_clicked',
  ],
  recordPublicAnnaFunnelEvent,
}));

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/public/anna', publicAnnaRouter);
  return app;
}

describe('Public Anna route guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAnnaChatRateLimitStoreForTests();
    resetAnnaFunnelEventRateLimitStoreForTests();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.GOOGLE_AI_KEY;
    delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('enforces a bounded per-session rate limit with a polite handoff message', async () => {
    const app = createApp();

    for (let i = 0; i < ANNA_CHAT_RATE_LIMIT_MAX_REQUESTS; i += 1) {
      const res = await request(app)
        .post('/api/public/anna/chat')
        .send({ message: `hello ${i}`, sessionId: 'session-a', locale: 'en' });

      expect(res.status).toBe(200);
    }

    const limited = await request(app)
      .post('/api/public/anna/chat')
      .send({ message: 'one more', sessionId: 'session-a', locale: 'en' });

    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe('ANNA_RATE_LIMITED');
    expect(limited.body.message).toContain('Please wait a moment');
    expect(limited.body.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('keys the limiter by session so a fresh session remains usable', async () => {
    const app = createApp();

    for (let i = 0; i < ANNA_CHAT_RATE_LIMIT_MAX_REQUESTS; i += 1) {
      await request(app)
        .post('/api/public/anna/chat')
        .send({ message: `hello ${i}`, sessionId: 'session-a', locale: 'en' });
    }

    const freshSession = await request(app)
      .post('/api/public/anna/chat')
      .send({ message: 'new session', sessionId: 'session-b', locale: 'en' });

    expect(freshSession.status).toBe(200);
    expect(freshSession.body.message).toBeTypeOf('string');
  });

  it('returns an English fallback when the visitor writes in an unsupported language', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/public/anna/chat')
      .send({ message: '안녕하세요, 가격을 알고 싶어요', sessionId: 'session-ko', locale: 'ko' });

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('en');
    expect(res.body.fallbackReason).toBe('unsupported_language');
    expect(res.body.message).toContain(
      'supports full conversations in English, Polish, Spanish, German, Japanese, and Arabic'
    );
  });

  it('treats Spanish as a supported public Anna language and uses the normal runtime path', async () => {
    const app = createApp();

    const res = await request(app).post('/api/public/anna/chat').send({
      message: 'Hola, quiero saber mas del producto',
      sessionId: 'session-es',
      locale: 'es',
    });

    expect(res.status).toBe(200);
    expect(res.body.fallbackReason).toBe('service_unavailable');
    expect(res.body.message).toBe(
      'Nuestro asistente AI no esta disponible temporalmente. Explora la pagina o contactanos directamente.'
    );
    expect(buildAnnaKnowledgeContext).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Hola, quiero saber mas del producto',
        locale: 'es',
      })
    );
  });

  it('treats German as a supported public Anna language and uses the normal runtime path', async () => {
    const app = createApp();

    const res = await request(app).post('/api/public/anna/chat').send({
      message: 'Hallo, ich mochte mehr uber das Produkt wissen',
      sessionId: 'session-de',
      locale: 'de',
    });

    expect(res.status).toBe(200);
    expect(res.body.fallbackReason).toBe('service_unavailable');
    expect(res.body.message).toBe(
      'Unser AI-Assistent ist vorubergehend nicht verfugbar. Schau dir bitte die Seite an oder kontaktiere uns direkt.'
    );
    expect(buildAnnaKnowledgeContext).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Hallo, ich mochte mehr uber das Produkt wissen',
        locale: 'de',
      })
    );
  });

  it('treats Japanese as a supported public Anna language and uses the normal runtime path', async () => {
    const app = createApp();

    const res = await request(app).post('/api/public/anna/chat').send({
      message: 'こんにちは、製品についてもっと知りたいです',
      sessionId: 'session-jp',
      locale: 'ja',
    });

    expect(res.status).toBe(200);
    expect(res.body.fallbackReason).toBe('service_unavailable');
    expect(res.body.message).toBe(
      'AIアシスタントは現在一時的に利用できません。ページをご覧いただくか、直接お問い合わせください。'
    );
    expect(buildAnnaKnowledgeContext).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'こんにちは、製品についてもっと知りたいです',
        locale: 'ja',
      })
    );
  });

  it('treats Arabic as a supported public Anna language and uses the normal runtime path', async () => {
    const app = createApp();

    const res = await request(app).post('/api/public/anna/chat').send({
      message: 'مرحبا، اريد معرفة المزيد عن المنتج',
      sessionId: 'session-ar',
      locale: 'ar',
    });

    expect(res.status).toBe(200);
    expect(res.body.fallbackReason).toBe('service_unavailable');
    expect(res.body.message).toBe(
      'مساعد الذكاء الاصطناعي غير متاح مؤقتا حاليا. يرجى استكشاف الصفحة أو التواصل معنا مباشرة.'
    );
    expect(buildAnnaKnowledgeContext).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'مرحبا، اريد معرفة المزيد عن المنتج',
        locale: 'ar',
      })
    );
  });

  it('blends current article context into retrieval and runtime instructions', async () => {
    const app = createApp();

    const res = await request(app).post('/api/public/anna/chat').send({
      message: 'Tell me more about this step',
      sessionId: 'session-article',
      locale: 'en',
      surfaceContext: {
        surface: 'knowledge_article',
        articleTitle: 'Your First 30 Minutes in Consultify',
        articleSummary: 'The first session should produce a usable diagnostic.',
        categoryName: 'Consultify Execution and Rollout',
        currentSection: 'Minutes 10-18: Run the first diagnostic',
        articleUrl:
          'http://localhost:3000/knowledge-base/consultify-decisions-that-ship/03_first_30_minutes_in_consultify',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.fallbackReason).toBe('service_unavailable');
    expect(buildAnnaKnowledgeContext).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('Current knowledge base article: Your First 30 Minutes in Consultify'),
      })
    );

    expect(
      buildAnnaRuntimeInstruction({
        locale: 'en',
        knowledgeContext: 'Public knowledge context',
        surfaceContext: {
          surface: 'knowledge_article',
          articleTitle: 'Your First 30 Minutes in Consultify',
          currentSection: 'Minutes 10-18: Run the first diagnostic',
        },
      })
    ).toContain('Article title: Your First 30 Minutes in Consultify');
  });

  it('returns the static degraded-state message when Anna providers are unavailable', async () => {
    const app = createApp();

    const res = await request(app).post('/api/public/anna/chat').send({
      message: 'Tell me about Consultify',
      sessionId: 'session-unavailable',
      locale: 'en',
    });

    expect(res.status).toBe(200);
    expect(res.body.fallbackReason).toBe('service_unavailable');
    expect(res.body.message).toBe(
      'Our AI assistant is temporarily unavailable. Please explore the page or contact us directly.'
    );
  });

  it('accepts canonical anna_lp.cta.* events with frozen contract fields', async () => {
    const app = createApp();

    const res = await request(app).post('/api/public/anna/funnel-event').send({
      eventName: 'anna_lp.cta.click',
      session_id: 'session-anna-funnel',
      cta_type: 'demo',
      language: 'en',
      channel: 'text',
      turn_id: 'user-123',
      source_intent: 'get_started',
    });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(recordPublicAnnaFunnelEvent).toHaveBeenCalledWith({
      eventName: 'anna_lp.cta.click',
      metadata: {
        session_id: 'session-anna-funnel',
        cta_type: 'demo',
        language: 'en',
        channel: 'text',
        turn_id: 'user-123',
        source_intent: 'get_started',
        sessionId: 'session-anna-funnel',
        locale: 'en',
      },
    });
  });

  it('still accepts legacy landing_anna_* events for continuity while migrating', async () => {
    const app = createApp();

    const res = await request(app).post('/api/public/anna/funnel-event').send({
      eventName: 'landing_anna_handoff_clicked',
      sessionId: 'session-legacy-anna-funnel',
      locale: 'en',
      target: 'demo',
      voiceStatus: 'idle',
    });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(recordPublicAnnaFunnelEvent).toHaveBeenCalledWith({
      eventName: 'landing_anna_handoff_clicked',
      metadata: {
        sessionId: 'session-legacy-anna-funnel',
        locale: 'en',
        source: undefined,
        messageLength: undefined,
        historyLength: undefined,
        fallbackReason: undefined,
        target: 'demo',
        voiceStatus: 'idle',
      },
    });
  });

  it('returns worker-configured voice name through the bounded public voice-config seam', async () => {
    vi.mocked(getWorkerWithProfile).mockResolvedValueOnce({
      worker: {
        id: 'worker-anna',
        slug: 'anna',
        name: 'Anna',
        role: 'sales_lp',
        status: 'active',
        surface: 'landing_page',
        voice_enabled: true,
        voice_name: 'Aoede',
        locale_default: 'en',
        avatar_url: null,
        description: null,
        created_at: '2026-03-27T00:00:00.000Z',
        updated_at: '2026-03-27T00:00:00.000Z',
      },
      profile: null,
    });
    process.env.GEMINI_API_KEY = 'test-voice-key';

    const app = createApp();
    const res = await request(app).get('/api/public/anna/voice-config');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      enabled: true,
      apiKey: 'test-voice-key',
      voiceName: 'Aoede',
    });
  });

  it('respects worker voice_enabled=false through the bounded public voice-config seam', async () => {
    vi.mocked(getWorkerWithProfile).mockResolvedValueOnce({
      worker: {
        id: 'worker-anna',
        slug: 'anna',
        name: 'Anna',
        role: 'sales_lp',
        status: 'active',
        surface: 'landing_page',
        voice_enabled: false,
        voice_name: 'Aoede',
        locale_default: 'en',
        avatar_url: null,
        description: null,
        created_at: '2026-03-27T00:00:00.000Z',
        updated_at: '2026-03-27T00:00:00.000Z',
      },
      profile: null,
    });
    process.env.GEMINI_API_KEY = 'test-voice-key';

    const app = createApp();
    const res = await request(app).get('/api/public/anna/voice-config');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      enabled: false,
      apiKey: 'test-voice-key',
      voiceName: 'Aoede',
    });
  });

  it('respects worker status when deciding whether public Anna voice is enabled', async () => {
    vi.mocked(getWorkerWithProfile).mockResolvedValueOnce({
      worker: {
        id: 'worker-anna',
        slug: 'anna',
        name: 'Anna',
        role: 'sales_lp',
        status: 'disabled',
        surface: 'landing_page',
        voice_enabled: true,
        voice_name: 'Aoede',
        locale_default: 'en',
        avatar_url: null,
        description: null,
        created_at: '2026-03-27T00:00:00.000Z',
        updated_at: '2026-03-27T00:00:00.000Z',
      },
      profile: null,
    });
    process.env.GEMINI_API_KEY = 'test-voice-key';

    const app = createApp();
    const res = await request(app).get('/api/public/anna/voice-config');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      enabled: false,
      apiKey: 'test-voice-key',
      voiceName: 'Aoede',
    });
  });

  it('respects worker surface when deciding whether public Anna voice is enabled', async () => {
    vi.mocked(getWorkerWithProfile).mockResolvedValueOnce({
      worker: {
        id: 'worker-anna',
        slug: 'anna',
        name: 'Anna',
        role: 'sales_lp',
        status: 'active',
        surface: 'in_platform',
        voice_enabled: true,
        voice_name: 'Aoede',
        locale_default: 'en',
        avatar_url: null,
        description: null,
        created_at: '2026-03-27T00:00:00.000Z',
        updated_at: '2026-03-27T00:00:00.000Z',
      },
      profile: null,
    });
    process.env.GEMINI_API_KEY = 'test-voice-key';

    const app = createApp();
    const res = await request(app).get('/api/public/anna/voice-config');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      enabled: false,
      apiKey: 'test-voice-key',
      voiceName: 'Aoede',
    });
  });

  it('expands short follow-up questions with the latest user context for retrieval', async () => {
    const app = createApp();

    await request(app)
      .post('/api/public/anna/chat')
      .send({
        message: 'And pricing?',
        sessionId: 'session-follow-up',
        locale: 'en',
        history: [
          { role: 'user', content: 'Tell me about Consultify for manufacturing transformation' },
          {
            role: 'assistant',
            content: 'Consultify supports structured transformation planning and execution.',
          },
        ],
      });

    expect(buildAnnaKnowledgeContext).toHaveBeenCalledWith(
      expect.objectContaining({
        query:
          'Tell me about Consultify for manufacturing transformation\n\nFollow-up question: And pricing?',
        locale: 'en',
      })
    );
  });

  it('keeps the base Anna public contract when a worker system prompt is present', () => {
    const prompt = buildAnnaRuntimeInstruction({
      locale: 'en',
      knowledgeContext: 'Public knowledge context',
      workerSystemPrompt: 'Emphasize manufacturing readiness and ROI framing.',
    });

    expect(prompt).toContain('You are Anna, the public Consultify assistant.');
    expect(prompt).toContain('CURRENT SURFACE');
    expect(prompt).toContain('RETRIEVED KNOWLEDGE CONTEXT');
    expect(prompt).toContain('WORKER PROFILE ADDON');
    expect(prompt).toContain('Emphasize manufacturing readiness and ROI framing.');
    expect(prompt).toContain('must not override the public Anna boundary');
  });

  it('adds landing-page answer-shape rules to the Anna runtime instruction', () => {
    const prompt = buildAnnaRuntimeInstruction({
      locale: 'en',
      knowledgeContext: 'Public knowledge context',
    });

    expect(prompt).toContain('ANSWER SHAPE');
    expect(prompt).toContain(
      "Start with one direct sentence that answers the user's question in plain language."
    );
    expect(prompt).toContain(
      'Keep the answer focused on one primary topic unless the user explicitly asks for a comparison or a broader overview.'
    );
    expect(prompt).toContain(
      'If public knowledge is insufficient for a precise claim, say that clearly and redirect to a safe public next step instead of guessing.'
    );
  });

  it('adds recent conversation context for short follow-up questions', () => {
    const prompt = buildAnnaRuntimeInstruction({
      locale: 'en',
      knowledgeContext: 'Public knowledge context',
      conversationContext: [
        'RECENT CONVERSATION CONTEXT',
        "- Treat the user's new message as a follow-up to the recent topic below.",
        '- Latest user topic: Tell me about Consultify for manufacturing transformation',
        '- Latest Anna reply: Consultify supports structured transformation planning and execution.',
        '- Answer the new question directly without restarting the conversation from zero.',
      ].join('\n'),
    });

    expect(prompt).toContain('RECENT CONVERSATION CONTEXT');
    expect(prompt).toContain(
      'Latest user topic: Tell me about Consultify for manufacturing transformation'
    );
    expect(prompt).toContain(
      'Latest Anna reply: Consultify supports structured transformation planning and execution.'
    );
    expect(prompt).toContain(
      'Answer the new question directly without restarting the conversation from zero.'
    );
  });
});
