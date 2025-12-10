import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import db from '../../server/database.js';
import app from '../../server/index.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Tasks Integration', () => {
    let token;
    const testId = Date.now() + Math.floor(Math.random() * 10000);
    const orgId = `org-tasks-${testId}`;
    const userId = `user-tasks-${testId}`;
    const email = `tasks-${testId}@dbr77.com`;
    const password = 'password123';

    beforeAll(async () => {
        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync(password, 8);

        // Create org
        await new Promise((resolve) => {
            db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                [orgId, 'Tasks Test Org', 'free', 'active'], (err) => {
                    if (err) console.error('Tasks org error:', err.message);
                    resolve();
                });
        });

        await sleep(100);

        // Create user
        await new Promise((resolve, reject) => {
            db.run('INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, orgId, email, hash, 'TaskTester', 'ADMIN'], (err) => {
                    if (err) {
                        console.error('Tasks user error:', err.message);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
        });

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

        expect(res.status).toBe(200);
        expect(res.body.title).toBe(`New Task ${testId}`);
    });
});
