import { describe, it, expect } from 'vitest';
import { recommendScenario, SCENARIOS } from '../../data/transformationScenarios';

describe('Transformation Scenarios Logic', () => {
    it('should have 6 unique scenarios', () => {
        const ids = new Set(SCENARIOS.map(s => s.id));
        expect(ids.size).toBe(6);
        expect(SCENARIOS.length).toBe(6);
    });

    it('recommendScenario should return stabilize for high risk & low budget', () => {
        const challenges: unknown[] = [];
        const profile = {
            activeConstraints: ['a', 'b', 'c', 'd'], // > 3
            budget: 'Low'
        };
        const recommendation = recommendScenario(challenges, profile);
        expect(recommendation).toBe('stabilize');
    });

    it('recommendScenario should return quickwins for low risk & low budget', () => {
        const challenges: unknown[] = [];
        const profile = {
            activeConstraints: ['a'], // <= 3
            budget: 'Low'
        };
        const recommendation = recommendScenario(challenges, profile);
        expect(recommendation).toBe('quickwins');
    });

    it('recommendScenario should return foundation for high risk & high budget', () => {
        const challenges: unknown[] = [];
        const profile = {
            activeConstraints: ['a', 'b', 'c', 'd'], // > 3
            budget: 'High'
        };
        const recommendation = recommendScenario(challenges, profile);
        expect(recommendation).toBe('foundation');
    });

    it('recommendScenario should default to hybrid', () => {
        const challenges: unknown[] = [];
        const profile = {
            activeConstraints: ['a'],
            budget: 'High'
        };
        const recommendation = recommendScenario(challenges, profile);
        expect(recommendation).toBe('hybrid');
    });
});
