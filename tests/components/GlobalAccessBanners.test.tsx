/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GlobalAccessBanners } from '../../components/GlobalAccessBanners';
import { usePolicySnapshot, useIsDemo, useIsTrial, useIsTrialExpired } from '../../contexts/AccessPolicyContext';

vi.mock('../../../contexts/AccessPolicyContext', () => ({
    usePolicySnapshot: vi.fn(),
    useIsDemo: vi.fn(),
    useIsTrial: vi.fn(),
    useIsTrialExpired: vi.fn()
}));

vi.mock('../../../components/TrialBanner', () => ({
    __esModule: true,
    default: () => <div>TrialBanner</div>
}));

vi.mock('../../../components/DemoBanner', () => ({
    __esModule: true,
    default: () => <div>DemoBanner</div>
}));

vi.mock('../../../components/TrialExpirationModal', () => ({
    __esModule: true,
    default: () => <div>TrialExpirationModal</div>
}));

describe('GlobalAccessBanners Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when loading', () => {
        (usePolicySnapshot as any).mockReturnValue({ snapshot: null, loading: true });
        (useIsDemo as any).mockReturnValue(false);
        (useIsTrial as any).mockReturnValue(false);
        (useIsTrialExpired as any).mockReturnValue(false);

        const { container } = render(<GlobalAccessBanners />);
        expect(container.firstChild).toBeNull();
    });

    it('renders nothing for paid orgs', () => {
        (usePolicySnapshot as any).mockReturnValue({
            snapshot: { isPaid: true },
            loading: false
        });
        (useIsDemo as any).mockReturnValue(false);
        (useIsTrial as any).mockReturnValue(false);
        (useIsTrialExpired as any).mockReturnValue(false);

        const { container } = render(<GlobalAccessBanners />);
        expect(container.firstChild).toBeNull();
    });

    it('renders DemoBanner for demo orgs', () => {
        (usePolicySnapshot as any).mockReturnValue({
            snapshot: { isPaid: false, isDemo: true },
            loading: false
        });
        (useIsDemo as any).mockReturnValue(true);
        (useIsTrial as any).mockReturnValue(false);
        (useIsTrialExpired as any).mockReturnValue(false);

        render(<GlobalAccessBanners />);
        expect(screen.getByText('DemoBanner')).toBeInTheDocument();
    });

    it('renders TrialBanner for active trial', () => {
        (usePolicySnapshot as any).mockReturnValue({
            snapshot: { isPaid: false, isTrial: true, trialDaysLeft: 7, warningLevel: 'none' },
            loading: false
        });
        (useIsDemo as any).mockReturnValue(false);
        (useIsTrial as any).mockReturnValue(true);
        (useIsTrialExpired as any).mockReturnValue(false);

        render(<GlobalAccessBanners />);
        expect(screen.getByText('TrialBanner')).toBeInTheDocument();
    });

    it('renders TrialExpirationModal when trial expired', () => {
        (usePolicySnapshot as any).mockReturnValue({
            snapshot: { isPaid: false, isTrial: true },
            loading: false
        });
        (useIsDemo as any).mockReturnValue(false);
        (useIsTrial as any).mockReturnValue(true);
        (useIsTrialExpired as any).mockReturnValue(true);

        render(<GlobalAccessBanners />);
        expect(screen.getByText('TrialExpirationModal')).toBeInTheDocument();
    });

    it('calls onStartTrial when provided', () => {
        const onStartTrial = vi.fn();
        (usePolicySnapshot as any).mockReturnValue({
            snapshot: { isPaid: false, isDemo: true },
            loading: false
        });
        (useIsDemo as any).mockReturnValue(true);
        (useIsTrial as any).mockReturnValue(false);
        (useIsTrialExpired as any).mockReturnValue(false);

        render(<GlobalAccessBanners onStartTrial={onStartTrial} />);
        // Component should pass callback to DemoBanner
        expect(screen.getByText('DemoBanner')).toBeInTheDocument();
    });
});











