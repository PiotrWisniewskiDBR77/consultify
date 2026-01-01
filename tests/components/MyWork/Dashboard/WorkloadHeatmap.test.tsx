/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkloadHeatmap } from '../../../components/MyWork/Dashboard/WorkloadHeatmap';

const mockData = {
    weeks: ['2024-W1', '2024-W2'],
    users: [
        { id: 'user-1', name: 'John', workload: { '2024-W1': 40, '2024-W2': 35 } }
    ]
};

describe('WorkloadHeatmap Component', () => {
    it('renders workload heatmap', () => {
        render(<WorkloadHeatmap data={mockData} />);

        expect(screen.getByText(/Workload/i) || screen.getByText(/Heatmap/i)).toBeInTheDocument();
    });
});


