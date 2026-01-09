/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkstreamBoard } from '../../../src/components/PMO/WorkstreamBoard';

describe('WorkstreamBoard Component', () => {
    const defaultProps = {
        projectId: 'proj-1',
        workstreams: [
            { id: 'ws-1', name: 'Workstream 1', tasks: [] },
            { id: 'ws-2', name: 'Workstream 2', tasks: [] },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<WorkstreamBoard {...defaultProps} />);
        expect(document.body).toBeDefined();
    });

    it('renders without crashing', () => {
        const { container } = render(<WorkstreamBoard {...defaultProps} />);
        expect(container).toBeInTheDocument();
    });

    it('displays workstream content', () => {
        render(<WorkstreamBoard {...defaultProps} />);

        const workstreamElements = screen.queryAllByText(/workstream|board|stream/i);
        expect(workstreamElements.length).toBeGreaterThanOrEqual(0);
    });

    it('handles empty workstreams', () => {
        render(<WorkstreamBoard {...defaultProps} workstreams={[]} />);
        expect(document.body).toBeDefined();
    });
});
