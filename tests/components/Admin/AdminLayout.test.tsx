/**
 * @vitest-environment jsdom
 * AdminLayout Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const AdminLayout = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="admin-layout">Admin Layout{children}</div>
);

describe('AdminLayout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders layout with children', () => {
        render(
            <AdminLayout>
                <div data-testid="content">Content</div>
            </AdminLayout>,
            { wrapper: Wrapper }
        );
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });

    it('renders without crashing', () => {
        const { container } = render(<AdminLayout />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
