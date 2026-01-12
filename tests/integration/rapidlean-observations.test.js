/**
 * Integration Tests for RapidLean Observations
 * Tests full workflow: observations → assessment → report
 */

const request = require('supertest');
const express = require('express');
const db = require('../../server/database');
const rapidleanRoutes = require('../../server/routes/rapidlean');
const { v4: uuidv4 } = require('uuid');

// Mock auth middleware
const mockAuth = (req, res, next) => {
    req.user = {
        id: 'test-user-id',
        organizationId: 'test-org-id',
        organization_id: 'test-org-id'
    };
    next();
};

describe('RapidLean Observations Integration', () => {
    let app;
    let assessmentId;
    let testProjectId;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use(mockAuth);
        app.use('/api/rapidlean', rapidleanRoutes);
    });

    beforeEach(async () => {
        testProjectId = uuidv4();
        
        // Clean up test data
        await new Promise((resolve) => {
            db.run('DELETE FROM rapid_lean_observations WHERE organization_id = ?', ['test-org-id'], () => {
                db.run('DELETE FROM rapid_lean_assessments WHERE organization_id = ?', ['test-org-id'], resolve);
            });
        });
    });

    describe('POST /api/rapidlean/observations', () => {
        test('should create assessment from observations', async () => {
            const observations = [
                {
                    templateId: 'value_stream_template',
                    location: 'Production Line A',
                    timestamp: new Date().toISOString(),
                    answers: {
                        'vs_1': true,
                        'vs_2': true,
                        'vs_4': true,
                        'vs_6': 'Test notes'
                    },
                    photos: [],
                    notes: 'Test observation'
                },
                {
                    templateId: 'waste_template',
                    location: 'Production Line A',
                    timestamp: new Date().toISOString(),
                    answers: {
                        'waste_1': false,
                        'waste_2': false,
                        'waste_7': false
                    },
                    photos: [],
                    notes: 'No major waste observed'
                }
            ];

            const response = await request(app)
                .post('/api/rapidlean/observations')
                .field('projectId', testProjectId)
                .field('observations', JSON.stringify(observations))
                .expect(200);

            expect(response.body).toHaveProperty('assessment');
            expect(response.body).toHaveProperty('report');
            expect(response.body.assessment).toHaveProperty('id');
            expect(response.body.assessment).toHaveProperty('overall_score');
            expect(response.body.assessment.observation_count).toBe(2);

            assessmentId = response.body.assessment.id;
        });

        test('should reject invalid observations', async () => {
            const response = await request(app)
                .post('/api/rapidlean/observations')
                .field('observations', JSON.stringify([]))
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /api/rapidlean/observations/:assessmentId', () => {
        test('should retrieve observations for assessment', async () => {
            // First create an assessment
            const observations = [
                {
                    templateId: 'value_stream_template',
                    location: 'Production Line A',
                    timestamp: new Date().toISOString(),
                    answers: { 'vs_1': true },
                    photos: [],
                    notes: 'Test'
                }
            ];

            const createResponse = await request(app)
                .post('/api/rapidlean/observations')
                .field('projectId', testProjectId)
                .field('observations', JSON.stringify(observations))
                .expect(200);

            const createdAssessmentId = createResponse.body.assessment.id;

            // Then retrieve observations
            const response = await request(app)
                .get(`/api/rapidlean/observations/${createdAssessmentId}`)
                .expect(200);

            expect(response.body).toHaveProperty('observations');
            expect(Array.isArray(response.body.observations)).toBe(true);
            expect(response.body.observations.length).toBeGreaterThan(0);
        });

        test('should return 404 for non-existent assessment', async () => {
            const response = await request(app)
                .get(`/api/rapidlean/observations/${uuidv4()}`)
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /api/rapidlean/templates', () => {
        test('should return all observation templates', async () => {
            const response = await request(app)
                .get('/api/rapidlean/templates')
                .expect(200);

            expect(response.body).toHaveProperty('templates');
            expect(Array.isArray(response.body.templates)).toBe(true);
            expect(response.body.templates.length).toBe(6);
            
            // Verify template structure
            const template = response.body.templates[0];
            expect(template).toHaveProperty('id');
            expect(template).toHaveProperty('dimension');
            expect(template).toHaveProperty('drdAxis');
            expect(template).toHaveProperty('checklist');
        });
    });

    describe('GET /api/rapidlean/:id/drd-mapping', () => {
        test('should return DRD mapping with observations', async () => {
            // Create assessment first
            const observations = [
                {
                    templateId: 'value_stream_template',
                    location: 'Production Line A',
                    timestamp: new Date().toISOString(),
                    answers: { 'vs_1': true, 'vs_2': true },
                    photos: [],
                    notes: 'Test'
                }
            ];

            const createResponse = await request(app)
                .post('/api/rapidlean/observations')
                .field('projectId', testProjectId)
                .field('observations', JSON.stringify(observations))
                .expect(200);

            const assessmentId = createResponse.body.assessment.id;

            // Get DRD mapping
            const response = await request(app)
                .get(`/api/rapidlean/${assessmentId}/drd-mapping`)
                .expect(200);

            expect(response.body).toHaveProperty('drdMapping');
            expect(response.body).toHaveProperty('gaps');
            expect(response.body).toHaveProperty('pathways');
            expect(response.body).toHaveProperty('observationsCount');
            expect(response.body.drdMapping).toHaveProperty('processes');
            expect(response.body.drdMapping).toHaveProperty('culture');
        });
    });

    describe('POST /api/rapidlean/:id/report', () => {
        test('should generate report for assessment', async () => {
            // Create assessment first
            const observations = [
                {
                    templateId: 'value_stream_template',
                    location: 'Production Line A',
                    timestamp: new Date().toISOString(),
                    answers: { 'vs_1': true },
                    photos: [],
                    notes: 'Test'
                }
            ];

            const createResponse = await request(app)
                .post('/api/rapidlean/observations')
                .field('projectId', testProjectId)
                .field('observations', JSON.stringify(observations))
                .expect(200);

            const assessmentId = createResponse.body.assessment.id;

            // Generate report
            const response = await request(app)
                .post(`/api/rapidlean/${assessmentId}/report`)
                .send({
                    format: 'pdf',
                    template: 'detailed',
                    includeCharts: true
                })
                .expect(200);

            expect(response.body).toHaveProperty('reportId');
            expect(response.body).toHaveProperty('fileUrl');
            expect(response.body).toHaveProperty('reportData');
        });
    });
});

