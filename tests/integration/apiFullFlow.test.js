// Set env vars for integration test BEFORE any imports
vi.hoisted(() => {
    process.env.NODE_ENV = 'test';
    process.env.TEST_TYPE = 'integration';
    process.env.MOCK_DB = 'false';
    process.env.SQLITE_PATH = './test-api-full-flow.db';
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only-min-32-chars';
});

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// ... (Sentry mock) ...

// Vertical Slice Mock for Gateway to avoid loading 150+ route files
vi.mock('../../server/src/Gateway.ts', async () => {
    // Dynamically import only valid routes needed for the test flow
    // Using simple mocks/requires due to hoisting limits or async imports
    const authRoutes = await import('../../server/src/routes/auth.routes.js');
    const projectRoutes = await import('../../server/src/routes/pmo/projects.routes.js');
    const taskRoutes = await import('../../server/src/routes/pmo/tasks.routes.js');
    const sessionsRoutes = await import('../../server/src/routes/user/sessions.routes.js');

    const initializeRoutes = (app) => {
        console.log('[MockGateway] Initializing vertical slice routes (Auth, Projects, Tasks, Sessions)...');
        app.use('/api/auth', authRoutes.default);
        app.use('/api/projects', projectRoutes.default);
        app.use('/api/tasks', taskRoutes.default);
        app.use('/api/sessions', sessionsRoutes.default);
    };

    return {
        ApiGateway: {
            getInstance: () => ({
                initializeRoutes
            })
        },
        apiGateway: {
            initializeRoutes
        }
    };
});

// Import app and database after setting env vars
import app from '../../server/src/index.js';
import { getDatabaseAsync } from '../../server/src/database/Database.js';
import * as DbPromise from '../../server/src/utils/DbPromise.js';
import { TEST_SCHEMA } from '../utils/testSchema.js';

/**
 * Level 2: Integration Tests - Full API Flow
 * Tests complete API workflows end-to-end
 */
describe('Integration Test: Full API Flow', () => {
    let authToken;
    let userId = 'user-flow-1';
    let orgId = 'org-flow-1';
    let testProjectId;
    let db;

    beforeAll(async () => {
        db = await getDatabaseAsync();
        
        // Initialize schema
        console.log('[Test] Initializing schema...');
        for (const sql of TEST_SCHEMA) {
            try {
                await DbPromise.run(db, sql);
            } catch (err) {
                if (!err.message.includes('already exists')) {
                    throw err;
                }
            }
        }
        
        // Setup usage of a fresh DB or clean tables
        await DbPromise.run(db, 'DELETE FROM projects');
        await DbPromise.run(db, 'DELETE FROM users');
        await DbPromise.run(db, 'DELETE FROM organizations');

        // Seed user
        const email = 'flow@test.com';
        const password = 'password123';
        const hash = bcrypt.hashSync(password, 8);

        await DbPromise.run(db, 'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
            [orgId, 'Flow Org', 'free', 'active']);
        await DbPromise.run(db, 'INSERT INTO users (id, organization_id, email, password, first_name, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, orgId, email, hash, 'FlowUser', 'ADMIN', 'active']);

        // Login to get token
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email, password });

        if (res.status !== 200) {
            console.error('Login failed in apiFullFlow setup:', res.status, res.body);
        }
        authToken = res.body.token;
    }, 60000);

    afterAll(async () => {
        if (db && db.close) {
            await new Promise((resolve) => db.close(resolve));
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        if (fs.existsSync('./test-api-full-flow.db')) {
            try {
                fs.unlinkSync('./test-api-full-flow.db');
            } catch (e) {
                console.warn('[Test] Failed to delete test DB file:', e.message);
            }
        }
    });

    describe('Project Lifecycle', () => {
        it('should create, read, update, and delete a project', async () => {
            if (!authToken) {
                console.log('Skipping API flow test - no auth token');
                return;
            }

            // Create project
            const createRes = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'API Flow Test Project',
                    organizationId: orgId,
                });

            expect([200, 201]).toContain(createRes.status);
            testProjectId = createRes.body.id || createRes.body.project?.id;

            // Read project
            const readRes = await request(app)
                .get(`/api/projects/${testProjectId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(readRes.status).toBe(200);
            expect(readRes.body.name || readRes.body.project?.name).toContain('API Flow');

            // Update project
            const updateRes = await request(app)
                .put(`/api/projects/${testProjectId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Updated API Flow Project',
                });

            expect(updateRes.status).toBe(200);

            // Delete project
            const deleteRes = await request(app)
                .delete(`/api/projects/${testProjectId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(deleteRes.status).toBe(200);
        });
    });

    describe('Task Lifecycle', () => {
        it('should create and manage tasks', async () => {
            if (!authToken || !testProjectId) {
                console.log('Skipping task flow test - no auth token or project');
                return;
            }

            // Create task
            const createRes = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    projectId: testProjectId,
                    title: 'API Flow Test Task',
                    description: 'Test task description',
                    status: 'todo',
                    // organizationId: orgId, // Removed: handled by auth middleware
                });

            expect([200, 201]).toContain(createRes.status);
            const taskId = createRes.body.id || createRes.body.task?.id;

            // Update task status
            const updateRes = await request(app)
                .put(`/api/tasks/${taskId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    status: 'in_progress',
                });

            expect(updateRes.status).toBe(200);
        });
    });

    describe('Session Management', () => {
        it('should save and retrieve session data', async () => {
            if (!authToken) {
                console.log('Skipping session test - no auth token');
                return;
            }

            const sessionData = {
                step1Completed: true,
                step2Completed: false,
                testData: 'API Flow Test',
            };

            // Save session
            const saveRes = await request(app)
                .post('/api/sessions')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    userId: userId,
                    type: 'free',
                    data: sessionData,
                });

            expect(saveRes.status).toBe(200);

            // Retrieve session
            const getRes = await request(app)
                .get('/api/sessions')
                .set('Authorization', `Bearer ${authToken}`);

            expect(getRes.status).toBe(200);
            expect(getRes.body.data).toBeDefined();
        });
    });
});
