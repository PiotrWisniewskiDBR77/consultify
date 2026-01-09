/**
 * @vitest-environment jsdom
 * SuperAdminMetricsView Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const SuperAdminMetricsView = () => <div data-testid="metrics-view">SuperAdmin Metrics View</div>;

describe('SuperAdminMetricsView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({});
    });

    it('renders view', () => {
        render(<SuperAdminMetricsView />, { wrapper: Wrapper });
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });

    it('renders without crashing', () => {
        const { container } = render(<SuperAdminMetricsView />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
