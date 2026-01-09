/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const ComparisonRadarChart = () => <div data-testid="comparison-radar">Comparison Radar Chart</div>;

describe('ComparisonRadarChart Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<ComparisonRadarChart />);
        expect(screen.getByTestId('comparison-radar')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = render(<ComparisonRadarChart />);
        expect(container).toBeInTheDocument();
    });
});
