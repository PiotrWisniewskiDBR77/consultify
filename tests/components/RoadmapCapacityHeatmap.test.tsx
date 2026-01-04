/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoadmapCapacityHeatmap } from '../../components/RoadmapCapacityHeatmap';

const mockData = {
    quarters: ['2024-Q1', '2024-Q2'],
    users: [
        { id: 'user-1', name: 'John', capacity: { '2024-Q1': 80, '2024-Q2': 90 } }
    ]
};

describe('RoadmapCapacityHeatmap Component', () => {
    it('renders capacity heatmap', () => {
        render(<RoadmapCapacityHeatmap data={mockData} />);

        expect(screen.getByText(/Capacity/i) || screen.getByText(/Heatmap/i)).toBeInTheDocument();
    });

    it('displays user capacity data', () => {
        render(<RoadmapCapacityHeatmap data={mockData} />);

        expect(screen.getByText(/John/i) || screen.getByText(/80/i)).toBeInTheDocument();
    });
});














