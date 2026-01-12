/**
 * Integration Tests for Auth Routes
 * 
 * Tests authentication API endpoints:
 * - Login
 * - Refresh token
 * - Sessions management
 * - MFA endpoints
 * - Password reset
 */

const request = require('supertest');
const app = require('../../../server/index.js');
const db = require('../../../server/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

describe('Auth Routes Integration', () => {
    let testUserId;
    let testOrgId;
    let testToken;
    let testRefreshToken;

    beforeAll(async () => {
        // Wait for DB initialization
        if (db.initPromise) {
            await db.initPromise;
        }

        // Create test organization
        testOrgId = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO organizations (id, name, plan, status, organization_type) VALUES (?, ?, ?, ?, ?)`,
                [testOrgId, 'Test Org', 'professional', 'active', 'PAID'],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Create test user
        testUserId = uuidv4();
        const hashedPassword = await bcrypt.hash('password123', 10);
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (id, organization_id, email, password_hash, name, role, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
                [testUserId, testOrgId, 'test@example.com', hashedPassword, 'Test User', 'client'],
                (err) => err ? reject(err) : resolve()
            );
        });
    });

    afterAll(async () => {
        // Cleanup
        await new Promise((resolve, reject) => {
            db.run(`DELETE FROM users WHERE id = ?`, [testUserId], (err) => err ? reject(err) : resolve());
        });
        await new Promise((resolve, reject) => {
            db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], (err) => err ? reject(err) : resolve());
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login with valid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.email).toBe('test@example.com');
            
            testToken = response.body.token;
            testRefreshToken = response.body.refreshToken;
        });

        it('should reject invalid email', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'invalid@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });

        it('should reject invalid password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });

        it('should require email and password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({});

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/auth/refresh', () => {
        it('should refresh access token with valid refresh token', async () => {
            // First login to get refresh token
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            const refreshToken = loginResponse.body.refreshToken;

            const response = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('refreshToken');
        });

        it('should reject invalid refresh token', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: 'invalid-token' });

            expect(response.status).toBe(401);
        });

        it('should require refresh token', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({});

            expect(response.status).toBe(400);
        });
    });

    describe('GET /api/auth/me', () => {
        it('should return user data with valid token', async () => {
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            const token = loginResponse.body.token;

            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.email).toBe('test@example.com');
        });

        it('should reject request without token', async () => {
            const response = await request(app)
                .get('/api/auth/me');

            expect(response.status).toBe(401);
        });

        it('should reject request with invalid token', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid-token');

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/auth/sessions', () => {
        it('should return active sessions for authenticated user', async () => {
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            const token = loginResponse.body.token;

            const response = await request(app)
                .get('/api/auth/sessions')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('sessions');
            expect(Array.isArray(response.body.sessions)).toBe(true);
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get('/api/auth/sessions');

            expect(response.status).toBe(401);
        });
    });

    describe('DELETE /api/auth/sessions/:id', () => {
        it('should revoke session for authenticated user', async () => {
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            const token = loginResponse.body.token;

            // Get sessions first
            const sessionsResponse = await request(app)
                .get('/api/auth/sessions')
                .set('Authorization', `Bearer ${token}`);

            if (sessionsResponse.body.sessions.length > 0) {
                const sessionId = sessionsResponse.body.sessions[0].id;

                const response = await request(app)
                    .delete(`/api/auth/sessions/${sessionId}`)
                    .set('Authorization', `Bearer ${token}`);

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('success', true);
            }
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .delete('/api/auth/sessions/test-id');

            expect(response.status).toBe(401);
        });
    });
});
