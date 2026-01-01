/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RevenueModule from '../../../views/superadmin/RevenueModule';

vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn().mockResolvedValue({}),
        getTasks: vi.fn().mockResolvedValue([])
    }
}));

describe('RevenueModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with default billing tab', () => {
        render(<RevenueModule />);
        
        expect(screen.getByText('Billing')).toBeInTheDocument();
    });

    it('should render with initial tab', () => {
        render(<RevenueModule initialTab="invoices" />);
        
        expect(screen.getByText('Invoices')).toBeInTheDocument();
    });

    it('should switch between tabs', () => {
        render(<RevenueModule />);
        
        fireEvent.click(screen.getByText('Invoices'));
        expect(screen.getByText('Invoices')).toBeInTheDocument();
        
        fireEvent.click(screen.getByText('Usage'));
        expect(screen.getByText('Usage')).toBeInTheDocument();
    });

    it('should display all three tabs', () => {
        render(<RevenueModule />);
        
        expect(screen.getByText('Billing')).toBeInTheDocument();
        expect(screen.getByText('Invoices')).toBeInTheDocument();
        expect(screen.getByText('Usage')).toBeInTheDocument();
    });
});
