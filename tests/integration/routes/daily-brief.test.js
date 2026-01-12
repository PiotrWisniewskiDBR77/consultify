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
        req.organizationId = 'org-1';
        next();
    }
}));

describe('Daily Brief Routes', () => {
    let app;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = express();
        app.use(express.json());
        const dailyBriefRouter = (await import('../../../server/routes/daily-brief.js')).default;
        app.use('/api/daily-brief', dailyBriefRouter);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('GET /api/daily-brief', () => {
        it('should generate daily brief', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, []);
            });

            const response = await request(app)
                .get('/api/daily-brief')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(response.body.decisions).toBeDefined();
            expect(response.body.tasks).toBeDefined();
            expect(response.body.initiatives).toBeDefined();
        });

        it('should filter by project', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, []);
            });

            await request(app)
                .get('/api/daily-brief?projectId=project-123')
                .expect(200);

            expect(mockDb.all).toHaveBeenCalled();
        });
    });
});










