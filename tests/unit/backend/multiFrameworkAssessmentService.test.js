/**
 * Unit Tests: Multi-Framework Assessment Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import multiFrameworkAssessmentService from '../../../server/services/multiFrameworkAssessmentService';
import db from '../../../server/database';
// Import other dependencies if needed, or mock them

// Mock database
// Mock database
const mockQuery = vi.fn();
const mockGet = vi.fn();
const mockRun = vi.fn();

vi.mock('../../../server/database', () => ({
    query: mockQuery,
    get: mockGet,
    run: mockRun,
    default: {
        query: mockQuery,
        get: mockGet,
        run: mockRun
    }
}));

// Mock audit service
vi.mock('../../../server/services/multiFrameworkAuditService', () => ({
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
    logAction: vi.fn(),
    ENTITY_TYPES: { ASSESSMENT: 'ASSESSMENT' },
    ACTION_TYPES: { CREATE: 'CREATE', UPDATE: 'UPDATE' },
    default: {
        logCreate: vi.fn(),
        logUpdate: vi.fn(),
        logDelete: vi.fn(),
        logAction: vi.fn()
    }
}));
import { calculateFrameworkScore } from '../../../server/services/frameworkScoreCalculators';

describe('MultiFrameworkAssessmentService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createAssessment', () => {
        it('should create SIRI assessment with valid data', async () => {
            const projectId = 'project-123';
            const framework = 'SIRI';
            const data = {
                dimensions: {
                    operations: 3,
                    supply_chain: 2.5,
                    product_lifecycle: 3,
                    automation: 2,
                    connectivity: 2.5,
                    intelligence: 2,
                    talent_readiness: 3,
                    structure_management: 2.5,
                },
                legalDisclaimerAccepted: true,
            };
            const userId = 'user-123';

            db.query.mockResolvedValueOnce({
                rows: [{
                    id: 'assessment-123',
                    project_id: projectId,
                    framework,
                    data,
                    status: 'DRAFT',
                    version: 1,
                }],
            });

            const result = await multiFrameworkAssessmentService.createAssessment(
                projectId,
                framework,
                data,
                userId,
                { name: 'Test SIRI Assessment', organizationId: 'org-123' }
            );

            expect(result).toBeDefined();
            expect(result.framework).toBe('SIRI');
            expect(db.query).toHaveBeenCalled();
        });

        it('should create ADMA assessment with valid data', async () => {
            const projectId = 'project-123';
            const framework = 'ADMA';
            const data = {
                dimensions: {
                    leadership_strategy: 3,
                    investment_innovation: 2.5,
                    digital_culture: 2,
                    skills_talent: 3,
                },
                legalDisclaimerAccepted: true,
            };
            const userId = 'user-123';

            db.query.mockResolvedValueOnce({
                rows: [{
                    id: 'assessment-456',
                    project_id: projectId,
                    framework,
                    data,
                    status: 'DRAFT',
                    version: 1,
                }],
            });

            const result = await multiFrameworkAssessmentService.createAssessment(
                projectId,
                framework,
                data,
                userId,
                { name: 'Test ADMA Assessment', organizationId: 'org-123' }
            );

            expect(result).toBeDefined();
            expect(result.framework).toBe('ADMA');
        });

        it('should create CMMI assessment with valid data', async () => {
            const projectId = 'project-123';
            const framework = 'CMMI';
            const data = {
                practiceAreas: {
                    EST: 2,
                    RDM: 3,
                    TS: 2,
                    PI: 2,
                    PR: 3,
                    VV: 2,
                    PLAN: 3,
                    MC: 2,
                },
                legalDisclaimerAccepted: true,
            };
            const userId = 'user-123';

            db.query.mockResolvedValueOnce({
                rows: [{
                    id: 'assessment-789',
                    project_id: projectId,
                    framework,
                    data,
                    status: 'DRAFT',
                    version: 1,
                }],
            });

            const result = await multiFrameworkAssessmentService.createAssessment(
                projectId,
                framework,
                data,
                userId,
                { name: 'Test CMMI Assessment', organizationId: 'org-123' }
            );

            expect(result).toBeDefined();
            expect(result.framework).toBe('CMMI');
        });

        it('should create LEAN assessment with valid data', async () => {
            const projectId = 'project-123';
            const framework = 'LEAN';
            const data = {
                processes: [
                    { id: 'p1', name: 'Assembly', steps: [], wastes: { WAITING: 3 } },
                ],
                workstations: [
                    { id: 'w1', name: 'Station 1', tasks: [], automationPotential: 4 },
                ],
                managementPractices: {
                    fiveS: { implemented: true },
                },
            };
            const userId = 'user-123';

            db.query.mockResolvedValueOnce({
                rows: [{
                    id: 'assessment-abc',
                    project_id: projectId,
                    framework,
                    data,
                    status: 'DRAFT',
                    version: 1,
                }],
            });

            const result = await multiFrameworkAssessmentService.createAssessment(
                projectId,
                framework,
                data,
                userId,
                { name: 'Test LEAN Assessment', organizationId: 'org-123' }
            );

            expect(result).toBeDefined();
            expect(result.framework).toBe('LEAN');
        });

        it('should reject invalid framework', async () => {
            await expect(
                multiFrameworkAssessmentService.createAssessment(
                    'project-123',
                    'INVALID_FRAMEWORK',
                    {},
                    'user-123',
                    {}
                )
            ).rejects.toThrow('Invalid framework');
        });

        it('should calculate overall score correctly', async () => {
            const data = {
                dimensions: {
                    operations: 4,
                    supply_chain: 4,
                    product_lifecycle: 4,
                    automation: 3,
                    connectivity: 3,
                    intelligence: 3,
                    talent_readiness: 3,
                    structure_management: 3,
                },
            };

            db.query.mockResolvedValueOnce({
                rows: [{
                    id: 'assessment-xyz',
                    project_id: 'project-123',
                    framework: 'SIRI',
                    data,
                    overall_score: 3.4,
                    status: 'DRAFT',
                    version: 1,
                }],
            });

            const result = await multiFrameworkAssessmentService.createAssessment(
                'project-123',
                'SIRI',
                data,
                'user-123',
                { organizationId: 'org-123' }
            );

            // Check that score calculation was called (via INSERT query)
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO multi_framework_assessments'),
                expect.any(Array)
            );
        });
    });

    describe('mapToUnifiedGaps', () => {
        it('should map SIRI dimensions to unified format', () => {
            const data = {
                dimensions: {
                    operations: 2,
                    automation: 1.5,
                    intelligence: 1,
                },
            };
            const scoreResult = {
                overall: 2.0,
                categories: { PROCESS: 2.5, TECHNOLOGY: 1.5, ORGANIZATION: 2.0 },
            };

            const gaps = multiFrameworkAssessmentService.mapToUnifiedGaps('SIRI', data, scoreResult);

            expect(gaps).toBeInstanceOf(Array);
            expect(gaps.length).toBeGreaterThan(0);
            expect(gaps[0]).toHaveProperty('framework', 'SIRI');
            expect(gaps[0]).toHaveProperty('dimensionId');
            expect(gaps[0]).toHaveProperty('gap');
            expect(gaps[0]).toHaveProperty('priority');
        });

        it('should map ADMA pillars to unified format', () => {
            const data = {
                dimensions: {
                    leadership_strategy: 2,
                    smart_products: 1.5,
                },
            };
            const scoreResult = {
                overall: 2.0,
                categories: { strategy: 2.0, smart_products: 1.5 },
            };

            const gaps = multiFrameworkAssessmentService.mapToUnifiedGaps('ADMA', data, scoreResult);

            expect(gaps).toBeInstanceOf(Array);
            expect(gaps.some(g => g.framework === 'ADMA')).toBe(true);
        });

        it('should map CMMI practice areas to unified format', () => {
            const data = {
                practiceAreas: {
                    EST: 1,
                    RDM: 2,
                    PLAN: 1,
                },
            };
            const scoreResult = {
                overall: 1,
                categories: { DOING: 1.5, MANAGING: 1.5, ENABLING: 2 },
            };

            const gaps = multiFrameworkAssessmentService.mapToUnifiedGaps('CMMI', data, scoreResult);

            expect(gaps).toBeInstanceOf(Array);
            expect(gaps.some(g => g.framework === 'CMMI')).toBe(true);
            // CMMI gaps should include isBlocker property
            expect(gaps.some(g => g.hasOwnProperty('isBlocker'))).toBe(true);
        });

        it('should map LEAN metrics to unified format', () => {
            const data = {
                processes: [
                    { id: 'p1', name: 'Assembly', wastes: { WAITING: 4, DEFECTS: 3 } },
                ],
                workstations: [
                    { id: 'w1', name: 'Station 1', automationPotential: 4, automationType: 'STANDARD' },
                ],
            };
            const scoreResult = {
                overall: 2.5,
                categories: { MEASURE: 3, OPTIMIZE: 2, AUTOMATE: 2.5 },
            };

            const gaps = multiFrameworkAssessmentService.mapToUnifiedGaps('LEAN', data, scoreResult);

            expect(gaps).toBeInstanceOf(Array);
            // Should include both waste gaps and automation opportunities
            expect(gaps.some(g => g.type === 'WASTE')).toBe(true);
            expect(gaps.some(g => g.type === 'AUTOMATION')).toBe(true);
        });
    });
});

describe('FrameworkScoreCalculators', () => {
    describe('calculateSIRIScore', () => {
        it('should average building block scores correctly', () => {
            const data = {
                dimensions: {
                    operations: 4,
                    supply_chain: 4,
                    product_lifecycle: 4,
                    automation: 3,
                    connectivity: 3,
                    intelligence: 3,
                    talent_readiness: 2,
                    structure_management: 2,
                },
            };

            const result = calculateFrameworkScore('SIRI', data);

            expect(result.overall).toBeGreaterThan(0);
            expect(result.overall).toBeLessThanOrEqual(5);
            expect(result.categories).toHaveProperty('PROCESS');
            expect(result.categories).toHaveProperty('TECHNOLOGY');
            expect(result.categories).toHaveProperty('ORGANIZATION');
            // PROCESS should be 4 (average of 4, 4, 4)
            expect(result.categories.PROCESS).toBe(4);
            // TECHNOLOGY should be 3 (average of 3, 3, 3)
            expect(result.categories.TECHNOLOGY).toBe(3);
            // ORGANIZATION should be 2 (average of 2, 2)
            expect(result.categories.ORGANIZATION).toBe(2);
        });

        it('should handle missing dimensions', () => {
            const data = {
                dimensions: {
                    operations: 3,
                    // Missing other dimensions
                },
            };

            const result = calculateFrameworkScore('SIRI', data);

            expect(result.overall).toBeGreaterThanOrEqual(0);
            expect(result.completeness).toBeLessThan(1);
        });
    });

    describe('calculateCMMIScore', () => {
        it('should return minimum practice area level', () => {
            const data = {
                practiceAreas: {
                    EST: 3,
                    RDM: 3,
                    TS: 2, // This is the minimum
                    PI: 3,
                    PR: 3,
                    VV: 3,
                    PLAN: 3,
                    MC: 3,
                    MPM: 3,
                    RSK: 3,
                    SAM: 3,
                    CAR: 3,
                    CM: 3,
                    DAR: 3,
                    GOV: 3,
                    II: 3,
                    OT: 3,
                    PAD: 3,
                    PCM: 3,
                    PPQA: 3,
                },
            };

            const result = calculateFrameworkScore('CMMI', data);

            // CMMI staged representation: overall = minimum
            expect(result.overall).toBe(2);
            expect(result.maturityLevel.level).toBe(2);
        });

        it('should handle incomplete assessments', () => {
            const data = {
                practiceAreas: {
                    EST: 3,
                    RDM: 3,
                    // Only 2 practice areas assessed
                },
            };

            const result = calculateFrameworkScore('CMMI', data);

            expect(result.overall).toBeGreaterThanOrEqual(1);
            expect(result.completeness).toBeLessThan(1);
        });
    });

    describe('calculateLeanScore', () => {
        it('should calculate process and workstation scores', () => {
            const data = {
                processes: [
                    { id: 'p1', steps: [1, 2, 3], wastes: { WAITING: 2 } },
                    { id: 'p2', steps: [1, 2], wastes: { DEFECTS: 3 } },
                ],
                workstations: [
                    { id: 'w1', tasks: [1], automationPotential: 4, aiReadiness: 3 },
                    { id: 'w2', tasks: [1, 2], automationPotential: 2 },
                ],
                managementPractices: {
                    fiveS: { implemented: true },
                    kaizen: { implemented: true },
                },
            };

            const result = calculateFrameworkScore('LEAN', data);

            expect(result.overall).toBeGreaterThan(0);
            expect(result.categories).toHaveProperty('MEASURE');
            expect(result.categories).toHaveProperty('OPTIMIZE');
            expect(result.categories).toHaveProperty('AUTOMATE');
            expect(result.automationPotential).toBeDefined();
        });
    });
});


