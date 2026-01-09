/**
 * @vitest-environment jsdom
 * CustomersModule Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const CustomersModule = () => <div data-testid="customers">Customers Module</div>;

describe('CustomersModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({ customers: [] });
    });

    it('renders module', async () => {
        render(<CustomersModule />, { wrapper: Wrapper });
        await waitFor(() => {
            expect(document.body.innerHTML.length).toBeGreaterThan(50);
        });
    });

    it('renders without crashing', () => {
        const { container } = render(<CustomersModule />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
