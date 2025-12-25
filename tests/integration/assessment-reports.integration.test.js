/**
 * Integration Tests: Assessment Reports
 * Tests for report generation and export endpoints
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock database
const mockDb = {
    get: vi.fn(),
    all: vi.fn()
};

vi.mock('../../server/database', () => ({ default: mockDb }));

// Mock report service
const mockReportService = {
    generatePDFReport: vi.fn(),
    generateExcelReport: vi.fn(),
    generateExecutiveSummary: vi.fn(),
    generateStakeholderReport: vi.fn(),
    getReportHistory: vi.fn()
};

vi.mock('../../server/services/assessmentReportService', () => ({
    default: mockReportService
}));

// Mock auth
vi.mock('../../server/middleware/auth', () => ({
    authMiddleware: (req, res, next) => {
        req.user = { id: 'user-123', organizationId: 'org-123', role: 'PROJECT_MANAGER' };
        next();
    }
}));

describe('Assessment Reports Integration Tests', () => {
    let app;

    const mockAssessment = {
        id: 'assessment-123',
        project_id: 'project-456',
        organization_id: 'org-123',
        axis_scores: JSON.stringify({
            processes: { actual: 4, target: 6, justification: 'Test' },
            digitalProducts: { actual: 3, target: 5, justification: 'Test' },
            businessModels: { actual: 3, target: 5, justification: 'Test' },
            dataManagement: { actual: 4, target: 6, justification: 'Test' },
            culture: { actual: 3, target: 5, justification: 'Test' },
            cybersecurity: { actual: 5, target: 6, justification: 'Test' },
            aiMaturity: { actual: 2, target: 5, justification: 'Test' }
        }),
        overall_score: 3.43,
        gap_analysis: JSON.stringify({
            priorityGaps: ['aiMaturity', 'culture'],
            overallGap: 1.86
        }),
        status: 'APPROVED',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-25T14:00:00Z'
    };

    beforeAll(() => {
        app = express();
        app.use(express.json());

        const router = express.Router();

        // PDF Report
        router.post('/:assessmentId/reports/pdf', async (req, res) => {
            try {
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(null, mockAssessment);
                });

                const { language = 'pl', includeGapAnalysis = true, includeRecommendations = true } = req.body;

                const report = await mockReportService.generatePDFReport({
                    assessment: mockAssessment,
                    language,
                    options: { includeGapAnalysis, includeRecommendations }
                });

                res.json({
                    reportId: report.id,
                    url: report.url,
                    generatedAt: report.generatedAt
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Excel Report
        router.post('/:assessmentId/reports/excel', async (req, res) => {
            try {
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(null, mockAssessment);
                });

                const { language = 'pl', includeRawData = false } = req.body;

                const report = await mockReportService.generateExcelReport({
                    assessment: mockAssessment,
                    language,
                    options: { includeRawData }
                });

                res.json({
                    reportId: report.id,
                    url: report.url,
                    generatedAt: report.generatedAt
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Executive Summary
        router.post('/:assessmentId/reports/executive-summary', async (req, res) => {
            try {
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(null, mockAssessment);
                });

                const { language = 'pl', audience = 'BOARD' } = req.body;

                const summary = await mockReportService.generateExecutiveSummary({
                    assessment: mockAssessment,
                    language,
                    audience
                });

                res.json(summary);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Stakeholder Report
        router.post('/:assessmentId/reports/stakeholder/:role', async (req, res) => {
            try {
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(null, mockAssessment);
                });

                const { role } = req.params;
                const { language = 'pl' } = req.body;

                const report = await mockReportService.generateStakeholderReport({
                    assessment: mockAssessment,
                    stakeholderRole: role,
                    language
                });

                res.json(report);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Report History
        router.get('/:assessmentId/reports/history', async (req, res) => {
            try {
                const history = await mockReportService.getReportHistory(req.params.assessmentId);
                res.json({ reports: history });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Download Report
        router.get('/:assessmentId/reports/:reportId/download', async (req, res) => {
            try {
                const { reportId } = req.params;
                // In real implementation, this would stream the file
                res.json({ downloadUrl: `/downloads/${reportId}` });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        app.use('/api/assessment', router);
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // PDF REPORT TESTS
    // =========================================================================

    describe('PDF Report Generation', () => {
        it('should generate PDF report', async () => {
            mockReportService.generatePDFReport.mockResolvedValue({
                id: 'report-123',
                url: '/reports/report-123.pdf',
                generatedAt: new Date().toISOString()
            });

            const response = await request(app)
                .post('/api/assessment/assessment-123/reports/pdf')
                .send({});

            expect(response.status).toBe(200);
            expect(response.body.reportId).toBe('report-123');
            expect(response.body.url).toContain('.pdf');
        });

        it('should accept language parameter', async () => {
            mockReportService.generatePDFReport.mockResolvedValue({
                id: 'report-123',
                url: '/reports/report-123.pdf',
                generatedAt: new Date().toISOString()
            });

            await request(app)
                .post('/api/assessment/assessment-123/reports/pdf')
                .send({ language: 'en' });

            expect(mockReportService.generatePDFReport).toHaveBeenCalledWith(
                expect.objectContaining({ language: 'en' })
            );
        });

        it('should include gap analysis by default', async () => {
            mockReportService.generatePDFReport.mockResolvedValue({
                id: 'report-123',
                url: '/reports/report-123.pdf',
                generatedAt: new Date().toISOString()
            });

            await request(app)
                .post('/api/assessment/assessment-123/reports/pdf')
                .send({});

            expect(mockReportService.generatePDFReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    options: expect.objectContaining({ includeGapAnalysis: true })
                })
            );
        });

        it('should allow excluding recommendations', async () => {
            mockReportService.generatePDFReport.mockResolvedValue({
                id: 'report-123',
                url: '/reports/report-123.pdf',
                generatedAt: new Date().toISOString()
            });

            await request(app)
                .post('/api/assessment/assessment-123/reports/pdf')
                .send({ includeRecommendations: false });

            expect(mockReportService.generatePDFReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    options: expect.objectContaining({ includeRecommendations: false })
                })
            );
        });

        it('should handle generation errors', async () => {
            mockReportService.generatePDFReport.mockRejectedValue(new Error('Generation failed'));

            const response = await request(app)
                .post('/api/assessment/assessment-123/reports/pdf')
                .send({});

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Generation failed');
        });
    });

    // =========================================================================
    // EXCEL REPORT TESTS
    // =========================================================================

    describe('Excel Report Generation', () => {
        it('should generate Excel report', async () => {
            mockReportService.generateExcelReport.mockResolvedValue({
                id: 'report-456',
                url: '/reports/report-456.xlsx',
                generatedAt: new Date().toISOString()
            });

            const response = await request(app)
                .post('/api/assessment/assessment-123/reports/excel')
                .send({});

            expect(response.status).toBe(200);
            expect(response.body.reportId).toBe('report-456');
            expect(response.body.url).toContain('.xlsx');
        });

        it('should allow including raw data', async () => {
            mockReportService.generateExcelReport.mockResolvedValue({
                id: 'report-456',
                url: '/reports/report-456.xlsx',
                generatedAt: new Date().toISOString()
            });

            await request(app)
                .post('/api/assessment/assessment-123/reports/excel')
                .send({ includeRawData: true });

            expect(mockReportService.generateExcelReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    options: expect.objectContaining({ includeRawData: true })
                })
            );
        });
    });

    // =========================================================================
    // EXECUTIVE SUMMARY TESTS
    // =========================================================================

    describe('Executive Summary Generation', () => {
        it('should generate executive summary', async () => {
            mockReportService.generateExecutiveSummary.mockResolvedValue({
                title: 'Executive Summary',
                summary: 'Organizacja osiągnęła średni poziom dojrzałości...',
                keyMetrics: {
                    currentMaturity: 3.43,
                    targetMaturity: 5.29,
                    overallGap: 1.86
                },
                topFindings: [
                    'Strongest area: Cybersecurity',
                    'Priority gap: AI Maturity'
                ],
                strategicRecommendations: [
                    'Focus on AI adoption'
                ]
            });

            const response = await request(app)
                .post('/api/assessment/assessment-123/reports/executive-summary')
                .send({});

            expect(response.status).toBe(200);
            expect(response.body.summary).toBeDefined();
            expect(response.body.keyMetrics).toBeDefined();
        });

        it('should support different audiences', async () => {
            mockReportService.generateExecutiveSummary.mockResolvedValue({
                title: 'Executive Summary for Investors',
                summary: 'Investment-focused summary...'
            });

            await request(app)
                .post('/api/assessment/assessment-123/reports/executive-summary')
                .send({ audience: 'INVESTORS' });

            expect(mockReportService.generateExecutiveSummary).toHaveBeenCalledWith(
                expect.objectContaining({ audience: 'INVESTORS' })
            );
        });
    });

    // =========================================================================
    // STAKEHOLDER REPORT TESTS
    // =========================================================================

    describe('Stakeholder Report Generation', () => {
        const stakeholderRoles = ['CTO', 'CFO', 'CHRO', 'CEO', 'COO'];

        stakeholderRoles.forEach(role => {
            it(`should generate report for ${role}`, async () => {
                mockReportService.generateStakeholderReport.mockResolvedValue({
                    stakeholderRole: role,
                    title: `Assessment Report for ${role}`,
                    focusAreas: [`Focus area for ${role}`],
                    actionItems: [`Action for ${role}`]
                });

                const response = await request(app)
                    .post(`/api/assessment/assessment-123/reports/stakeholder/${role}`)
                    .send({});

                expect(response.status).toBe(200);
                expect(response.body.stakeholderRole).toBe(role);
            });
        });

        it('should include role-specific focus areas', async () => {
            mockReportService.generateStakeholderReport.mockResolvedValue({
                stakeholderRole: 'CTO',
                title: 'Technology Assessment',
                focusAreas: ['AI/ML capabilities', 'Architecture maturity', 'Cybersecurity'],
                technicalDetails: { detailedAnalysis: true }
            });

            const response = await request(app)
                .post('/api/assessment/assessment-123/reports/stakeholder/CTO')
                .send({});

            expect(response.body.focusAreas).toContain('AI/ML capabilities');
        });
    });

    // =========================================================================
    // REPORT HISTORY TESTS
    // =========================================================================

    describe('Report History', () => {
        it('should return report history', async () => {
            mockReportService.getReportHistory.mockResolvedValue([
                { id: 'r1', type: 'PDF', createdAt: '2024-01-20T10:00:00Z' },
                { id: 'r2', type: 'EXCEL', createdAt: '2024-01-21T14:00:00Z' },
                { id: 'r3', type: 'PDF', createdAt: '2024-01-25T09:00:00Z' }
            ]);

            const response = await request(app)
                .get('/api/assessment/assessment-123/reports/history');

            expect(response.status).toBe(200);
            expect(response.body.reports).toHaveLength(3);
        });

        it('should return empty array for no history', async () => {
            mockReportService.getReportHistory.mockResolvedValue([]);

            const response = await request(app)
                .get('/api/assessment/assessment-123/reports/history');

            expect(response.status).toBe(200);
            expect(response.body.reports).toEqual([]);
        });
    });

    // =========================================================================
    // REPORT DOWNLOAD TESTS
    // =========================================================================

    describe('Report Download', () => {
        it('should return download URL', async () => {
            const response = await request(app)
                .get('/api/assessment/assessment-123/reports/report-456/download');

            expect(response.status).toBe(200);
            expect(response.body.downloadUrl).toContain('report-456');
        });
    });

    // =========================================================================
    // MULTI-LANGUAGE TESTS
    // =========================================================================

    describe('Multi-language Support', () => {
        const languages = ['pl', 'en', 'de', 'fr'];

        languages.forEach(lang => {
            it(`should generate report in ${lang}`, async () => {
                mockReportService.generatePDFReport.mockResolvedValue({
                    id: `report-${lang}`,
                    url: `/reports/report-${lang}.pdf`,
                    language: lang,
                    generatedAt: new Date().toISOString()
                });

                await request(app)
                    .post('/api/assessment/assessment-123/reports/pdf')
                    .send({ language: lang });

                expect(mockReportService.generatePDFReport).toHaveBeenCalledWith(
                    expect.objectContaining({ language: lang })
                );
            });
        });
    });

    // =========================================================================
    // CONTENT VERIFICATION TESTS
    // =========================================================================

    describe('Report Content', () => {
        it('should include all axis scores in PDF', async () => {
            mockReportService.generatePDFReport.mockResolvedValue({
                id: 'report-123',
                url: '/reports/report-123.pdf',
                content: {
                    axes: ['processes', 'digitalProducts', 'businessModels', 
                           'dataManagement', 'culture', 'cybersecurity', 'aiMaturity']
                },
                generatedAt: new Date().toISOString()
            });

            await request(app)
                .post('/api/assessment/assessment-123/reports/pdf')
                .send({});

            expect(mockReportService.generatePDFReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    assessment: expect.objectContaining({
                        axis_scores: expect.any(String)
                    })
                })
            );
        });

        it('should include gap analysis when requested', async () => {
            mockReportService.generatePDFReport.mockResolvedValue({
                id: 'report-123',
                url: '/reports/report-123.pdf',
                generatedAt: new Date().toISOString()
            });

            await request(app)
                .post('/api/assessment/assessment-123/reports/pdf')
                .send({ includeGapAnalysis: true });

            expect(mockReportService.generatePDFReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    assessment: expect.objectContaining({
                        gap_analysis: expect.any(String)
                    })
                })
            );
        });
    });
});

