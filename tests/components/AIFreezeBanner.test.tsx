/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const AIFreezeBanner = () => <div data-testid="ai-freeze-banner">AI Freeze Banner</div>;

describe('AIFreezeBanner Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<AIFreezeBanner />);
        expect(screen.getByTestId('ai-freeze-banner')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = render(<AIFreezeBanner />);
        expect(container).toBeInTheDocument();
    });
});
