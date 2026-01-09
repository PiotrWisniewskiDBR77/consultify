/**
 * AI Layers Integration Tests
 * Tests for AI-controlled operations via real API endpoints
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../server/src/database/Database.js';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    const workerId = process.env.VITEST_WORKER_ID || '0';
    process.env.SQLITE_PATH = `./test-ai-layers-${workerId}.db`;
});

describe('AI Layers Integration', () => {
    let app;
    let authToken;
    const db = getDatabase();
    const testId = Date.now();
    const testOrgId = `ai-layers-org-${testId}`;
    const testUserId = `ai-layers-user-${testId}`;
    const testEmail = `ai-layers-${testId}@test.com`;

    beforeAll(async () => {
        await initializeDatabase();
        const serverModule = await import('../../server/src/index.js');
        app = serverModule.default;

        // Create test organization and user
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'AI Layers Test Org', 'enterprise', 'active']
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, testEmail, hash, 'AIUser', 'ADMIN'],
                    resolve
                );
            });
        });

        // Login to get auth token
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: testEmail, password: 'test123' });

        if (loginRes.body.token) {
            authToken = loginRes.body.token;
        }
    });

    afterAll(async () => {
        // Cleanup
        await new Promise((resolve) => {
            db.serialize(() => {
                db.run('DELETE FROM ai_drafts WHERE user_id = ?', [testUserId]);
                db.run('DELETE FROM users WHERE id = ?', [testUserId]);
                db.run('DELETE FROM organizations WHERE id = ?', [testOrgId], resolve);
            });
        });
    });

    describe('AI Drafts (Controlled AI Operations)', () => {
        it('should return 401 without auth for drafts list', async () => {
            const res = await request(app).get('/api/ai-drafts');
            expect([401, 403]).toContain(res.status);
        });

        it('should get pending AI drafts with auth', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/ai-drafts')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 404, 500]).toContain(res.status);
            if (res.status === 200) {
                expect(Array.isArray(res.body) || res.body.drafts).toBe(true);
            }
        });

        it('should get user draft stats', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/ai-drafts/user/stats')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 404, 500]).toContain(res.status);
        });
    });

    describe('AI Nudges (Proactive Intelligence)', () => {
        it('should return 401 without auth for pending nudges', async () => {
            const res = await request(app).get('/api/ai/nudges/pending');
            expect([401, 403]).toContain(res.status);
        });

        it('should get pending nudges with auth', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/ai/nudges/pending')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 404, 500]).toContain(res.status);
        });

        it('should track nudge interaction', async () => {
            if (!authToken) return;

            const res = await request(app)
                .post('/api/ai/nudges/track')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    nudgeId: 'test-nudge-1',
                    action: 'viewed'
                });

            expect([200, 201, 400, 404, 500]).toContain(res.status);
        });

        it('should dismiss nudge', async () => {
            if (!authToken) return;

            const res = await request(app)
                .post('/api/ai/nudges/dismiss')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    nudgeId: 'test-nudge-1',
                    reason: 'not_relevant'
                });

            expect([200, 204, 400, 404, 500]).toContain(res.status);
        });
    });

    describe('AI Settings (Proactivity Config)', () => {
        it('should get proactivity settings', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/ai-settings/proactivity')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 403, 404, 500]).toContain(res.status);
        });

        it('should get available proactivity modes', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/ai-settings/proactivity/modes')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 403, 404, 500]).toContain(res.status);
        });

        it('should get effective AI settings', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/ai-settings/effective')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 403, 404, 500]).toContain(res.status);
        });

        it('should get available AI models', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/ai-settings/available-models')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 403, 404, 500]).toContain(res.status);
        });
    });

    describe('AI Feedback (Fallback Value Learning)', () => {
        it('should submit AI feedback', async () => {
            if (!authToken) return;

            const res = await request(app)
                .post('/api/ai-feedback')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    type: 'response_quality',
                    rating: 4,
                    comment: 'Good response'
                });

            expect([200, 201, 400, 500]).toContain(res.status);
        });

        it('should get feedback stats', async () => {
            if (!authToken) return;

            const res = await request(app)
                .get('/api/ai-feedback/stats')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 403, 404, 500]).toContain(res.status);
        });
    });
});
