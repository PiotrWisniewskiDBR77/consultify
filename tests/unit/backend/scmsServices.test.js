/**
 * SCMS Services Unit Tests
 * 
 * Tests for SCMS (Supply Chain Management System) services.
 * 
 * @module tests/unit/backend/scmsServices.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create SCMS services implementation
const createScmsServices = () => {
    const assessments = new Map();
    const dimensions = new Map();
    const benchmarks = new Map();

    const defaultDimensions = [
        { id: 'planning', name: 'Planning & Strategy', weight: 0.2 },
        { id: 'sourcing', name: 'Sourcing & Procurement', weight: 0.2 },
        { id: 'operations', name: 'Operations & Production', weight: 0.25 },
        { id: 'logistics', name: 'Logistics & Distribution', weight: 0.2 },
        { id: 'technology', name: 'Technology & Integration', weight: 0.15 }
    ];

    return {
        // Create assessment
        createAssessment: async (data) => {
            if (!data.organizationId || !data.name) {
                throw new Error('Organization ID and name required');
            }

            const id = `scms-${Date.now()}`;
            const assessment = {
                id,
                organizationId: data.organizationId,
                name: data.name,
                type: data.type || 'maturity',
                status: 'draft',
                dimensions: defaultDimensions.map(d => ({
                    ...d,
                    score: null,
                    notes: ''
                })),
                overallScore: null,
                createdAt: new Date().toISOString(),
                createdBy: data.createdBy
            };

            assessments.set(id, assessment);
            return assessment;
        },

        // Get assessment
        getAssessment: async (id) => {
            return assessments.get(id) || null;
        },

        // Score dimension
        scoreDimension: async (assessmentId, dimensionId, score, notes = '') => {
            const assessment = assessments.get(assessmentId);
            if (!assessment) throw new Error('Assessment not found');

            if (score < 1 || score > 5) {
                throw new Error('Score must be between 1 and 5');
            }

            const dimension = assessment.dimensions.find(d => d.id === dimensionId);
            if (!dimension) throw new Error('Dimension not found');

            dimension.score = score;
            dimension.notes = notes;

            // Recalculate overall score
            const scoredDimensions = assessment.dimensions.filter(d => d.score !== null);
            if (scoredDimensions.length > 0) {
                const totalWeight = scoredDimensions.reduce((sum, d) => sum + d.weight, 0);
                assessment.overallScore = scoredDimensions.reduce(
                    (sum, d) => sum + (d.score * d.weight / totalWeight), 0
                );
            }

            assessments.set(assessmentId, assessment);
            return assessment;
        },

        // Complete assessment
        completeAssessment: async (assessmentId) => {
            const assessment = assessments.get(assessmentId);
            if (!assessment) throw new Error('Assessment not found');

            const unscored = assessment.dimensions.filter(d => d.score === null);
            if (unscored.length > 0) {
                throw new Error(`${unscored.length} dimensions not scored`);
            }

            assessment.status = 'completed';
            assessment.completedAt = new Date().toISOString();
            assessments.set(assessmentId, assessment);

            return assessment;
        },

        // Get maturity level
        getMaturityLevel: (score) => {
            if (score >= 4.5) return { level: 5, name: 'Optimizing' };
            if (score >= 3.5) return { level: 4, name: 'Managed' };
            if (score >= 2.5) return { level: 3, name: 'Defined' };
            if (score >= 1.5) return { level: 2, name: 'Repeatable' };
            return { level: 1, name: 'Initial' };
        },

        // Compare to benchmark
        compareToBenchmark: async (assessmentId, benchmarkId) => {
            const assessment = assessments.get(assessmentId);
            if (!assessment) throw new Error('Assessment not found');

            const benchmark = benchmarks.get(benchmarkId) || {
                id: 'industry_average',
                name: 'Industry Average',
                scores: {
                    planning: 3.2,
                    sourcing: 3.0,
                    operations: 3.5,
                    logistics: 3.1,
                    technology: 2.8
                },
                overall: 3.12
            };

            const comparison = {
                assessmentId,
                benchmarkId: benchmark.id,
                benchmarkName: benchmark.name,
                overallDiff: assessment.overallScore ? assessment.overallScore - benchmark.overall : null,
                dimensions: assessment.dimensions.map(d => ({
                    id: d.id,
                    name: d.name,
                    score: d.score,
                    benchmarkScore: benchmark.scores[d.id],
                    diff: d.score !== null ? d.score - benchmark.scores[d.id] : null
                }))
            };

            return comparison;
        },

        // Generate recommendations
        generateRecommendations: async (assessmentId) => {
            const assessment = assessments.get(assessmentId);
            if (!assessment) throw new Error('Assessment not found');

            const recommendations = [];

            for (const dimension of assessment.dimensions) {
                if (dimension.score !== null && dimension.score < 3) {
                    recommendations.push({
                        dimension: dimension.id,
                        dimensionName: dimension.name,
                        priority: dimension.score < 2 ? 'high' : 'medium',
                        currentScore: dimension.score,
                        targetScore: Math.min(5, dimension.score + 1),
                        type: 'improvement'
                    });
                }
            }

            return recommendations.sort((a, b) => {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });
        },

        // List assessments for organization
        listByOrganization: async (organizationId) => {
            return Array.from(assessments.values())
                .filter(a => a.organizationId === organizationId)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        },

        // Clear for testing
        clear: () => {
            assessments.clear();
            dimensions.clear();
            benchmarks.clear();
        }
    };
};

describe('ScmsServices', () => {
    let scmsServices;

    beforeEach(() => {
        scmsServices = createScmsServices();
    });

    describe('Assessment Creation', () => {
        it('should create an assessment', async () => {
            const assessment = await scmsServices.createAssessment({
                organizationId: 'org-1',
                name: 'Q4 Maturity Assessment',
                createdBy: 'user-1'
            });

            expect(assessment.id).toBeDefined();
            expect(assessment.status).toBe('draft');
            expect(assessment.dimensions).toHaveLength(5);
        });

        it('should require organization and name', async () => {
            await expect(scmsServices.createAssessment({}))
                .rejects.toThrow('Organization ID and name required');
        });
    });

    describe('Scoring', () => {
        let assessment;

        beforeEach(async () => {
            assessment = await scmsServices.createAssessment({
                organizationId: 'org-1',
                name: 'Test Assessment'
            });
        });

        it('should score a dimension', async () => {
            const updated = await scmsServices.scoreDimension(assessment.id, 'planning', 4, 'Good planning process');

            const planningDim = updated.dimensions.find(d => d.id === 'planning');
            expect(planningDim.score).toBe(4);
            expect(planningDim.notes).toBe('Good planning process');
        });

        it('should reject invalid scores', async () => {
            await expect(scmsServices.scoreDimension(assessment.id, 'planning', 6))
                .rejects.toThrow('Score must be between 1 and 5');
        });

        it('should calculate overall score', async () => {
            await scmsServices.scoreDimension(assessment.id, 'planning', 4);
            await scmsServices.scoreDimension(assessment.id, 'sourcing', 3);
            await scmsServices.scoreDimension(assessment.id, 'operations', 5);

            const updated = await scmsServices.getAssessment(assessment.id);
            expect(updated.overallScore).toBeGreaterThan(0);
        });
    });

    describe('Completion', () => {
        let assessment;

        beforeEach(async () => {
            assessment = await scmsServices.createAssessment({
                organizationId: 'org-1',
                name: 'Complete Me'
            });
        });

        it('should complete when all dimensions scored', async () => {
            await scmsServices.scoreDimension(assessment.id, 'planning', 4);
            await scmsServices.scoreDimension(assessment.id, 'sourcing', 3);
            await scmsServices.scoreDimension(assessment.id, 'operations', 5);
            await scmsServices.scoreDimension(assessment.id, 'logistics', 3);
            await scmsServices.scoreDimension(assessment.id, 'technology', 4);

            const completed = await scmsServices.completeAssessment(assessment.id);

            expect(completed.status).toBe('completed');
            expect(completed.completedAt).toBeDefined();
        });

        it('should reject incomplete assessments', async () => {
            await scmsServices.scoreDimension(assessment.id, 'planning', 4);

            await expect(scmsServices.completeAssessment(assessment.id))
                .rejects.toThrow('dimensions not scored');
        });
    });

    describe('Maturity Level', () => {
        it('should determine maturity level', () => {
            expect(scmsServices.getMaturityLevel(4.5).name).toBe('Optimizing');
            expect(scmsServices.getMaturityLevel(3.5).name).toBe('Managed');
            expect(scmsServices.getMaturityLevel(2.5).name).toBe('Defined');
            expect(scmsServices.getMaturityLevel(1.5).name).toBe('Repeatable');
            expect(scmsServices.getMaturityLevel(1.0).name).toBe('Initial');
        });
    });

    describe('Benchmarking', () => {
        it('should compare to benchmark', async () => {
            const assessment = await scmsServices.createAssessment({
                organizationId: 'org-1',
                name: 'Benchmark Test'
            });

            await scmsServices.scoreDimension(assessment.id, 'planning', 4);
            await scmsServices.scoreDimension(assessment.id, 'sourcing', 2);

            const comparison = await scmsServices.compareToBenchmark(assessment.id, 'industry_average');

            expect(comparison.benchmarkName).toBe('Industry Average');
            expect(comparison.dimensions.find(d => d.id === 'planning').diff).toBeGreaterThan(0);
            expect(comparison.dimensions.find(d => d.id === 'sourcing').diff).toBeLessThan(0);
        });
    });

    describe('Recommendations', () => {
        it('should generate improvement recommendations', async () => {
            const assessment = await scmsServices.createAssessment({
                organizationId: 'org-1',
                name: 'Recommendations Test'
            });

            await scmsServices.scoreDimension(assessment.id, 'planning', 4);
            await scmsServices.scoreDimension(assessment.id, 'sourcing', 1); // Low score
            await scmsServices.scoreDimension(assessment.id, 'operations', 2); // Medium-low

            const recommendations = await scmsServices.generateRecommendations(assessment.id);

            expect(recommendations.length).toBe(2);
            expect(recommendations[0].dimension).toBe('sourcing'); // Highest priority
            expect(recommendations[0].priority).toBe('high');
        });
    });
});
