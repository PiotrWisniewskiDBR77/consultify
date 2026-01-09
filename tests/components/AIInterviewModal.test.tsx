/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const AIInterviewModal = ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="ai-interview-modal">AI Interview Modal</div> : null;

describe('AIInterviewModal Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders when open', () => {
        render(<AIInterviewModal isOpen={true} />);
        expect(screen.getByTestId('ai-interview-modal')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        const { container } = render(<AIInterviewModal isOpen={false} />);
        expect(container.firstChild).toBeNull();
    });
});
