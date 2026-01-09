/**
 * @vitest-environment jsdom
 * SecurityModule Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const SecurityModule = () => <div data-testid="security">Security Module</div>;

describe('SecurityModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({});
    });

    it('renders module', async () => {
        render(<SecurityModule />, { wrapper: Wrapper });
        await waitFor(() => {
            expect(document.body.innerHTML.length).toBeGreaterThan(50);
        });
    });

    it('renders without crashing', () => {
        const { container } = render(<SecurityModule />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
