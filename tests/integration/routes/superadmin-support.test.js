/**
 * Integration tests for SuperAdmin Support endpoints
 */

const request = require('supertest');
const express = require('express');
const router = require('../../../../server/routes/superadmin');
const { createTestToken } = require('../../helpers/auth');

const app = express();
app.use(express.json());
app.use('/api/superadmin', router);

describe('SuperAdmin Support API', () => {
    let authToken;

    beforeAll(() => {
        authToken = createTestToken({ role: 'SUPERADMIN', id: 'admin-001' });
    });

    describe('GET /api/superadmin/support/tickets', () => {
        it('should return support tickets', async () => {
            const response = await request(app)
                .get('/api/superadmin/support/tickets')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('POST /api/superadmin/support/tickets', () => {
        it('should create a support ticket', async () => {
            const response = await request(app)
                .post('/api/superadmin/support/tickets')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    organizationId: 'org-123',
                    subject: 'Test Ticket',
                    description: 'Test Description',
                    priority: 'medium'
                })
                .expect(200);

            expect(response.body).toHaveProperty('ticketNumber');
        });
    });

    describe('GET /api/superadmin/organizations/:id/customer-success/notes', () => {
        it('should return customer success notes', async () => {
            const response = await request(app)
                .get('/api/superadmin/organizations/org-123/customer-success/notes')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });
});

