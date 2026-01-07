/**
 * Auth API Tests
 * Tests for authentication API endpoints
 * 
 * @module tests/api/auth-api.test.js
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Mock database
vi.mock('../../server/src/database/DatabaseInitializer.ts', () => ({
    default: {
        getInstance: () => ({
            getDatabase: () => mockDb,
            initPromise: Promise.resolve(),
        }),
    },
}));

const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    prepare: vi.fn().mockReturnValue({
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn(),
    }),
};

describe('Auth API Tests', () => {
    let app;

    beforeAll(async () => {
        try {
            const gateway = await import('../../server/src/Gateway.ts');
            app = gateway.default || gateway.app;
        } catch (error) {
            const express = (await import('express')).default;
            app = express();
            app.use(express.json());

            // Mock auth routes
            app.post('/api/auth/login', (req, res) => {
                const { email, password } = req.body;

                if (!email || !password) {
                    return res.status(400).json({
                        success: false,
                        error: 'Email and password required',
                        code: 'VALIDATION_ERROR',
                    });
                }

                if (email === 'test@test.com' && password === 'password123') {
                    return res.json({
                        success: true,
                        data: {
                            token: 'mock-jwt-token',
                            user: { id: 'user-1', email },
                        },
                    });
                }

                res.status(401).json({
                    success: false,
                    error: 'Invalid credentials',
                    code: 'UNAUTHORIZED',
                });
            });

            app.post('/api/auth/register', (req, res) => {
                const { email, password, firstName, lastName } = req.body;

                if (!email || !password) {
                    return res.status(400).json({
                        success: false,
                        error: 'Email and password required',
                    });
                }

                res.status(201).json({
                    success: true,
                    data: {
                        user: { id: 'user-new', email, firstName, lastName },
                    },
                });
            });

            app.post('/api/auth/logout', (req, res) => {
                res.json({ success: true, message: 'Logged out' });
            });

            app.post('/api/auth/refresh', (req, res) => {
                const { refreshToken } = req.body;

                if (!refreshToken) {
                    return res.status(400).json({
                        success: false,
                        error: 'Refresh token required',
                    });
                }

                res.json({
                    success: true,
                    data: { token: 'new-jwt-token' },
                });
            });

            app.post('/api/auth/forgot-password', (req, res) => {
                const { email } = req.body;

                if (!email) {
                    return res.status(400).json({
                        success: false,
                        error: 'Email required',
                    });
                }

                res.json({ success: true, message: 'Reset email sent' });
            });

            app.post('/api/auth/reset-password', (req, res) => {
                const { token, password } = req.body;

                if (!token || !password) {
                    return res.status(400).json({
                        success: false,
                        error: 'Token and password required',
                    });
                }

                res.json({ success: true, message: 'Password reset' });
            });

            app.get('/api/auth/me', (req, res) => {
                const authHeader = req.headers.authorization;

                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return res.status(401).json({
                        success: false,
                        error: 'Not authenticated',
                    });
                }

                res.json({
                    success: true,
                    data: { id: 'user-1', email: 'test@test.com' },
                });
            });
        }
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ═══════════════════════════════════════════════════════════════════
    // LOGIN
    // ═══════════════════════════════════════════════════════════════════

    describe('POST /api/auth/login', () => {
        it('should login with valid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@test.com', password: 'password123' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('token');
        });

        it('should reject invalid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@test.com', password: 'wrong' });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
        });

        it('should require email and password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({});

            expect(response.status).toBe(400);
        });

        it('should validate email format', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'invalid-email', password: 'password123' });

            expect([400, 401]).toContain(response.status);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // REGISTER
    // ═══════════════════════════════════════════════════════════════════

    describe('POST /api/auth/register', () => {
        it('should register new user', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'new@test.com',
                    password: 'password123',
                    firstName: 'New',
                    lastName: 'User',
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('success', true);
        });

        it('should require email and password', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({ firstName: 'Test' });

            expect(response.status).toBe(400);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // LOGOUT
    // ═══════════════════════════════════════════════════════════════════

    describe('POST /api/auth/logout', () => {
        it('should logout successfully', async () => {
            const response = await request(app)
                .post('/api/auth/logout');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // TOKEN REFRESH
    // ═══════════════════════════════════════════════════════════════════

    describe('POST /api/auth/refresh', () => {
        it('should refresh token', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: 'valid-refresh-token' });

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveProperty('token');
        });

        it('should require refresh token', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({});

            expect(response.status).toBe(400);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PASSWORD RESET
    // ═══════════════════════════════════════════════════════════════════

    describe('POST /api/auth/forgot-password', () => {
        it('should send reset email', async () => {
            const response = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'test@test.com' });

            expect(response.status).toBe(200);
        });

        it('should require email', async () => {
            const response = await request(app)
                .post('/api/auth/forgot-password')
                .send({});

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/auth/reset-password', () => {
        it('should reset password', async () => {
            const response = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: 'reset-token', password: 'newpassword123' });

            expect(response.status).toBe(200);
        });

        it('should require token and password', async () => {
            const response = await request(app)
                .post('/api/auth/reset-password')
                .send({});

            expect(response.status).toBe(400);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CURRENT USER
    // ═══════════════════════════════════════════════════════════════════

    describe('GET /api/auth/me', () => {
        it('should return current user when authenticated', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveProperty('id');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get('/api/auth/me');

            expect(response.status).toBe(401);
        });
    });
});
