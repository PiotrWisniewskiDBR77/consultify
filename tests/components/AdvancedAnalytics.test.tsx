/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdvancedAnalytics } from '../../../components/AdvancedAnalytics';

const mockData = {
    burnDown: [
        { week: 'W1', ideal: 10, planned: 10, actual: 9 },
        { week: 'W2', ideal: 8, planned: 8, actual: 7 }
    ],
    velocity: [
        { week: 'W1', completed: 5, target: 5 },
        { week: 'W2', completed: 6, target: 5 }
    ]
};

describe('AdvancedAnalytics Component', () => {
    it('renders advanced analytics', () => {
        render(<AdvancedAnalytics burnDownData={mockData.burnDown} velocityData={mockData.velocity} />);

        expect(screen.getByText(/Burn-Down/i) || screen.getByText(/Velocity/i)).toBeInTheDocument();
    });

    it('displays burn-down chart', () => {
        render(<AdvancedAnalytics burnDownData={mockData.burnDown} velocityData={mockData.velocity} />);

        expect(screen.getByText(/Burn-Down Chart/i)).toBeInTheDocument();
    });

    it('displays velocity chart', () => {
        render(<AdvancedAnalytics burnDownData={mockData.burnDown} velocityData={mockData.velocity} />);

        expect(screen.getByText(/Team Velocity/i)).toBeInTheDocument();
    });
});









