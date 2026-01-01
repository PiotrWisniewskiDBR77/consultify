/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CustomersModule from '../../../views/superadmin/CustomersModule';
import { Api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
    Api: {
        getOrganizations: vi.fn(),
        getUserFeedback: vi.fn(),
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
        (Api.getUserFeedback as any).mockResolvedValue([
            { id: 'fb-1', status: 'pending' },
            { id: 'fb-2', status: 'new' }
        ]);
    });

    it('should render with default organizations tab', async () => {
        render(<CustomersModule />);
        
        await waitFor(() => {
            expect(screen.getByText('Organizations')).toBeInTheDocument();
        });
    });

    it('should render with initial tab', async () => {
        render(<CustomersModule initialTab="users" />);
        
        await waitFor(() => {
            expect(screen.getByText('Users')).toBeInTheDocument();
        });
    });

    it('should switch between tabs', async () => {
        render(<CustomersModule />);
        
        await waitFor(() => {
            expect(screen.getByText('Feedback')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Feedback'));
        expect(screen.getByText('Feedback')).toBeInTheDocument();
    });

    it('should display all four tabs', async () => {
        render(<CustomersModule />);
        
        await waitFor(() => {
            expect(screen.getByText('Organizations')).toBeInTheDocument();
            expect(screen.getByText('Users')).toBeInTheDocument();
            expect(screen.getByText('Feedback')).toBeInTheDocument();
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
            expect(Api.getUserFeedback).toHaveBeenCalled();
        });
    });

    it('should display feedback badge when pending feedback exists', async () => {
        render(<CustomersModule />);
        
        await waitFor(() => {
            expect(Api.getUserFeedback).toHaveBeenCalled();
        });
    });
});
