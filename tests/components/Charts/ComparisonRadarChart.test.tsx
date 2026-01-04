/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ComparisonRadarChart } from '../../components/Charts/ComparisonRadarChart';

const mockData = {
    current: [
        { label: 'Processes', value: 3 },
        { label: 'Digital', value: 4 }
    ],
    target: [
        { label: 'Processes', value: 5 },
        { label: 'Digital', value: 5 }
    ]
};

describe('ComparisonRadarChart Component', () => {
    it('renders comparison radar chart', () => {
        const { container } = render(<ComparisonRadarChart currentData={mockData.current} targetData={mockData.target} size={400} />);

        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('displays both current and target data', () => {
        const { container } = render(<ComparisonRadarChart currentData={mockData.current} targetData={mockData.target} size={400} />);

        const polygons = container.querySelectorAll('polygon');
        expect(polygons.length).toBeGreaterThanOrEqual(2); // At least current and target
    });
});










