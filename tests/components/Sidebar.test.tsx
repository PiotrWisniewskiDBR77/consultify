/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from '../../src/components/layout/Sidebar';
import { useAppStore } from '../../src/store/useAppStore';

vi.mock('../../store/useAppStore', () => ({
    useAppStore: vi.fn()
}));

vi.mock('../../hooks/useDeviceType', () => ({
    useDeviceType: () => ({ isMobile: false, isTablet: false })
}));

// Using global mock from tests/setup.ts

describe('Sidebar Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        (useAppStore as any).mockReturnValue({
            currentView: 'dashboard',
            currentUser: { id: 'user-1', role: 'USER' },
            setCurrentView: vi.fn(),
            freeSessionData: { step1Completed: false, step2Completed: false, step3Completed: false },
            fullSessionData: { step1Completed: false, step2Completed: false, step3Completed: false }
        });
    });

    it('renders sidebar navigation', () => {
        render(<Sidebar />);

        expect(screen.getByRole('navigation', { hidden: true })).toBeInTheDocument();
    });

    it('displays dashboard menu item', () => {
        render(<Sidebar />);

        expect(screen.getByText(/My Work/i)).toBeInTheDocument();
    });

    it('highlights current view', () => {
        render(<Sidebar />);

        const dashboardItem = screen.getByText(/My Work/i);
        expect(dashboardItem.closest('a') || dashboardItem.closest('button')).toHaveClass(/active|current/i);
    });

    it('navigates when menu item clicked', async () => {
        const setCurrentView = vi.fn();
        (useAppStore as any).mockReturnValue({
            currentView: 'dashboard',
            currentUser: { id: 'user-1', role: 'USER' },
            setCurrentView,
            freeSessionData: { step1Completed: false, step2Completed: false, step3Completed: false },
            fullSessionData: { step1Completed: false, step2Completed: false, step3Completed: false }
        });

        render(<Sidebar />);

        const projectsItem = screen.getByText(/Project Intelligence/i);
        if (projectsItem) {
            await user.click(projectsItem);
            expect(setCurrentView).toHaveBeenCalled();
        }
    });

    it('shows user profile section', () => {
        render(<Sidebar />);

        const settingsItem = screen.getByText(/Settings/i);
        expect(settingsItem).toBeInTheDocument();
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

