import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../server/database.js');
const app = require('../../server/index.js');
const { seedMegatrends } = require('../../server/seed/seed_megatrends.js');

// Helper to wait for DB/server sync
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Megatrend Integration', () => {
    let token;
    let userId;
    let companyId;
    const testId = Date.now();
    const email = `mega-${testId}@dbr77.com`;
    const password = 'password123';

    beforeAll(async () => {
        // Wait for DB init
        if (db.initPromise) {
            await db.initPromise;
        }

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync(password, 8);
        companyId = `comp-mega-${testId}`;
        userId = `user-mega-${testId}`;

        // Setup User and Company
        await new Promise((resolve) => {
            db.serialize(() => {
                db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [companyId, 'Megatrend Test Corp', 'free', 'active']);

                db.run('INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [userId, companyId, email, hash, 'MegaTester', 'ADMIN']);

                // Seed megatrends if empty (though app likely seeds on start)
                seedMegatrends().then(() => resolve()).catch(() => resolve());
            });
        });

        await sleep(500);

        // Login to get token
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email, password });

        token = res.body.token;
    });

    it('should fetch baseline megatrends', async () => {
        const res = await request(app)
            .get('/api/megatrends/baseline?industry=general')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0]).toHaveProperty('label');
        expect(res.body[0]).toHaveProperty('baseImpactScore');
    });

    it('should fetch radar data', async () => {
        const res = await request(app)
            .get('/api/megatrends/radar?industry=general')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0]).toHaveProperty('ring');
        expect(res.body[0]).toHaveProperty('impact');
    });

    it('should fetch megatrend detail by ID', async () => {
        // Get a valid ID first
        const listRes = await request(app)
            .get('/api/megatrends/baseline')
            .set('Authorization', `Bearer ${token}`);

        const trendId = listRes.body[0].id;

        const res = await request(app)
            .get(`/api/megatrends/${trendId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id', trendId);
        expect(res.body).toHaveProperty('aiInsight');
    });

    it('should create and manage custom trend', async () => {
        // Create
        const newTrend = {
            industry: 'automotive',
            type: 'Business',
            label: `Custom Trend ${testId}`,
            description: 'A specific trend for testing',
            ring: 'Watch Closely'
        };

        const createRes = await request(app)
            .post('/api/megatrends/custom')
            .set('Authorization', `Bearer ${token}`)
            .send(newTrend);

        expect(createRes.status).toBe(201);
        expect(createRes.body).toHaveProperty('id');
        expect(createRes.body.label).toBe(newTrend.label);

        const customId = createRes.body.id;

        // Update
        const updateRes = await request(app)
            .put(`/api/megatrends/custom/${customId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ ring: 'Now' });

        expect(updateRes.status).toBe(200);
        expect(updateRes.body.ring).toBe('Now');
    });
});
