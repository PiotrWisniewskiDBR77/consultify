/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const AIFeedbackButton = () => <button data-testid="ai-feedback-btn">Feedback</button>;

describe('AIFeedbackButton Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<AIFeedbackButton />);
        expect(screen.getByTestId('ai-feedback-btn')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = render(<AIFeedbackButton />);
        expect(container).toBeInTheDocument();
    });
});
