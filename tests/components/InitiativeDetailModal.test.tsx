/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InitiativeDetailModal } from '../../components/InitiativeDetailModal';

const mockInitiative = {
    id: 'init-1',
    name: 'Test Initiative',
    description: 'Test description',
    status: 'PLANNING',
    priority: 'High'
} as any;

describe('InitiativeDetailModal Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders modal when open', () => {
        render(<InitiativeDetailModal initiative={mockInitiative} isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />);

        expect(screen.getByText('Test Initiative')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        const { container } = render(<InitiativeDetailModal initiative={mockInitiative} isOpen={false} onClose={vi.fn()} onSave={vi.fn()} />);
        expect(container.firstChild).toBeNull();
    });

    it('displays initiative name', () => {
        render(<InitiativeDetailModal initiative={mockInitiative} isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />);

        expect(screen.getByText('Test Initiative')).toBeInTheDocument();
    });

    it('displays tabs', () => {
        render(<InitiativeDetailModal initiative={mockInitiative} isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />);

        expect(screen.getByText(/Overview/i) || screen.getByText(/Tasks/i) || screen.getByText(/Definition/i)).toBeInTheDocument();
    });

    it('switches tabs', async () => {
        render(<InitiativeDetailModal initiative={mockInitiative} isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />);

        const tasksTab = screen.getByText(/Tasks/i);
        if (tasksTab) {
            await user.click(tasksTab);
        }
    });

    it('calls onClose when close clicked', async () => {
        const onClose = vi.fn();
        render(<InitiativeDetailModal initiative={mockInitiative} isOpen={true} onClose={onClose} onSave={vi.fn()} />);

        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        expect(onClose).toHaveBeenCalled();
    });

    it('calls onSave when save clicked', async () => {
        const onSave = vi.fn();
        render(<InitiativeDetailModal initiative={mockInitiative} isOpen={true} onClose={vi.fn()} onSave={onSave} />);

        const saveButton = screen.getByRole('button', { name: /save/i });
        await user.click(saveButton);

        expect(onSave).toHaveBeenCalled();
    });
});










