/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoModeModal } from '../../../components/Landing/DemoModeModal';

describe('DemoModeModal Component', () => {
    const user = userEvent.setup();

    it('renders modal when open', () => {
        render(<DemoModeModal isOpen={true} onClose={vi.fn()} />);

        expect(screen.getByText(/Demo/i) || screen.getByText(/Mode/i)).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        const { container } = render(<DemoModeModal isOpen={false} onClose={vi.fn()} />);
        expect(container.firstChild).toBeNull();
    });

    it('calls onClose when close clicked', async () => {
        const onClose = vi.fn();
        render(<DemoModeModal isOpen={true} onClose={onClose} />);

        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        expect(onClose).toHaveBeenCalled();
    });
});


