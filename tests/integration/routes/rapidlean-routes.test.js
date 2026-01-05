import app from '../../../server/src/index.js';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    process.env.SQLITE_PATH = ':memory:';
});

/**
 * Integration Tests for RapidLean Routes
 * Tests all API endpoints with proper request/response handling
 */




// Rely on global mocks for auth and multer from setup.ts

describe('RapidLean Routes Integration', () => {
    const db = getDatabase();
    let app;
    let testProjectId;
    

    beforeAll(async () => {
        await initializeDatabase();
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        const rapidleanRoutes = require('../../../server/routes/rapidlean');
        app.use('/api/rapidlean', rapidleanRoutes);

        // Add error logger
        app.use((err, req, res, next) => {
            console.error('SERVER ERROR IN INTEGRATION TEST:', err);
            res.status(500).json({ error: err.message, stack: err.stack });
        });
    });

    beforeEach(async () => {
        testProjectId = uuidv4();

        // Clean up test data using real DB (in-memory SQLite)
        await new Promise((resolve) => {
            db.run('DELETE FROM rapid_lean_reports WHERE organization_id = ?', ['test-org-id'], () => {
                db.run('DELETE FROM rapid_lean_observations WHERE organization_id = ?', ['test-org-id'], () => {
                    db.run('DELETE FROM rapid_lean_assessments WHERE organization_id = ?', ['test-org-id'], () => {
                        resolve();
                    });
                });
            });
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/rapidlean/templates', () => {
    const db = getDatabase();
        it('should return all 6 observation templates', async () => {
            const response = await request(app)
                .get('/api/rapidlean/templates')
                .expect(200);

            expect(response.body).toHaveProperty('templates');
            expect(Array.isArray(response.body.templates)).toBe(true);
            expect(response.body.templates.length).toBe(6);
        });
    });

    describe('POST /api/rapidlean/observations', () => {
    const db = getDatabase();
        it('should create assessment and save observations', async () => {
            const observations = [
                {
                    templateId: 'value_stream_template',
                    location: 'Production Line A',
                    timestamp: new Date().toISOString(),
                    answers: { 'vs_1': true },
                    photos: [],
                    notes: 'Test observation'
                }
            ];

            const response = await request(app)
                .post('/api/rapidlean/observations')
                .send({
                    projectId: testProjectId,
                    observations: observations
                })
                .expect(200);

            expect(response.body).toHaveProperty('assessment');
            expect(response.body.assessment).toHaveProperty('id');
            expect(response.body.assessment.observation_count).toBe(1);
        });
    });

    describe('GET /api/rapidlean/observations/:assessmentId', () => {
    const db = getDatabase();
        it('should return observations for assessment', async () => {
            const observations = [
                {
                    templateId: 'value_stream_template',
                    location: 'Line A',
                    timestamp: new Date().toISOString(),
                    answers: { 'vs_1': true },
                    photos: [],
                    notes: 'Test'
                }
            ];

            const createResponse = await request(app)
                .post('/api/rapidlean/observations')
                .send({
                    projectId: testProjectId,
                    observations: observations
                })
                .expect(200);

            const createdAssessmentId = createResponse.body.assessment.id;

            const response = await request(app)
                .get(`/api/rapidlean/observations/${createdAssessmentId}`)
                .expect(200);

            expect(response.body).toHaveProperty('observations');
            expect(response.body.observations.length).toBeGreaterThan(0);
        });
    });

    describe('GET /api/rapidlean/:id/drd-mapping', () => {
    const db = getDatabase();
        it('should return DRD mapping with gaps and pathways', async () => {
            const observations = [{ templateId: 'value_stream_template', answers: { 'vs_1': true } }];
            const createResponse = await request(app)
                .post('/api/rapidlean/observations')
                .send({ projectId: testProjectId, observations })
                .expect(200);

            const assessmentId = createResponse.body.assessment.id;

            const response = await request(app)
                .get(`/api/rapidlean/${assessmentId}/drd-mapping`)
                .expect(200);

            expect(response.body).toHaveProperty('drdMapping');
            expect(response.body).toHaveProperty('gaps');
            expect(response.body).toHaveProperty('pathways');
        });
    });
});