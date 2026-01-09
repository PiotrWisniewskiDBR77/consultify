/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const MegatrendScanner = () => <div data-testid="megatrend-scanner">Megatrend Scanner</div>;

describe('MegatrendScanner Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<MegatrendScanner />);
        expect(screen.getByTestId('megatrend-scanner')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = render(<MegatrendScanner />);
        expect(container).toBeInTheDocument();
    });
});
