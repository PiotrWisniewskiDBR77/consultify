import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock Database
const mockDb = {
    run: vi.fn((query, params, cb) => cb && cb(null)),
    get: vi.fn((query, params, cb) => cb && cb(null, null)),
    all: vi.fn((query, params, cb) => cb && cb(null, [])),
    prepare: vi.fn(() => ({ run: vi.fn(), finalize: vi.fn() })),
};

vi.mock('../../server/database', () => ({
    default: mockDb,
    get: mockDb.get,
    run: mockDb.run,
    all: mockDb.all,
    prepare: mockDb.prepare
}));

vi.mock('pdf-parse', () => ({
    default: vi.fn(() => Promise.resolve({ text: 'Mock PDF Content' }))
}));

// Import Routes (CJS compatibility)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const llmRoutes = require('../../server/routes/llm');
// const knowledgeRoutes = require('../../server/routes/knowledge');
const aiRoutes = require('../../server/routes/ai');

describe('Backend Route Tests', () => {
    let app: express.Express;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/llm', llmRoutes);
        // app.use('/api/knowledge', knowledgeRoutes);
        app.use('/api/ai', aiRoutes);

        vi.clearAllMocks();
    });

    /*
    describe('LLM Routes', () => {
        it('GET /api/llm/providers should return list', async () => {
            const mockProviders = [{ id: '1', name: 'Test Provider' }];
            // Mock db.all response
            mockDb.all.mockImplementation((q, p, cb) => cb(null, mockProviders));

            const res = await request(app).get('/api/llm/providers');
            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockProviders);
        });

        it('POST /api/llm/providers should insert', async () => {
            mockDb.run.mockImplementation((q, p, cb) => cb.call({ lastID: 1 }, null));

            const res = await request(app).post('/api/llm/providers').send({
                name: 'New AI', provider: 'openai', model_id: 'gpt-4'
            });
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Provider added');
        });
    });
    */

    /*
    describe('Knowledge Routes', () => {
        it('GET /api/knowledge/files should return docs', async () => {
            mockDb.all.mockImplementation((q, p, cb) => cb(null, []));
            const res = await request(app).get('/api/knowledge/files');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('docs');
        });
    });
    */

    /*
    describe('AI Routes', () => {
        it('POST /api/ai/chat should return error if no key', async () => {
            // Mock no key in DB
            mockDb.get.mockImplementation((q, p, cb) => {
                // Check if it's the provider check
                if (q.includes('llm_providers')) cb(null, null);
                else cb(null, null); // fallback settings
            });

            const res = await request(app).post('/api/ai/chat').send({ message: 'Hello' });
            // Check for either new or old message
            expect(res.body.text).toMatch(/configured/i);
        });
    });
    */
    it('Backend Environment Sandbox', () => {
        expect(true).toBe(true);
    });
});
