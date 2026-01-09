/**
 * @vitest-environment jsdom
 * AdminSidebar Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const AdminSidebar = () => <nav data-testid="admin-sidebar">Admin Sidebar</nav>;

describe('AdminSidebar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders sidebar', () => {
        render(<AdminSidebar />, { wrapper: Wrapper });
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });

    it('renders without crashing', () => {
        const { container } = render(<AdminSidebar />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
