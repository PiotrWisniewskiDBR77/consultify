/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkloadChart } from '../../components/WorkloadChart';

const mockInitiatives = [
    { id: 'init-1', quarter: '2024-Q1', effortProfile: { analytical: 2, operational: 1, change: 1 } },
    { id: 'init-2', quarter: '2024-Q1', effortProfile: { analytical: 1, operational: 2, change: 1 } }
] as any;

const mockQuarters = ['2024-Q1', '2024-Q2', '2024-Q3', '2024-Q4'];

describe('WorkloadChart Component', () => {
    it('renders workload chart', () => {
        render(<WorkloadChart initiatives={mockInitiatives} quarters={mockQuarters} />);

        expect(screen.getByText(/Workload/i) || screen.getByText(/Quarter/i)).toBeInTheDocument();
    });

    it('displays chart with data', () => {
        const { container } = render(<WorkloadChart initiatives={mockInitiatives} quarters={mockQuarters} />);

        expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
    });
});










