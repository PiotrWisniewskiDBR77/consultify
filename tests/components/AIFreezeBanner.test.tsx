/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AIFreezeBanner } from '../../../components/AIFreezeBanner';
import { useAppStore } from '../../../store/useAppStore';

vi.mock('../../../store/useAppStore', () => ({
    useAppStore: vi.fn()
}));

describe('AIFreezeBanner Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not render when AI is not frozen', () => {
        (useAppStore as any).mockReturnValue({
            aiFreezeStatus: { isFrozen: false }
        });

        const { container } = render(<AIFreezeBanner />);
        expect(container.firstChild).toBeNull();
    });

    it('renders when AI is frozen', () => {
        (useAppStore as any).mockReturnValue({
            aiFreezeStatus: { isFrozen: true, scope: 'Global' }
        });

        render(<AIFreezeBanner />);

        expect(screen.getByText(/AI FREEZE ACTIVE/i)).toBeInTheDocument();
    });

    it('displays freeze message with scope', () => {
        (useAppStore as any).mockReturnValue({
            aiFreezeStatus: { isFrozen: true, scope: 'Project' }
        });

        render(<AIFreezeBanner />);

        expect(screen.getByText(/Budget hard limit reached/i)).toBeInTheDocument();
        expect(screen.getByText(/Project/i)).toBeInTheDocument();
    });

    it('shows increase budget button', () => {
        (useAppStore as any).mockReturnValue({
            aiFreezeStatus: { isFrozen: true, scope: 'Global' }
        });

        render(<AIFreezeBanner />);

        expect(screen.getByText(/Increase Budget/i)).toBeInTheDocument();
    });

    it('navigates to billing settings when button clicked', () => {
        const mockLocation = { href: '' };
        Object.defineProperty(window, 'location', {
            value: mockLocation,
            writable: true
        });

        (useAppStore as any).mockReturnValue({
            aiFreezeStatus: { isFrozen: true, scope: 'Global' }
        });

        render(<AIFreezeBanner />);

        const button = screen.getByText(/Increase Budget/i);
        button.click();

        expect(mockLocation.href).toBe('/settings/billing');
    });

    it('displays budget control protocol badge', () => {
        (useAppStore as any).mockReturnValue({
            aiFreezeStatus: { isFrozen: true, scope: 'Global' }
        });

        render(<AIFreezeBanner />);

        expect(screen.getByText(/Budget Control Protocol/i)).toBeInTheDocument();
    });
});






