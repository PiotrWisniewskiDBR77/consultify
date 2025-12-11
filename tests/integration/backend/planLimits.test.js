vi.unmock('../../../server/database');
vi.unmock('../../../server/config');
const request = require('supertest');
const app = require('../../../server/index'); // Adjust path as needed
const db = require('../../../server/database');
const jwt = require('jsonwebtoken');
const config = require('../../../server/config');
const { v4: uuidv4 } = require('uuid');

describe('Plan Limits Integration', () => {
    let authToken;
    let userId;
    let orgId;

    beforeAll(async () => {
        // Setup usage of a fresh DB or clean tables
        await new Promise(resolve => db.run('DELETE FROM projects', resolve));
        await new Promise(resolve => db.run('DELETE FROM users', resolve));
        await new Promise(resolve => db.run('DELETE FROM organizations', resolve));

        // Create Org (Free Plan)
        orgId = uuidv4();
        userId = uuidv4();
        await new Promise(resolve => db.run(
            `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
            [orgId, 'Test Org', 'free', 'active'],
            resolve
        ));

        // Create User
        await new Promise(resolve => db.run(
            `INSERT INTO users (id, email, password, organization_id, role) VALUES (?, ?, ?, ?, ?)`,
            [userId, 'test@example.com', 'hashedpass', orgId, 'ADMIN'],
            resolve
        ));

        // Generate Token
        authToken = jwt.sign({ id: userId, organizationId: orgId, role: 'ADMIN' }, config.JWT_SECRET);
    });

    test('should prevent creating more projects than allowed by Free plan', async () => {
        // Free plan limit is 1 (based on planLimits.js default)

        // 1. Create first project - Should Succeed
        const res1 = await request(app)
            .post('/api/projects')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ name: 'Project 1' });

        expect(res1.status).toBe(200);

        // 2. Create second project - Should Fail
        const res2 = await request(app)
            .post('/api/projects')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ name: 'Project 2' });

        expect(res2.status).toBe(403);
        expect(res2.body.error).toMatch(/Plan limit reached/);
    });

    test('should allow creating more projects after upgrade', async () => {
        // Upgrade to Pro
        await new Promise(resolve => db.run(
            `UPDATE organizations SET plan = 'pro' WHERE id = ?`,
            [orgId],
            resolve
        ));

        // 3. Create second project - Should Succeed now
        const res3 = await request(app)
            .post('/api/projects')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ name: 'Project 2 (Pro)' });

        expect(res3.status).toBe(200);
    });
});
