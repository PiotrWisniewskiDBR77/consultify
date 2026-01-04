
/**
 * Help Feedback API Unit Tests (Integration with Singleton DB)
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock Database
const mockDb = {
    run: vi.fn((sql, params, cb) => {
        if (cb) cb(null);
        else return Promise.resolve({ changes: 1 });
    }),
    get: vi.fn((sql, params, cb) => {
        if (cb) cb(null, null);
        else return Promise.resolve(null);
    }),
    all: vi.fn((sql, params, cb) => {
        if (cb) cb(null, []);
        else return Promise.resolve([]);
    }),
    query: vi.fn((sql, params) => {
        return Promise.resolve({ rows: [] });
    })
};

vi.doMock('../../server/database.js', () => ({
    default: mockDb,
    getDatabase: () => mockDb
}));

// We need to require routes because they are CJS and might depend on other CJS modules
// Using await import to ensure mock is applied first
let helpFeedbackRoutes;

// Mock Auth Middleware globally
vi.mock('../../server/middleware/authMiddleware', () => ({
    default: (req, res, next) => {
        req.user = { id: 'test-user', organizationId: 'test-org' };
        req.userId = 'test-user';
        req.organizationId = 'test-org';
        next();
    }
}));


describe('Help Feedback API', () => {
    let app;

    beforeAll(async () => {
        vi.resetModules();
        const routesModule = await import('../../server/routes/helpFeedback.js');
        helpFeedbackRoutes = routesModule.default;
    });

    beforeEach(async () => {
        vi.clearAllMocks();

        // Initialize App
        app = express();
        app.use(express.json());
        app.use((req, res, next) => {
            req.user = { id: 'test-user', organizationId: 'test-org' };
            next();
        });
        app.use('/api/help', helpFeedbackRoutes);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('POST /api/help/feedback', () => {
        it('should create feedback successfully', async () => {
            const feedbackData = {
                contentType: 'card',
                contentId: 'profile-settings',
                isHelpful: true,
                rating: 5,
                comment: 'Very helpful!'
            };

            const response = await request(app)
                .post('/api/help/feedback')
                .send(feedbackData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/help/feedback')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();
        });

        // ... Keep existing logic but via Supertest
    });

    describe('GET /api/help/analytics/summary', () => {
        it('should return analytics summary', async () => {
            // Mock db.query to return seeded events
            mockDb.query.mockImplementation((sql, params) => {
                if (sql.includes('GROUP BY event_type')) {
                    return Promise.resolve({
                        rows: [
                            { event_type: 'search', count: 5 },
                            { event_type: 'feedback', count: 2 }
                        ]
                    });
                }
                return Promise.resolve({ rows: [] });
            });

            const response = await request(app)
                .get('/api/help/analytics/summary');

            expect(response.status).toBe(200);
            expect(response.body.eventsByType).toBeDefined();
        });
    });
});
