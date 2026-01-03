/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpgradePromptBanner } from '../../../components/banners/UpgradePromptBanner';

describe('UpgradePromptBanner Component', () => {
    const user = userEvent.setup();

    it('renders upgrade banner', () => {
        render(<UpgradePromptBanner onUpgrade={vi.fn()} />);

        expect(screen.getByText(/Upgrade/i) || screen.getByText(/Premium/i)).toBeInTheDocument();
    });

    it('calls onUpgrade when clicked', async () => {
        const onUpgrade = vi.fn();
        render(<UpgradePromptBanner onUpgrade={onUpgrade} />);

        const upgradeButton = screen.getByRole('button', { name: /Upgrade/i });
        await user.click(upgradeButton);

        expect(onUpgrade).toHaveBeenCalled();
    });
});









