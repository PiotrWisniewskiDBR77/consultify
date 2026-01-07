/**
 * TeamModule Unit Tests
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TeamModule } from '@/views/admin/TeamModule';

// Mock dependencies
vi.mock('@/services/api', () => ({
    Api: {
        getUsers: vi.fn().mockResolvedValue([]),
        getInvitations: vi.fn().mockResolvedValue([]),
    },
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('TeamModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render Team module', () => {
        render(
            <BrowserRouter>
                <TeamModule />
            </BrowserRouter>
        );
        
        expect(screen.getByText(/Team/i)).toBeInTheDocument();
    });

    it('should render users tab by default', () => {
        render(
            <BrowserRouter>
                <TeamModule />
            </BrowserRouter>
        );
        
        const usersTab = screen.queryByText(/Users/i);
        expect(usersTab).toBeTruthy();
    });

    it('should render all five tabs', () => {
        render(
            <BrowserRouter>
                <TeamModule />
            </BrowserRouter>
        );
        
        const tabs = ['Users', 'Groups', 'Invitations', 'Roles', 'Consultants'];
        tabs.forEach(tab => {
            const tabElement = screen.queryByText(new RegExp(tab, 'i'));
            expect(tabElement).toBeTruthy();
        });
    });
});

