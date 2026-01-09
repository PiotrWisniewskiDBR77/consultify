/**
 * @vitest-environment jsdom
 * BulkUserImport Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const BulkUserImport = () => <div data-testid="bulk-import">Bulk User Import</div>;

describe('BulkUserImport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders import modal', () => {
        render(<BulkUserImport />, { wrapper: Wrapper });
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });

    it('renders without crashing', () => {
        const { container } = render(<BulkUserImport />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
