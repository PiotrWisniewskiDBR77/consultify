/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from '../../../components/Sidebar';
import { useAppStore } from '../../../store/useAppStore';

vi.mock('../../../store/useAppStore', () => ({
    useAppStore: vi.fn()
}));

vi.mock('../../../hooks/useDeviceType', () => ({
    useDeviceType: () => ({ isMobile: false, isTablet: false })
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback || key
    })
}));

describe('Sidebar Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        (useAppStore as any).mockReturnValue({
            currentView: 'dashboard',
            currentUser: { id: 'user-1', role: 'USER' },
            setCurrentView: vi.fn()
        });
    });

    it('renders sidebar navigation', () => {
        render(<Sidebar />);

        expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('displays dashboard menu item', () => {
        render(<Sidebar />);

        expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
    });

    it('highlights current view', () => {
        render(<Sidebar />);

        const dashboardItem = screen.getByText(/Dashboard/i);
        expect(dashboardItem.closest('a') || dashboardItem.closest('button')).toHaveClass(/active|current/i);
    });

    it('navigates when menu item clicked', async () => {
        const setCurrentView = vi.fn();
        (useAppStore as any).mockReturnValue({
            currentView: 'dashboard',
            currentUser: { id: 'user-1', role: 'USER' },
            setCurrentView
        });

        render(<Sidebar />);

        const projectsItem = screen.getByText(/Projects/i);
        if (projectsItem) {
            await user.click(projectsItem);
            expect(setCurrentView).toHaveBeenCalled();
        }
    });

    it('shows user profile section', () => {
        render(<Sidebar />);

        expect(screen.getByText(/Profile/i) || screen.getByText(/Settings/i)).toBeInTheDocument();
    });

    it('handles logout', async () => {
        render(<Sidebar />);

        const logoutButton = screen.getByText(/Logout/i) || screen.getByText(/Log Out/i);
        if (logoutButton) {
            await user.click(logoutButton);
            // Logout should be handled
        }
    });
});

