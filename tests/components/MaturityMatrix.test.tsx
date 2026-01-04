/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MaturityMatrix } from '../../components/MaturityMatrix';

vi.mock('../../services/drdStructure', () => ({
    getQuestionsForAxis: () => [
        { id: 'area-1', name: 'Processes', levels: [{ level: 1, title: 'L1', description: 'Desc' }] },
        { id: 'area-2', name: 'Digital', levels: [{ level: 1, title: 'L1', description: 'Desc' }] }
    ]
}));

const mockScores = {
    'area-1': [1],
    'area-2': [2]
};

describe('MaturityMatrix Component', () => {
    it('renders maturity matrix', () => {
        render(<MaturityMatrix
            axisId={1}
            axisKey="processes"
            currentScores={mockScores}
            onScoreSelect={vi.fn()}
            onComplete={vi.fn()}
        />);

        expect(screen.getAllByText(/Processes/i)[0]).toBeInTheDocument();
        expect(screen.getByText(/Digital/i)).toBeInTheDocument();
    });

    it('displays axis scores and progress', () => {
        render(<MaturityMatrix
            axisId={1}
            axisKey="processes"
            currentScores={mockScores}
            onScoreSelect={vi.fn()}
            onComplete={vi.fn()}
        />);

        expect(screen.getByText(/2 of 2 Areas Evaluated/i)).toBeInTheDocument();
    });
});














