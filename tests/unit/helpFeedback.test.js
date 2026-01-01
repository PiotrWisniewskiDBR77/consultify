
/**
 * Help Feedback API Unit Tests (Integration with Singleton DB)
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Import Real Dependencies (Singleton)
import db from '../../server/database.js';
// We need to require routes because they are CJS and might depend on other CJS modules
import helpFeedbackRoutes from '../../server/routes/helpFeedback.js';

// Mock Auth Middleware globally (or rely on bypass if available)
// helpFeedback routes might not use the same bypass logic as ai-memory.
// Let's check if helpFeedbackRoutes uses verifyToken.
// If so, we might need to mock it.
// Assuming verifyToken is used.
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

    const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });

    beforeAll(async () => {
        vi.restoreAllMocks();
    });

    beforeEach(async () => {
        // Clear tables
        await dbRun('DELETE FROM help_feedback');
        await dbRun('DELETE FROM help_events');

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
            // Seed some events first
            await dbRun(`INSERT INTO help_analytics 
                (id, user_id, organization_id, event_type, content_type, content_id, metadata, created_at)
                VALUES 
                ('evt-1', 'test-user', 'test-org', 'search', 'global', 'none', '{"query":"help"}', datetime('now'))
            `);

            const response = await request(app)
                .get('/api/help/analytics/summary');

            expect(response.status).toBe(200);
            expect(response.body.eventsByType).toBeDefined();
        });
    });
});
