/**
 * Full Workflow Integration Test for RapidLean Observations
 * Tests complete end-to-end flow: templates → observations → assessment → report → DRD mapping
 */

const request = require('supertest');
const express = require('express');
const db = require('../../server/database');
const rapidleanRoutes = require('../../server/routes/rapidlean');
const RapidLeanService = require('../../server/services/rapidLeanService');
const RapidLeanObservationMapper = require('../../server/services/rapidLeanObservationMapper');
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

describe('RapidLean Full Workflow Integration', () => {
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

    test('complete workflow: templates → observations → assessment → report → DRD mapping', async () => {
        // Step 1: Get templates
        const templatesResponse = await request(app)
            .get('/api/rapidlean/templates')
            .expect(200);

        expect(templatesResponse.body.templates.length).toBe(6);
        const templates = templatesResponse.body.templates;

        // Step 2: Create observations for all 6 templates
        const observations = templates.map((template, index) => ({
            templateId: template.id,
            location: `Production Line ${String.fromCharCode(65 + index)}`, // A, B, C, D, E, F
            timestamp: new Date(Date.now() + index * 60000).toISOString(), // Staggered times
            answers: generateAnswersForTemplate(template),
            photos: [],
            notes: `Observation for ${template.name}`
        }));

        // Step 3: Submit observations and create assessment
        const observationsResponse = await request(app)
            .post('/api/rapidlean/observations')
            .field('projectId', testProjectId)
            .field('observations', JSON.stringify(observations))
            .expect(200);

        expect(observationsResponse.body).toHaveProperty('assessment');
        expect(observationsResponse.body).toHaveProperty('report');
        expect(observationsResponse.body).toHaveProperty('pdfUrl');
        
        assessmentId = observationsResponse.body.assessment.id;
        expect(observationsResponse.body.assessment.observation_count).toBe(6);

        // Step 4: Verify assessment scores
        expect(observationsResponse.body.assessment.overall_score).toBeGreaterThan(0);
        expect(observationsResponse.body.assessment.overall_score).toBeLessThanOrEqual(5);
        expect(observationsResponse.body.assessment.value_stream_score).toBeGreaterThan(0);

        // Step 5: Retrieve observations
        const getObservationsResponse = await request(app)
            .get(`/api/rapidlean/observations/${assessmentId}`)
            .expect(200);

        expect(getObservationsResponse.body.observations.length).toBe(6);
        getObservationsResponse.body.observations.forEach(obs => {
            expect(obs).toHaveProperty('templateId');
            expect(obs).toHaveProperty('location');
            expect(obs).toHaveProperty('answers');
        });

        // Step 6: Get DRD mapping
        const drdMappingResponse = await request(app)
            .get(`/api/rapidlean/${assessmentId}/drd-mapping`)
            .expect(200);

        expect(drdMappingResponse.body.drdMapping).toHaveProperty('processes');
        expect(drdMappingResponse.body.drdMapping).toHaveProperty('culture');
        expect(drdMappingResponse.body.observationsCount).toBe(6);
        expect(drdMappingResponse.body.gaps).toHaveProperty('processes');
        expect(drdMappingResponse.body.pathways).toHaveProperty('processes');

        // Step 7: Generate report
        const reportResponse = await request(app)
            .post(`/api/rapidlean/${assessmentId}/report`)
            .send({
                format: 'pdf',
                template: 'detailed',
                includeCharts: true,
                compareWithPrevious: false
            })
            .expect(200);

        expect(reportResponse.body).toHaveProperty('reportId');
        expect(reportResponse.body).toHaveProperty('fileUrl');
        expect(reportResponse.body).toHaveProperty('reportData');
        expect(reportResponse.body.reportData).toHaveProperty('summary');
        expect(reportResponse.body.reportData).toHaveProperty('dimensions');
        expect(reportResponse.body.reportData).toHaveProperty('drdMapping');

        // Step 8: Verify report data structure
        const reportData = reportResponse.body.reportData;
        expect(reportData.summary).toHaveProperty('overallScore');
        expect(reportData.summary).toHaveProperty('drdMaturity');
        expect(Array.isArray(reportData.dimensions)).toBe(true);
        expect(reportData.dimensions.length).toBe(6);
        expect(Array.isArray(reportData.observations)).toBe(true);
        expect(reportData.observations.length).toBe(6);
    });

    test('workflow with multiple assessments for trend analysis', async () => {
        // Create first assessment
        const observations1 = [
            {
                templateId: 'value_stream_template',
                location: 'Line A',
                timestamp: new Date('2024-01-01').toISOString(),
                answers: { 'vs_1': true, 'vs_2': true },
                photos: [],
                notes: 'First assessment'
            }
        ];

        const response1 = await request(app)
            .post('/api/rapidlean/observations')
            .field('projectId', testProjectId)
            .field('observations', JSON.stringify(observations1))
            .expect(200);

        const assessmentId1 = response1.body.assessment.id;

        // Create second assessment (later date)
        const observations2 = [
            {
                templateId: 'value_stream_template',
                location: 'Line A',
                timestamp: new Date('2024-02-01').toISOString(),
                answers: { 'vs_1': true, 'vs_2': true, 'vs_4': true },
                photos: [],
                notes: 'Second assessment - improved'
            }
        ];

        const response2 = await request(app)
            .post('/api/rapidlean/observations')
            .field('projectId', testProjectId)
            .field('observations', JSON.stringify(observations2))
            .expect(200);

        const assessmentId2 = response2.body.assessment.id;

        // Generate report with comparison
        const reportResponse = await request(app)
            .post(`/api/rapidlean/${assessmentId2}/report`)
            .send({
                format: 'pdf',
                template: 'comparison',
                compareWithPrevious: true
            })
            .expect(200);

        expect(reportResponse.body.reportData).toHaveProperty('trends');
        if (reportResponse.body.reportData.trends) {
            expect(reportResponse.body.reportData.trends).toHaveProperty('overallTrend');
            expect(reportResponse.body.reportData.trends).toHaveProperty('dimensionTrends');
        }
    });
});

// Helper function to generate answers for a template
function generateAnswersForTemplate(template) {
    const answers = {};
    template.checklist.forEach(item => {
        switch (item.type) {
            case 'yes_no':
                answers[item.id] = true; // Default to yes for testing
                break;
            case 'scale':
                answers[item.id] = 3; // Middle value
                break;
            case 'measurement':
                answers[item.id] = 10;
                break;
            case 'text':
                answers[item.id] = 'Test observation';
                break;
            case 'photo':
                // Photo items don't have answers, handled separately
                break;
        }
    });
    return answers;
}

