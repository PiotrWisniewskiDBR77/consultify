import app from '../../../server/src/index.js';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    process.env.SQLITE_PATH = ':memory:';
});

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
        req.organizationId = 'org-1';
        next();
    }
}));

describe('Pinned Prompts Routes', () => {
    const db = getDatabase();
    beforeAll(async () => {
        await initializeDatabase();
    });

    let app;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = express();
        app.use(express.json());
        const pinnedPromptsRouter = (await import('../../../server/routes/pinned-prompts.js')).default;
        app.use('/api/pinned-prompts', pinnedPromptsRouter);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('GET /api/pinned-prompts', () => {
    const db = getDatabase();
    beforeAll(async () => {
        await initializeDatabase();
    });

        it('should list pinned prompts', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { id: 'prompt-1', prompt: 'Test prompt', label: 'Test', usage_count: 5 }
                ]);
            });

            const response = await request(app)
                .get('/api/pinned-prompts')
                .expect(200);

            expect(response.body.prompts).toBeDefined();
            expect(Array.isArray(response.body.prompts)).toBe(true);
        });

        it('should filter by category', async () => {
            mockDb.all.mockResolvedValue($2);

            await request(app)
                .get('/api/pinned-prompts?category=general')
                .expect(200);

            expect(mockDb.all).toHaveBeenCalled();
        });
    });

    describe('POST /api/pinned-prompts', () => {
    const db = getDatabase();
    beforeAll(async () => {
        await initializeDatabase();
    });

        it('should create a pinned prompt', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1, lastID: 'prompt-new' }, null);
            });

            const response = await request(app)
                .post('/api/pinned-prompts')
                .send({ prompt: 'Test prompt', label: 'Test Label' })
                .expect(201);

            expect(response.body).toBeDefined();
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should validate required fields', async () => {
            await request(app)
                .post('/api/pinned-prompts')
                .send({})
                .expect(400);
        });
    });
});