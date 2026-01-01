import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockDb = {
    all: vi.fn((sql, params, callback) => callback(null, [])),
    get: vi.fn((sql, params, callback) => callback(null, null)),
    run: vi.fn(function(sql, params, callback) { callback.call({ changes: 1, lastID: 1 }, null); })
};

vi.mock('../../../server/database', () => ({
    default: mockDb
}));

vi.mock('../../../server/middleware/authMiddleware', () => ({
    default: (req, res, next) => {
        req.user = { id: 'user-1', organizationId: 'org-1' };
        req.userId = 'user-1';
        next();
    }
}));

describe('AI Memory Routes', () => {
    let app;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = express();
        app.use(express.json());
        const aiMemoryRouter = (await import('../../../server/routes/ai-memory.js')).default;
        app.use('/api/ai-memory', aiMemoryRouter);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('GET /api/ai-memory', () => {
        it('should list user memories', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { id: 'mem-1', key: 'preference', value: 'value1', source: 'user' }
                ]);
            });

            const response = await request(app)
                .get('/api/ai-memory')
                .expect(200);

            expect(response.body.memories).toBeDefined();
            expect(Array.isArray(response.body.memories)).toBe(true);
        });

        it('should filter by source', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, []);
            });

            await request(app)
                .get('/api/ai-memory?source=user')
                .expect(200);

            expect(mockDb.all).toHaveBeenCalled();
        });
    });

    describe('GET /api/ai-memory/context', () => {
        it('should get formatted memory context', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { key: 'pref1', value: 'val1', source: 'user', confidence: 1.0 }
                ]);
            });

            const response = await request(app)
                .get('/api/ai-memory/context')
                .expect(200);

            expect(response.body.context).toBeDefined();
        });
    });

    describe('POST /api/ai-memory', () => {
        it('should create a memory', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1, lastID: 'mem-new' }, null);
            });

            const response = await request(app)
                .post('/api/ai-memory')
                .send({ key: 'test-key', value: 'test-value', source: 'user' })
                .expect(201);

            expect(response.body).toBeDefined();
            expect(mockDb.run).toHaveBeenCalled();
        });
    });
});

