/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LowBalanceBanner } from '../../../src/components/banners/LowBalanceBanner';

describe('LowBalanceBanner Component', () => {
    const user = userEvent.setup();

    it('renders when balance is low', () => {
        render(<LowBalanceBanner balance={50} threshold={100} onTopUp={vi.fn()} />);

        expect(screen.getByText(/Low Balance/i) || screen.getByText(/50/i)).toBeInTheDocument();
    });

    it('does not render when balance is sufficient', () => {
        const { container } = render(<LowBalanceBanner balance={150} threshold={100} onTopUp={vi.fn()} />);
        expect(container.firstChild).toBeNull();
    });

    it('calls onTopUp when clicked', async () => {
        const onTopUp = vi.fn();
        render(<LowBalanceBanner balance={50} threshold={100} onTopUp={onTopUp} />);

        const topUpButton = screen.getByRole('button', { name: /Top Up/i });
        await user.click(topUpButton);

        expect(onTopUp).toHaveBeenCalled();
    });
});















