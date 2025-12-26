/**
 * Unit Tests: Initiative Generator Service
 * Complete test coverage for AI-powered initiative generation from assessments
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock database
const mockDb = {
    get: vi.fn(),
    run: vi.fn(),
    all: vi.fn()
};

vi.mock('../../../server/database', () => ({
    default: mockDb
}));

// Mock uuid
vi.mock('uuid', () => ({
    v4: () => 'test-uuid-123'
}));

// Mock RapidLeanService
vi.mock('../../../server/services/rapidLeanService', () => ({
    default: {
        getAssessment: vi.fn()
    }
}));

// Mock ExternalAssessmentService
vi.mock('../../../server/services/externalAssessmentService', () => ({
    default: {
        getAssessment: vi.fn()
    }
}));

describe('InitiativeGeneratorService', () => {
    let InitiativeGeneratorService;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const module = await import('../../../server/services/initiativeGeneratorService.js');
        InitiativeGeneratorService = module.default;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // calculateGapPriority TESTS
    // =========================================================================

    describe('calculateGapPriority', () => {
        it('should calculate base priority from gap size', () => {
            const priority = InitiativeGeneratorService.calculateGapPriority(3, 'OTHER');
            expect(priority).toBe(30);
        });

        it('should boost DRD gaps by 1.2x', () => {
            const drdPriority = InitiativeGeneratorService.calculateGapPriority(3, 'DRD');
            const otherPriority = InitiativeGeneratorService.calculateGapPriority(3, 'OTHER');
            expect(drdPriority).toBeGreaterThan(otherPriority);
            expect(drdPriority).toBe(36); // 30 * 1.2
        });

        it('should boost LEAN gaps by 1.1x', () => {
            const leanPriority = InitiativeGeneratorService.calculateGapPriority(3, 'LEAN');
            expect(leanPriority).toBe(33); // 30 * 1.1
        });

        it('should cap priority at 100', () => {
            const priority = InitiativeGeneratorService.calculateGapPriority(15, 'DRD');
            expect(priority).toBeLessThanOrEqual(100);
        });
    });

    // =========================================================================
    // calculateGapPriorityLevel TESTS
    // =========================================================================

    describe('calculateGapPriorityLevel', () => {
        it('should return CRITICAL for gaps >= 4', () => {
            expect(InitiativeGeneratorService.calculateGapPriorityLevel(4)).toBe('CRITICAL');
            expect(InitiativeGeneratorService.calculateGapPriorityLevel(5)).toBe('CRITICAL');
        });

        it('should return HIGH for gaps >= 3', () => {
            expect(InitiativeGeneratorService.calculateGapPriorityLevel(3)).toBe('HIGH');
        });

        it('should return MEDIUM for gaps >= 2', () => {
            expect(InitiativeGeneratorService.calculateGapPriorityLevel(2)).toBe('MEDIUM');
        });

        it('should return LOW for gaps < 2', () => {
            expect(InitiativeGeneratorService.calculateGapPriorityLevel(1)).toBe('LOW');
            expect(InitiativeGeneratorService.calculateGapPriorityLevel(0)).toBe('LOW');
        });
    });

    // =========================================================================
    // getAxisName TESTS
    // =========================================================================

    describe('getAxisName', () => {
        it('should return correct name for processes axis', () => {
            expect(InitiativeGeneratorService.getAxisName('processes')).toBe('Processes');
        });

        it('should return correct name for digitalProducts axis', () => {
            expect(InitiativeGeneratorService.getAxisName('digitalProducts')).toBe('Digital Products');
        });

        it('should return correct name for businessModels axis', () => {
            expect(InitiativeGeneratorService.getAxisName('businessModels')).toBe('Business Models');
        });

        it('should return correct name for dataManagement axis', () => {
            expect(InitiativeGeneratorService.getAxisName('dataManagement')).toBe('Data Management');
        });

        it('should return correct name for culture axis', () => {
            expect(InitiativeGeneratorService.getAxisName('culture')).toBe('Organizational Culture');
        });

        it('should return correct name for cybersecurity axis', () => {
            expect(InitiativeGeneratorService.getAxisName('cybersecurity')).toBe('Cybersecurity');
        });

        it('should return correct name for aiMaturity axis', () => {
            expect(InitiativeGeneratorService.getAxisName('aiMaturity')).toBe('AI Maturity');
        });

        it('should return axisId for unknown axes', () => {
            expect(InitiativeGeneratorService.getAxisName('unknown')).toBe('unknown');
        });
    });

    // =========================================================================
    // groupGapsByTheme TESTS
    // =========================================================================

    describe('groupGapsByTheme', () => {
        it('should group dataManagement gaps correctly', () => {
            const gaps = [
                { dimension: 'dataManagement', gap: 3 },
                { dimension: 'Data Governance', gap: 2 }
            ];

            const result = InitiativeGeneratorService.groupGapsByTheme(gaps);

            expect(result['Data Management']).toHaveLength(2);
        });

        it('should group process-related gaps correctly', () => {
            const gaps = [
                { dimension: 'processes', gap: 3 },
                { dimension: 'value_stream', gap: 2 },
                { dimension: 'Process Digitalization', gap: 2 }
            ];

            const result = InitiativeGeneratorService.groupGapsByTheme(gaps);

            expect(result['Process Digitalization']).toHaveLength(3);
        });

        it('should group operational excellence gaps correctly', () => {
            const gaps = [
                { dimension: 'waste_elimination', gap: 3 },
                { dimension: 'flow_pull', gap: 2 },
                { dimension: 'quality_source', gap: 2 }
            ];

            const result = InitiativeGeneratorService.groupGapsByTheme(gaps);

            expect(result['Operational Excellence']).toHaveLength(3);
        });

        it('should group culture gaps correctly', () => {
            const gaps = [
                { dimension: 'culture', gap: 3 },
                { dimension: 'continuous_improvement', gap: 2 }
            ];

            const result = InitiativeGeneratorService.groupGapsByTheme(gaps);

            expect(result['Organizational Culture']).toHaveLength(2);
        });

        it('should remove empty themes', () => {
            const gaps = [
                { dimension: 'processes', gap: 3 }
            ];

            const result = InitiativeGeneratorService.groupGapsByTheme(gaps);

            expect(Object.keys(result)).toHaveLength(1);
            expect(result['Data Management']).toBeUndefined();
        });
    });

    // =========================================================================
    // generateInitiativeName TESTS
    // =========================================================================

    describe('generateInitiativeName', () => {
        it('should generate name for Data Management theme', () => {
            const name = InitiativeGeneratorService.generateInitiativeName('Data Management', []);
            expect(name).toBe('Master Data Management Platform');
        });

        it('should generate name for Process Digitalization theme', () => {
            const name = InitiativeGeneratorService.generateInitiativeName('Process Digitalization', []);
            expect(name).toBe('End-to-End Process Digitalization Program');
        });

        it('should generate name for Cybersecurity theme', () => {
            const name = InitiativeGeneratorService.generateInitiativeName('Cybersecurity', []);
            expect(name).toBe('Enterprise Cybersecurity Enhancement');
        });

        it('should generate fallback name for unknown theme', () => {
            const name = InitiativeGeneratorService.generateInitiativeName('Unknown Theme', []);
            expect(name).toBe('Unknown Theme Improvement Initiative');
        });
    });

    // =========================================================================
    // generateInitiativeSummary TESTS
    // =========================================================================

    describe('generateInitiativeSummary', () => {
        it('should generate summary with gap count and sources', () => {
            const gaps = [
                { source: 'DRD', gap: 3 },
                { source: 'LEAN', gap: 2 }
            ];

            const summary = InitiativeGeneratorService.generateInitiativeSummary('Data Management', gaps);

            expect(summary).toContain('2 critical gap(s)');
            expect(summary).toContain('DRD, LEAN');
            expect(summary).toContain('Data Management');
        });

        it('should deduplicate sources', () => {
            const gaps = [
                { source: 'DRD', gap: 3 },
                { source: 'DRD', gap: 2 }
            ];

            const summary = InitiativeGeneratorService.generateInitiativeSummary('Processes', gaps);

            expect(summary).toContain('DRD');
            expect(summary.split('DRD').length - 1).toBe(1);
        });
    });

    // =========================================================================
    // generateGapJustification TESTS
    // =========================================================================

    describe('generateGapJustification', () => {
        it('should generate justification with gap details', () => {
            const gaps = [
                { source: 'DRD', dimension: 'processes', gap: 3.5 },
                { source: 'LEAN', dimension: 'value_stream', gap: 2.5 }
            ];

            const justification = InitiativeGeneratorService.generateGapJustification('Processes', gaps);

            expect(justification).toContain('DRD processes: gap of 3.5');
            expect(justification).toContain('LEAN value_stream: gap of 2.5');
        });
    });

    // =========================================================================
    // mapThemeToDRDAxis TESTS
    // =========================================================================

    describe('mapThemeToDRDAxis', () => {
        it('should map Data Management to dataManagement', () => {
            expect(InitiativeGeneratorService.mapThemeToDRDAxis('Data Management')).toBe('dataManagement');
        });

        it('should map Process Digitalization to processes', () => {
            expect(InitiativeGeneratorService.mapThemeToDRDAxis('Process Digitalization')).toBe('processes');
        });

        it('should map Operational Excellence to processes', () => {
            expect(InitiativeGeneratorService.mapThemeToDRDAxis('Operational Excellence')).toBe('processes');
        });

        it('should map Digital Products to digitalProducts', () => {
            expect(InitiativeGeneratorService.mapThemeToDRDAxis('Digital Products')).toBe('digitalProducts');
        });

        it('should map Organizational Culture to culture', () => {
            expect(InitiativeGeneratorService.mapThemeToDRDAxis('Organizational Culture')).toBe('culture');
        });

        it('should map Cybersecurity to cybersecurity', () => {
            expect(InitiativeGeneratorService.mapThemeToDRDAxis('Cybersecurity')).toBe('cybersecurity');
        });

        it('should default to processes for unknown themes', () => {
            expect(InitiativeGeneratorService.mapThemeToDRDAxis('Unknown')).toBe('processes');
        });
    });

    // =========================================================================
    // consolidateGaps TESTS
    // =========================================================================

    describe('consolidateGaps', () => {
        it('should consolidate DRD gaps with significant size', () => {
            const assessmentData = {
                drd: {
                    id: 'drd-1',
                    axis_scores: [
                        { axis: 'processes', asIs: 2, toBe: 5, gap: 3 },
                        { axis: 'dataManagement', asIs: 3, toBe: 5, gap: 2 } // below threshold
                    ]
                },
                lean: null,
                external: []
            };

            const gaps = InitiativeGeneratorService.consolidateGaps(assessmentData);

            expect(gaps.length).toBe(1);
            expect(gaps[0].source).toBe('DRD');
            expect(gaps[0].dimension).toBe('processes');
        });

        it('should consolidate LEAN gaps', () => {
            const assessmentData = {
                drd: null,
                lean: {
                    id: 'lean-1',
                    top_gaps: ['waste_elimination'],
                    waste_elimination_score: 2,
                    industry_benchmark: 5
                },
                external: []
            };

            const gaps = InitiativeGeneratorService.consolidateGaps(assessmentData);

            expect(gaps.some(g => g.source === 'LEAN')).toBe(true);
        });

        it('should consolidate external assessment gaps', () => {
            const assessmentData = {
                drd: null,
                lean: null,
                external: [{
                    id: 'ext-1',
                    framework_type: 'SIRI',
                    drd_axis_mapping: {
                        processes: 3,
                        dataManagement: 2
                    }
                }]
            };

            const gaps = InitiativeGeneratorService.consolidateGaps(assessmentData);

            expect(gaps.some(g => g.source === 'SIRI')).toBe(true);
        });

        it('should sort gaps by priority (highest first)', () => {
            const assessmentData = {
                drd: {
                    axis_scores: [
                        { axis: 'processes', gap: 3 },
                        { axis: 'culture', gap: 5 }
                    ]
                },
                lean: null,
                external: []
            };

            const gaps = InitiativeGeneratorService.consolidateGaps(assessmentData);

            expect(gaps[0].priority).toBeGreaterThanOrEqual(gaps[1]?.priority || 0);
        });
    });

    // =========================================================================
    // extractGapsFromAssessment TESTS
    // =========================================================================

    describe('extractGapsFromAssessment', () => {
        const sampleAssessment = {
            axis_scores: [
                { axis: 'processes', asIs: 2, toBe: 5 },
                { axis: 'dataManagement', current: 3, target: 4 },
                { axis: 'culture', asIs: 4, toBe: 4 } // no gap
            ]
        };

        it('should extract gaps from assessment', () => {
            const gaps = InitiativeGeneratorService.extractGapsFromAssessment(sampleAssessment);

            expect(gaps.length).toBe(2);
            expect(gaps.some(g => g.axisId === 'processes')).toBe(true);
            expect(gaps.some(g => g.axisId === 'culture')).toBe(false);
        });

        it('should filter by focus areas when provided', () => {
            const gaps = InitiativeGeneratorService.extractGapsFromAssessment(
                sampleAssessment,
                ['processes']
            );

            expect(gaps.length).toBe(1);
            expect(gaps[0].axisId).toBe('processes');
        });

        it('should calculate gap correctly', () => {
            const gaps = InitiativeGeneratorService.extractGapsFromAssessment(sampleAssessment);

            const processGap = gaps.find(g => g.axisId === 'processes');
            expect(processGap.gap).toBe(3);
            expect(processGap.currentScore).toBe(2);
            expect(processGap.targetScore).toBe(5);
        });

        it('should include priority level', () => {
            const gaps = InitiativeGeneratorService.extractGapsFromAssessment(sampleAssessment);

            gaps.forEach(gap => {
                expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(gap.priority);
            });
        });

        it('should sort by gap size descending', () => {
            const gaps = InitiativeGeneratorService.extractGapsFromAssessment(sampleAssessment);

            for (let i = 1; i < gaps.length; i++) {
                expect(gaps[i - 1].gap).toBeGreaterThanOrEqual(gaps[i].gap);
            }
        });
    });

    // =========================================================================
    // generateSmartInitiativeName TESTS
    // =========================================================================

    describe('generateSmartInitiativeName', () => {
        it('should generate appropriate name for large process gap', () => {
            const name = InitiativeGeneratorService.generateSmartInitiativeName({
                axisId: 'processes',
                gap: 4
            });

            expect(name).toBe('Process Automation Platform');
        });

        it('should generate appropriate name for medium process gap', () => {
            const name = InitiativeGeneratorService.generateSmartInitiativeName({
                axisId: 'processes',
                gap: 3
            });

            expect(name).toBe('End-to-End Workflow Digitalization');
        });

        it('should generate appropriate name for small process gap', () => {
            const name = InitiativeGeneratorService.generateSmartInitiativeName({
                axisId: 'processes',
                gap: 2
            });

            expect(name).toBe('Intelligent Process Mining Initiative');
        });

        it('should generate name for AI maturity axis', () => {
            const name = InitiativeGeneratorService.generateSmartInitiativeName({
                axisId: 'aiMaturity',
                gap: 4
            });

            expect(name).toBe('AI/ML Center of Excellence');
        });

        it('should generate name for cybersecurity axis', () => {
            const name = InitiativeGeneratorService.generateSmartInitiativeName({
                axisId: 'cybersecurity',
                gap: 4
            });

            expect(name).toBe('Enterprise Security Enhancement');
        });

        it('should fallback for unknown axis', () => {
            const name = InitiativeGeneratorService.generateSmartInitiativeName({
                axisId: 'unknown',
                axisName: 'Custom Axis',
                gap: 3
            });

            expect(name).toContain('Improvement Initiative');
        });
    });

    // =========================================================================
    // generateInitiativeDescription TESTS
    // =========================================================================

    describe('generateInitiativeDescription', () => {
        it('should include axis name and scores', () => {
            const description = InitiativeGeneratorService.generateInitiativeDescription(
                { axisName: 'Processes', currentScore: 2, targetScore: 5, gap: 3, priority: 'HIGH' },
                {}
            );

            expect(description).toContain('Processes');
            expect(description).toContain('level 2');
            expect(description).toContain('level 5');
        });

        it('should include priority level', () => {
            const description = InitiativeGeneratorService.generateInitiativeDescription(
                { axisName: 'Processes', currentScore: 2, targetScore: 5, gap: 3, priority: 'HIGH' },
                {}
            );

            expect(description).toContain('high-priority');
        });

        it('should include gap size', () => {
            const description = InitiativeGeneratorService.generateInitiativeDescription(
                { axisName: 'Processes', currentScore: 2, targetScore: 5, gap: 3.5, priority: 'CRITICAL' },
                {}
            );

            expect(description).toContain('3.5');
        });
    });

    // =========================================================================
    // generateObjectives TESTS
    // =========================================================================

    describe('generateObjectives', () => {
        it('should include primary gap-closing objective', () => {
            const objectives = InitiativeGeneratorService.generateObjectives({
                axisName: 'Processes',
                currentScore: 2,
                targetScore: 5,
                axisId: 'processes'
            });

            expect(objectives[0]).toContain('Increase Processes maturity');
            expect(objectives[0]).toContain('level 2');
            expect(objectives[0]).toContain('level 5');
        });

        it('should include axis-specific objectives for processes', () => {
            const objectives = InitiativeGeneratorService.generateObjectives({
                axisId: 'processes',
                axisName: 'Processes',
                currentScore: 2,
                targetScore: 5
            });

            expect(objectives.length).toBeGreaterThan(1);
            expect(objectives.some(o => o.includes('process'))).toBe(true);
        });

        it('should include axis-specific objectives for dataManagement', () => {
            const objectives = InitiativeGeneratorService.generateObjectives({
                axisId: 'dataManagement',
                axisName: 'Data Management',
                currentScore: 2,
                targetScore: 5
            });

            expect(objectives.some(o => 
                o.includes('data') || o.includes('analytics') || o.includes('governance')
            )).toBe(true);
        });

        it('should include axis-specific objectives for aiMaturity', () => {
            const objectives = InitiativeGeneratorService.generateObjectives({
                axisId: 'aiMaturity',
                axisName: 'AI Maturity',
                currentScore: 2,
                targetScore: 5
            });

            expect(objectives.some(o => 
                o.includes('AI') || o.includes('ML')
            )).toBe(true);
        });
    });

    // =========================================================================
    // createEnhancedInitiative TESTS
    // =========================================================================

    describe('createEnhancedInitiative', () => {
        const sampleGap = {
            axisId: 'processes',
            axisName: 'Processes',
            currentScore: 2,
            targetScore: 5,
            gap: 3,
            priority: 'HIGH'
        };

        it('should create initiative with required fields', () => {
            const initiative = InitiativeGeneratorService.createEnhancedInitiative(
                sampleGap,
                {},
                { assessmentId: 'test-assessment' }
            );

            expect(initiative.id).toBeDefined();
            expect(initiative.name).toBeDefined();
            expect(initiative.description).toBeDefined();
            expect(initiative.objectives).toBeInstanceOf(Array);
            expect(initiative.estimatedROI).toBeDefined();
            expect(initiative.estimatedBudget).toBeDefined();
            expect(initiative.timeline).toBeDefined();
            expect(initiative.riskLevel).toBeDefined();
            expect(initiative.status).toBe('DRAFT');
            expect(initiative.aiGenerated).toBe(true);
        });

        it('should calculate budget based on gap size', () => {
            const smallGap = { ...sampleGap, gap: 2 };
            const largeGap = { ...sampleGap, gap: 5 };

            const smallInit = InitiativeGeneratorService.createEnhancedInitiative(smallGap, {}, {});
            const largeInit = InitiativeGeneratorService.createEnhancedInitiative(largeGap, {}, {});

            expect(largeInit.estimatedBudget).toBeGreaterThan(smallInit.estimatedBudget);
        });

        it('should adjust budget for team size', () => {
            const smallTeam = InitiativeGeneratorService.createEnhancedInitiative(
                sampleGap,
                { teamSize: '1-5' },
                {}
            );
            const largeTeam = InitiativeGeneratorService.createEnhancedInitiative(
                sampleGap,
                { teamSize: '10-20' },
                {}
            );

            expect(largeTeam.estimatedBudget).toBeGreaterThan(smallTeam.estimatedBudget);
        });

        it('should calculate appropriate risk level', () => {
            const highRiskGap = { ...sampleGap, gap: 5 };
            const lowRiskGap = { ...sampleGap, gap: 1 };

            const highRiskInit = InitiativeGeneratorService.createEnhancedInitiative(highRiskGap, {}, {});
            const lowRiskInit = InitiativeGeneratorService.createEnhancedInitiative(lowRiskGap, {}, {});

            expect(highRiskInit.riskLevel).toBe('HIGH');
            expect(lowRiskInit.riskLevel).toBe('LOW');
        });

        it('should include assessment ID from context', () => {
            const initiative = InitiativeGeneratorService.createEnhancedInitiative(
                sampleGap,
                {},
                { assessmentId: 'assessment-123' }
            );

            expect(initiative.assessmentId).toBe('assessment-123');
        });
    });

    // =========================================================================
    // generateWithAI TESTS
    // =========================================================================

    describe('generateWithAI', () => {
        const sampleGaps = [
            { axisId: 'processes', axisName: 'Processes', gap: 3, priority: 'HIGH', currentScore: 2, targetScore: 5 },
            { axisId: 'dataManagement', axisName: 'Data Management', gap: 2, priority: 'MEDIUM', currentScore: 3, targetScore: 5 }
        ];

        it('should generate initiative for each gap', async () => {
            const initiatives = await InitiativeGeneratorService.generateWithAI(
                sampleGaps,
                {},
                {}
            );

            expect(initiatives.length).toBe(2);
        });

        it('should apply budget constraints', async () => {
            const initiatives = await InitiativeGeneratorService.generateWithAI(
                sampleGaps,
                { maxBudget: 100000 },
                {}
            );

            const totalBudget = initiatives.reduce((sum, i) => sum + i.estimatedBudget, 0);
            expect(totalBudget).toBeLessThanOrEqual(100000);
        });

        it('should apply timeline constraints', async () => {
            const initiatives = await InitiativeGeneratorService.generateWithAI(
                sampleGaps,
                { maxTimeline: '6 months' },
                {}
            );

            initiatives.forEach(init => {
                expect(init.timeline).toBe('6 months');
            });
        });

        it('should adjust for conservative risk appetite', async () => {
            const initiatives = await InitiativeGeneratorService.generateWithAI(
                [{ ...sampleGaps[0], gap: 5 }], // HIGH risk
                { riskAppetite: 'conservative' },
                {}
            );

            expect(initiatives[0].riskLevel).toBe('MEDIUM');
        });

        it('should adjust for aggressive risk appetite', async () => {
            const initiatives = await InitiativeGeneratorService.generateWithAI(
                [{ ...sampleGaps[1], gap: 1 }], // LOW risk
                { riskAppetite: 'aggressive' },
                {}
            );

            expect(initiatives[0].riskLevel).toBe('MEDIUM');
        });
    });

    // =========================================================================
    // validateInitiative TESTS
    // =========================================================================

    describe('validateInitiative', () => {
        const validInitiative = {
            name: 'Valid Initiative Name',
            description: 'This is a valid description that meets the minimum length requirement',
            estimatedBudget: 100000,
            timeline: '6-12 months',
            objectives: ['Objective 1', 'Objective 2'],
            estimatedROI: 2.5,
            riskLevel: 'MEDIUM'
        };

        it('should validate complete initiative as valid', async () => {
            const result = await InitiativeGeneratorService.validateInitiative(validInitiative);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject initiative with short name', async () => {
            const result = await InitiativeGeneratorService.validateInitiative({
                ...validInitiative,
                name: 'Ab'
            });

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('name'))).toBe(true);
        });

        it('should reject initiative without name', async () => {
            const result = await InitiativeGeneratorService.validateInitiative({
                ...validInitiative,
                name: null
            });

            expect(result.valid).toBe(false);
        });

        it('should reject initiative with short description', async () => {
            const result = await InitiativeGeneratorService.validateInitiative({
                ...validInitiative,
                description: 'Too short'
            });

            expect(result.valid).toBe(false);
        });

        it('should reject initiative without budget', async () => {
            const result = await InitiativeGeneratorService.validateInitiative({
                ...validInitiative,
                estimatedBudget: 0
            });

            expect(result.valid).toBe(false);
        });

        it('should reject initiative without timeline', async () => {
            const result = await InitiativeGeneratorService.validateInitiative({
                ...validInitiative,
                timeline: ''
            });

            expect(result.valid).toBe(false);
        });

        it('should warn about missing objectives', async () => {
            const result = await InitiativeGeneratorService.validateInitiative({
                ...validInitiative,
                objectives: []
            });

            expect(result.valid).toBe(true);
            expect(result.warnings.some(w => w.includes('objective'))).toBe(true);
        });

        it('should warn about low ROI', async () => {
            const result = await InitiativeGeneratorService.validateInitiative({
                ...validInitiative,
                estimatedROI: 0.5
            });

            expect(result.warnings.some(w => w.includes('ROI'))).toBe(true);
        });

        it('should warn about high-risk high-budget initiatives', async () => {
            const result = await InitiativeGeneratorService.validateInitiative({
                ...validInitiative,
                riskLevel: 'HIGH',
                estimatedBudget: 600000
            });

            expect(result.warnings.some(w => w.includes('High-risk'))).toBe(true);
        });
    });

    // =========================================================================
    // createInitiativeFromGaps TESTS
    // =========================================================================

    describe('createInitiativeFromGaps', () => {
        const sampleGaps = [
            { source: 'DRD', sourceId: 'drd-1', dimension: 'processes', gap: 3, asIs: 2, priority: 50 },
            { source: 'LEAN', sourceId: 'lean-1', dimension: 'value_stream', gap: 2, score: 3, priority: 40 }
        ];

        const assessmentData = {
            drd: { id: 'drd-1' },
            lean: { id: 'lean-1' },
            external: []
        };

        it('should create initiative with correct theme', () => {
            const initiative = InitiativeGeneratorService.createInitiativeFromGaps(
                'Process Digitalization',
                sampleGaps,
                assessmentData
            );

            expect(initiative.axis).toBe('processes');
        });

        it('should calculate priority from gap severity', () => {
            const initiative = InitiativeGeneratorService.createInitiativeFromGaps(
                'Process Digitalization',
                sampleGaps,
                assessmentData
            );

            expect(['Critical', 'High', 'Medium', 'Low']).toContain(initiative.priority);
        });

        it('should include traceability data', () => {
            const initiative = InitiativeGeneratorService.createInitiativeFromGaps(
                'Process Digitalization',
                sampleGaps,
                assessmentData
            );

            expect(initiative.derived_from_assessments).toBeInstanceOf(Array);
            expect(initiative.derived_from_assessments.length).toBe(2);
            expect(initiative.assessment_traceability.drd_id).toBe('drd-1');
            expect(initiative.assessment_traceability.lean_id).toBe('lean-1');
        });

        it('should set status to DRAFT', () => {
            const initiative = InitiativeGeneratorService.createInitiativeFromGaps(
                'Process Digitalization',
                sampleGaps,
                assessmentData
            );

            expect(initiative.status).toBe('DRAFT');
        });

        it('should mark as auto-generated', () => {
            const initiative = InitiativeGeneratorService.createInitiativeFromGaps(
                'Process Digitalization',
                sampleGaps,
                assessmentData
            );

            expect(initiative.created_from).toBe('AI_ASSESSMENT');
            expect(initiative.assessment_traceability.auto_generated).toBe(true);
        });
    });

    // =========================================================================
    // generateInitiativeDrafts TESTS
    // =========================================================================

    describe('generateInitiativeDrafts', () => {
        it('should generate one initiative per theme', () => {
            const gaps = [
                { dimension: 'processes', gap: 3, source: 'DRD' },
                { dimension: 'dataManagement', gap: 2, source: 'DRD' }
            ];

            const assessmentData = { drd: null, lean: null, external: [] };

            const initiatives = InitiativeGeneratorService.generateInitiativeDrafts(gaps, assessmentData);

            expect(initiatives.length).toBe(2);
        });

        it('should combine gaps of same theme into single initiative', () => {
            const gaps = [
                { dimension: 'processes', gap: 3, source: 'DRD' },
                { dimension: 'value_stream', gap: 2, source: 'LEAN' }
            ];

            const assessmentData = { drd: null, lean: null, external: [] };

            const initiatives = InitiativeGeneratorService.generateInitiativeDrafts(gaps, assessmentData);

            // Both should be grouped under Process Digitalization
            expect(initiatives.length).toBe(1);
        });
    });
});

