/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrustStrip } from '../../../src/components/Landing/TrustStrip';

describe('TrustStrip Component', () => {
    it('renders trust strip', () => {
        render(<TrustStrip />);

        expect(screen.getByText(/Trusted/i) || screen.getByText(/Secure/i) || screen.getByText(/ISO/i)).toBeInTheDocument();
    });

    it('displays trust badges', () => {
        render(<TrustStrip />);

        const badges = screen.getAllByRole('img') || screen.getAllByText(/ISO|GDPR|SOC/i);
        expect(badges.length).toBeGreaterThan(0);
    });
});















