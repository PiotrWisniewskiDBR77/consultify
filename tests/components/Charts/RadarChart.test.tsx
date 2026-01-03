/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RadarChart } from '../../../components/Charts/RadarChart';

const mockData = [
    { label: 'Processes', value: 3 },
    { label: 'Digital', value: 4 }
];

describe('Charts RadarChart Component', () => {
    it('renders radar chart', () => {
        const { container } = render(<RadarChart data={mockData} size={400} />);

        expect(container.querySelector('svg')).toBeInTheDocument();
    });
});









