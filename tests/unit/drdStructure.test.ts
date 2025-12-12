import { describe, it, expect } from 'vitest';
import { DRD_STRUCTURE, getQuestionsForAxis } from '../../services/drdStructure';

describe('Service Test: drdStructure', () => {
    it('exports DRD_STRUCTURE as array', () => {
        expect(Array.isArray(DRD_STRUCTURE)).toBe(true);
        expect(DRD_STRUCTURE.length).toBeGreaterThan(0);
    });

    it('each axis has required properties', () => {
        DRD_STRUCTURE.forEach(axis => {
            expect(axis).toHaveProperty('id');
            expect(axis).toHaveProperty('name');
            expect(axis).toHaveProperty('areas');
            expect(Array.isArray(axis.areas)).toBe(true);
        });
    });

    it('each area has required properties', () => {
        DRD_STRUCTURE.forEach(axis => {
            axis.areas.forEach(area => {
                expect(area).toHaveProperty('id');
                expect(area).toHaveProperty('name');
                expect(area).toHaveProperty('levels');
                expect(Array.isArray(area.levels)).toBe(true);
            });
        });
    });

    it('each level has required properties', () => {
        DRD_STRUCTURE.forEach(axis => {
            axis.areas.forEach(area => {
                area.levels.forEach(level => {
                    expect(level).toHaveProperty('level');
                    expect(level).toHaveProperty('title');
                    expect(level).toHaveProperty('description');
                });
            });
        });
    });

    describe('getQuestionsForAxis', () => {
        it('returns areas for valid axis ID', () => {
            const areas = getQuestionsForAxis(1);
            expect(Array.isArray(areas)).toBe(true);
        });

        it('returns empty array for invalid axis ID', () => {
            const areas = getQuestionsForAxis(999);
            expect(areas).toEqual([]);
        });

        it('returns areas for different axis IDs', () => {
            [1, 2, 3, 4, 5, 6, 7].forEach(axisId => {
                const areas = getQuestionsForAxis(axisId);
                expect(Array.isArray(areas)).toBe(true);
            });
        });
    });
});

