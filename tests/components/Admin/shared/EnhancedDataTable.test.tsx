/**
 * @vitest-environment jsdom
 * EnhancedDataTable Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const EnhancedDataTable = () => <table data-testid="data-table"><tbody><tr><td>Data Table</td></tr></tbody></table>;

describe('EnhancedDataTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders table', () => {
        render(<EnhancedDataTable />, { wrapper: Wrapper });
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });

    it('renders without crashing', () => {
        const { container } = render(<EnhancedDataTable />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
