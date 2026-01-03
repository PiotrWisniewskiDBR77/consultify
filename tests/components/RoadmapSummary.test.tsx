/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoadmapSummary } from '../../../components/RoadmapSummary';

const mockInitiatives = [
    { id: 'init-1', name: 'Initiative 1', quarter: '2024-Q1', status: 'EXECUTING' },
    { id: 'init-2', name: 'Initiative 2', quarter: '2024-Q2', status: 'PLANNING' }
] as any;

describe('RoadmapSummary Component', () => {
    it('renders roadmap summary', () => {
        render(<RoadmapSummary initiatives={mockInitiatives} />);

        expect(screen.getByText(/Roadmap/i) || screen.getByText(/Summary/i)).toBeInTheDocument();
    });

    it('displays initiative count', () => {
        render(<RoadmapSummary initiatives={mockInitiatives} />);

        expect(screen.getByText(/2/i)).toBeInTheDocument();
    });
});








