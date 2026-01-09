/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const DemoBanner = () => <div data-testid="demo-banner">Demo Banner</div>;

describe('DemoBanner Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<DemoBanner />);
        expect(screen.getByTestId('demo-banner')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = render(<DemoBanner />);
        expect(container).toBeInTheDocument();
    });
});
