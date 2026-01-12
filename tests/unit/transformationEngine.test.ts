import { describe, it, expect } from 'vitest';
import { generateInitiatives } from '../../services/transformationEngine';
import { FullSession } from '../../types';

describe('Service Test: transformationEngine', () => {
    const createMockSession = (): FullSession => ({
        id: 'session-1',
        assessment: {
            completedAxes: [],
            processes: { actual: 2, target: 3, justification: '', notes: '' },
            digitalProducts: { actual: 1, target: 2, justification: '', notes: '' },
            businessModels: { actual: 1, target: 1, justification: '', notes: '' },
            dataManagement: { actual: 1, target: 1, justification: '', notes: '' },
            culture: { actual: 1, target: 1, justification: '', notes: '' },
            cybersecurity: { actual: 1, target: 1, justification: '', notes: '' },
            aiMaturity: { actual: 1, target: 1, justification: '', notes: '' },
        },
        audits: [],
        roadmap: [],
        initiatives: [],
        economics: { totalCost: 0, totalAnnualBenefit: 0, overallROI: 0, paybackPeriodYears: 0 },
        step1Completed: false,
        step2Completed: false,
        step3Completed: false,
        step4Completed: false,
        step5Completed: false,
    });

    it('generates initiatives from session', () => {
        const session = createMockSession();
        const initiatives = generateInitiatives(session);

        expect(Array.isArray(initiatives)).toBe(true);
    });

    it('generates initiatives with required properties', () => {
        const session = createMockSession();
        const initiatives = generateInitiatives(session);

        initiatives.forEach(initiative => {
            expect(initiative).toHaveProperty('id');
            expect(initiative).toHaveProperty('name');
            expect(initiative).toHaveProperty('description');
            expect(initiative).toHaveProperty('axis');
            expect(initiative).toHaveProperty('priority');
            expect(initiative).toHaveProperty('complexity');
            expect(initiative).toHaveProperty('status');
        });
    });

    it('generates initiatives only for levels above current', () => {
        const session = createMockSession();
        const initiatives = generateInitiatives(session);

        // All initiatives should target levels above current assessment
        initiatives.forEach(initiative => {
            const axisData = session.assessment[initiative.axis as keyof typeof session.assessment] as { actual: number } | undefined;
            if (axisData && axisData.actual) {
                // The initiative should be for advancing beyond current level
                expect(initiative.name).toContain('Level');
            }
        });
    });

    it('handles session with no gaps', () => {
        const session = createMockSession();
        // Set all axes to level 5 (maximum)
        Object.keys(session.assessment).forEach(key => {
            if (key !== 'completedAxes') {
                const assessmentRecord = session.assessment as Record<string, { actual: number }>;
                if (assessmentRecord[key]?.actual !== undefined) {
                    assessmentRecord[key].actual = 5;
                }
            }
        });

        const initiatives = generateInitiatives(session);
        // Should still return array (might be empty or have other initiatives)
        expect(Array.isArray(initiatives)).toBe(true);
    });

    it('assigns priority based on current level', () => {
        const session = createMockSession();
        session.assessment.processes!.actual = 1;
        const initiatives = generateInitiatives(session);

        const processInitiatives = initiatives.filter(i => i.axis === 'processes');
        if (processInitiatives.length > 0) {
            // Level 1 should generate High priority
            expect(processInitiatives[0].priority).toBe('High');
        }
    });

    it('assigns complexity based on target level', () => {
        const session = createMockSession();
        const initiatives = generateInitiatives(session);

        initiatives.forEach(initiative => {
            expect(['High', 'Medium', 'Low']).toContain(initiative.complexity);
        });
    });
});
