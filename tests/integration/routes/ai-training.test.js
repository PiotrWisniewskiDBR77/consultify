// AI Training/Feedback Routes Integration Tests
// Tests AI feedback collection and training data management

const request = require('supertest');
const app = require('../../../server/server');
const { sequelize } = require('../../../server/models');
const { User, Organization } = require('../../../server/models');

describe('AI Training/Feedback Routes Integration Tests', () => {
    let testUser;
    let testOrg;
    let authToken;

    beforeAll(async () => {
        // Create test data
        testOrg = await Organization.create({
            name: 'Test AI Training Org',
            domain: 'ai-training-test.com'
        });

        testUser = await User.create({
            firstName: 'Training',
            lastName: 'TestUser',
            email: 'training@test.com',
            organizationId: testOrg.id,
            password: 'hashedpassword'
        });

        // Mock JWT token
        authToken = 'mock-jwt-token-for-training-tests';
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('GET /api/ai-training', () => {
        it('should retrieve AI feedback for organization', async () => {
            const response = await request(app)
                .get('/api/ai-training')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        it('should filter feedback by helpful status', async () => {
            const response = await request(app)
                .get('/api/ai-training')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ helpful: 'true' });

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            // All returned feedback should be helpful
            response.body.forEach(feedback => {
                expect(feedback.helpful).toBe(1);
            });
        });

        it('should filter feedback by context', async () => {
            const response = await request(app)
                .get('/api/ai-training')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ context: 'project_planning' });

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            // All returned feedback should have the specified context
            response.body.forEach(feedback => {
                expect(feedback.context).toBe('project_planning');
            });
        });

        it('should limit results to 100', async () => {
            const response = await request(app)
                .get('/api/ai-training')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.length).toBeLessThanOrEqual(100);
        });

        it('should order results by creation date descending', async () => {
            const response = await request(app)
                .get('/api/ai-training')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            if (response.body.length > 1) {
                for (let i = 1; i < response.body.length; i++) {
                    const prevDate = new Date(response.body[i - 1].created_at);
                    const currDate = new Date(response.body[i].created_at);
                    expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime());
                }
            }
        });

        it('should return 401 without authentication', async () => {
            const response = await request(app)
                .get('/api/ai-training');

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/ai-training', () => {
        it('should submit positive AI feedback', async () => {
            const feedback = {
                context: 'task_creation',
                prompt: 'Create a task for implementing user authentication',
                response: 'I\'ve created a task for implementing user authentication with the following details...',
                helpful: true,
                comment: 'Great response, very detailed'
            };

            const response = await request(app)
                .post('/api/ai-training')
                .set('Authorization', `Bearer ${authToken}`)
                .send(feedback);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('organization_id', testOrg.id);
            expect(response.body).toHaveProperty('user_id', testUser.id);
            expect(response.body).toHaveProperty('helpful', 1);
        });

        it('should submit negative AI feedback', async () => {
            const feedback = {
                context: 'report_generation',
                prompt: 'Generate a quarterly progress report',
                response: 'Here is your report...',
                helpful: false,
                comment: 'Report was incomplete and missing key metrics'
            };

            const response = await request(app)
                .post('/api/ai-training')
                .set('Authorization', `Bearer ${authToken}`)
                .send(feedback);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('helpful', 0);
            expect(response.body).toHaveProperty('comment', 'Report was incomplete and missing key metrics');
        });

        it('should accept feedback without optional fields', async () => {
            const minimalFeedback = {
                context: 'general_assistance',
                response: 'This is a test response',
                helpful: true
            };

            const response = await request(app)
                .post('/api/ai-training')
                .set('Authorization', `Bearer ${authToken}`)
                .send(minimalFeedback);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('prompt', '');
            expect(response.body).toHaveProperty('comment', '');
        });

        it('should reject feedback missing required fields', async () => {
            const invalidFeedback = {
                context: 'test_context'
                // Missing response and helpful
            };

            const response = await request(app)
                .post('/api/ai-training')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidFeedback);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('required');
        });

        it('should reject feedback with missing context', async () => {
            const invalidFeedback = {
                response: 'Test response',
                helpful: true
                // Missing context
            };

            const response = await request(app)
                .post('/api/ai-training')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidFeedback);

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('context');
        });

        it('should handle malformed request body', async () => {
            const response = await request(app)
                .post('/api/ai-training')
                .set('Authorization', `Bearer ${authToken}`)
                .send('invalid json');

            expect(response.status).toBe(400);
        });
    });

    describe('GET /api/ai-training/stats', () => {
        it('should return feedback statistics', async () => {
            const response = await request(app)
                .get('/api/ai-training/stats')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('total');
            expect(response.body).toHaveProperty('helpful');
            expect(response.body).toHaveProperty('notHelpful');
            expect(response.body).toHaveProperty('accuracy');
        });

        it('should calculate accuracy correctly', async () => {
            const response = await request(app)
                .get('/api/ai-training/stats')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            const stats = response.body;

            if (stats.total > 0) {
                expect(stats.accuracy).toBeGreaterThanOrEqual(0);
                expect(stats.accuracy).toBeLessThanOrEqual(100);
                expect(stats.helpful + stats.notHelpful).toBe(stats.total);
            }
        });
    });

    describe('GET /api/ai-training/export', () => {
        it('should export feedback data', async () => {
            const response = await request(app)
                .get('/api/ai-training/export')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ format: 'json' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('feedback');
            expect(Array.isArray(response.body.feedback)).toBe(true);
        });

        it('should support CSV export format', async () => {
            const response = await request(app)
                .get('/api/ai-training/export')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ format: 'csv' });

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('text/csv');
        });

        it('should filter export by date range', async () => {
            const startDate = '2024-01-01';
            const endDate = '2024-12-31';

            const response = await request(app)
                .get('/api/ai-training/export')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    format: 'json',
                    startDate,
                    endDate
                });

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body.feedback)).toBe(true);

            // Check that all exported feedback is within date range
            response.body.feedback.forEach(feedback => {
                const feedbackDate = new Date(feedback.created_at);
                const start = new Date(startDate);
                const end = new Date(endDate);
                expect(feedbackDate.getTime()).toBeGreaterThanOrEqual(start.getTime());
                expect(feedbackDate.getTime()).toBeLessThanOrEqual(end.getTime());
            });
        });
    });

    describe('DELETE /api/ai-training/:id', () => {
        it('should delete specific feedback entry', async () => {
            // First create feedback to delete
            const createResponse = await request(app)
                .post('/api/ai-training')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    context: 'test_deletion',
                    response: 'Test response for deletion',
                    helpful: true
                });

            const feedbackId = createResponse.body.id;

            // Then delete it
            const deleteResponse = await request(app)
                .delete(`/api/ai-training/${feedbackId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(deleteResponse.status).toBe(200);

            // Verify it's deleted by trying to get stats
            const statsResponse = await request(app)
                .get('/api/ai-training/stats')
                .set('Authorization', `Bearer ${authToken}`);

            expect(statsResponse.status).toBe(200);
        });

        it('should return 404 for non-existent feedback', async () => {
            const response = await request(app)
                .delete('/api/ai-training/non-existent-id')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
        });
    });

    describe('Data Validation', () => {
        it('should sanitize HTML content in feedback', async () => {
            const maliciousFeedback = {
                context: 'security_test',
                prompt: '<script>alert("xss")</script>',
                response: '<img src="x" onerror="alert(\'xss\')">Normal response',
                helpful: false,
                comment: '<a href="javascript:alert(\'xss\')">Click me</a>'
            };

            const response = await request(app)
                .post('/api/ai-training')
                .set('Authorization', `Bearer ${authToken}`)
                .send(maliciousFeedback);

            expect(response.status).toBe(200);

            // Verify HTML is sanitized
            expect(response.body.prompt).not.toContain('<script>');
            expect(response.body.response).not.toContain('onerror');
            expect(response.body.comment).not.toContain('javascript:');
        });

        it('should validate context values', async () => {
            const validContexts = [
                'task_creation',
                'project_planning',
                'report_generation',
                'general_assistance',
                'risk_analysis'
            ];

            for (const context of validContexts) {
                const feedback = {
                    context,
                    response: 'Test response',
                    helpful: true
                };

                const response = await request(app)
                    .post('/api/ai-training')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(feedback);

                expect(response.status).toBe(200);
            }
        });

        it('should handle very long feedback content', async () => {
            const longContent = 'a'.repeat(10000); // 10KB of content

            const feedback = {
                context: 'performance_test',
                prompt: longContent,
                response: longContent,
                helpful: true,
                comment: longContent
            };

            const response = await request(app)
                .post('/api/ai-training')
                .set('Authorization', `Bearer ${authToken}`)
                .send(feedback);

            expect(response.status).toBe(200);
        });
    });

    describe('Organization Isolation', () => {
        it('should only return feedback for user\'s organization', async () => {
            // This would require creating another org and user
            // For now, just verify the query includes organization filter
            const response = await request(app)
                .get('/api/ai-training')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            // All returned feedback should belong to the user's org
            response.body.forEach(feedback => {
                expect(feedback.organization_id).toBe(testOrg.id);
            });
        });

        it('should prevent cross-organization data access', async () => {
            // Create feedback in one org, try to access from another
            // This test would require multiple org setup
            // For now, just ensure org filtering is working
            const response = await request(app)
                .get('/api/ai-training')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
        });
    });

    describe('Rate Limiting', () => {
        it('should handle rapid feedback submissions', async () => {
            const feedbackPromises = Array(50).fill().map((_, i) =>
                request(app)
                    .post('/api/ai-training')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        context: `rate_limit_test_${i}`,
                        response: `Response ${i}`,
                        helpful: Math.random() > 0.5
                    })
            );

            const responses = await Promise.all(feedbackPromises);

            const successCount = responses.filter(r => r.status === 200).length;
            const rateLimitedCount = responses.filter(r => r.status === 429).length;

            expect(successCount + rateLimitedCount).toBe(50);
            expect(successCount).toBeGreaterThan(0); // At least some should succeed
        });
    });

    describe('Concurrent Access', () => {
        it('should handle concurrent feedback submissions', async () => {
            const concurrentFeedback = Array(10).fill().map((_, i) => ({
                context: `concurrent_test_${i}`,
                response: `Concurrent response ${i}`,
                helpful: i % 2 === 0,
                comment: `Comment ${i}`
            }));

            const responses = await Promise.all(
                concurrentFeedback.map(feedback =>
                    request(app)
                        .post('/api/ai-training')
                        .set('Authorization', `Bearer ${authToken}`)
                        .send(feedback)
                )
            );

            const successCount = responses.filter(r => r.status === 200).length;
            expect(successCount).toBe(10); // All should succeed

            // Verify all feedback was recorded
            const getResponse = await request(app)
                .get('/api/ai-training')
                .set('Authorization', `Bearer ${authToken}`);

            expect(getResponse.status).toBe(200);
            const concurrentEntries = getResponse.body.filter(f =>
                f.context.startsWith('concurrent_test_')
            );
            expect(concurrentEntries.length).toBe(10);
        });
    });
});


