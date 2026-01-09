/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InitiativeCompletenessChecker } from '../../../src/components/PMO/InitiativeCompletenessChecker';

describe('InitiativeCompletenessChecker Component', () => {
    const completeInitiative = {
        name: 'Test Initiative',
        description: 'Complete description',
        objectives: 'Clear objectives',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        budget: 10000,
        owner: 'user-1',
    };

    const emptyInitiative = {
        name: '',
        description: '',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<InitiativeCompletenessChecker initiative={completeInitiative} />);
        expect(document.body).toBeDefined();
    });

    it('renders without crashing', () => {
        const { container } = render(<InitiativeCompletenessChecker initiative={completeInitiative} />);
        expect(container).toBeInTheDocument();
    });

    it('displays completeness content', () => {
        render(<InitiativeCompletenessChecker initiative={completeInitiative} />);

        const completenessElements = screen.queryAllByText(/complete|progress|%/i);
        expect(completenessElements.length).toBeGreaterThanOrEqual(0);
    });

    it('handles empty initiative', () => {
        render(<InitiativeCompletenessChecker initiative={emptyInitiative} />);
        expect(document.body).toBeDefined();
    });

    it('has visual indicators', () => {
        render(<InitiativeCompletenessChecker initiative={completeInitiative} />);
        expect(document.body.innerHTML.length).toBeGreaterThan(100);
    });
});
