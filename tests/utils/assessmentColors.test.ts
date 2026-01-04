/**
 * Assessment Colors Utility Tests
 */
import { describe, it, expect } from 'vitest';
import {
    ACTUAL_COLORS,
    TARGET_COLORS,
    getAssessmentButtonClasses,
    getMatrixCellClasses,
    getLevelBubbleClasses,
    getStatusBadgeClasses,
    getScoreBadgeClasses,
    getLegendDotClasses
} from '../../utils/assessmentColors';

describe('Assessment Colors Utility', () => {
    describe('ACTUAL_COLORS', () => {
        it('defines primary background color', () => {
            expect(ACTUAL_COLORS.bg).toBe('bg-blue-600');
        });

        it('defines border color', () => {
            expect(ACTUAL_COLORS.border).toBe('border-blue-500');
        });

        it('defines text color', () => {
            expect(ACTUAL_COLORS.text).toBe('text-white');
        });

        it('defines hover states', () => {
            expect(ACTUAL_COLORS.hoverBg).toBe('hover:bg-blue-500');
            expect(ACTUAL_COLORS.hoverBorder).toBe('hover:border-blue-500');
        });

        it('defines dark mode variants', () => {
            expect(ACTUAL_COLORS.darkBg).toBe('dark:bg-blue-600');
        });

        it('defines shadow effects', () => {
            expect(ACTUAL_COLORS.shadow).toContain('shadow');
            expect(ACTUAL_COLORS.glow).toContain('shadow');
        });

        it('defines small element colors', () => {
            expect(ACTUAL_COLORS.dot).toBe('bg-blue-600');
            expect(ACTUAL_COLORS.ring).toBe('border-blue-500');
        });
    });

    describe('TARGET_COLORS', () => {
        it('defines primary background color', () => {
            expect(TARGET_COLORS.bg).toBe('bg-purple-600');
        });

        it('defines border color', () => {
            expect(TARGET_COLORS.border).toBe('border-purple-500');
        });

        it('defines dashed border variant', () => {
            expect(TARGET_COLORS.borderDashed).toContain('border-dashed');
        });

        it('defines text color', () => {
            expect(TARGET_COLORS.text).toBe('text-white');
        });

        it('defines neutral text color', () => {
            expect(TARGET_COLORS.textNeutral).toContain('text-purple-900');
            expect(TARGET_COLORS.textNeutral).toContain('dark:text-white');
        });

        it('defines shadow effects', () => {
            expect(TARGET_COLORS.shadow).toContain('shadow');
        });
    });

    describe('getAssessmentButtonClasses', () => {
        describe('actual type', () => {
            it('returns active classes when isActive is true', () => {
                const classes = getAssessmentButtonClasses('actual', true);

                expect(classes).toContain('bg-blue-600');
                expect(classes).toContain('border-blue-500');
                expect(classes).toContain('text-white');
                expect(classes).toContain('shadow');
            });

            it('returns inactive classes when isActive is false', () => {
                const classes = getAssessmentButtonClasses('actual', false);

                expect(classes).toContain('bg-slate-100');
                expect(classes).toContain('hover:border-blue-500');
                expect(classes).toContain('hover:bg-blue-50');
            });
        });

        describe('target type', () => {
            it('returns active classes when isActive is true', () => {
                const classes = getAssessmentButtonClasses('target', true);

                expect(classes).toContain('bg-purple-600');
                expect(classes).toContain('border-purple-500');
                expect(classes).toContain('text-white');
            });

            it('returns inactive classes when isActive is false', () => {
                const classes = getAssessmentButtonClasses('target', false);

                expect(classes).toContain('bg-slate-100');
                expect(classes).toContain('hover:border-purple-500');
                expect(classes).toContain('hover:bg-purple-50');
            });
        });
    });

    describe('getMatrixCellClasses', () => {
        it('returns actual cell classes', () => {
            const classes = getMatrixCellClasses(true, false);

            expect(classes).toContain('bg-blue-600');
            expect(classes).toContain('text-white');
            expect(classes).toContain('z-10');
            expect(classes).toContain('scale-105');
        });

        it('returns target cell classes', () => {
            const classes = getMatrixCellClasses(false, true);

            expect(classes).toContain('bg-purple-100');
            expect(classes).toContain('border-dashed');
        });

        it('returns default cell classes when neither actual nor target', () => {
            const classes = getMatrixCellClasses(false, false);

            expect(classes).toContain('bg-slate-50');
            expect(classes).toContain('hover:bg-slate-100');
        });

        it('prioritizes actual over target when both true', () => {
            const classes = getMatrixCellClasses(true, true);

            expect(classes).toContain('bg-blue-600');
            expect(classes).not.toContain('bg-purple-100');
        });
    });

    describe('getLevelBubbleClasses', () => {
        it('returns actual bubble classes', () => {
            const classes = getLevelBubbleClasses(true, false, false);

            expect(classes).toContain('border-blue-500');
            expect(classes).toContain('text-blue-400');
        });

        it('returns target bubble classes', () => {
            const classes = getLevelBubbleClasses(false, true, false);

            expect(classes).toContain('border-purple-400');
            expect(classes).toContain('text-purple-400');
        });

        it('returns gap bubble classes', () => {
            const classes = getLevelBubbleClasses(false, false, true);

            expect(classes).toContain('border-purple-500/30');
            expect(classes).toContain('text-purple-200/50');
        });

        it('returns default bubble classes when all false', () => {
            const classes = getLevelBubbleClasses(false, false, false);

            expect(classes).toContain('border-white/10');
            expect(classes).toContain('text-slate-600');
        });

        it('prioritizes actual over target and gap', () => {
            const classes = getLevelBubbleClasses(true, true, true);

            expect(classes).toContain('border-blue-500');
        });
    });

    describe('getStatusBadgeClasses', () => {
        it('returns actual badge classes', () => {
            const classes = getStatusBadgeClasses('actual');

            expect(classes).toContain('text-white');
            expect(classes).toContain('bg-blue-600');
            expect(classes).toContain('text-xs');
            expect(classes).toContain('font-bold');
            expect(classes).toContain('rounded-full');
        });

        it('returns target badge classes', () => {
            const classes = getStatusBadgeClasses('target');

            expect(classes).toContain('text-white');
            expect(classes).toContain('bg-purple-600');
            expect(classes).toContain('rounded-full');
        });
    });

    describe('getScoreBadgeClasses', () => {
        it('returns actual score badge classes', () => {
            const classes = getScoreBadgeClasses('actual');

            expect(classes).toContain('bg-blue-600');
            expect(classes).toContain('text-white');
            expect(classes).toContain('font-bold');
            expect(classes).toContain('rounded');
        });

        it('returns target score badge classes', () => {
            const classes = getScoreBadgeClasses('target');

            expect(classes).toContain('bg-purple-100');
            expect(classes).toContain('border-purple-500');
            expect(classes).toContain('font-bold');
        });
    });

    describe('getLegendDotClasses', () => {
        it('returns actual legend dot classes', () => {
            const classes = getLegendDotClasses('actual');

            expect(classes).toContain('w-2');
            expect(classes).toContain('h-2');
            expect(classes).toContain('rounded-full');
            expect(classes).toContain('bg-blue-600');
        });

        it('returns target legend dot classes', () => {
            const classes = getLegendDotClasses('target');

            expect(classes).toContain('w-2');
            expect(classes).toContain('h-2');
            expect(classes).toContain('rounded-full');
            expect(classes).toContain('border-purple-400');
        });
    });

    describe('Color Consistency', () => {
        it('actual colors use blue theme consistently', () => {
            expect(ACTUAL_COLORS.bg).toContain('blue');
            expect(ACTUAL_COLORS.border).toContain('blue');
            expect(ACTUAL_COLORS.hoverBg).toContain('blue');
            expect(ACTUAL_COLORS.dot).toContain('blue');
        });

        it('target colors use purple theme consistently', () => {
            expect(TARGET_COLORS.bg).toContain('purple');
            expect(TARGET_COLORS.border).toContain('purple');
            expect(TARGET_COLORS.hoverBg).toContain('purple');
            expect(TARGET_COLORS.dot).toContain('purple');
        });
    });
});











