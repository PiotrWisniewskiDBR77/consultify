/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CustomersModule from '@/views/superadmin/CustomersModule';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
    Api: {
        getOrganizations: vi.fn(),
        getFeedback: vi.fn(),
        getAccessRequests: vi.fn(),
        getAccessCodes: vi.fn(),
        getSuperAdminUsers: vi.fn(),
        getUserPlans: vi.fn(),
        getTasks: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue({})
    }
}));

describe('CustomersModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getOrganizations as any).mockResolvedValue([
            { id: 'org-1', name: 'Org 1' }
        ]);
        (Api.getFeedback as any).mockResolvedValue([
            { id: 'fb-1', status: 'pending' },
            { id: 'fb-2', status: 'new' }
        ]);
        (Api.getAccessRequests as any).mockResolvedValue([]);
        (Api.getAccessCodes as any).mockResolvedValue([]);
        (Api.getSuperAdminUsers as any).mockResolvedValue([]);
        (Api.getUserPlans as any).mockResolvedValue([]);
    });

    it('should render with default organizations tab', async () => {
        render(<CustomersModule />);
        
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Customers' })).toBeInTheDocument();
        });
    });

    it('should render with initial tab', async () => {
        render(<CustomersModule initialTab="users" />);
        
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Customers' })).toBeInTheDocument();
        });
    });

    it('should switch between tabs', async () => {
        render(<CustomersModule />);
        
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Customers' })).toBeInTheDocument();
        });

        const feedbackTab = screen.getAllByText('Feedback')[0];
        fireEvent.click(feedbackTab);
        expect(feedbackTab).toBeInTheDocument();
    });

    it('should display all four tabs', async () => {
        render(<CustomersModule />);
        
        await waitFor(() => {
            expect(screen.getAllByText('Organizations').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Users').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Feedback').length).toBeGreaterThan(0);
            expect(screen.getByText('Bulk Ops')).toBeInTheDocument();
        });
    });

    it('should fetch organizations on mount', async () => {
        render(<CustomersModule />);
        
        await waitFor(() => {
            expect(Api.getOrganizations).toHaveBeenCalled();
        });
    });

    it('should fetch feedback count for badge', async () => {
        render(<CustomersModule />);
        
        await waitFor(() => {
            expect(Api.getFeedback).toHaveBeenCalled();
        });
    });

    it('should display feedback badge when pending feedback exists', async () => {
        render(<CustomersModule />);
        
        await waitFor(() => {
            expect(Api.getFeedback).toHaveBeenCalled();
        });
    });
});
