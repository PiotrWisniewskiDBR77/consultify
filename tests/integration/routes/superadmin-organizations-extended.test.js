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
 * Integration tests for SuperAdmin Organizations Extended endpoints
 */

const express = require('express');
const router = require('../../../../server/routes/superadmin');
const { createTestToken } = require('../../helpers/auth');

const app = express();
app.use(express.json());
app.use('/api/superadmin', router);

describe('SuperAdmin Organizations Extended API', () => {
    const db = getDatabase();
    let authToken;

    beforeAll(() => {
        authToken = createTestToken({ role: 'SUPERADMIN', id: 'admin-001' });
    });

    describe('GET /api/superadmin/organizations/:id/metadata', () => {
    const db = getDatabase();
        it('should return organization metadata', async () => {
            const response = await request(app)
                .get('/api/superadmin/organizations/org-123/metadata')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('PUT /api/superadmin/organizations/:id/metadata', () => {
    const db = getDatabase();
        it('should update organization metadata', async () => {
            const response = await request(app)
                .put('/api/superadmin/organizations/org-123/metadata')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    key: 'test_key',
                    value: 'test_value',
                    valueType: 'string'
                })
                .expect(200);

            expect(response.body).toHaveProperty('message');
        });
    });

    describe('GET /api/superadmin/organizations/:id/tags', () => {
    const db = getDatabase();
        it('should return organization tags', async () => {
            const response = await request(app)
                .get('/api/superadmin/organizations/org-123/tags')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('GET /api/superadmin/organizations/:id/health', () => {
    const db = getDatabase();
        it('should return organization health score', async () => {
            const response = await request(app)
                .get('/api/superadmin/organizations/org-123/health')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('overallScore');
            expect(response.body).toHaveProperty('churnRisk');
        });
    });
});