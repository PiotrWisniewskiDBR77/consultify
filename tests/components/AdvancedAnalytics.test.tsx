/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BurnDownChart, VelocityChart } from '../../components/AdvancedAnalytics';

// Mock ResizeObserver
class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
}
global.ResizeObserver = ResizeObserver;

const mockBurnDown = [
    { week: 'W1', ideal: 10, planned: 10, actual: 9 },
    { week: 'W2', ideal: 8, planned: 8, actual: 7 }
];

const mockVelocity = [
    { week: 'W1', completed: 5, target: 5 },
    { week: 'W2', completed: 6, target: 5 }
];

describe('AdvancedAnalytics Components', () => {
    it('renders BurnDownChart', () => {
        render(<BurnDownChart data={mockBurnDown} />);
        expect(screen.getByText(/Burn-Down Chart/i)).toBeInTheDocument();
        expect(screen.getByText(/Track progress/i)).toBeInTheDocument();
    });

    it('renders VelocityChart', () => {
        render(<VelocityChart data={mockVelocity} />);
        expect(screen.getByText(/Team Velocity/i)).toBeInTheDocument();
        expect(screen.getByText(/completion rate/i)).toBeInTheDocument();
    });
});











