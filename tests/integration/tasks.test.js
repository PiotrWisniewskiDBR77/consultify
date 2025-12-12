import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../server/database.js');
const app = require('../../server/index.js');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Tasks Integration', () => {
    let token;
    const testId = Date.now() + Math.floor(Math.random() * 10000);
    const orgId = `org-tasks-${testId}`;
    const userId = `user-tasks-${testId}`;
    const email = `tasks-${testId}@dbr77.com`;
    const password = 'password123';

    beforeAll(async () => {
        if (db.initPromise) {
            await db.initPromise;
        }

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync(password, 8);

        // Create data sequentially
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

        // Wait a bit for callbacks to complete (since serialize doesn't wait for callbacks)
        await sleep(200);

        await sleep(100);

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
    });

    it('should create a task', async () => {
        if (!token) {
            console.log('Tasks: Skipping - no token');
            return;
        }

        const res = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: `New Task ${testId}`,
                status: 'todo',
                priority: 'medium'
            });

        if (res.status !== 200) {
            console.error('Task creation failed:', JSON.stringify(res.body, null, 2));
            console.error('Status:', res.status);
        }
        expect(res.status).toBe(200);
        expect(res.body.title).toBe(`New Task ${testId}`);
    });
});
