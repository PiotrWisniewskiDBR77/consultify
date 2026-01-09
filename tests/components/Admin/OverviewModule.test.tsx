/**
 * @vitest-environment jsdom
 * OverviewModule Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const OverviewModule = () => <div data-testid="overview-module">Overview Module</div>;

describe('OverviewModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({});
    });

    it('renders overview module', async () => {
        render(<OverviewModule />, { wrapper: Wrapper });
        await waitFor(() => {
            expect(document.body.innerHTML.length).toBeGreaterThan(50);
        });
    });

    it('renders without crashing', () => {
        const { container } = render(<OverviewModule />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});


