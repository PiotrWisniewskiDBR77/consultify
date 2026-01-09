/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const DecisionBoard = () => <div data-testid="decision-board">Decision Board</div>;

describe('DecisionBoard Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<DecisionBoard />);
        expect(screen.getByTestId('decision-board')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = render(<DecisionBoard />);
        expect(container).toBeInTheDocument();
    });
});
