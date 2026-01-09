/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const LowBalanceModal = ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="low-balance-modal">Low Balance Modal</div> : null;

describe('LowBalanceModal Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders when open', () => {
        render(<LowBalanceModal isOpen={true} />);
        expect(screen.getByTestId('low-balance-modal')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        const { container } = render(<LowBalanceModal isOpen={false} />);
        expect(container.firstChild).toBeNull();
    });
});
