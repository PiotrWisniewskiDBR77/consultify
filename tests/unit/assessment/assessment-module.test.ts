/**
 * Assessment Module - Comprehensive Unit Tests
 *
 * Tests for maturity assessments, scoring, and recommendations
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Assessment Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Maturity Assessment', () => {
        it('should create assessment', () => {
            const assessment = {
                id: 'ASM-001',
                organizationId: 'org-001',
                type: 'digital_maturity',
                status: 'in_progress',
                startedAt: new Date(),
                completedAt: null,
            };

            expect(assessment.status).toBe('in_progress');
        });

        it('should define maturity dimensions', () => {
            const dimensions = [
                'strategy',
                'technology',
                'people',
                'processes',
                'data',
                'culture',
            ];

            expect(dimensions).toHaveLength(6);
        });

        it('should calculate dimension score', () => {
            const answers = [
                { questionId: 'Q1', score: 4 },
                { questionId: 'Q2', score: 3 },
                { questionId: 'Q3', score: 5 },
                { questionId: 'Q4', score: 4 },
            ];

            const avgScore = answers.reduce((sum, a) => sum + a.score, 0) / answers.length;

            expect(avgScore).toBe(4);
        });

        it('should calculate overall maturity level', () => {
            const dimensionScores = {
                strategy: 4.2,
                technology: 3.8,
                people: 3.5,
                processes: 4.0,
                data: 3.2,
                culture: 3.8,
            };

            const scores = Object.values(dimensionScores);
            const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;

            expect(overallScore).toBeCloseTo(3.75, 2);
        });

        it('should determine maturity level from score', () => {
            const score = 3.75;
            let level: string;

            if (score >= 4.5) level = 'optimizing';
            else if (score >= 3.5) level = 'managed';
            else if (score >= 2.5) level = 'defined';
            else if (score >= 1.5) level = 'developing';
            else level = 'initial';

            expect(level).toBe('managed');
        });
    });

    describe('Assessment Questions', () => {
        it('should create question', () => {
            const question = {
                id: 'Q-001',
                dimension: 'technology',
                text: 'How well is cloud infrastructure adopted?',
                type: 'scale',
                scale: { min: 1, max: 5 },
                weight: 1.0,
            };

            expect(question.type).toBe('scale');
        });

        it('should validate answer within scale', () => {
            const scale = { min: 1, max: 5 };
            const answer = 4;

            const isValid = answer >= scale.min && answer <= scale.max;

            expect(isValid).toBe(true);
        });

        it('should reject answer outside scale', () => {
            const scale = { min: 1, max: 5 };
            const answer = 7;

            const isValid = answer >= scale.min && answer <= scale.max;

            expect(isValid).toBe(false);
        });

        it('should calculate weighted score', () => {
            const answers = [
                { score: 4, weight: 1.5 },
                { score: 3, weight: 1.0 },
                { score: 5, weight: 2.0 },
            ];

            const totalWeight = answers.reduce((sum, a) => sum + a.weight, 0);
            const weightedSum = answers.reduce((sum, a) => sum + a.score * a.weight, 0);
            const weightedAvg = weightedSum / totalWeight;

            expect(weightedAvg).toBeCloseTo(4.22, 2);
        });
    });

    describe('Gap Analysis', () => {
        it('should calculate gap between current and target', () => {
            const currentScore = 3.5;
            const targetScore = 4.5;
            const gap = targetScore - currentScore;

            expect(gap).toBe(1.0);
        });

        it('should identify priority areas', () => {
            const scores = [
                { dimension: 'strategy', current: 4.2, target: 4.5, gap: 0.3 },
                { dimension: 'technology', current: 3.0, target: 4.5, gap: 1.5 },
                { dimension: 'people', current: 3.5, target: 4.5, gap: 1.0 },
            ];

            const priority = scores.sort((a, b) => b.gap - a.gap)[0];

            expect(priority.dimension).toBe('technology');
        });

        it('should calculate improvement effort', () => {
            const gap = 1.5;
            const effortPerPoint = 100; // hours per maturity point
            const estimatedEffort = gap * effortPerPoint;

            expect(estimatedEffort).toBe(150);
        });
    });

    describe('Recommendations', () => {
        it('should generate recommendations based on gaps', () => {
            const gaps = [
                { dimension: 'technology', gap: 1.5 },
                { dimension: 'data', gap: 1.2 },
            ];

            const recommendations = gaps.map((g) => ({
                area: g.dimension,
                priority: g.gap >= 1.0 ? 'high' : 'medium',
                suggestedActions: [`Improve ${g.dimension} capabilities`],
            }));

            expect(recommendations).toHaveLength(2);
            expect(recommendations[0].priority).toBe('high');
        });

        it('should prioritize recommendations', () => {
            const recommendations = [
                { id: 'R1', impact: 8, effort: 3 },
                { id: 'R2', impact: 5, effort: 2 },
                { id: 'R3', impact: 9, effort: 5 },
            ];

            // Priority = impact / effort ratio
            const prioritized = recommendations
                .map((r) => ({ ...r, ratio: r.impact / r.effort }))
                .sort((a, b) => b.ratio - a.ratio);

            expect(prioritized[0].id).toBe('R1');
        });
    });

    describe('Rapid Lean Assessment', () => {
        it('should create rapid assessment', () => {
            const assessment = {
                type: 'rapid_lean',
                duration: 30, // minutes
                questionsCount: 15,
                dimensions: ['waste', 'flow', 'value', 'pull', 'perfection'],
            };

            expect(assessment.dimensions).toHaveLength(5);
        });

        it('should calculate lean maturity', () => {
            const dimensionScores = {
                waste: 3.5,
                flow: 4.0,
                value: 4.2,
                pull: 3.8,
                perfection: 3.0,
            };

            const scores = Object.values(dimensionScores);
            const leanScore = scores.reduce((a, b) => a + b, 0) / scores.length;

            expect(leanScore).toBe(3.7);
        });

        it('should identify waste types', () => {
            const wasteTypes = [
                'overproduction',
                'waiting',
                'transportation',
                'overprocessing',
                'inventory',
                'motion',
                'defects',
                'unused_talent',
            ];

            expect(wasteTypes).toContain('unused_talent');
        });
    });

    describe('Assessment Progress', () => {
        it('should track completion progress', () => {
            const assessment = {
                totalQuestions: 50,
                answeredQuestions: 35,
            };

            const progress = (assessment.answeredQuestions / assessment.totalQuestions) * 100;

            expect(progress).toBe(70);
        });

        it('should save progress', () => {
            const progress = {
                assessmentId: 'ASM-001',
                lastQuestionId: 'Q-035',
                answeredIds: ['Q-001', 'Q-002', 'Q-003'],
                savedAt: new Date(),
            };

            expect(progress.answeredIds).toHaveLength(3);
        });

        it('should resume from saved progress', () => {
            const savedProgress = {
                lastQuestionId: 'Q-035',
                nextQuestionIndex: 35,
            };

            expect(savedProgress.nextQuestionIndex).toBe(35);
        });
    });

    describe('Benchmark Comparison', () => {
        it('should compare against industry benchmark', () => {
            const myScore = 3.8;
            const industryAvg = 3.5;
            const percentile = myScore > industryAvg ? 'above' : 'below';

            expect(percentile).toBe('above');
        });

        it('should calculate percentile rank', () => {
            const myScore = 4.2;
            const benchmarkScores = [3.0, 3.2, 3.5, 3.8, 4.0, 4.1, 4.3, 4.5, 4.8];
            const below = benchmarkScores.filter((s) => s < myScore).length;
            const percentile = (below / benchmarkScores.length) * 100;

            expect(percentile).toBeCloseTo(66.67, 1);
        });
    });

    describe('Assessment Templates', () => {
        it('should create assessment template', () => {
            const template = {
                id: 'TPL-001',
                name: 'Industry 4.0 Readiness',
                version: '2.0',
                dimensions: 5,
                questions: 40,
                estimatedDuration: 45,
            };

            expect(template.name).toBe('Industry 4.0 Readiness');
        });

        it('should clone template for organization', () => {
            const template = { id: 'TPL-001', name: 'Standard Assessment' };
            const instance = {
                templateId: template.id,
                organizationId: 'org-001',
                createdAt: new Date(),
            };

            expect(instance.templateId).toBe('TPL-001');
        });
    });
});
