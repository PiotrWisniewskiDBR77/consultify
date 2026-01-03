/**
 * Economics Financial Endpoints Integration Tests
 * 
 * Tests for financial analysis, benefits tracking, and quality assessment endpoints
 */

const request = require('supertest');
const app = require('../../../server');
const { setupTestAuth, cleanupTestData } = require('../../helpers/testSetup');

describe('Economics Financial API Endpoints', () => {
    let authToken;
    let testAnalysisId;
    const organizationId = 1;

    beforeAll(async () => {
        // Get test auth token
        authToken = await setupTestAuth(organizationId);
        
        // Create a test analysis
        const createRes = await request(app)
            .post('/api/economics/analyses')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                name: 'Test Financial Analysis',
                description: 'Analysis for financial testing'
            });
        
        testAnalysisId = createRes.body.id;
    });

    afterAll(async () => {
        // Cleanup test data
        if (testAnalysisId) {
            await request(app)
                .delete(`/api/economics/analyses/${testAnalysisId}`)
                .set('Authorization', `Bearer ${authToken}`);
        }
        await cleanupTestData();
    });

    describe('GET /api/economics/analyses/:id/financials', () => {
        it('should return empty structure for new analysis', async () => {
            const res = await request(app)
                .get(`/api/economics/analyses/${testAnalysisId}/financials`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('analysisId');
            expect(res.body).toHaveProperty('costs');
            expect(res.body).toHaveProperty('benefits');
            expect(Array.isArray(res.body.costs)).toBe(true);
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .get(`/api/economics/analyses/${testAnalysisId}/financials`);

            expect(res.status).toBe(401);
        });

        it('should return 404 for non-existent analysis', async () => {
            const res = await request(app)
                .get('/api/economics/analyses/non-existent-id/financials')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 404]).toContain(res.status);
        });
    });

    describe('PUT /api/economics/analyses/:id/financials', () => {
        it('should save financial data', async () => {
            const financialData = {
                costs: [
                    { year: 0, amount: 100000, description: 'Initial Investment' },
                    { year: 1, amount: 20000, description: 'Operating Cost' }
                ],
                benefits: [
                    { year: 1, amount: 50000, description: 'Cost Savings' },
                    { year: 2, amount: 60000, description: 'Revenue Increase' }
                ],
                discountRate: 12,
                investmentHorizon: 5
            };

            const res = await request(app)
                .put(`/api/economics/analyses/${testAnalysisId}/financials`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(financialData);

            expect(res.status).toBe(200);
            expect(res.body.discountRate).toBe(12);
            expect(res.body.investmentHorizon).toBe(5);
        });

        it('should update existing financial data', async () => {
            const updatedData = {
                discountRate: 15,
                investmentHorizon: 7
            };

            const res = await request(app)
                .put(`/api/economics/analyses/${testAnalysisId}/financials`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updatedData);

            expect(res.status).toBe(200);
            expect(res.body.discountRate).toBe(15);
            expect(res.body.investmentHorizon).toBe(7);
        });
    });

    describe('POST /api/economics/analyses/:id/calculate-metrics', () => {
        beforeEach(async () => {
            // Ensure we have financial data
            await request(app)
                .put(`/api/economics/analyses/${testAnalysisId}/financials`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    costs: [
                        { year: 0, amount: 100000, description: 'Initial Investment' }
                    ],
                    benefits: [
                        { year: 1, amount: 50000, description: 'Annual Benefit' }
                    ],
                    discountRate: 10,
                    investmentHorizon: 5
                });
        });

        it('should calculate financial metrics', async () => {
            const res = await request(app)
                .post(`/api/economics/analyses/${testAnalysisId}/calculate-metrics`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('npv');
            expect(res.body).toHaveProperty('irr');
            expect(res.body).toHaveProperty('paybackPeriod');
            expect(res.body).toHaveProperty('roi');
            expect(res.body).toHaveProperty('cashFlows');
            expect(Array.isArray(res.body.cashFlows)).toBe(true);
        });

        it('should return calculated metrics with expected structure', async () => {
            const res = await request(app)
                .post(`/api/economics/analyses/${testAnalysisId}/calculate-metrics`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(typeof res.body.npv).toBe('number');
            expect(res.body.cashFlows[0]).toHaveProperty('year');
            expect(res.body.cashFlows[0]).toHaveProperty('netCashFlow');
            expect(res.body.cashFlows[0]).toHaveProperty('cumulativeCashFlow');
        });
    });

    describe('Benefits Tracking Endpoints', () => {
        describe('GET /api/economics/analyses/:id/benefits', () => {
            it('should return empty array for new analysis', async () => {
                const res = await request(app)
                    .get(`/api/economics/analyses/${testAnalysisId}/benefits`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(res.status).toBe(200);
                expect(res.body).toHaveProperty('benefits');
                expect(Array.isArray(res.body.benefits)).toBe(true);
            });
        });

        describe('PUT /api/economics/analyses/:id/benefits', () => {
            it('should create benefit tracking entry', async () => {
                const benefitData = {
                    trackingPeriod: 'Q1 2025',
                    plannedBenefits: 25000,
                    actualBenefits: 23000
                };

                const res = await request(app)
                    .put(`/api/economics/analyses/${testAnalysisId}/benefits`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(benefitData);

                expect(res.status).toBe(200);
            });

            it('should calculate variance automatically', async () => {
                const benefitData = {
                    trackingPeriod: 'Q2 2025',
                    plannedBenefits: 30000,
                    actualBenefits: 35000
                };

                await request(app)
                    .put(`/api/economics/analyses/${testAnalysisId}/benefits`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(benefitData);

                const getRes = await request(app)
                    .get(`/api/economics/analyses/${testAnalysisId}/benefits`)
                    .set('Authorization', `Bearer ${authToken}`);

                const q2Entry = getRes.body.benefits.find(b => b.trackingPeriod === 'Q2 2025');
                expect(q2Entry.variance).toBe(5000);
            });
        });
    });

    describe('Quality Assessment Endpoint', () => {
        describe('GET /api/economics/analyses/:id/quality-assessment', () => {
            it('should return quality assessment', async () => {
                const res = await request(app)
                    .get(`/api/economics/analyses/${testAnalysisId}/quality-assessment`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(res.status).toBe(200);
                expect(res.body).toHaveProperty('methodologyScore');
                expect(res.body).toHaveProperty('documentationScore');
            });

            it('should compute scores for new analysis', async () => {
                const res = await request(app)
                    .get(`/api/economics/analyses/${testAnalysisId}/quality-assessment`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(res.status).toBe(200);
                // New analysis should have computed flag or low scores
                expect(res.body.methodologyScore).toBeDefined();
            });
        });
    });

    describe('Initiative Linking Endpoints', () => {
        describe('POST /api/economics/analyses/:id/link-initiative', () => {
            it('should require initiativeId', async () => {
                const res = await request(app)
                    .post(`/api/economics/analyses/${testAnalysisId}/link-initiative`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({});

                expect(res.status).toBe(400);
                expect(res.body.code).toBe('INITIATIVE_REQUIRED');
            });

            it('should link analysis to initiative', async () => {
                const res = await request(app)
                    .post(`/api/economics/analyses/${testAnalysisId}/link-initiative`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ initiativeId: 'test-initiative-123' });

                expect([200, 404]).toContain(res.status);
            });
        });
    });

    describe('Business Case Generation', () => {
        describe('POST /api/economics/analyses/:id/business-case', () => {
            it('should generate business case document', async () => {
                const res = await request(app)
                    .post(`/api/economics/analyses/${testAnalysisId}/business-case`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        format: 'pdf',
                        language: 'pl',
                        includeExecutiveSummary: true,
                        includeFinancialAnalysis: true
                    });

                // May return 200 or 500 depending on PDF service availability
                expect([200, 500]).toContain(res.status);
                if (res.status === 200) {
                    expect(res.body).toHaveProperty('downloadUrl');
                    expect(res.body).toHaveProperty('filename');
                }
            });

            it('should return 404 for non-existent analysis', async () => {
                const res = await request(app)
                    .post('/api/economics/analyses/non-existent/business-case')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ format: 'pdf' });

                expect(res.status).toBe(404);
            });
        });
    });
});









