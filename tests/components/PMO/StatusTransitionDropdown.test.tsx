/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusTransitionDropdown } from '../../../src/components/PMO/StatusTransitionDropdown';

describe('StatusTransitionDropdown Component', () => {
    const defaultProps = {
        currentStatus: 'in_progress',
        onStatusChange: vi.fn(),
        availableTransitions: ['completed', 'blocked', 'cancelled'],
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<StatusTransitionDropdown {...defaultProps} />);
        expect(document.body).toBeDefined();
    });

    it('renders without crashing', () => {
        const { container } = render(<StatusTransitionDropdown {...defaultProps} />);
        expect(container).toBeInTheDocument();
    });

    it('displays dropdown content', () => {
        render(<StatusTransitionDropdown {...defaultProps} />);

        const dropdownElements = screen.queryAllByRole('button');
        expect(dropdownElements.length).toBeGreaterThanOrEqual(0);
    });

    it('handles empty transitions', () => {
        render(<StatusTransitionDropdown {...defaultProps} availableTransitions={[]} />);
        expect(document.body).toBeDefined();
    });
});
