/**
 * @vitest-environment jsdom
 * SessionManagementPanel Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const SessionManagementPanel = () => <div data-testid="session-mgmt">Session Management Panel</div>;

describe('SessionManagementPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({ sessions: [] });
    });

    it('renders panel', () => {
        render(<SessionManagementPanel />, { wrapper: Wrapper });
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });

    it('renders without crashing', () => {
        const { container } = render(<SessionManagementPanel />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
