/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoadmapGantt } from '../../../components/RoadmapGantt';

const mockInitiatives = [
    { id: 'init-1', name: 'Initiative 1', startDate: '2024-01-01', endDate: '2024-03-31' }
] as any;

describe('RoadmapGantt Component', () => {
    it('renders Gantt chart', () => {
        render(<RoadmapGantt initiatives={mockInitiatives} />);

        expect(screen.getByText(/Gantt/i) || screen.getByText(/Timeline/i)).toBeInTheDocument();
    });

    it('displays initiatives', () => {
        render(<RoadmapGantt initiatives={mockInitiatives} />);

        expect(screen.getByText('Initiative 1')).toBeInTheDocument();
    });
});



