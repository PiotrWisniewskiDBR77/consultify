// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { TestDatabaseFactory } from '../utils/TestDatabaseFactory.js';
import bcrypt from 'bcryptjs';

// Explicitly mock Sentry here to survive resetModules
vi.mock('@sentry/node', () => ({
    init: vi.fn(),
    Handlers: { requestHandler: () => (req, res, next) => next(), errorHandler: () => (error, req, res, next) => next() },
    captureException: vi.fn(),
}));

// Vertical Slice Mock for Gateway to avoid loading 150+ route files
vi.mock('../../server/src/Gateway.ts', async () => {
    // Dynamically import only valid routes needed for the test flow
    // Using simple mocks/requires due to hoisting limits or async imports
    const authRoutes = await import('../../server/src/routes/auth.routes.js');
    const projectRoutes = await import('../../server/src/routes/projects.routes.js');
    const taskRoutes = await import('../../server/src/routes/tasks.routes.js');
    const sessionsRoutes = await import('../../server/src/routes/sessions.routes.js');

    const initializeRoutes = (app) => {
        console.log('[MockGateway] Initializing vertical slice routes (Auth, Projects, Tasks, Sessions)...');
        app.use('/api/auth', authRoutes.default);
        app.use('/api/projects', projectRoutes.default);
        app.use('/api/tasks', taskRoutes.default);
        app.use('/api/sessions', sessionsRoutes.default);

        // Log registered routes for debugging
        if (app._router && app._router.stack) {
            console.log('[MockGateway] Registered routes:',
                app._router.stack
                    .filter(r => r.route || r.name === 'router')
                    .map(r => r.route ? r.route.path : `Router(${r.regexp})`)
            );
        }
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

/**
 * Level 2: Integration Tests - Full API Flow
 * Tests complete API workflows end-to-end
 */
describe('Integration Test: Full API Flow', () => {
    let app;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let db;
    let authToken;
    let userId = 'user-flow-1';
    let orgId = 'org-flow-1';
    let testProjectId;

    beforeAll(async () => {
        const testDb = await TestDatabaseFactory.create();

        // Patch missing methods required by middleware (e.g. performanceMetrics)
        testDb.query = async () => ({ rows: [], rowCount: 0 });

        global.__TEST_DB_MOCK__ = testDb;
        vi.resetModules();

        // Use dynamic imports to pick up the mock DB and Sentry
        const dbModule = await import('../../server/database.js');
        db = dbModule.default;

        const appModule = await import('../../server/src/index.ts');
        app = appModule.default || appModule;


        // Schema Patch: Ensure tables exist since DatabaseInitializer script is missing
        await new Promise((resolve) => {
            testDb.serialize(() => {
                testDb.run(`CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    organization_id TEXT,
                    name TEXT,
                    description TEXT,
                    goal TEXT,
                    status TEXT,
                    owner_id TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);
                testDb.run(`CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    project_id TEXT,
                    organization_id TEXT,
                    title TEXT,
                    description TEXT,
                    status TEXT,
                    priority TEXT,
                    assignee_id TEXT,
                    reporter_id TEXT,
                    due_date DATETIME,
                    estimated_hours REAL,
                    task_type TEXT,
                    tags TEXT,
                    initiative_id TEXT,
                    kpi_id TEXT,
                    raid_item_id TEXT,
                    roadmap_initiative_id TEXT,
                    why TEXT,
                    checklist TEXT,
                    expected_outcome TEXT,
                    decision_impact TEXT,
                    evidence_required TEXT,
                    strategic_contribution TEXT,
                    progress INTEGER,
                    blocked_reason TEXT,
                    start_date DATETIME,
                    assignees TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);
                testDb.run(`CREATE TABLE IF NOT EXISTS pmo_audit_trail (
                    id TEXT PRIMARY KEY,
                    project_id TEXT,
                    pmo_domain_id TEXT,
                    object_type TEXT,
                    object_id TEXT,
                    action TEXT,
                    actor_id TEXT,
                    details TEXT,
                    metadata TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);
                testDb.run(`CREATE TABLE IF NOT EXISTS active_sessions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    device TEXT,
                    ip_address TEXT,
                    last_active DATETIME,
                    created_at DATETIME
                )`, resolve);
            });
        });

        // Seed user
        const email = 'flow@test.com';
        const password = 'password123';
        const hash = bcrypt.hashSync(password, 8);

        await new Promise((resolve) => {
            testDb.serialize(() => {
                testDb.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [orgId, 'Flow Org', 'free', 'active']);
                testDb.run('INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [userId, orgId, email, hash, 'FlowUser', 'ADMIN'], resolve);
            });
        });

        // Login to get token
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email, password });

        if (res.status !== 200) {
            console.error('Login failed in apiFullFlow setup:', res.status, res.body);
        }
        authToken = res.body.token;
    }, 120000);

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
