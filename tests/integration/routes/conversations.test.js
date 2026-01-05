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
        next();
    }
}));

describe('Conversations Routes', () => {
    const db = getDatabase();
    beforeAll(async () => {
        await initializeDatabase();
    });

    let app;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = express();
        app.use(express.json());
        const conversationsRouter = (await import('../../../server/routes/conversations.js')).default;
        app.use('/api/conversations', conversationsRouter);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('GET /api/conversations', () => {
    const db = getDatabase();
    beforeAll(async () => {
        await initializeDatabase();
    });

        it('should list conversations', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { id: 'conv-1', title: 'Test Conversation', message_count: 5 }
                ]);
            });

            const response = await request(app)
                .get('/api/conversations')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body.conversations)).toBe(true);
        });

        it('should filter by archived status', async () => {
            mockDb.all.mockResolvedValue($2);

            await request(app)
                .get('/api/conversations?archived=false')
                .expect(200);

            expect(mockDb.all).toHaveBeenCalled();
        });

        it('should filter by project', async () => {
            mockDb.all.mockResolvedValue($2);

            await request(app)
                .get('/api/conversations?projectId=project-123')
                .expect(200);

            expect(mockDb.all).toHaveBeenCalled();
        });
    });

    describe('POST /api/conversations', () => {
    const db = getDatabase();
    beforeAll(async () => {
        await initializeDatabase();
    });

        it('should create a new conversation', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1, lastID: 'conv-new' }, null);
            });

            const response = await request(app)
                .post('/api/conversations')
                .send({ title: 'New Conversation' })
                .expect(201);

            expect(response.body).toBeDefined();
            expect(mockDb.run).toHaveBeenCalled();
        });
    });
});