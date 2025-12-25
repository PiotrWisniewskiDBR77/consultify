/**
 * Integration Tests for RapidLean Routes
 * Tests all API endpoints with proper request/response handling
 */

const request = require('supertest');
const express = require('express');
const db = require('../../../server/database');
const rapidleanRoutes = require('../../../server/routes/rapidlean');
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

describe('RapidLean Routes Integration', () => {
    let app;
    let testProjectId;
    let assessmentId;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(mockAuth);
        app.use('/api/rapidlean', rapidleanRoutes);
    });

    beforeEach(async () => {
        testProjectId = uuidv4();
        
        // Clean up test data
        await new Promise((resolve) => {
            db.run('DELETE FROM rapid_lean_reports WHERE organization_id = ?', ['test-org-id'], () => {
                db.run('DELETE FROM rapid_lean_observations WHERE organization_id = ?', ['test-org-id'], () => {
                    db.run('DELETE FROM rapid_lean_assessments WHERE organization_id = ?', ['test-org-id'], resolve);
                });
            });
        });
    });

    describe('GET /api/rapidlean/templates', () => {
        test('should return all 6 observation templates', async () => {
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
            expect(template).toHaveProperty('name');
            expect(template).toHaveProperty('checklist');
            expect(Array.isArray(template.checklist)).toBe(true);
        });

        test('should include all required template fields', async () => {
            const response = await request(app)
                .get('/api/rapidlean/templates')
                .expect(200);

            const template = response.body.templates[0];
            expect(template).toHaveProperty('photoRequired');
            expect(template).toHaveProperty('notesRequired');
            expect(template).toHaveProperty('estimatedTime');
            expect(typeof template.photoRequired).toBe('boolean');
            expect(typeof template.notesRequired).toBe('boolean');
            expect(typeof template.estimatedTime).toBe('number');
        });
    });

    describe('POST /api/rapidlean/observations', () => {
        test('should create assessment and save observations', async () => {
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
                }
            ];

            const response = await request(app)
                .post('/api/rapidlean/observations')
                .field('projectId', testProjectId)
                .field('observations', JSON.stringify(observations))
                .expect(200);

            expect(response.body).toHaveProperty('assessment');
            expect(response.body).toHaveProperty('report');
            expect(response.body).toHaveProperty('pdfUrl');
            expect(response.body.assessment).toHaveProperty('id');
            expect(response.body.assessment).toHaveProperty('overall_score');
            expect(response.body.assessment.observation_count).toBe(1);

            assessmentId = response.body.assessment.id;
        });

        test('should handle multiple observations', async () => {
            const observations = [
                {
                    templateId: 'value_stream_template',
                    location: 'Line A',
                    timestamp: new Date().toISOString(),
                    answers: { 'vs_1': true },
                    photos: [],
                    notes: 'Obs 1'
                },
                {
                    templateId: 'waste_template',
                    location: 'Line A',
                    timestamp: new Date().toISOString(),
                    answers: { 'waste_1': false },
                    photos: [],
                    notes: 'Obs 2'
                }
            ];

            const response = await request(app)
                .post('/api/rapidlean/observations')
                .field('projectId', testProjectId)
                .field('observations', JSON.stringify(observations))
                .expect(200);

            expect(response.body.assessment.observation_count).toBe(2);
        });

        test('should reject empty observations array', async () => {
            const response = await request(app)
                .post('/api/rapidlean/observations')
                .field('observations', JSON.stringify([]))
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should reject invalid observations format', async () => {
            const response = await request(app)
                .post('/api/rapidlean/observations')
                .field('observations', 'invalid-json')
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /api/rapidlean/observations/:assessmentId', () => {
        test('should return observations for assessment', async () => {
            // First create an assessment with observations
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
            
            const obs = response.body.observations[0];
            expect(obs).toHaveProperty('templateId');
            expect(obs).toHaveProperty('location');
            expect(obs).toHaveProperty('answers');
            expect(obs).toHaveProperty('photos');
        });

        test('should return 404 for non-existent assessment', async () => {
            const response = await request(app)
                .get(`/api/rapidlean/observations/${uuidv4()}`)
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /api/rapidlean/:id/drd-mapping', () => {
        test('should return DRD mapping with gaps and pathways', async () => {
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
            expect(typeof response.body.drdMapping.processes).toBe('number');
            expect(typeof response.body.drdMapping.culture).toBe('number');
            
            expect(response.body.gaps).toHaveProperty('processes');
            expect(response.body.gaps.processes).toHaveProperty('current');
            expect(response.body.gaps.processes).toHaveProperty('target');
            expect(response.body.gaps.processes).toHaveProperty('gap');
            expect(response.body.gaps.processes).toHaveProperty('priority');
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
            expect(response.body.reportData).toHaveProperty('summary');
            expect(response.body.reportData).toHaveProperty('dimensions');
            expect(response.body.reportData).toHaveProperty('drdMapping');
        });

        test('should support different report formats', async () => {
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

            // Test Excel format
            const excelResponse = await request(app)
                .post(`/api/rapidlean/${assessmentId}/report`)
                .send({ format: 'excel' })
                .expect(200);

            expect(excelResponse.body.fileUrl).toContain('.xlsx');
        });
    });

    describe('GET /api/rapidlean/:assessmentId', () => {
        test('should return assessment with DRD mapping and observations', async () => {
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

            // Get assessment
            const response = await request(app)
                .get(`/api/rapidlean/${assessmentId}`)
                .expect(200);

            expect(response.body).toHaveProperty('assessment');
            expect(response.body).toHaveProperty('drdMapping');
            expect(response.body).toHaveProperty('observations');
            expect(response.body).toHaveProperty('benchmark');
        });
    });
});

