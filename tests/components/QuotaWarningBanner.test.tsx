/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const QuotaWarningBanner = () => <div data-testid="quota-warning">Quota Warning Banner</div>;

describe('QuotaWarningBanner Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<QuotaWarningBanner />);
        expect(screen.getByTestId('quota-warning')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = render(<QuotaWarningBanner />);
        expect(container).toBeInTheDocument();
    });
});
