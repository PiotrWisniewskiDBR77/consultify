/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const ChangeRequestModal = ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="change-request-modal">Change Request Modal</div> : null;

describe('ChangeRequestModal Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders when open', () => {
        render(<ChangeRequestModal isOpen={true} />);
        expect(screen.getByTestId('change-request-modal')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        const { container } = render(<ChangeRequestModal isOpen={false} />);
        expect(container.firstChild).toBeNull();
    });
});
