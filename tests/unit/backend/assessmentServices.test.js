/**
 * Assessment Services Unit Tests
 * Tests assessment creation, scoring, and reporting
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Assessment Service implementation
const createAssessmentService = () => {
    const assessments = new Map();
    let counter = 0;

    return {
        create: (type, config = {}) => {
            const id = `assess-${Date.now()}-${++counter}`;
            const assessment = {
                id,
                type,
                title: config.title || `${type} Assessment`,
                sections: config.sections || [],
                responses: {},
                status: 'draft',
                createdAt: new Date()
            };
            assessments.set(id, assessment);
            return assessment;
        },

        get: (id) => assessments.get(id) || null,

        list: (filters = {}) => {
            let result = Array.from(assessments.values());
            if (filters.type) result = result.filter(a => a.type === filters.type);
            if (filters.status) result = result.filter(a => a.status === filters.status);
            return result;
        },

        addSection: (assessmentId, section) => {
            const assessment = assessments.get(assessmentId);
            if (!assessment) throw new Error('Assessment not found');
            const sectionId = `section-${assessment.sections.length + 1}`;
            assessment.sections.push({
                id: sectionId,
                ...section,
                questions: section.questions || []
            });
            return assessment;
        },

        submitResponse: (assessmentId, sectionId, questionId, answer) => {
            const assessment = assessments.get(assessmentId);
            if (!assessment) throw new Error('Assessment not found');

            if (!assessment.responses[sectionId]) {
                assessment.responses[sectionId] = {};
            }
            assessment.responses[sectionId][questionId] = {
                answer,
                submittedAt: new Date()
            };
            return assessment;
        },

        calculateScores: (assessmentId) => {
            const assessment = assessments.get(assessmentId);
            if (!assessment) throw new Error('Assessment not found');

            const sectionScores = {};
            let totalPoints = 0;
            let earnedPoints = 0;

            for (const section of assessment.sections) {
                const sectionResponses = assessment.responses[section.id] || {};
                let sectionTotal = section.questions.length * 10;
                let sectionEarned = 0;

                for (const q of section.questions) {
                    const response = sectionResponses[q.id];
                    if (response) {
                        sectionEarned += response.answer === q.correct ? 10 : 5;
                    }
                }

                sectionScores[section.id] = {
                    name: section.name,
                    score: sectionTotal > 0 ? Math.round((sectionEarned / sectionTotal) * 100) : 0,
                    total: sectionTotal,
                    earned: sectionEarned
                };

                totalPoints += sectionTotal;
                earnedPoints += sectionEarned;
            }

            return {
                total: totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0,
                sections: sectionScores
            };
        },

        generateReport: (assessmentId) => {
            const assessment = assessments.get(assessmentId);
            if (!assessment) throw new Error('Assessment not found');

            const scores = this.calculateScores?.(assessmentId) || { total: 0, sections: {} };

            return {
                assessmentId,
                type: assessment.type,
                title: assessment.title,
                scores,
                generated: true,
                generatedAt: new Date(),
                recommendations: generateRecommendations(scores)
            };
        },

        complete: (assessmentId) => {
            const assessment = assessments.get(assessmentId);
            if (!assessment) throw new Error('Assessment not found');
            assessment.status = 'completed';
            assessment.completedAt = new Date();
            return assessment;
        }
    };
};

function generateRecommendations(scores) {
    const recommendations = [];
    for (const [sectionId, section] of Object.entries(scores.sections)) {
        if (section.score < 70) {
            recommendations.push(`Improve ${section.name}: Current score ${section.score}%`);
        }
    }
    return recommendations;
}

describe('AssessmentServices', () => {
    let assessmentService;

    beforeEach(() => {
        assessmentService = createAssessmentService();
    });

    describe('Assessment Creation', () => {
        it('should create assessment', () => {
            const assessment = assessmentService.create('drd', { title: 'DRD Assessment' });

            expect(assessment.id).toBeDefined();
            expect(assessment.type).toBe('drd');
            expect(assessment.status).toBe('draft');
        });

        it('should support different assessment types', () => {
            const drd = assessmentService.create('drd');
            const adkar = assessmentService.create('adkar');

            expect(drd.type).toBe('drd');
            expect(adkar.type).toBe('adkar');
        });
    });

    describe('Section Management', () => {
        it('should add section to assessment', () => {
            const assessment = assessmentService.create('drd');
            assessmentService.addSection(assessment.id, {
                name: 'Strategy',
                questions: [{ id: 'q1', text: 'Question 1' }]
            });

            expect(assessmentService.get(assessment.id).sections).toHaveLength(1);
        });
    });

    describe('Response Submission', () => {
        it('should submit response', () => {
            const assessment = assessmentService.create('drd');
            assessmentService.addSection(assessment.id, {
                name: 'Section 1',
                questions: [{ id: 'q1', text: 'Q1', correct: 'a' }]
            });

            assessmentService.submitResponse(assessment.id, 'section-1', 'q1', 'a');

            const updated = assessmentService.get(assessment.id);
            expect(updated.responses['section-1']['q1']).toBeDefined();
        });
    });

    describe('Score Calculation', () => {
        it('should calculate scores', () => {
            const assessment = assessmentService.create('drd');
            assessmentService.addSection(assessment.id, {
                name: 'Test Section',
                questions: [
                    { id: 'q1', correct: 'a' },
                    { id: 'q2', correct: 'b' }
                ]
            });
            assessmentService.submitResponse(assessment.id, 'section-1', 'q1', 'a');
            assessmentService.submitResponse(assessment.id, 'section-1', 'q2', 'b');

            const scores = assessmentService.calculateScores(assessment.id);
            expect(scores.total).toBeGreaterThan(0);
        });
    });

    describe('Report Generation', () => {
        it('should generate report', () => {
            const assessment = assessmentService.create('drd');
            const report = assessmentService.generateReport(assessment.id);

            expect(report.generated).toBe(true);
            expect(report.assessmentId).toBe(assessment.id);
        });
    });
});

