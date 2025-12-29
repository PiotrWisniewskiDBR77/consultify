/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeroSection } from '../../../components/Landing/HeroSection';

describe('HeroSection Component', () => {
    const user = userEvent.setup();

    it('renders hero section', () => {
        render(<HeroSection />);

        expect(screen.getByText(/Consultify/i) || screen.getByText(/Digital/i)).toBeInTheDocument();
    });

    it('displays CTA button', () => {
        render(<HeroSection />);

        expect(screen.getByRole('button', { name: /Start/i }) || screen.getByRole('button', { name: /Get Started/i })).toBeInTheDocument();
    });

    it('handles CTA click', async () => {
        render(<HeroSection />);

        const ctaButton = screen.getByRole('button', { name: /Start/i }) || screen.getByRole('button', { name: /Get Started/i });
        await user.click(ctaButton);
        // Should navigate or trigger action
    });
});

