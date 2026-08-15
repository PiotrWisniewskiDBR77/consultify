/**
 * Help Chat Routes Unit Tests
 *
 * Tests the /api/help/chat and /api/help/feedback endpoints
 * with properly mocked AI pipeline and KB context.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockProcess = vi.fn();
const mockBuildContext = vi.fn();
const mockIsProductQuery = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => {
    _req.userId = 'test-user';
    _req.organizationId = 'test-org';
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/services/ai/AIPipeline.js', () => ({
  AIPipeline: class {
    process = mockProcess;
  },
}));

vi.mock('../../../server/src/services/ai/helpDocsContext.js', () => ({
  buildHelpDocsContext: (...a: unknown[]) => mockBuildContext(...a),
  isProductOrHowToQuery: (...a: unknown[]) => mockIsProductQuery(...a),
}));

const { default: helpChatRoutes } = await import('../../../server/src/routes/helpChat.routes.js');

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/help', helpChatRoutes);
  return app;
}

describe('Help Chat Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildContext.mockResolvedValue({
      isProductQuestion: true,
      citations: [{ id: 'kb1', title: 'Tools Primer', link: '/kb/p25b-tools-primer' }],
      systemInstructionAddon: '\n## KB Articles\n[KB1] Tools Primer...',
    });
    mockIsProductQuery.mockReturnValue(true);
    mockProcess.mockResolvedValue({
      text: 'Based on [KB1] Tools Primer, you can start by browsing the library.',
    });
  });

  describe('POST /api/help/chat', () => {
    it('returns AI response with KB sources', async () => {
      const res = await request(createApp())
        .post('/api/help/chat')
        .send({ message: 'How do I use tools?' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Tools Primer');
      expect(res.body.sources).toBeDefined();
      expect(res.body.sources.length).toBeGreaterThanOrEqual(1);
      expect(res.body.sources[0].title).toBe('Tools Primer');
      expect(res.body.isProductQuestion).toBe(true);
    });

    it('passes context module to buildHelpDocsContext', async () => {
      await request(createApp())
        .post('/api/help/chat')
        .send({ message: 'Help me', context: 'dashboard' });

      expect(mockBuildContext).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'Help me',
          moduleId: 'dashboard',
          surface: 'help',
        })
      );
    });

    it('includes system instruction addon from KB context', async () => {
      await request(createApp()).post('/api/help/chat').send({ message: 'What is the interview?' });

      const processCall = mockProcess.mock.calls[0][0];
      expect(processCall.options.systemInstruction).toContain('KB Articles');
    });

    it('uses capability help', async () => {
      await request(createApp()).post('/api/help/chat').send({ message: 'test question' });

      const processCall = mockProcess.mock.calls[0][0];
      expect(processCall.capability).toBe('help');
    });

    it('appends fallback instruction when no KB docs match a product question', async () => {
      mockBuildContext.mockResolvedValue({
        isProductQuestion: true,
        citations: [],
        systemInstructionAddon: '',
      });

      await request(createApp()).post('/api/help/chat').send({ message: 'How do I configure X?' });

      const processCall = mockProcess.mock.calls[0][0];
      expect(processCall.options.systemInstruction).toContain(
        'No matching documentation was found'
      );
    });

    it('system prompt mentions Teresa', async () => {
      await request(createApp()).post('/api/help/chat').send({ message: 'who are you?' });

      const processCall = mockProcess.mock.calls[0][0];
      expect(processCall.options.systemInstruction).toContain('Teresa');
    });

    it('returns 500 on AI pipeline error', async () => {
      mockProcess.mockRejectedValue(new Error('AI unavailable'));

      const res = await request(createApp()).post('/api/help/chat').send({ message: 'test' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('HelpChat request failed');
      expect(JSON.stringify(res.body)).not.toContain('AI unavailable');
    });
  });
});
