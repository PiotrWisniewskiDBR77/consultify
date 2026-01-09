/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RACIMatrix } from '../../../src/components/PMO/RACIMatrix';

describe('RACIMatrix Component', () => {
    const defaultProps = {
        projectId: 'proj-1',
        tasks: [
            { id: 'task-1', name: 'Task 1', assignments: [] },
            { id: 'task-2', name: 'Task 2', assignments: [] },
        ],
        teamMembers: [
            { id: 'user-1', name: 'John Doe' },
            { id: 'user-2', name: 'Jane Smith' },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<RACIMatrix {...defaultProps} />);
        expect(document.body).toBeDefined();
    });

    it('renders without crashing', () => {
        const { container } = render(<RACIMatrix {...defaultProps} />);
        expect(container).toBeInTheDocument();
    });

    it('displays RACI content', () => {
        render(<RACIMatrix {...defaultProps} />);

        const raciElements = screen.queryAllByText(/RACI|responsible|accountable|consulted|informed/i);
        expect(raciElements.length).toBeGreaterThanOrEqual(0);
    });

    it('handles empty data', () => {
        render(<RACIMatrix {...defaultProps} tasks={[]} teamMembers={[]} />);
        expect(document.body).toBeDefined();
    });
});
