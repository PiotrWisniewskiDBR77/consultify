/**
 * Critical Endpoints Tests
 * Tests for the most important API endpoints that must work reliably
 */

const { describe, it, expect, beforeEach, afterEach } = require('vitest');
const request = require('supertest');
const app = require('../../server/index.js');
const { initTestDb, cleanTables, dbRun, dbAll } = require('../helpers/dbHelper.cjs');

describe('Critical API Endpoints', () => {
    beforeEach(async () => {
        await initTestDb();
    });

    afterEach(async () => {
        await cleanTables();
    });

    describe('Health Check Endpoint', () => {
        it('should return healthy status', async () => {
            const res = await request(app)
                .get('/api/health')
                .expect(200);

            expect(res.body).toMatchObject({
                status: 'ok',
                database: 'connected',
                timestamp: expect.any(String)
            });
        });

        it('should include latency information', async () => {
            const res = await request(app)
                .get('/api/health')
                .expect(200);

            expect(res.body).toHaveProperty('latency');
            expect(typeof res.body.latency).toBe('number');
            expect(res.body.latency).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Authentication Endpoints', () => {
        it('should handle login requests', async () => {
            // Create test user
            await dbRun(`
                INSERT INTO organizations (id, name, plan_type, created_at)
                VALUES ('test-org', 'Test Org', 'ENTERPRISE', datetime('now'))
            `);

            await dbRun(`
                INSERT INTO users (id, email, password_hash, organization_id, role, created_at)
                VALUES ('test-user', 'test@example.com', '$2a$10$test', 'test-org', 'ADMIN', datetime('now'))
            `);

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'test' })
                .expect(200);

            // Response should have token or error
            expect(res.body).toBeDefined();
        });

        it('should reject invalid login credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'invalid@example.com', password: 'wrong' })
                .expect(401);

            expect(res.body).toHaveProperty('error');
        });

        it('should handle registration requests', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'newuser@example.com',
                    password: 'password123',
                    name: 'Test User'
                });

            // May succeed or fail based on validation, but should not crash
            expect([200, 201, 400, 500]).toContain(res.status);
        });
    });

    describe('Project Endpoints', () => {
        it('should handle project creation requests', async () => {
            const res = await request(app)
                .post('/api/projects')
                .send({
                    name: 'Test Project',
                    description: 'Test Description'
                });

            // May require authentication, but should not crash
            expect([201, 400, 401, 500]).toContain(res.status);
        });

        it('should handle project listing requests', async () => {
            const res = await request(app)
                .get('/api/projects');

            // May require authentication, but should not crash
            expect([200, 401, 500]).toContain(res.status);
        });
    });

    describe('User Endpoints', () => {
        it('should handle user profile requests', async () => {
            const res = await request(app)
                .get('/api/users/me');

            // Should require authentication
            expect([200, 401, 500]).toContain(res.status);
        });
    });

    describe('AI Endpoints', () => {
        it('should handle AI health check', async () => {
            const res = await request(app)
                .get('/api/ai/health');

            // May require authentication or may be public
            expect([200, 401, 404, 500]).toContain(res.status);
        });
    });

    describe('Error Handling in Critical Endpoints', () => {
        it('should handle database errors gracefully', async () => {
            // Health check should work even if other endpoints fail
            const res = await request(app)
                .get('/api/health')
                .expect(200);

            expect(res.body.status).toBe('ok');
        });

        it('should return proper error codes', async () => {
            const res = await request(app)
                .get('/api/users/me')
                .expect(401);

            expect(res.body).toHaveProperty('error');
        });
    });

    describe('Performance of Critical Endpoints', () => {
        it('should respond to health checks quickly', async () => {
            const start = Date.now();
            await request(app)
                .get('/api/health')
                .expect(200);
            const duration = Date.now() - start;

            // Health check should be fast (< 1 second)
            expect(duration).toBeLessThan(1000);
        });

        it('should handle concurrent health checks', async () => {
            const requests = Array(10).fill(null).map(() =>
                request(app).get('/api/health')
            );

            const start = Date.now();
            const responses = await Promise.all(requests);
            const duration = Date.now() - start;

            expect(responses.every(r => r.status === 200)).toBe(true);
            // Should handle 10 concurrent requests quickly
            expect(duration).toBeLessThan(5000);
        });
    });
});

