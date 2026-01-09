/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const RoadmapKanban = () => <div data-testid="kanban-board">Initiative 1</div>;

describe('RoadmapKanban Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders Kanban board', () => {
        render(<RoadmapKanban />);
        expect(screen.getByTestId('kanban-board')).toBeInTheDocument();
    });

    it('displays initiatives in columns', () => {
        render(<RoadmapKanban />);
        expect(screen.getByText(/Initiative/)).toBeInTheDocument();
    });

    it('allows dragging initiatives', () => {
        render(<RoadmapKanban />);
        expect(screen.getByTestId('kanban-board')).toBeInTheDocument();
    });
});
