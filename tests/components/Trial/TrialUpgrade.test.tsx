/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrialUpgrade } from '../../components/Trial/TrialUpgrade';

describe('TrialUpgrade Component', () => {
    const user = userEvent.setup();

    it('renders upgrade component', () => {
        render(<TrialUpgrade onUpgrade={vi.fn()} />);

        expect(screen.getByText(/Upgrade/i) || screen.getByText(/Trial/i)).toBeInTheDocument();
    });

    it('calls onUpgrade when button clicked', async () => {
        const onUpgrade = vi.fn();
        render(<TrialUpgrade onUpgrade={onUpgrade} />);

        const upgradeButton = screen.getByRole('button', { name: /Upgrade/i });
        await user.click(upgradeButton);

        expect(onUpgrade).toHaveBeenCalled();
    });
});














