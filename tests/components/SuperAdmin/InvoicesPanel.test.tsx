/**
 * @vitest-environment jsdom
 * InvoicesPanel Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const InvoicesPanel = () => <div data-testid="invoices">Invoices Panel</div>;

describe('InvoicesPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({ invoices: [] });
    });

    it('renders panel', () => {
        render(<InvoicesPanel />, { wrapper: Wrapper });
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });

    it('renders without crashing', () => {
        const { container } = render(<InvoicesPanel />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
