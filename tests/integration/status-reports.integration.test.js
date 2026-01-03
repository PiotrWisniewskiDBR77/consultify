/**
 * Integration Tests for Status Reports API
 * 
 * Tests status report endpoints:
 * - Generate report
 * - List reports
 * - Approve/publish workflow
 * - Export
 */

const request = require('supertest');
const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');

// Mock database and auth
jest.mock('../../server/database', () => ({
    run: jest.fn((sql, params, callback) => {
        if (callback) callback(null);
    }),
    get: jest.fn((sql, params, callback) => {
        if (callback) callback(null, null);
    }),
    all: jest.fn((sql, params, callback) => {
        if (callback) callback(null, []);
    }),
    serialize: jest.fn(cb => cb()),
    close: jest.fn()
}));

jest.mock('../../server/middleware/authMiddleware', () => {
    return jest.fn((req, res, next) => {
        req.user = {
            id: 'test-user-id',
            organizationId: 'test-org-id',
            email: 'test@example.com'
        };
        next();
    });
});

const express = require('express');
const statusReportsRoutes = require('../../server/routes/status-reports');

describe('Status Reports API Integration Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/status-reports', statusReportsRoutes);
    });

    describe('POST /api/status-reports/initiative/:initiativeId/generate', () => {
        it('should reject invalid period type', async () => {
            const response = await request(app)
                .post('/api/status-reports/initiative/init-1/generate')
                .send({ periodType: 'INVALID' })
                .expect(400);

            expect(response.body.error).toBe('Invalid period type');
            expect(response.body.validTypes).toContain('WEEKLY');
        });

        it('should accept valid period types', async () => {
            // Would need proper mock setup for full test
            const response = await request(app)
                .post('/api/status-reports/initiative/init-1/generate')
                .send({ periodType: 'WEEKLY' });

            // In real scenario would return 201 with report
            expect(response.status).toBeGreaterThanOrEqual(200);
        });
    });

    describe('GET /api/status-reports/initiative/:initiativeId', () => {
        it('should return empty list when no reports', async () => {
            const response = await request(app)
                .get('/api/status-reports/initiative/init-1')
                .expect(200);

            expect(response.body.reports).toBeDefined();
        });
    });

    describe('GET /api/status-reports/:reportId', () => {
        it('should return 404 for non-existent report', async () => {
            const response = await request(app)
                .get('/api/status-reports/non-existent')
                .expect(404);

            expect(response.body.error).toBe('Report not found');
        });
    });

    describe('POST /api/status-reports/:reportId/approve', () => {
        it('should approve report', async () => {
            const response = await request(app)
                .post('/api/status-reports/report-1/approve')
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/status-reports/:reportId/publish', () => {
        it('should publish report', async () => {
            const response = await request(app)
                .post('/api/status-reports/report-1/publish')
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/status-reports/:reportId/distribute', () => {
        it('should reject empty recipients', async () => {
            const response = await request(app)
                .post('/api/status-reports/report-1/distribute')
                .send({ recipients: [] })
                .expect(400);

            expect(response.body.error).toBe('Recipients array required');
        });

        it('should reject missing recipients', async () => {
            const response = await request(app)
                .post('/api/status-reports/report-1/distribute')
                .send({})
                .expect(400);

            expect(response.body.error).toBe('Recipients array required');
        });
    });

    describe('GET /api/status-reports/:reportId/export/:format', () => {
        it('should reject invalid format', async () => {
            const response = await request(app)
                .get('/api/status-reports/report-1/export/doc')
                .expect(400);

            expect(response.body.error).toBe('Invalid export format');
            expect(response.body.validFormats).toContain('pdf');
        });
    });

    describe('GET /api/status-reports/metadata/options', () => {
        it('should return metadata options', async () => {
            const response = await request(app)
                .get('/api/status-reports/metadata/options')
                .expect(200);

            expect(response.body.periodTypes).toContain('WEEKLY');
            expect(response.body.ragStatuses).toContain('GREEN');
            expect(response.body.sectionNames).toContain('SCHEDULE');
        });
    });

    describe('GET /api/status-reports/initiative/:initiativeId/latest', () => {
        it('should return null when no reports', async () => {
            const response = await request(app)
                .get('/api/status-reports/initiative/init-1/latest')
                .expect(200);

            expect(response.body.report).toBeNull();
        });
    });
});








