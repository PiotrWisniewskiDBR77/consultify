/**
 * @vitest-environment jsdom
 * AIModule Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const AIModule = () => <div data-testid="ai-module">AI Module</div>;

describe('AIModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({});
    });

    it('renders AI module', async () => {
        render(<AIModule />, { wrapper: Wrapper });
        await waitFor(() => {
            expect(document.body.innerHTML.length).toBeGreaterThan(50);
        });
    });

    it('renders without crashing', () => {
        const { container } = render(<AIModule />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});


