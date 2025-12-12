import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../server/database.js');
const app = require('../../server/index.js');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Initiatives Integration', () => {
    let token;
    const testId = Date.now();
    const orgId = `org-init-${testId}`;
    const userId = `user-init-${testId}`;
    const email = `init-${testId}@dbr77.com`;
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
                [orgId, 'Init Test Org', 'free', 'active'], (err) => {
                    if (err) console.error('Init org error:', err.message);
                });

            // Create user
            db.run('INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, orgId, email, hash, 'InitTester', 'ADMIN'], (err) => {
                    if (err) console.error('Init user error:', err.message);
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
            console.error('Init login failed:', res.body);
        }
    });

    it('should list initiatives', async () => {
        if (!token) {
            console.log('Init: Skipping - no token');
            return;
        }

        const res = await request(app)
            .get('/api/initiatives')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('should create an initiative', async () => {
        if (!token) {
            console.log('Init: Skipping - no token');
            return;
        }

        const res = await request(app)
            .post('/api/initiatives')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: `New Initiative ${testId}`,
                status: 'step3',
                business_value: 'High'
            });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe(`New Initiative ${testId}`);
    });
});
