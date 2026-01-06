import app from '../../../server/src/index.js';
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import bcrypt from 'bcryptjs';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    const workerId = process.env.VITEST_WORKER_ID || '0';
    process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

describe('SuperAdmin Support API Integration', () => {
    const db = getDatabase();
    let superAdminToken;
    const testId = Date.now();
    const adminEmail = `superadmin-${testId}@test.com`;

    beforeAll(async () => {
        await initializeDatabase();
        await db.initPromise;

        const hash = bcrypt.hashSync('test123', 8);

        // Create superadmin user
        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO users (id, email, password, first_name, role, status) VALUES (?, ?, ?, ?, ?, ?)',
                [`admin-${testId}`, adminEmail, hash, 'Super', 'SUPERADMIN', 'active'],
                (err) => (err ? reject(err) : resolve()),
            );
        });

        // Login to get token
        const loginRes = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'test123' });

        superAdminToken = loginRes.body.token;
    });

    describe('Support Tickets', () => {
        it('should return support tickets', async () => {
            const res = await request(app)
                .get('/api/superadmin/support/tickets')
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('should create a support ticket', async () => {
            const res = await request(app)
                .post('/api/superadmin/support/tickets')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send({
                    organizationId: 'org-123',
                    subject: 'Test Ticket',
                    description: 'Test Description',
                    priority: 'medium',
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('ticketNumber');
        });
    });

    describe('Customer Success Notes', () => {
        it('should return customer success notes', async () => {
            const res = await request(app)
                .get('/api/superadmin/organizations/org-123/customer-success/notes')
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });
});
