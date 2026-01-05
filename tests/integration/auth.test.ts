import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { testFactory } from '../helpers/TestFactory';

vi.hoisted(() => {
    const path = require('path');
    process.env.SQLITE_PATH = path.resolve(__dirname, 'auth.integration.db');
    process.env.MOCK_DB = 'false';
});

import app from '../../server/src/index';

import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';
import { dbProxy, resetConnection, getDatabase } from '../../server/src/database/Database.js';
import { setDependencies } from '../../server/src/controllers/AuthController.js';

describe('Auth Integration', () => {
    const password = 'password123';
    let email: string;
    let orgId: string;
    const testDbPath = path.resolve(__dirname, 'auth.integration.db');

    beforeAll(async () => {
        // SQLITE_PATH already set via vi.hoisted

        // Reset connection to release file lock/descriptor
        await resetConnection();

        // Initialize database schema
        const initResult = await initializeDatabase();
        if (!initResult.success) {
            throw new Error(`Database initialization failed: ${initResult.message}`);
        }

        // Reset AuthController dependencies with dynamic Proxy
        await setDependencies({ db: dbProxy });

        // Create a user with a known password for login tests
        const org = await testFactory.createOrganization();
        orgId = org.id;
        const user = await testFactory.createUser({
            organizationId: orgId,
            password,
            role: 'ADMIN'
        });
        email = user.email;
    });

    afterAll(async () => {
        // Ensure connection is closed
        await resetConnection();
    });

    describe('Login Flow', () => {
        it('should login successfully with valid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email, password });

            if (res.status !== 200) {
                console.error('Login Failed Status:', res.status);
                console.error('Login Failed Body:', JSON.stringify(res.body, null, 2));
            }

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body.user).toHaveProperty('email', email);
            expect(res.body.user).toHaveProperty('organizationId', orgId);
        });

        it('should fail with invalid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email, password: 'wrongpassword' });

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error');
        });

        it('should require email and password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email }); // Missing password

            // 400 Bad Request or 401 Unauthorized are acceptable depending on validation layer
            expect([400, 401]).toContain(res.status);
        });
    });

    describe('Token Validation via /me', () => {
        let token: string;

        beforeAll(async () => {
            // Get a fresh token
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email, password });
            token = res.body.token;
        });

        it('should validate token and return user profile', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`);

            if (res.status !== 200) {
                console.error('/me Failed Status:', res.status);
                console.error('/me Failed Body:', JSON.stringify(res.body, null, 2));
            }

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('user');
            expect(res.body.user.email).toBe(email);
            expect(res.body.user.organizationId).toBe(orgId);
        });

        it('should reject invalid token', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid-token');

            expect([401, 403]).toContain(res.status);
        });

        it('should reject request without token', async () => {
            const res = await request(app)
                .get('/api/auth/me');

            expect([401, 403]).toContain(res.status);
        });
    });

    describe('Multi-Tenant Isolation', () => {
        let org1Token: string;
        let org2Token: string;
        let org1Id: string;
        let org2Id: string;

        beforeAll(async () => {
            // Setup Org 1
            const org1 = await testFactory.createOrganization({ name: 'Auth Org 1' });
            org1Id = org1.id;
            const user1 = await testFactory.createUser({
                organizationId: org1.id,
                password: 'test123'
            });

            // Setup Org 2
            const org2 = await testFactory.createOrganization({ name: 'Auth Org 2' });
            org2Id = org2.id;
            const user2 = await testFactory.createUser({
                organizationId: org2.id,
                password: 'test123'
            });

            // Login User 1
            const res1 = await request(app)
                .post('/api/auth/login')
                .send({ email: user1.email, password: 'test123' });
            org1Token = res1.body.token;

            // Login User 2
            const res2 = await request(app)
                .post('/api/auth/login')
                .send({ email: user2.email, password: 'test123' });
            org2Token = res2.body.token;
        });

        it('should return correct organizationId based on token', async () => {
            expect(org1Token).toBeDefined();
            expect(org2Token).toBeDefined();

            const res1 = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${org1Token}`);

            const res2 = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${org2Token}`);

            expect(res1.status).toBe(200);
            expect(res2.status).toBe(200);
            expect(res1.body.user.organizationId).toBe(org1Id);
            expect(res2.body.user.organizationId).toBe(org2Id);
            expect(res1.body.user.organizationId).not.toBe(res2.body.user.organizationId);
        });
    });
});
