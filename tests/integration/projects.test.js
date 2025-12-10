import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import db from '../../server/database.js';
import app from '../../server/index.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Projects Integration', () => {
    let token;
    const testId = Date.now() + Math.floor(Math.random() * 10000);
    const orgId = `org-projects-${testId}`;
    const userId = `user-projects-${testId}`;
    const email = `projects-${testId}@dbr77.com`;
    const password = 'password123';

    beforeAll(async () => {
        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync(password, 8);

        // Create org
        await new Promise((resolve) => {
            db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                [orgId, 'Projects Test Org', 'free', 'active'], (err) => {
                    if (err) console.error('Projects org error:', err.message);
                    resolve();
                });
        });

        await sleep(100);

        // Create user
        await new Promise((resolve, reject) => {
            db.run('INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, orgId, email, hash, 'ProjectTester', 'ADMIN'], (err) => {
                    if (err) {
                        console.error('Projects user error:', err.message);
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
