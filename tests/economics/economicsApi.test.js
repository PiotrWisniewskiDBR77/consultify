/**
 * Economics API Integration Tests
 * 
 * Tests for the Economics API endpoints
 */

const request = require('supertest');
const express = require('express');
const economicsRouter = require('../../server/routes/economics');

// Mock services
jest.mock('../../server/services/economicsService');
jest.mock('../../server/services/excelImportService');
jest.mock('../../server/services/excelExportService');
jest.mock('../../server/services/pdfExportService');
jest.mock('../../server/services/versioningService');
jest.mock('../../server/services/evidenceService');
jest.mock('../../server/services/governanceAuditService');

// Mock auth middleware
jest.mock('../../server/middleware/authMiddleware', () => 
    (req, res, next) => {
        req.user = { id: 'test-user', role: 'admin' };
        req.organizationId = 'test-org';
        next();
    }
);

jest.mock('../../server/middleware/permissionMiddleware', () => ({
    requirePermission: () => (req, res, next) => next(),
    auditAction: () => (req, res, next) => next(),
}));

const EconomicsService = require('../../server/services/economicsService');
const VersioningService = require('../../server/services/versioningService');
const EvidenceService = require('../../server/services/evidenceService');

describe('Economics API', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/economics', economicsRouter);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/economics/analyses', () => {
        it('should return list of analyses', async () => {
            const mockAnalyses = {
                analyses: [
                    { id: '1', name: 'Analysis 1' },
                    { id: '2', name: 'Analysis 2' },
                ],
                total: 2,
            };

            EconomicsService.getAnalyses.mockResolvedValue(mockAnalyses);

            const res = await request(app)
                .get('/api/economics/analyses')
                .expect(200);

            expect(res.body.analyses).toHaveLength(2);
            expect(EconomicsService.getAnalyses).toHaveBeenCalledWith(
                'test-org',
                expect.any(Object)
            );
        });

        it('should handle query parameters', async () => {
            EconomicsService.getAnalyses.mockResolvedValue({ analyses: [], total: 0 });

            await request(app)
                .get('/api/economics/analyses?status=completed&search=test&page=2')
                .expect(200);

            expect(EconomicsService.getAnalyses).toHaveBeenCalledWith(
                'test-org',
                expect.objectContaining({
                    status: 'completed',
                    search: 'test',
                    page: 2,
                })
            );
        });

        it('should return 500 on service error', async () => {
            EconomicsService.getAnalyses.mockRejectedValue(new Error('DB Error'));

            const res = await request(app)
                .get('/api/economics/analyses')
                .expect(500);

            expect(res.body.code).toBe('LIST_FAILED');
        });
    });

    describe('POST /api/economics/analyses', () => {
        it('should create a new analysis', async () => {
            const mockAnalysis = { id: 'new-123', name: 'New Analysis' };
            EconomicsService.createAnalysis.mockResolvedValue(mockAnalysis);

            const res = await request(app)
                .post('/api/economics/analyses')
                .send({ name: 'New Analysis', description: 'Test' })
                .expect(201);

            expect(res.body.id).toBe('new-123');
            expect(EconomicsService.createAnalysis).toHaveBeenCalled();
        });

        it('should return 400 for invalid data', async () => {
            const res = await request(app)
                .post('/api/economics/analyses')
                .send({}) // Missing required name
                .expect(400);

            expect(res.body.errors).toBeDefined();
        });

        it('should return 500 on service error', async () => {
            EconomicsService.createAnalysis.mockRejectedValue(new Error('DB Error'));

            await request(app)
                .post('/api/economics/analyses')
                .send({ name: 'Test' })
                .expect(500);
        });
    });

    describe('GET /api/economics/analyses/:id', () => {
        it('should return single analysis', async () => {
            const mockAnalysis = { id: 'test-123', name: 'Test Analysis' };
            EconomicsService.getAnalysisById.mockResolvedValue(mockAnalysis);

            const res = await request(app)
                .get('/api/economics/analyses/test-123')
                .expect(200);

            expect(res.body.id).toBe('test-123');
        });

        it('should return 404 for non-existent analysis', async () => {
            EconomicsService.getAnalysisById.mockResolvedValue(null);

            const res = await request(app)
                .get('/api/economics/analyses/non-existent')
                .expect(404);

            expect(res.body.code).toBe('NOT_FOUND');
        });
    });

    describe('PUT /api/economics/analyses/:id', () => {
        it('should update analysis', async () => {
            const mockAnalysis = { id: 'test-123', name: 'Updated' };
            EconomicsService.getAnalysisById.mockResolvedValue({ id: 'test-123', name: 'Original' });
            EconomicsService.updateAnalysis.mockResolvedValue(mockAnalysis);

            const res = await request(app)
                .put('/api/economics/analyses/test-123')
                .send({ name: 'Updated' })
                .expect(200);

            expect(res.body.name).toBe('Updated');
        });

        it('should return 404 if analysis not found', async () => {
            EconomicsService.getAnalysisById.mockResolvedValue(null);

            await request(app)
                .put('/api/economics/analyses/non-existent')
                .send({ name: 'Updated' })
                .expect(404);
        });
    });

    describe('DELETE /api/economics/analyses/:id', () => {
        it('should delete analysis', async () => {
            EconomicsService.getAnalysisById.mockResolvedValue({ id: 'test-123' });
            EconomicsService.deleteAnalysis.mockResolvedValue(true);

            const res = await request(app)
                .delete('/api/economics/analyses/test-123')
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('should return 404 if analysis not found', async () => {
            EconomicsService.getAnalysisById.mockResolvedValue(null);

            await request(app)
                .delete('/api/economics/analyses/non-existent')
                .expect(404);
        });
    });

    describe('PUT /api/economics/analyses/:id/scores', () => {
        it('should update multiple scores', async () => {
            const mockAnalysis = { id: 'test-123', axisScores: {} };
            EconomicsService.getAnalysisById.mockResolvedValue(mockAnalysis);
            EconomicsService.bulkUpdateScores.mockResolvedValue(mockAnalysis);

            const scores = [
                { axisId: 'axis-1', areaId: 'area-1', currentLevel: 3, targetLevel: 5 },
            ];

            await request(app)
                .put('/api/economics/analyses/test-123/scores')
                .send({ scores })
                .expect(200);

            expect(EconomicsService.bulkUpdateScores).toHaveBeenCalled();
        });

        it('should return 400 for invalid scores', async () => {
            await request(app)
                .put('/api/economics/analyses/test-123/scores')
                .send({ scores: [] }) // Empty scores array
                .expect(400);
        });
    });

    describe('Versioning Endpoints', () => {
        describe('POST /api/economics/analyses/:id/versions', () => {
            it('should create a new version', async () => {
                EconomicsService.getAnalysisById.mockResolvedValue({ id: 'test-123' });
                VersioningService.createVersion.mockResolvedValue({
                    id: 'version-1',
                    version_number: 1,
                });

                const res = await request(app)
                    .post('/api/economics/analyses/test-123/versions')
                    .send({ versionName: 'v1.0', versionType: 'snapshot' })
                    .expect(201);

                expect(res.body.id).toBe('version-1');
            });

            it('should return 404 if analysis not found', async () => {
                EconomicsService.getAnalysisById.mockResolvedValue(null);

                await request(app)
                    .post('/api/economics/analyses/non-existent/versions')
                    .send({ versionType: 'snapshot' })
                    .expect(404);
            });
        });

        describe('GET /api/economics/analyses/:id/versions', () => {
            it('should return list of versions', async () => {
                VersioningService.getVersions.mockResolvedValue([
                    { id: 'v1', version_number: 1 },
                    { id: 'v2', version_number: 2 },
                ]);

                const res = await request(app)
                    .get('/api/economics/analyses/test-123/versions')
                    .expect(200);

                expect(res.body.versions).toHaveLength(2);
            });
        });

        describe('POST /api/economics/analyses/:id/versions/:versionId/restore', () => {
            it('should restore version', async () => {
                VersioningService.getVersion.mockResolvedValue({
                    id: 'v1',
                    analysis_id: 'test-123',
                    version_number: 1,
                });
                VersioningService.restoreVersion.mockResolvedValue({
                    version_number: 2,
                });

                const res = await request(app)
                    .post('/api/economics/analyses/test-123/versions/v1/restore')
                    .expect(200);

                expect(res.body.success).toBe(true);
            });

            it('should return 404 if version not found', async () => {
                VersioningService.getVersion.mockResolvedValue(null);

                await request(app)
                    .post('/api/economics/analyses/test-123/versions/non-existent/restore')
                    .expect(404);
            });
        });
    });

    describe('Evidence Endpoints', () => {
        describe('POST /api/economics/scores/:scoreId/evidence', () => {
            it('should add evidence to score', async () => {
                EvidenceService.addEvidence.mockResolvedValue({
                    id: 'evidence-1',
                    title: 'Test Evidence',
                });

                const res = await request(app)
                    .post('/api/economics/scores/score-123/evidence')
                    .send({
                        evidenceType: 'link',
                        title: 'Test Evidence',
                        content: 'https://example.com',
                    })
                    .expect(201);

                expect(res.body.id).toBe('evidence-1');
            });

            it('should return 400 for invalid evidence type', async () => {
                await request(app)
                    .post('/api/economics/scores/score-123/evidence')
                    .send({
                        evidenceType: 'invalid',
                        title: 'Test',
                    })
                    .expect(400);
            });
        });

        describe('GET /api/economics/scores/:scoreId/evidence', () => {
            it('should return evidence list', async () => {
                EvidenceService.getEvidenceForScore.mockResolvedValue([
                    { id: 'e1', title: 'Evidence 1' },
                    { id: 'e2', title: 'Evidence 2' },
                ]);

                const res = await request(app)
                    .get('/api/economics/scores/score-123/evidence')
                    .expect(200);

                expect(res.body.evidence).toHaveLength(2);
            });
        });

        describe('DELETE /api/economics/evidence/:id', () => {
            it('should delete evidence', async () => {
                EvidenceService.getEvidence.mockResolvedValue({ id: 'e1' });
                EvidenceService.deleteEvidence.mockResolvedValue(true);

                const res = await request(app)
                    .delete('/api/economics/evidence/e1')
                    .expect(200);

                expect(res.body.success).toBe(true);
            });

            it('should return 404 if evidence not found', async () => {
                EvidenceService.getEvidence.mockResolvedValue(null);

                await request(app)
                    .delete('/api/economics/evidence/non-existent')
                    .expect(404);
            });
        });
    });

    describe('Statistics Endpoint', () => {
        it('should return catalog statistics', async () => {
            EconomicsService.getCatalogStats.mockResolvedValue({
                total: 10,
                completed: 5,
                inProgress: 3,
                draft: 2,
                avgScore: 4.5,
            });

            const res = await request(app)
                .get('/api/economics/stats')
                .expect(200);

            expect(res.body.total).toBe(10);
            expect(res.body.avgScore).toBe(4.5);
        });
    });

    describe('Rate Limiting', () => {
        // Note: Rate limiting tests require special setup
        // These are placeholder tests showing the expected behavior
        
        it.todo('should limit requests to 200 per 15 minutes');
        it.todo('should limit exports to 30 per hour');
        it.todo('should limit imports to 20 per hour');
    });
});














