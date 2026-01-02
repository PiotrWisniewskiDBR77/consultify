// @vitest-environment node
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { TestDatabaseFactory } from '../utils/TestDatabaseFactory.js';
import { v4 as uuidv4 } from 'uuid';

// Delay importing app/db until after mock setup
let app;
let db;

describe('Projects Integration', () => {
    let token;
    const testId = Date.now();
    const orgId = `org-proj-${testId}`;
    const userId = `user-proj-${testId}`;
    const email = `proj-${testId}@dbr77.com`;
    const password = 'password123';

    beforeAll(async () => {
        // 1. Create isolated DB
        const testDb = await TestDatabaseFactory.create();
        global.__TEST_DB_MOCK__ = testDb;

        // 2. Reset modules to pick up new mock
        vi.resetModules();

        // 3. Import dependencies
        const dbModule = await import('../../server/database.js');
        db = dbModule.default;

        const appModule = await import('../../server/index.js');
        app = appModule.default || appModule;

        const bcrypt = await import('bcryptjs');
        const hash = bcrypt.hashSync(password, 8);

        // 4. Seed Data
        await new Promise((resolve, reject) => {
            testDb.serialize(() => {
                testDb.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [orgId, 'Projects Test Org', 'free', 'active'], (err) => {
                        if (err) console.error('Org seed error:', err);
                    });

                testDb.run('INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [userId, orgId, email, hash, 'ProjectTester', 'ADMIN'], (err) => {
                        if (err) {
                            console.error('User seed error:', err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
            });
        });

        // 5. Login to get token
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email, password });

        if (res.body.token) {
            token = res.body.token;
        } else {
            console.error('Projects login failed:', res.body);
            throw new Error('Failed to login in beforeAll');
        }
    });

    it('should create a new project', async () => {
        const projectId = uuidv4();
        const res = await request(app)
            .post('/api/projects')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: `Integration Project ${testId}`,
                description: 'Test Description',
                status: 'active'
            });

        if (res.status !== 201 && res.status !== 200) {
            console.error('Create project failed:', res.body);
        }

        expect([200, 201]).toContain(res.status);
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe(`Integration Project ${testId}`);
    });

    it('should list projects', async () => {
        const res = await request(app)
            .get('/api/projects')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        const project = res.body.find(p => p.name === `Integration Project ${testId}`);
        expect(project).toBeDefined();
    });
});
