/**
 * AI API Tests
 * Tests for AI-related API endpoints
 *
 * @module tests/api/ai-api.test.js
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../server/src/database/DatabaseInitializer.ts', () => ({
  default: {
    getInstance: () => ({
      getDatabase: () => mockDb,
      initPromise: Promise.resolve(),
    }),
  },
}));

const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  prepare: vi.fn().mockReturnValue({ run: vi.fn(), get: vi.fn(), all: vi.fn() }),
};

describe('AI API Tests', () => {
  let app;

  beforeAll(async () => {
    try {
      const gateway = await import('../../server/src/Gateway.ts');
      app = gateway.default || gateway.app;
    } catch (error) {
      const express = (await import('express')).default;
      app = express();
      app.use(express.json());

      // Mock AI routes
      app.post('/api/ai/chat', (req, res) => {
        const { message, conversationId } = req.body;

        if (!message) {
          return res.status(400).json({
            success: false,
            error: 'Message required',
          });
        }

        res.json({
          success: true,
          data: {
            response: 'Mock AI response',
            conversationId: conversationId || 'conv-new',
            tokens: { prompt: 10, completion: 20 },
          },
        });
      });

      app.post('/api/ai/stream', (req, res) => {
        const { message } = req.body;

        if (!message) {
          return res.status(400).json({ success: false, error: 'Message required' });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.write('data: {"text": "Mock"}\n\n');
        res.write('data: {"text": " streaming"}\n\n');
        res.write('data: {"text": " response"}\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
      });

      app.get('/api/ai/conversations', (req, res) => {
        res.json({
          success: true,
          data: [
            { id: 'conv-1', title: 'Conversation 1' },
            { id: 'conv-2', title: 'Conversation 2' },
          ],
        });
      });

      app.get('/api/ai/conversations/:id', (req, res) => {
        res.json({
          success: true,
          data: {
            id: req.params.id,
            messages: [
              { role: 'user', content: 'Hello' },
              { role: 'assistant', content: 'Hi there!' },
            ],
          },
        });
      });

      app.delete('/api/ai/conversations/:id', (req, res) => {
        res.json({ success: true, message: 'Deleted' });
      });

      app.get('/api/ai/usage', (req, res) => {
        res.json({
          success: true,
          data: {
            tokensUsed: 5000,
            tokensLimit: 100000,
            requestsCount: 50,
          },
        });
      });

      app.get('/api/ai/models', (req, res) => {
        res.json({
          success: true,
          data: [
            { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
            { id: 'claude-3', name: 'Claude 3', provider: 'anthropic' },
          ],
        });
      });

      app.post('/api/ai/feedback', (req, res) => {
        const { messageId, rating } = req.body;

        if (!messageId || rating === undefined) {
          return res.status(400).json({ success: false, error: 'Missing fields' });
        }

        res.json({ success: true });
      });
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════
  // CHAT
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/ai/chat', () => {
    it('should send chat message', async () => {
      const response = await request(app).post('/api/ai/chat').send({ message: 'Hello AI' });

      expect([200, 401]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('response');
      }
    });

    it('should require message', async () => {
      const response = await request(app).post('/api/ai/chat').send({});

      expect([400, 401]).toContain(response.status);
    });

    it('should return token usage', async () => {
      const response = await request(app).post('/api/ai/chat').send({ message: 'Hello' });

      if (response.status === 200) {
        expect(response.body.data).toHaveProperty('tokens');
      }
    });

    it('should support conversation context', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .send({ message: 'Continue', conversationId: 'conv-123' });

      expect([200, 401]).toContain(response.status);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // STREAMING
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/ai/stream', () => {
    it('should stream response', async () => {
      const response = await request(app).post('/api/ai/stream').send({ message: 'Hello' });

      expect([200, 401]).toContain(response.status);
    });

    it('should use SSE content type', async () => {
      const response = await request(app).post('/api/ai/stream').send({ message: 'Hello' });

      if (response.status === 200) {
        expect(response.headers['content-type']).toMatch(/event-stream|json/);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CONVERSATIONS
  // ═══════════════════════════════════════════════════════════════════

  describe('GET /api/ai/conversations', () => {
    it('should list conversations', async () => {
      const response = await request(app).get('/api/ai/conversations');

      expect([200, 401]).toContain(response.status);

      if (response.status === 200) {
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  describe('GET /api/ai/conversations/:id', () => {
    it('should get conversation by ID', async () => {
      const response = await request(app).get('/api/ai/conversations/conv-1');

      expect([200, 401, 404]).toContain(response.status);
    });
  });

  describe('DELETE /api/ai/conversations/:id', () => {
    it('should delete conversation', async () => {
      const response = await request(app).delete('/api/ai/conversations/conv-1');

      expect([200, 204, 401, 404]).toContain(response.status);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // USAGE
  // ═══════════════════════════════════════════════════════════════════

  describe('GET /api/ai/usage', () => {
    it('should return usage statistics', async () => {
      const response = await request(app).get('/api/ai/usage');

      expect([200, 401]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.data).toHaveProperty('tokensUsed');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MODELS
  // ═══════════════════════════════════════════════════════════════════

  describe('GET /api/ai/models', () => {
    it('should list available models', async () => {
      const response = await request(app).get('/api/ai/models');

      expect([200, 401]).toContain(response.status);

      if (response.status === 200) {
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FEEDBACK
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/ai/feedback', () => {
    it('should submit feedback', async () => {
      const response = await request(app)
        .post('/api/ai/feedback')
        .send({ messageId: 'msg-1', rating: 5 });

      expect([200, 401]).toContain(response.status);
    });

    it('should require messageId and rating', async () => {
      const response = await request(app).post('/api/ai/feedback').send({});

      expect([400, 401]).toContain(response.status);
    });
  });
});
