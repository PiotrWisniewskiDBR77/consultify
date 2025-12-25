import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';

const require = createRequire(import.meta.url);

describe('Assessment Service', () => {
    let AssessmentService;
    let mockDb;

    beforeEach(() => {
        vi.resetModules();

        mockDb = createMockDb();

        vi.doMock('../../../server/database', () => ({ default: mockDb }));

        AssessmentService = require('../../../server/services/assessmentService.js');
        
        // Inject mock dependencies
        AssessmentService.setDependencies({
            db: mockDb,
            uuidv4: () => 'mock-uuid-assessment'
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
    });

    describe('Logic: generateGapSummary', () => {
        it('should interpret gaps correctly', async () => {
            const assessment = {
                axisScores: [
                    { axis: 'Planning', asIs: 2, toBe: 5 }, // Gap 3
                    { axis: 'Execution', asIs: 3, toBe: 4 }, // Gap 1
                    { axis: 'People', asIs: 4, toBe: 4 }      // Gap 0
                ]
            };

            // If AssessmentService is not loaded correctly (due to CJS), this might fail. 
            // We need to handle that.
            if (!AssessmentService) {
                // Fallback for direct testing if import failed in environment
                const imported = await import('../../../server/services/assessmentService.js');
                AssessmentService = imported.default || imported;
            }

            const result = AssessmentService.generateGapSummary(assessment);
            expect(result.prioritizedGaps).toContain('Planning');
            expect(result.prioritizedGaps).not.toContain('Execution'); // Gap < 2
            expect(result.gapAnalysisSummary).toContain('Planning');
        });
    });

    describe('getAssessment', () => {
        it('should retrieve and parse assessment', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, {
                    id: 'assessment-1',
                    project_id: 'p-1',
                    axis_scores: JSON.stringify([{ axis: 'A', asIs: 1, toBe: 2 }]),
                    completed_axes: JSON.stringify(['A'])
                });
            });

            const result = await AssessmentService.getAssessment('p-1');
            expect(result).toBeDefined();
            expect(result.axisScores).toHaveLength(1);
            expect(result.completedAxes).toContain('A');
        });

        it('should return null for non-existent assessment', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, null);
            });

            const result = await AssessmentService.getAssessment('p-1');
            expect(result).toBeNull();
        });
    });

    describe('saveAssessment', () => {
        it('should calculate totals and save', async () => {
            mockDb.run.mockImplementation(function (sql, params, cb) {
                cb.call({ changes: 1 }, null);
            });

            const data = {
                axisScores: [{ axis: 'A', asIs: 3, toBe: 5 }],
                completedAxes: ['A']
            };

            const result = await AssessmentService.saveAssessment('p-1', data);
            expect(result.overallGap).toBe(2);
            expect(result.overallAsIs).toBe(3);
            expect(result.overallToBe).toBe(5);
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should calculate average for multiple axes', async () => {
            mockDb.run.mockImplementation(function (sql, params, cb) {
                cb.call({ changes: 1 }, null);
            });

            const data = {
                axisScores: [
                    { axis: 'A', asIs: 2, toBe: 4 },
                    { axis: 'B', asIs: 4, toBe: 6 },
                    { axis: 'C', asIs: 3, toBe: 5 }
                ],
                completedAxes: ['A', 'B', 'C']
            };

            const result = await AssessmentService.saveAssessment('p-1', data);
            expect(result.overallAsIs).toBe(3); // (2+4+3)/3 = 3
            expect(result.overallToBe).toBe(5); // (4+6+5)/3 = 5
            expect(result.overallGap).toBe(2);  // 5 - 3 = 2
        });

        it('should mark as complete when all 7 axes done', async () => {
            mockDb.run.mockImplementation(function (sql, params, cb) {
                cb.call({ changes: 1 }, null);
            });

            const data = {
                axisScores: [
                    { axis: 'processes', asIs: 3, toBe: 5 },
                    { axis: 'digitalProducts', asIs: 3, toBe: 5 },
                    { axis: 'businessModels', asIs: 3, toBe: 5 },
                    { axis: 'dataManagement', asIs: 3, toBe: 5 },
                    { axis: 'culture', asIs: 3, toBe: 5 },
                    { axis: 'cybersecurity', asIs: 3, toBe: 5 },
                    { axis: 'aiMaturity', asIs: 3, toBe: 5 }
                ],
                completedAxes: ['processes', 'digitalProducts', 'businessModels', 
                               'dataManagement', 'culture', 'cybersecurity', 'aiMaturity']
            };

            const result = await AssessmentService.saveAssessment('p-1', data);
            expect(result.isComplete).toBe(true);
        });
    });

    describe('getAssessmentStatus', () => {
        it('should return IN_PROGRESS by default', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { assessment_status: null });
            });

            const result = await AssessmentService.getAssessmentStatus('p-1');
            expect(result).toBe('IN_PROGRESS');
        });

        it('should return FINALIZED when assessment is finalized', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { assessment_status: 'FINALIZED' });
            });

            const result = await AssessmentService.getAssessmentStatus('p-1');
            expect(result).toBe('FINALIZED');
        });
    });

    describe('canEditAssessment', () => {
        it('should return true for IN_PROGRESS assessment', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { assessment_status: 'IN_PROGRESS' });
            });

            const result = await AssessmentService.canEditAssessment('p-1', 'user-1');
            expect(result).toBe(true);
        });

        it('should return false for FINALIZED assessment', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { assessment_status: 'FINALIZED' });
            });

            const result = await AssessmentService.canEditAssessment('p-1', 'user-1');
            expect(result).toBe(false);
        });
    });

    describe('finalizeAssessment', () => {
        it('should reject if not all axes completed', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, {
                    axis_scores: JSON.stringify([
                        { axis: 'A', asIs: 3, toBe: 5 },
                        { axis: 'B', asIs: 3, toBe: 5 }
                    ]),
                    completed_axes: JSON.stringify(['A', 'B'])
                });
            });

            await expect(AssessmentService.finalizeAssessment('p-1', 'user-1'))
                .rejects.toThrow('All 7 axes must be completed');
        });

        it('should reject if missing actual or target scores', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, {
                    axis_scores: JSON.stringify([
                        { axis: 'A', asIs: 3, toBe: 0 },  // Missing toBe
                        { axis: 'B', asIs: 0, toBe: 5 },  // Missing asIs
                        { axis: 'C', asIs: 3, toBe: 5 },
                        { axis: 'D', asIs: 3, toBe: 5 },
                        { axis: 'E', asIs: 3, toBe: 5 },
                        { axis: 'F', asIs: 3, toBe: 5 },
                        { axis: 'G', asIs: 3, toBe: 5 }
                    ]),
                    completed_axes: JSON.stringify(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
                });
            });

            await expect(AssessmentService.finalizeAssessment('p-1', 'user-1'))
                .rejects.toThrow('All axes must have both actual and target levels');
        });

        it('should finalize successfully with complete data', async () => {
            const completeAxes = [
                { axis: 'processes', asIs: 3, toBe: 5 },
                { axis: 'digitalProducts', asIs: 3, toBe: 5 },
                { axis: 'businessModels', asIs: 3, toBe: 5 },
                { axis: 'dataManagement', asIs: 3, toBe: 5 },
                { axis: 'culture', asIs: 3, toBe: 5 },
                { axis: 'cybersecurity', asIs: 3, toBe: 5 },
                { axis: 'aiMaturity', asIs: 3, toBe: 5 }
            ];

            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('axis_scores')) {
                    cb(null, {
                        axis_scores: JSON.stringify(completeAxes),
                        completed_axes: JSON.stringify(completeAxes.map(a => a.axis))
                    });
                } else {
                    cb(null, {
                        id: 'assessment-1',
                        project_id: 'p-1',
                        axis_scores: JSON.stringify(completeAxes),
                        completed_axes: JSON.stringify(completeAxes.map(a => a.axis)),
                        assessment_status: 'FINALIZED'
                    });
                }
            });

            mockDb.run.mockImplementation(function (sql, params, cb) {
                cb.call({ changes: 1 }, null);
            });

            const result = await AssessmentService.finalizeAssessment('p-1', 'user-1');
            expect(result.status).toBe('FINALIZED');
            expect(result.finalizedAt).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle database error on getAssessment', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(new Error('Database connection failed'), null);
            });

            await expect(AssessmentService.getAssessment('p-1'))
                .rejects.toThrow('Database connection failed');
        });

        it('should handle invalid JSON in axis_scores', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, {
                    id: 'assessment-1',
                    project_id: 'p-1',
                    axis_scores: 'invalid-json',
                    completed_axes: '[]'
                });
            });

            const result = await AssessmentService.getAssessment('p-1');
            expect(result.axisScores).toEqual([]);
        });
    });
});
