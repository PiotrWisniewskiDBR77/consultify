/**
 * OverviewModule Unit Tests
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OverviewModule } from '@/views/admin/OverviewModule';

// Mock dependencies
vi.mock('@/services/api', () => ({
    Api: {
        getUsers: vi.fn().mockResolvedValue([]),
        getProjects: vi.fn().mockResolvedValue([]),
    },
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('OverviewModule', () => {
    const mockUsers = [];
    const mockProjects = [];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render Overview module', () => {
        render(
            <BrowserRouter>
                <OverviewModule users={mockUsers} projects={mockProjects} />
            </BrowserRouter>
        );
        
        expect(screen.getByText(/Overview|Dashboard/i)).toBeInTheDocument();
    });

    it('should render dashboard tab by default', () => {
        render(
            <BrowserRouter>
                <OverviewModule users={mockUsers} projects={mockProjects} />
            </BrowserRouter>
        );
        
        // Check if dashboard tab is active or visible
        const dashboardTab = screen.queryByText(/Dashboard/i);
        expect(dashboardTab).toBeTruthy();
    });

    it('should render all three tabs', () => {
        render(
            <BrowserRouter>
                <OverviewModule users={mockUsers} projects={mockProjects} />
            </BrowserRouter>
        );
        
        // Check for tab buttons
        const tabs = ['Dashboard', 'Metrics', 'Analytics'];
        tabs.forEach(tab => {
            const tabElement = screen.queryByText(new RegExp(tab, 'i'));
            expect(tabElement).toBeTruthy();
        });
    });
});

