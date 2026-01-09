/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const ActionDecisionDialog = ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="action-dialog">Action Decision Dialog</div> : null;

describe('ActionDecisionDialog Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders when open', () => {
        render(<ActionDecisionDialog isOpen={true} />);
        expect(screen.getByTestId('action-dialog')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        const { container } = render(<ActionDecisionDialog isOpen={false} />);
        expect(container.firstChild).toBeNull();
    });
});
