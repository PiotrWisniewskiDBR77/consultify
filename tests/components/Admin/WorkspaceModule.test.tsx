/**
 * WorkspaceModule Unit Tests
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { WorkspaceModule } from '@/views/admin/WorkspaceModule';

// Mock dependencies
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('WorkspaceModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render Workspace module', () => {
        render(
            <BrowserRouter>
                <WorkspaceModule />
            </BrowserRouter>
        );
        
        expect(screen.getByText(/Workspace/i)).toBeInTheDocument();
    });

    it('should render defaults tab by default', () => {
        render(
            <BrowserRouter>
                <WorkspaceModule />
            </BrowserRouter>
        );
        
        const defaultsTab = screen.queryByText(/Defaults/i);
        expect(defaultsTab).toBeTruthy();
    });

    it('should render all three tabs', () => {
        render(
            <BrowserRouter>
                <WorkspaceModule />
            </BrowserRouter>
        );
        
        const tabs = ['Defaults', 'Templates', 'Branding'];
        tabs.forEach(tab => {
            const tabElement = screen.queryByText(new RegExp(tab, 'i'));
            expect(tabElement).toBeTruthy();
        });
    });
});

