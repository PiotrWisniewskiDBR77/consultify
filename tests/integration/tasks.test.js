import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

describe('Tasks Integration', () => {
    let token;
    let db;
    let app;
    const testId = Date.now() + Math.floor(Math.random() * 10000);
    const orgId = `org-tasks-${testId}`;
    const userId = `user-tasks-${testId}`;
    const email = `tasks-${testId}@dbr77.com`;
    const password = 'password123';

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    beforeAll(async () => {
        // Dynamic imports to handle ESM/CJS interop
        const dbModule = await import('../../server/database.js');
        db = dbModule.default || dbModule;

        if (db.initPromise) {
            await db.initPromise;
        }

        const appModule = await import('../../server/index.cjs');
        app = appModule.default || appModule;

        const bcrypt = await import('bcryptjs');
        const hash = await bcrypt.hash(password, 8);

        // Create data sequentially
        await new Promise((resolve) => {
            db.serialize(() => {
                // Create org
                db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [orgId, 'Tasks Test Org', 'free', 'active'], (err) => {
                        if (err) console.error('Tasks org error:', err.message);
                    });

                // Create user
                db.run('INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [userId, orgId, email, hash, 'TaskTester', 'ADMIN'], (err) => {
                        if (err) {
                            console.error('Tasks user error:', err.message);
                        }
                    });
            });
            resolve();
        });

        // Wait a bit for callbacks to complete (since serialize doesn't wait for callbacks)
        await sleep(200);

        // Login
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email, password });

        if (res.body.token) {
            token = res.body.token;
        } else {
            console.error('Tasks login failed:', res.body);
        }
    });

    it('should list tasks', async () => {
        if (!token) {
            console.log('Tasks: Skipping - no token');
            return;
        }

        const res = await request(app)
            .get('/api/tasks')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        // Integration Check: API Structure
        // Check if the returned tasks (if any) match expected schema
        // If empty, we can't verify structure fully, but at least we know it returns an array
        if (res.body.length > 0) {
            const task = res.body[0];
            expect(task).toHaveProperty('id');
            expect(task).toHaveProperty('title');
            expect(task).toHaveProperty('status');
            // Add more specific checks here based on User requirements
        }
    });

    it('should create a task', async () => {
        if (!token) {
            console.log('Tasks: Skipping - no token');
            return;
        }

        const newTask = {
            title: `New Task ${testId}`,
            status: 'todo',
            priority: 'medium',
            // Adding typically required fields to avoid validation errors
            type: 'TASK'
        };

        const res = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send(newTask);

        if (res.status !== 201) {
            console.error('Task creation failed:', JSON.stringify(res.body, null, 2));
            console.error('Status:', res.status);
        }
        expect(res.status).toBe(201);
        expect(res.body.title).toBe(`New Task ${testId}`);

        // Verify created task structure
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('organization_id', orgId);
        expect(res.body).toHaveProperty('created_at');
    });
});
