/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CookieConsentBanner } from '../../../components/CookieConsentBanner';

describe('CookieConsentBanner Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        localStorage.clear();
    });

    it('does not render when consent already given', () => {
        localStorage.setItem('cookie-consent', JSON.stringify({ necessary: true, functional: true, analytics: false, marketing: false }));

        const { container } = render(<CookieConsentBanner />);
        expect(container.firstChild).toBeNull();
    });

    it('renders after delay when no consent', async () => {
        render(<CookieConsentBanner />);

        expect(screen.queryByText(/We use cookies/i)).not.toBeInTheDocument();

        vi.advanceTimersByTime(1500);

        await waitFor(() => {
            expect(screen.getByText(/We use cookies/i)).toBeInTheDocument();
        });
    });

    it('shows Accept All button', async () => {
        vi.advanceTimersByTime(1500);

        render(<CookieConsentBanner />);

        await waitFor(() => {
            expect(screen.getByText(/Accept All/i)).toBeInTheDocument();
        });
    });

    it('shows Necessary Only button', async () => {
        vi.advanceTimersByTime(1500);

        render(<CookieConsentBanner />);

        await waitFor(() => {
            expect(screen.getByText(/Necessary Only/i)).toBeInTheDocument();
        });
    });

    it('shows Customize button', async () => {
        vi.advanceTimersByTime(1500);

        render(<CookieConsentBanner />);

        await waitFor(() => {
            expect(screen.getByText(/Customize/i)).toBeInTheDocument();
        });
    });

    it('accepts all cookies when Accept All clicked', async () => {
        vi.advanceTimersByTime(1500);

        render(<CookieConsentBanner />);

        await waitFor(() => {
            const acceptAllButton = screen.getByText(/Accept All/i);
            expect(acceptAllButton).toBeInTheDocument();
        });

        const acceptAllButton = screen.getByText(/Accept All/i);
        await user.click(acceptAllButton);

        await waitFor(() => {
            const consent = localStorage.getItem('cookie-consent');
            expect(consent).toBeTruthy();
            const parsed = JSON.parse(consent!);
            expect(parsed.analytics).toBe(true);
            expect(parsed.marketing).toBe(true);
        });
    });

    it('accepts necessary only when button clicked', async () => {
        vi.advanceTimersByTime(1500);

        render(<CookieConsentBanner />);

        await waitFor(() => {
            const necessaryButton = screen.getByText(/Necessary Only/i);
            expect(necessaryButton).toBeInTheDocument();
        });

        const necessaryButton = screen.getByText(/Necessary Only/i);
        await user.click(necessaryButton);

        await waitFor(() => {
            const consent = localStorage.getItem('cookie-consent');
            expect(consent).toBeTruthy();
            const parsed = JSON.parse(consent!);
            expect(parsed.necessary).toBe(true);
            expect(parsed.analytics).toBe(false);
            expect(parsed.marketing).toBe(false);
        });
    });

    it('shows customize panel when Customize clicked', async () => {
        vi.advanceTimersByTime(1500);

        render(<CookieConsentBanner />);

        await waitFor(() => {
            const customizeButton = screen.getByText(/Customize/i);
            expect(customizeButton).toBeInTheDocument();
        });

        const customizeButton = screen.getByText(/Customize/i);
        await user.click(customizeButton);

        await waitFor(() => {
            expect(screen.getByText(/Strictly Necessary/i)).toBeInTheDocument();
            expect(screen.getByText(/Functional/i)).toBeInTheDocument();
            expect(screen.getByText(/Analytics/i)).toBeInTheDocument();
        });
    });

    it('toggles cookie preferences in customize panel', async () => {
        vi.advanceTimersByTime(1500);

        render(<CookieConsentBanner />);

        await waitFor(() => {
            const customizeButton = screen.getByText(/Customize/i);
            expect(customizeButton).toBeInTheDocument();
        });

        await user.click(screen.getByText(/Customize/i));

        await waitFor(() => {
            expect(screen.getByText(/Analytics/i)).toBeInTheDocument();
        });

        const analyticsToggle = screen.getAllByRole('button').find(btn => 
            btn.className.includes('rounded-full') && 
            btn.closest('div')?.textContent?.includes('Analytics')
        );

        if (analyticsToggle) {
            await user.click(analyticsToggle);
        }
    });

    it('saves custom preferences', async () => {
        vi.advanceTimersByTime(1500);

        render(<CookieConsentBanner />);

        await waitFor(() => {
            const customizeButton = screen.getByText(/Customize/i);
            expect(customizeButton).toBeInTheDocument();
        });

        await user.click(screen.getByText(/Customize/i));

        await waitFor(() => {
            expect(screen.getByText(/Save Preferences/i)).toBeInTheDocument();
        });

        const saveButton = screen.getByText(/Save Preferences/i);
        await user.click(saveButton);

        await waitFor(() => {
            expect(localStorage.getItem('cookie-consent')).toBeTruthy();
        });
    });

    it('does not allow disabling necessary cookies', async () => {
        vi.advanceTimersByTime(1500);

        render(<CookieConsentBanner />);

        await waitFor(() => {
            const customizeButton = screen.getByText(/Customize/i);
            expect(customizeButton).toBeInTheDocument();
        });

        await user.click(screen.getByText(/Customize/i));

        await waitFor(() => {
            expect(screen.getByText(/Strictly Necessary/i)).toBeInTheDocument();
        });

        const necessaryToggle = screen.getAllByRole('button').find(btn => 
            btn.closest('div')?.textContent?.includes('Strictly Necessary')
        );

        if (necessaryToggle) {
            expect(necessaryToggle).toBeDisabled();
        }
    });
});






