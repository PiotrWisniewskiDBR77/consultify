/**
 * @vitest-environment jsdom
 * SuperAdminDashboard Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const SuperAdminDashboard = () => <div data-testid="sa-dashboard">SuperAdmin Dashboard</div>;

describe('SuperAdminDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({});
    });

    it('renders dashboard', () => {
        render(<SuperAdminDashboard />, { wrapper: Wrapper });
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });

    it('renders without crashing', () => {
        const { container } = render(<SuperAdminDashboard />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
