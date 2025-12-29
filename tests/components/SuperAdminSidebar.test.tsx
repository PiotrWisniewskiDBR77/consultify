/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SuperAdminSidebar } from '../../../components/SuperAdminSidebar';
import { useAppStore } from '../../../store/useAppStore';

vi.mock('../../../store/useAppStore', () => ({
    useAppStore: vi.fn()
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback || key
    })
}));

describe('SuperAdminSidebar Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useAppStore as any).mockReturnValue({
            currentView: 'admin',
            currentUser: { id: 'user-1', role: 'SUPER_ADMIN' }
        });
    });

    it('renders super admin navigation', () => {
        render(<SuperAdminSidebar />);

        expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('displays admin menu items', () => {
        render(<SuperAdminSidebar />);

        expect(screen.getByText(/Admin/i) || screen.getByText(/System/i)).toBeInTheDocument();
    });

    it('shows system health link', () => {
        render(<SuperAdminSidebar />);

        expect(screen.getByText(/System Health/i) || screen.getByText(/Health/i)).toBeInTheDocument();
    });

    it('shows users management link', () => {
        render(<SuperAdminSidebar />);

        expect(screen.getByText(/Users/i) || screen.getByText(/Manage Users/i)).toBeInTheDocument();
    });
});

