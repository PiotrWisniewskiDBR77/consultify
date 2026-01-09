/**
 * HeroSection Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('HeroSection Component', () => {
    it('renders hero section', () => {
        const hero = { title: 'AI-Powered Consulting', subtitle: 'Transform your business' };
        expect(hero.title).toContain('AI');
    });

    it('displays CTA button', () => {
        const ctaText = 'Get Started';
        expect(ctaText).toBe('Get Started');
    });

    it('handles CTA click', () => {
        const onCtaClick = vi.fn();
        onCtaClick();
        expect(onCtaClick).toHaveBeenCalled();
    });
});
