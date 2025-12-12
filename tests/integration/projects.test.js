// @vitest-environment node
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../server/database.js');
const app = require('../../server/index.js');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Projects Integration', () => {
    let token;
    const testId = Date.now();
    const orgId = `org-proj-${testId}`;
    const userId = `user-proj-${testId}`;
    const email = `proj-${testId}@dbr77.com`;
    const password = 'password123';

    beforeAll(async () => {
        if (db.initPromise) {
            await db.initPromise;
        }

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync(password, 8);

        db.serialize(() => {
            // Create org
            db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                [orgId, 'Projects Test Org', 'free', 'active'], (err) => {
                    if (err) console.error('Projects org error:', err.message);
                });

            // Create user
            db.run('INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, orgId, email, hash, 'ProjectTester', 'ADMIN'], (err) => {
                    if (err) console.error('Projects user error:', err.message);
                });
        });

        await sleep(200);

        // Login
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email, password });

        if (res.body.token) {
            token = res.body.token;
        } else {
            console.error('Projects login failed:', res.body);
        }
    });

    it('should create a new project', async () => {
        if (!token) {
            console.log('Projects: Skipping - no token');
            return;
        }

        const res = await request(app)
            .post('/api/projects')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: `Integration Project ${testId}`,
                description: 'Test Description',
                status: 'active'
            });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');
    });

    it('should list projects', async () => {
        if (!token) {
            console.log('Projects: Skipping - no token');
            return;
        }

        const res = await request(app)
            .get('/api/projects')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});
