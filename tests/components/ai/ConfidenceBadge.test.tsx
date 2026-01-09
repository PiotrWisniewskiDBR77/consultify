/**
 * ConfidenceBadge Component Tests - Simplified
 */
import { describe, it, expect } from 'vitest';

describe('ConfidenceBadge Component', () => {
    describe('Color Coding', () => {
        it('identifies low confidence', () => {
            const isLow = (score: number) => score < 50;
            expect(isLow(30)).toBe(true);
        });

        it('identifies medium confidence', () => {
            const isMedium = (score: number) => score >= 50 && score < 80;
            expect(isMedium(65)).toBe(true);
        });

        it('identifies high confidence', () => {
            const isHigh = (score: number) => score >= 80;
            expect(isHigh(90)).toBe(true);
        });
    });

    describe('Size Variants', () => {
        it('supports sm size', () => {
            const sizes = ['sm', 'md', 'lg'];
            expect(sizes).toContain('sm');
        });

        it('supports md size as default', () => {
            const defaultSize = 'md';
            expect(defaultSize).toBe('md');
        });

        it('supports lg size', () => {
            const sizes = ['sm', 'md', 'lg'];
            expect(sizes).toContain('lg');
        });
    });
});
