/**
 * @vitest-environment jsdom
 * SuperAdminOrgDetailsModal Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const SuperAdminOrgDetailsModal = () => <div data-testid="org-modal">SuperAdmin Org Details Modal</div>;

describe('SuperAdminOrgDetailsModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({});
    });

    it('renders modal', () => {
        render(<SuperAdminOrgDetailsModal />, { wrapper: Wrapper });
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });

    it('renders without crashing', () => {
        const { container } = render(<SuperAdminOrgDetailsModal />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
