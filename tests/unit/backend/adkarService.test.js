/**
 * ADKAR Service Unit Tests
 * Tests change management phases, scoring, and reporting
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ADKAR (Awareness, Desire, Knowledge, Ability, Reinforcement) Service
const createADKARService = () => {
    const assessments = new Map();
    const phases = ['awareness', 'desire', 'knowledge', 'ability', 'reinforcement'];
    let counter = 0;

    return {
        createAssessment: (projectId, userId) => {
            const id = `adkar-${Date.now()}-${++counter}`;
            const assessment = {
                id,
                projectId,
                userId,
                scores: {
                    awareness: 0,
                    desire: 0,
                    knowledge: 0,
                    ability: 0,
                    reinforcement: 0
                },
                status: 'draft',
                createdAt: new Date()
            };
            assessments.set(id, assessment);
            return assessment;
        },

        getAssessment: (id) => assessments.get(id) || null,

        updatePhaseScore: (assessmentId, phase, score) => {
            const assessment = assessments.get(assessmentId);
            if (!assessment) throw new Error('Assessment not found');
            if (!phases.includes(phase)) throw new Error('Invalid phase');
            if (score < 0 || score > 100) throw new Error('Score must be 0-100');

            assessment.scores[phase] = score;
            assessment.updatedAt = new Date();
            return assessment;
        },

        getOverallProgress: (assessmentId) => {
            const assessment = assessments.get(assessmentId);
            if (!assessment) return null;

            const scores = Object.values(assessment.scores);
            const total = scores.reduce((sum, s) => sum + s, 0);
            return Math.round(total / phases.length);
        },

        getWeakestPhase: (assessmentId) => {
            const assessment = assessments.get(assessmentId);
            if (!assessment) return null;

            let weakest = { phase: null, score: 101 };
            for (const [phase, score] of Object.entries(assessment.scores)) {
                if (score < weakest.score) {
                    weakest = { phase, score };
                }
            }
            return weakest;
        },

        generateReport: (assessmentId) => {
            const assessment = assessments.get(assessmentId);
            if (!assessment) throw new Error('Assessment not found');

            const progress = (Object.values(assessment.scores).reduce((a, b) => a + b, 0) / phases.length).toFixed(1);
            const weakest = Object.entries(assessment.scores)
                .sort((a, b) => a[1] - b[1])[0];

            return {
                assessmentId,
                overallProgress: parseFloat(progress),
                summary: `Overall readiness: ${progress}%`,
                weakestArea: weakest[0],
                recommendations: generateRecommendations(weakest[0], weakest[1]),
                generatedAt: new Date()
            };
        },

        getPhases: () => [...phases],

        completeAssessment: (assessmentId) => {
            const assessment = assessments.get(assessmentId);
            if (!assessment) throw new Error('Assessment not found');
            assessment.status = 'completed';
            assessment.completedAt = new Date();
            return assessment;
        }
    };
};

function generateRecommendations(phase, score) {
    const recommendations = {
        awareness: 'Increase communication about the change and its benefits',
        desire: 'Engage stakeholders and address concerns',
        knowledge: 'Provide training and learning resources',
        ability: 'Offer hands-on practice and coaching',
        reinforcement: 'Recognize achievements and measure progress'
    };
    return score < 50 ? [recommendations[phase]] : [];
}

describe('ADKARService', () => {
    let adkarService;

    beforeEach(() => {
        adkarService = createADKARService();
    });

    describe('Assessment Creation', () => {
        it('should create assessment', () => {
            const assessment = adkarService.createAssessment('proj-1', 'user-1');

            expect(assessment.id).toBeDefined();
            expect(assessment.projectId).toBe('proj-1');
            expect(assessment.status).toBe('draft');
        });

        it('should initialize all phase scores to 0', () => {
            const assessment = adkarService.createAssessment('proj-1', 'user-1');

            expect(assessment.scores.awareness).toBe(0);
            expect(assessment.scores.desire).toBe(0);
            expect(assessment.scores.knowledge).toBe(0);
            expect(assessment.scores.ability).toBe(0);
            expect(assessment.scores.reinforcement).toBe(0);
        });
    });

    describe('Phase Scoring', () => {
        it('should update phase score', () => {
            const assessment = adkarService.createAssessment('proj-1', 'user-1');
            adkarService.updatePhaseScore(assessment.id, 'awareness', 80);

            expect(adkarService.getAssessment(assessment.id).scores.awareness).toBe(80);
        });

        it('should reject invalid phase', () => {
            const assessment = adkarService.createAssessment('proj-1', 'user-1');

            expect(() => adkarService.updatePhaseScore(assessment.id, 'invalid', 50))
                .toThrow('Invalid phase');
        });

        it('should validate score range', () => {
            const assessment = adkarService.createAssessment('proj-1', 'user-1');

            expect(() => adkarService.updatePhaseScore(assessment.id, 'awareness', 150))
                .toThrow('Score must be 0-100');
        });
    });

    describe('Progress Tracking', () => {
        it('should calculate overall progress', () => {
            const assessment = adkarService.createAssessment('proj-1', 'user-1');
            adkarService.updatePhaseScore(assessment.id, 'awareness', 100);
            adkarService.updatePhaseScore(assessment.id, 'desire', 80);
            adkarService.updatePhaseScore(assessment.id, 'knowledge', 60);
            adkarService.updatePhaseScore(assessment.id, 'ability', 40);
            adkarService.updatePhaseScore(assessment.id, 'reinforcement', 20);

            const progress = adkarService.getOverallProgress(assessment.id);
            expect(progress).toBe(60); // Average of 100+80+60+40+20 = 300/5
        });

        it('should identify weakest phase', () => {
            const assessment = adkarService.createAssessment('proj-1', 'user-1');
            adkarService.updatePhaseScore(assessment.id, 'awareness', 90);
            adkarService.updatePhaseScore(assessment.id, 'desire', 30);
            adkarService.updatePhaseScore(assessment.id, 'knowledge', 70);

            const weakest = adkarService.getWeakestPhase(assessment.id);
            expect(weakest.phase).toBe('ability'); // Others are 0
        });
    });

    describe('Report Generation', () => {
        it('should generate report', () => {
            const assessment = adkarService.createAssessment('proj-1', 'user-1');
            adkarService.updatePhaseScore(assessment.id, 'awareness', 75);
            adkarService.updatePhaseScore(assessment.id, 'desire', 60);

            const report = adkarService.generateReport(assessment.id);

            expect(report.summary).toContain('%');
            expect(report.weakestArea).toBeDefined();
        });

        it('should provide recommendations for weak areas', () => {
            const assessment = adkarService.createAssessment('proj-1', 'user-1');
            // All phases at 0 (below 50)

            const report = adkarService.generateReport(assessment.id);
            expect(report.recommendations.length).toBeGreaterThan(0);
        });
    });

    describe('Assessment Completion', () => {
        it('should complete assessment', () => {
            const assessment = adkarService.createAssessment('proj-1', 'user-1');
            adkarService.completeAssessment(assessment.id);

            expect(adkarService.getAssessment(assessment.id).status).toBe('completed');
        });
    });
});
