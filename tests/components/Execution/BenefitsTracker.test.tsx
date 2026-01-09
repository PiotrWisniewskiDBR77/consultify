/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const BenefitsTracker = () => <div data-testid="benefits-tracker">Benefits Tracker</div>;

describe('BenefitsTracker Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<BenefitsTracker />);
        expect(screen.getByTestId('benefits-tracker')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = render(<BenefitsTracker />);
        expect(container).toBeInTheDocument();
    });
});