/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoadmapSummary } from '../../components/RoadmapSummary';

const mockSummary = {
    summaryText: 'Strategic implementation focusing on digital transformation.',
    riskText: 'Resource constraints.',
    recommendation: 'Hire more devs.'
};

describe('RoadmapSummary Component', () => {
    it('renders roadmap summary', () => {
        render(<RoadmapSummary summary={mockSummary} />);

        expect(screen.getByText(/Strategic Roadmap Summary/i)).toBeInTheDocument();
        expect(screen.getByText(/Strategic implementation/i)).toBeInTheDocument();
    });

    it('displays risks', () => {
        render(<RoadmapSummary summary={mockSummary} />);

        expect(screen.getByText(/Key Risk/i)).toBeInTheDocument();
        expect(screen.getByText(/Resource constraints/i)).toBeInTheDocument();
    });
});














