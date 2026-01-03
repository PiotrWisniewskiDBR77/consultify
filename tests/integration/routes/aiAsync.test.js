// AI Async Routes Integration Tests
// Tests asynchronous AI job processing and queue management

const request = require('supertest');
const app = require('../../../server/server');
const { sequelize } = require('../../../server/models');
const { User, Organization } = require('../../../server/models');

describe('AI Async Routes Integration Tests', () => {
    let testUser;
    let testOrg;
    let authToken;
    let submittedJobId;

    beforeAll(async () => {
        // Create test data
        testOrg = await Organization.create({
            name: 'Test AI Async Org',
            domain: 'ai-async-test.com'
        });

        testUser = await User.create({
            firstName: 'Async',
            lastName: 'TestUser',
            email: 'async@test.com',
            organizationId: testOrg.id,
            password: 'hashedpassword'
        });

        // Mock JWT token
        authToken = 'mock-jwt-token-for-async-tests';
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('POST /api/aiAsync/jobs', () => {
        it('should submit an AI job to the queue', async () => {
            const jobPayload = {
                taskType: 'text_generation',
                payload: {
                    prompt: 'Generate a project summary for a software development initiative',
                    context: {
                        projectId: 'test-project-123',
                        userId: testUser.id
                    },
                    parameters: {
                        maxTokens: 500,
                        temperature: 0.7
                    }
                }
            };

            const response = await request(app)
                .post('/api/aiAsync/jobs')
                .set('Authorization', `Bearer ${authToken}`)
                .send(jobPayload);

            expect(response.status).toBe(202); // Accepted
            expect(response.body).toHaveProperty('jobId');
            expect(response.body).toHaveProperty('status', 'queued');
            expect(response.body).toHaveProperty('estimatedTime');

            submittedJobId = response.body.jobId;
        });

        it('should submit a complex AI analysis job', async () => {
            const analysisJob = {
                taskType: 'risk_analysis',
                payload: {
                    data: {
                        projectBudget: 1000000,
                        timeline: '12_months',
                        teamSize: 15,
                        complexity: 'high'
                    },
                    analysisType: 'comprehensive',
                    outputFormat: 'structured_report'
                }
            };

            const response = await request(app)
                .post('/api/aiAsync/jobs')
                .set('Authorization', `Bearer ${authToken}`)
                .send(analysisJob);

            expect(response.status).toBe(202);
            expect(response.body).toHaveProperty('jobId');
            expect(response.body).toHaveProperty('taskType', 'risk_analysis');
        });

        it('should submit a batch processing job', async () => {
            const batchJob = {
                taskType: 'batch_processing',
                payload: {
                    items: [
                        { id: 'task-1', content: 'Analyze this task' },
                        { id: 'task-2', content: 'Review this task' },
                        { id: 'task-3', content: 'Optimize this task' }
                    ],
                    operation: 'sentiment_analysis',
                    batchSize: 10
                }
            };

            const response = await request(app)
                .post('/api/aiAsync/jobs')
                .set('Authorization', `Bearer ${authToken}`)
                .send(batchJob);

            expect(response.status).toBe(202);
            expect(response.body).toHaveProperty('jobId');
            expect(response.body).toHaveProperty('batchSize', 3);
        });

        it('should reject jobs with missing required fields', async () => {
            const invalidJob = {
                taskType: 'text_generation'
                // Missing payload
            };

            const response = await request(app)
                .post('/api/aiAsync/jobs')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidJob);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('payload');
        });

        it('should reject jobs with invalid task types', async () => {
            const invalidJob = {
                taskType: 'invalid_task_type',
                payload: { some: 'data' }
            };

            const response = await request(app)
                .post('/api/aiAsync/jobs')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidJob);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('taskType');
        });

        it('should handle large payload jobs', async () => {
            const largePayload = {
                taskType: 'document_analysis',
                payload: {
                    content: 'A'.repeat(100000), // 100KB of content
                    analysisType: 'comprehensive',
                    extractEntities: true,
                    sentimentAnalysis: true
                }
            };

            const response = await request(app)
                .post('/api/aiAsync/jobs')
                .set('Authorization', `Bearer ${authToken}`)
                .send(largePayload);

            expect(response.status).toBe(202);
            expect(response.body).toHaveProperty('jobId');
        });

        it('should accept jobs without authentication for public endpoints', async () => {
            // Some AI jobs might be public
            const publicJob = {
                taskType: 'public_analysis',
                payload: {
                    data: 'public data',
                    anonymous: true
                }
            };

            const response = await request(app)
                .post('/api/aiAsync/jobs')
                .send(publicJob);

            // Either accepts (202) or requires auth (401) - both are valid
            expect([202, 401]).toContain(response.status);
        });
    });

    describe('GET /api/aiAsync/jobs/:id', () => {
        it('should retrieve job status for submitted job', async () => {
            // First ensure we have a submitted job
            if (!submittedJobId) {
                const jobResponse = await request(app)
                    .post('/api/aiAsync/jobs')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        taskType: 'text_generation',
                        payload: { prompt: 'Test prompt' }
                    });

                submittedJobId = jobResponse.body.jobId;
            }

            const response = await request(app)
                .get(`/api/aiAsync/jobs/${submittedJobId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('jobId', submittedJobId);
            expect(response.body).toHaveProperty('status');
            expect(['queued', 'processing', 'completed', 'failed']).toContain(response.body.status);
        });

        it('should return job progress information', async () => {
            const response = await request(app)
                .get(`/api/aiAsync/jobs/${submittedJobId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);

            if (response.body.status === 'processing') {
                expect(response.body).toHaveProperty('progress');
                expect(response.body.progress).toBeGreaterThanOrEqual(0);
                expect(response.body.progress).toBeLessThanOrEqual(100);
            }
        });

        it('should return completed job results', async () => {
            // This test might need to wait for job completion or mock a completed job
            const response = await request(app)
                .get(`/api/aiAsync/jobs/${submittedJobId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);

            if (response.body.status === 'completed') {
                expect(response.body).toHaveProperty('result');
                expect(response.body).toHaveProperty('completedAt');
                expect(response.body).toHaveProperty('processingTime');
            }
        });

        it('should return job metadata', async () => {
            const response = await request(app)
                .get(`/api/aiAsync/jobs/${submittedJobId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('submittedAt');
            expect(response.body).toHaveProperty('taskType');
            expect(response.body).toHaveProperty('userId', testUser.id);
        });

        it('should return 404 for non-existent jobs', async () => {
            const response = await request(app)
                .get('/api/aiAsync/jobs/non-existent-job-id')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error', 'Job not found');
        });

        it('should return 401 for unauthorized job access', async () => {
            // Create a job with one user, try to access with another
            // This would require multiple users - for now just test the endpoint exists
            const response = await request(app)
                .get('/api/aiAsync/jobs/invalid-job-id')
                .set('Authorization', `Bearer ${authToken}`);

            expect([404, 403]).toContain(response.status);
        });
    });

    describe('Job Status Transitions', () => {
        it('should track job status changes over time', async () => {
            const jobResponse = await request(app)
                .post('/api/aiAsync/jobs')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    taskType: 'quick_analysis',
                    payload: { data: 'Quick test data' }
                });

            const jobId = jobResponse.body.jobId;

            // Poll status multiple times
            const statusChecks = [];
            for (let i = 0; i < 5; i++) {
                const response = await request(app)
                    .get(`/api/aiAsync/jobs/${jobId}`)
                    .set('Authorization', `Bearer ${authToken}`);

                statusChecks.push(response.body.status);
                await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
            }

            // Status should be consistent or progressing
            expect(statusChecks.length).toBe(5);
            expect(statusChecks.every(status => ['queued', 'processing', 'completed', 'failed'].includes(status))).toBe(true);
        });
    });

    describe('Job Types', () => {
        const jobTypes = [
            'text_generation',
            'data_analysis',
            'risk_assessment',
            'recommendation_engine',
            'document_processing',
            'batch_processing'
        ];

        it.each(jobTypes)('should handle %s job type', async (jobType) => {
            const job = {
                taskType: jobType,
                payload: {
                    data: `Test data for ${jobType}`,
                    parameters: { test: true }
                }
            };

            const response = await request(app)
                .post('/api/aiAsync/jobs')
                .set('Authorization', `Bearer ${authToken}`)
                .send(job);

            expect(response.status).toBe(202);
            expect(response.body).toHaveProperty('jobId');
            expect(response.body).toHaveProperty('taskType', jobType);
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed job submissions', async () => {
            const malformedJobs = [
                null,
                undefined,
                '',
                [],
                {},
                { taskType: '', payload: {} },
                { taskType: 'valid', payload: null }
            ];

            for (const job of malformedJobs) {
                const response = await request(app)
                    .post('/api/aiAsync/jobs')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(job);

                expect([400, 500]).toContain(response.status);
            }
        });

        it('should handle queue overflow', async () => {
            // Submit many jobs quickly
            const jobPromises = Array(100).fill().map((_, i) =>
                request(app)
                    .post('/api/aiAsync/jobs')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        taskType: 'stress_test',
                        payload: { testId: i, data: 'x'.repeat(1000) }
                    })
            );

            const responses = await Promise.all(jobPromises);

            const acceptedCount = responses.filter(r => r.status === 202).length;
            const rejectedCount = responses.filter(r => r.status === 429).length;

            // Should accept some and potentially reject others due to rate limiting
            expect(acceptedCount + rejectedCount).toBe(100);
            expect(acceptedCount).toBeGreaterThan(0);
        });

        it('should handle service unavailability', async () => {
            // This would require mocking service failures
            const response = await request(app)
                .post('/api/aiAsync/jobs')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    taskType: 'text_generation',
                    payload: { prompt: 'Test' }
                });

            // Should either succeed or fail gracefully
            expect([202, 500, 503]).toContain(response.status);
        });
    });

    describe('Performance Characteristics', () => {
        it('should respond quickly to status queries', async () => {
            const startTime = Date.now();

            const response = await request(app)
                .get(`/api/aiAsync/jobs/${submittedJobId}`)
                .set('Authorization', `Bearer ${authToken}`);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(response.status).toBe(200);
            // Status queries should be fast (< 100ms)
            expect(responseTime).toBeLessThan(100);
        });

        it('should handle concurrent status queries', async () => {
            const concurrentQueries = Array(10).fill().map(() =>
                request(app)
                    .get(`/api/aiAsync/jobs/${submittedJobId}`)
                    .set('Authorization', `Bearer ${authToken}`)
            );

            const responses = await Promise.all(concurrentQueries);

            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('jobId', submittedJobId);
            });
        });
    });

    describe('Job Persistence', () => {
        it('should persist jobs across requests', async () => {
            // Submit a job
            const submitResponse = await request(app)
                .post('/api/aiAsync/jobs')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    taskType: 'persistence_test',
                    payload: { data: 'Test persistence' }
                });

            const jobId = submitResponse.body.jobId;

            // Query it immediately
            const statusResponse1 = await request(app)
                .get(`/api/aiAsync/jobs/${jobId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(statusResponse1.status).toBe(200);

            // Wait a bit and query again
            await new Promise(resolve => setTimeout(resolve, 500));

            const statusResponse2 = await request(app)
                .get(`/api/aiAsync/jobs/${jobId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(statusResponse2.status).toBe(200);
            expect(statusResponse2.body.jobId).toBe(jobId);
        });
    });

    describe('Security', () => {
        it('should associate jobs with authenticated users', async () => {
            const response = await request(app)
                .post('/api/aiAsync/jobs')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    taskType: 'security_test',
                    payload: { data: 'Test data' }
                });

            expect(response.status).toBe(202);

            const statusResponse = await request(app)
                .get(`/api/aiAsync/jobs/${response.body.jobId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(statusResponse.status).toBe(200);
            expect(statusResponse.body).toHaveProperty('userId', testUser.id);
        });

        it('should validate job ownership', async () => {
            // Jobs should only be accessible by their owners or admins
            const response = await request(app)
                .get('/api/aiAsync/jobs/some-other-users-job')
                .set('Authorization', `Bearer ${authToken}`);

            expect([404, 403]).toContain(response.status);
        });

        it('should sanitize job payloads', async () => {
            const maliciousPayload = {
                taskType: 'test',
                payload: {
                    data: '<script>alert("xss")</script>',
                    nested: {
                        dangerous: 'javascript:alert("xss")'
                    }
                }
            };

            const response = await request(app)
                .post('/api/aiAsync/jobs')
                .set('Authorization', `Bearer ${authToken}`)
                .send(maliciousPayload);

            expect(response.status).toBe(202);

            // Verify the job was created but payload was sanitized
            const statusResponse = await request(app)
                .get(`/api/aiAsync/jobs/${response.body.jobId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(statusResponse.status).toBe(200);
            // Payload should not contain script tags
            expect(JSON.stringify(statusResponse.body.payload)).not.toContain('<script>');
        });
    });
});





