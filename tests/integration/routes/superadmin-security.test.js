import app from '../../../server/src/index.js';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    process.env.SQLITE_PATH = ':memory:';
});

/**
 * Integration tests for SuperAdmin Security endpoints
 */

const express = require('express');
const router = require('../../../../server/routes/superadmin');
const { createTestToken } = require('../../helpers/auth');

const app = express();
app.use(express.json());
app.use('/api/superadmin', router);

describe('SuperAdmin Security API', () => {
    const db = getDatabase();
    let authToken;

    beforeAll(() => {
        authToken = createTestToken({ role: 'SUPERADMIN', id: 'admin-001' });
    });

    describe('GET /api/superadmin/organizations/:id/ip-whitelist', () => {
    const db = getDatabase();
        it('should return IP whitelist', async () => {
            const response = await request(app)
                .get('/api/superadmin/organizations/org-123/ip-whitelist')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('POST /api/superadmin/organizations/:id/ip-whitelist', () => {
    const db = getDatabase();
        it('should add IP to whitelist', async () => {
            const response = await request(app)
                .post('/api/superadmin/organizations/org-123/ip-whitelist')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    ipAddress: '192.168.1.1',
                    description: 'Test IP'
                })
                .expect(200);

            expect(response.body).toHaveProperty('ipAddress');
        });
    });

    describe('GET /api/superadmin/users/:id/devices', () => {
    const db = getDatabase();
        it('should return user devices', async () => {
            const response = await request(app)
                .get('/api/superadmin/users/user-123/devices')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('GET /api/superadmin/security-events', () => {
    const db = getDatabase();
        it('should return security events', async () => {
            const response = await request(app)
                .get('/api/superadmin/security-events')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });
});