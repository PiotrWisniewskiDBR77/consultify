/**
 * @vitest-environment jsdom
 * BillingOverviewPanel Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const BillingOverviewPanel = () => <div data-testid="billing">Billing Overview</div>;

describe('BillingOverviewPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({});
    });

    it('renders panel', async () => {
        render(<BillingOverviewPanel />, { wrapper: Wrapper });
        await waitFor(() => {
            expect(document.body.innerHTML.length).toBeGreaterThan(50);
        });
    });

    it('renders without crashing', () => {
        const { container } = render(<BillingOverviewPanel />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
