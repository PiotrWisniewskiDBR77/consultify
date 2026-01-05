import app from '../../../server/src/index.js';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    process.env.SQLITE_PATH = ':memory:';
});

// Assessment Routes Integration Tests
// Tests the assessment API endpoints for proper functionality

const express = require('express');
const assessmentRoutes = require('../../../../server/routes/assessment');
const { setupTestDatabase, teardownTestDatabase } = require('../helpers/testDatabase');

describe('Assessment Routes', () => {
    const db = getDatabase();
    let app;
    let server;
    let testDb;

    beforeAll(async () => {
        await initializeDatabase();
        testDb = await setupTestDatabase();

        app = express();
        app.use(express.json());
        app.use('/api/assessment', assessmentRoutes);

        server = app.listen(3001);
    });

    afterAll(async () => {
        await teardownTestDatabase(testDb);
        server.close();
    });

    beforeEach(async () => {
        // Reset database state
        await testDb.run('DELETE FROM assessments');
        await testDb.run('DELETE FROM assessment_responses');
    });

    describe('POST /api/assessment/start', () => {
    const db = getDatabase();
        it('should start a new assessment', async () => {
            const assessmentData = {
                type: 'maturity_assessment',
                organizationId: 'org-123',
                userId: 'user-123',
                framework: 'consultify_standard'
            };

            const response = await request(app)
                .post('/api/assessment/start')
                .send(assessmentData)
                .expect(201);

            expect(response.body).toHaveProperty('assessmentId');
            expect(response.body).toHaveProperty('status', 'in_progress');
            expect(response.body).toHaveProperty('questions');
            expect(Array.isArray(response.body.questions)).toBe(true);
        });

        it('should validate required fields', async () => {
            const invalidData = {
                type: 'maturity_assessment'
                // Missing required fields
            };

            const response = await request(app)
                .post('/api/assessment/start')
                .send(invalidData)
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Missing required fields');
        });

        it('should prevent duplicate active assessments', async () => {
            const assessmentData = {
                type: 'maturity_assessment',
                organizationId: 'org-123',
                userId: 'user-123',
                framework: 'consultify_standard'
            };

            // Create first assessment
            await request(app)
                .post('/api/assessment/start')
                .send(assessmentData)
                .expect(201);

            // Try to create duplicate
            const response = await request(app)
                .post('/api/assessment/start')
                .send(assessmentData)
                .expect(409);

            expect(response.body.error).toContain('Active assessment already exists');
        });
    });

    describe('GET /api/assessment/:id', () => {
    const db = getDatabase();
        let assessmentId;

        beforeEach(async () => {
            // Create test assessment
            const response = await request(app)
                .post('/api/assessment/start')
                .send({
                    type: 'maturity_assessment',
                    organizationId: 'org-123',
                    userId: 'user-123',
                    framework: 'consultify_standard'
                });

            assessmentId = response.body.assessmentId;
        });

        it('should retrieve assessment by ID', async () => {
            const response = await request(app)
                .get(`/api/assessment/${assessmentId}`)
                .expect(200);

            expect(response.body).toHaveProperty('id', assessmentId);
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('progress');
            expect(response.body).toHaveProperty('questions');
        });

        it('should return 404 for non-existent assessment', async () => {
            const response = await request(app)
                .get('/api/assessment/non-existent-id')
                .expect(404);

            expect(response.body.error).toContain('Assessment not found');
        });

        it('should include assessment metadata', async () => {
            const response = await request(app)
                .get(`/api/assessment/${assessmentId}`)
                .expect(200);

            expect(response.body).toHaveProperty('createdAt');
            expect(response.body).toHaveProperty('updatedAt');
            expect(response.body).toHaveProperty('framework');
            expect(response.body).toHaveProperty('organizationId');
        });
    });

    describe('POST /api/assessment/:id/answer', () => {
    const db = getDatabase();
        let assessmentId;
        let questionId;

        beforeEach(async () => {
            // Create test assessment
            const response = await request(app)
                .post('/api/assessment/start')
                .send({
                    type: 'maturity_assessment',
                    organizationId: 'org-123',
                    userId: 'user-123',
                    framework: 'consultify_standard'
                });

            assessmentId = response.body.assessmentId;
            questionId = response.body.questions[0].id;
        });

        it('should save assessment answer', async () => {
            const answerData = {
                questionId: questionId,
                answer: '4',
                comments: 'Strong maturity in this area'
            };

            const response = await request(app)
                .post(`/api/assessment/${assessmentId}/answer`)
                .send(answerData)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('nextQuestion');
        });

        it('should validate answer format', async () => {
            const invalidAnswer = {
                questionId: questionId,
                answer: 'invalid_answer',
                comments: 'Test comment'
            };

            const response = await request(app)
                .post(`/api/assessment/${assessmentId}/answer`)
                .send(invalidAnswer)
                .expect(400);

            expect(response.body.error).toContain('Invalid answer format');
        });

        it('should update assessment progress', async () => {
            const answerData = {
                questionId: questionId,
                answer: '3',
                comments: 'Good progress'
            };

            await request(app)
                .post(`/api/assessment/${assessmentId}/answer`)
                .send(answerData)
                .expect(200);

            // Check progress update
            const assessmentResponse = await request(app)
                .get(`/api/assessment/${assessmentId}`)
                .expect(200);

            expect(assessmentResponse.body.progress).toBeGreaterThan(0);
        });
    });

    describe('POST /api/assessment/:id/complete', () => {
    const db = getDatabase();
        let assessmentId;

        beforeEach(async () => {
            // Create and partially complete assessment
            const response = await request(app)
                .post('/api/assessment/start')
                .send({
                    type: 'maturity_assessment',
                    organizationId: 'org-123',
                    userId: 'user-123',
                    framework: 'consultify_standard'
                });

            assessmentId = response.body.assessmentId;

            // Answer all questions (simplified for test)
            for (const question of response.body.questions.slice(0, 3)) {
                await request(app)
                    .post(`/api/assessment/${assessmentId}/answer`)
                    .send({
                        questionId: question.id,
                        answer: '4',
                        comments: 'Test answer'
                    });
            }
        });

        it('should complete assessment and generate results', async () => {
            const response = await request(app)
                .post(`/api/assessment/${assessmentId}/complete`)
                .send({ generateReport: true })
                .expect(200);

            expect(response.body).toHaveProperty('status', 'completed');
            expect(response.body).toHaveProperty('results');
            expect(response.body).toHaveProperty('reportUrl');
            expect(response.body.results).toHaveProperty('overallScore');
            expect(response.body.results).toHaveProperty('dimensionScores');
        });

        it('should calculate maturity scores correctly', async () => {
            const response = await request(app)
                .post(`/api/assessment/${assessmentId}/complete`)
                .send({ generateReport: true })
                .expect(200);

            const results = response.body.results;

            expect(results.overallScore).toBeGreaterThanOrEqual(0);
            expect(results.overallScore).toBeLessThanOrEqual(5);
            expect(Array.isArray(results.dimensionScores)).toBe(true);
            expect(results.dimensionScores.length).toBeGreaterThan(0);
        });

        it('should generate assessment report', async () => {
            const response = await request(app)
                .post(`/api/assessment/${assessmentId}/complete`)
                .send({ generateReport: true })
                .expect(200);

            expect(response.body).toHaveProperty('reportUrl');
            expect(response.body.reportUrl).toMatch(/^\/reports\/assessment\//);
        });
    });

    describe('GET /api/assessment/organization/:orgId', () => {
    const db = getDatabase();
        beforeEach(async () => {
            // Create multiple assessments for organization
            const assessments = [
                {
                    type: 'maturity_assessment',
                    organizationId: 'org-123',
                    userId: 'user-1',
                    framework: 'consultify_standard'
                },
                {
                    type: 'gap_analysis',
                    organizationId: 'org-123',
                    userId: 'user-2',
                    framework: 'iso_21500'
                }
            ];

            for (const assessment of assessments) {
                await request(app)
                    .post('/api/assessment/start')
                    .send(assessment);
            }
        });

        it('should list all assessments for organization', async () => {
            const response = await request(app)
                .get('/api/assessment/organization/org-123')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2);
            expect(response.body[0]).toHaveProperty('id');
            expect(response.body[0]).toHaveProperty('type');
            expect(response.body[0]).toHaveProperty('status');
        });

        it('should filter by status', async () => {
            const response = await request(app)
                .get('/api/assessment/organization/org-123?status=in_progress')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            response.body.forEach(assessment => {
                expect(assessment.status).toBe('in_progress');
            });
        });

        it('should filter by type', async () => {
            const response = await request(app)
                .get('/api/assessment/organization/org-123?type=maturity_assessment')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            response.body.forEach(assessment => {
                expect(assessment.type).toBe('maturity_assessment');
            });
        });
    });

    describe('DELETE /api/assessment/:id', () => {
    const db = getDatabase();
        let assessmentId;

        beforeEach(async () => {
            // Create test assessment
            const response = await request(app)
                .post('/api/assessment/start')
                .send({
                    type: 'maturity_assessment',
                    organizationId: 'org-123',
                    userId: 'user-123',
                    framework: 'consultify_standard'
                });

            assessmentId = response.body.assessmentId;
        });

        it('should delete assessment', async () => {
            const response = await request(app)
                .delete(`/api/assessment/${assessmentId}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);

            // Verify assessment is deleted
            await request(app)
                .get(`/api/assessment/${assessmentId}`)
                .expect(404);
        });

        it('should prevent deletion of completed assessments', async () => {
            // Complete the assessment first
            await request(app)
                .post(`/api/assessment/${assessmentId}/complete`)
                .send({ generateReport: false })
                .expect(200);

            // Try to delete
            const response = await request(app)
                .delete(`/api/assessment/${assessmentId}`)
                .expect(400);

            expect(response.body.error).toContain('Cannot delete completed assessment');
        });
    });

    describe('POST /api/assessment/:id/pause', () => {
    const db = getDatabase();
        let assessmentId;

        beforeEach(async () => {
            // Create test assessment
            const response = await request(app)
                .post('/api/assessment/start')
                .send({
                    type: 'maturity_assessment',
                    organizationId: 'org-123',
                    userId: 'user-123',
                    framework: 'consultify_standard'
                });

            assessmentId = response.body.assessmentId;
        });

        it('should pause assessment', async () => {
            const response = await request(app)
                .post(`/api/assessment/${assessmentId}/pause`)
                .send({ reason: 'User requested pause' })
                .expect(200);

            expect(response.body).toHaveProperty('status', 'paused');

            // Verify status change
            const assessmentResponse = await request(app)
                .get(`/api/assessment/${assessmentId}`)
                .expect(200);

            expect(assessmentResponse.body.status).toBe('paused');
        });

        it('should resume paused assessment', async () => {
            // Pause first
            await request(app)
                .post(`/api/assessment/${assessmentId}/pause`)
                .send({ reason: 'Test pause' })
                .expect(200);

            // Resume
            const response = await request(app)
                .post(`/api/assessment/${assessmentId}/resume`)
                .expect(200);

            expect(response.body).toHaveProperty('status', 'in_progress');

            // Verify status change
            const assessmentResponse = await request(app)
                .get(`/api/assessment/${assessmentId}`)
                .expect(200);

            expect(assessmentResponse.body.status).toBe('in_progress');
        });
    });

    describe('GET /api/assessment/:id/progress', () => {
    const db = getDatabase();
        let assessmentId;

        beforeEach(async () => {
            // Create test assessment
            const response = await request(app)
                .post('/api/assessment/start')
                .send({
                    type: 'maturity_assessment',
                    organizationId: 'org-123',
                    userId: 'user-123',
                    framework: 'consultify_standard'
                });

            assessmentId = response.body.assessmentId;
        });

        it('should return detailed progress information', async () => {
            const response = await request(app)
                .get(`/api/assessment/${assessmentId}/progress`)
                .expect(200);

            expect(response.body).toHaveProperty('overallProgress');
            expect(response.body).toHaveProperty('completedQuestions');
            expect(response.body).toHaveProperty('totalQuestions');
            expect(response.body).toHaveProperty('timeSpent');
            expect(response.body).toHaveProperty('estimatedTimeRemaining');
        });

        it('should include dimension-wise progress', async () => {
            const response = await request(app)
                .get(`/api/assessment/${assessmentId}/progress`)
                .expect(200);

            expect(response.body).toHaveProperty('dimensionProgress');
            expect(Array.isArray(response.body.dimensionProgress)).toBe(true);
        });
    });

    describe('Error Handling', () => {
    const db = getDatabase();
        it('should handle database errors gracefully', async () => {
            // Mock database error
            const originalRun = testDb.run;
            testDb.run = jest.fn((query, params, callback) => {
                callback(new Error('Database connection failed'));
            });

            const response = await request(app)
                .post('/api/assessment/start')
                .send({
                    type: 'maturity_assessment',
                    organizationId: 'org-123',
                    userId: 'user-123',
                    framework: 'consultify_standard'
                })
                .expect(500);

            expect(response.body.error).toContain('Database error');

            testDb.run = originalRun;
        });

        it('should handle invalid assessment IDs', async () => {
            const response = await request(app)
                .get('/api/assessment/invalid-id-format')
                .expect(400);

            expect(response.body.error).toContain('Invalid assessment ID');
        });

        it('should prevent unauthorized access', async () => {
            // This would require authentication middleware in real implementation
            const response = await request(app)
                .get('/api/assessment/assessment-123')
                .expect(401);

            expect(response.body.error).toContain('Unauthorized');
        });
    });

    describe('Performance', () => {
    const db = getDatabase();
        it('should handle concurrent assessment operations', async () => {
            const operations = Array(10).fill().map(() =>
                request(app)
                    .post('/api/assessment/start')
                    .send({
                        type: 'maturity_assessment',
                        organizationId: 'org-123',
                        userId: `user-${Math.random()}`,
                        framework: 'consultify_standard'
                    })
            );

            const responses = await Promise.all(operations);

            responses.forEach(response => {
                expect(response.status).toBe(201);
                expect(response.body).toHaveProperty('assessmentId');
            });
        });

        it('should respond within acceptable time limits', async () => {
            const startTime = Date.now();

            await request(app)
                .post('/api/assessment/start')
                .send({
                    type: 'maturity_assessment',
                    organizationId: 'org-123',
                    userId: 'user-123',
                    framework: 'consultify_standard'
                })
                .expect(201);

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(1000); // Less than 1 second
        });
    });
});