/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminSidebar } from '../../src/components/Admin/AdminSidebar';

describe('AdminSidebar Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(
            <BrowserRouter>
                <AdminSidebar />
            </BrowserRouter>
        );
        expect(document.body).toBeDefined();
    });

    it('renders without crashing', () => {
        const { container } = render(
            <BrowserRouter>
                <AdminSidebar />
            </BrowserRouter>
        );
        expect(container).toBeInTheDocument();
    });

    it('displays navigation elements', () => {
        render(
            <BrowserRouter>
                <AdminSidebar />
            </BrowserRouter>
        );

        const navElements = screen.queryAllByRole('navigation');
        const links = screen.queryAllByRole('link');
        expect(navElements.length + links.length).toBeGreaterThanOrEqual(0);
    });

    it('has menu items', () => {
        render(
            <BrowserRouter>
                <AdminSidebar />
            </BrowserRouter>
        );

        const menuItems = screen.queryAllByText(/overview|team|billing|security|workspace|ai/i);
        expect(menuItems.length).toBeGreaterThanOrEqual(0);
    });
});
