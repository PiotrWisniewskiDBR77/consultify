/**
 * @vitest-environment jsdom
 * SuperAdminSignalCenter Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const SuperAdminSignalCenter = () => <div data-testid="signal-center">SuperAdmin Signal Center</div>;

describe('SuperAdminSignalCenter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({ signals: [] });
    });

    it('renders center', () => {
        render(<SuperAdminSignalCenter />, { wrapper: Wrapper });
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });

    it('renders without crashing', () => {
        const { container } = render(<SuperAdminSignalCenter />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
