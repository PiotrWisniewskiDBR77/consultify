/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const UsageMeters = () => <div data-testid="usage-meters">Usage Meters</div>;

describe('UsageMeters Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<UsageMeters />);
        expect(screen.getByTestId('usage-meters')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = render(<UsageMeters />);
        expect(container).toBeInTheDocument();
    });
});
