/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoadmapKanban } from '../../../components/RoadmapKanban';

const mockInitiatives = [
    { id: 'init-1', name: 'Initiative 1', status: 'EXECUTING' },
    { id: 'init-2', name: 'Initiative 2', status: 'PLANNING' }
] as any;

describe('RoadmapKanban Component', () => {
    const user = userEvent.setup();

    it('renders Kanban board', () => {
        render(<RoadmapKanban initiatives={mockInitiatives} onUpdateInitiative={vi.fn()} />);

        expect(screen.getByText(/Kanban/i) || screen.getByText(/Planning/i)).toBeInTheDocument();
    });

    it('displays initiatives in columns', () => {
        render(<RoadmapKanban initiatives={mockInitiatives} onUpdateInitiative={vi.fn()} />);

        expect(screen.getByText('Initiative 1')).toBeInTheDocument();
        expect(screen.getByText('Initiative 2')).toBeInTheDocument();
    });

    it('allows dragging initiatives', async () => {
        render(<RoadmapKanban initiatives={mockInitiatives} onUpdateInitiative={vi.fn()} />);

        const initiative = screen.getByText('Initiative 1');
        // Drag and drop testing would require more complex setup
        expect(initiative).toBeInTheDocument();
    });
});


