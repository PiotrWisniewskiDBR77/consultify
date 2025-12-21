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
    });
});
