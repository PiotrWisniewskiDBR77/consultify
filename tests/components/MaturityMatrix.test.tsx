/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MaturityMatrix } from '../../../components/MaturityMatrix';

const mockData = {
    axes: [
        { id: 'processes', label: 'Processes', score: 3 },
        { id: 'digital', label: 'Digital', score: 4 }
    ],
    currentScores: { processes: 3, digital: 4 },
    targetScores: { processes: 5, digital: 5 }
};

describe('MaturityMatrix Component', () => {
    it('renders maturity matrix', () => {
        render(<MaturityMatrix data={mockData} />);

        expect(screen.getByText(/Maturity/i) || screen.getByText(/Matrix/i)).toBeInTheDocument();
    });

    it('displays axis scores', () => {
        render(<MaturityMatrix data={mockData} />);

        expect(screen.getByText(/Processes/i) || screen.getByText(/Digital/i)).toBeInTheDocument();
    });
});

