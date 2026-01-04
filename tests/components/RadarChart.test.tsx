/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RadarChart } from '../../components/RadarChart';

const mockData = [
    { label: 'Processes', value: 3 },
    { label: 'Digital', value: 4 },
    { label: 'Data', value: 2 }
];

describe('RadarChart Component', () => {
    it('renders radar chart', () => {
        const { container } = render(<RadarChart data={mockData} size={400} />);

        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('displays chart with correct size', () => {
        const { container } = render(<RadarChart data={mockData} size={400} />);

        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('width', '400');
        expect(svg).toHaveAttribute('height', '400');
    });

    it('renders data points', () => {
        const { container } = render(<RadarChart data={mockData} size={400} />);

        const polygons = container.querySelectorAll('polygon');
        expect(polygons.length).toBeGreaterThan(0);
    });
});










