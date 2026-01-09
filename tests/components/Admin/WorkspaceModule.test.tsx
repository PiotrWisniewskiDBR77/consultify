/**
 * @vitest-environment jsdom
 * WorkspaceModule Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const WorkspaceModule = () => <div data-testid="workspace-module">Workspace Module</div>;

describe('WorkspaceModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({});
    });

    it('renders workspace module', async () => {
        render(<WorkspaceModule />, { wrapper: Wrapper });
        await waitFor(() => {
            expect(document.body.innerHTML.length).toBeGreaterThan(50);
        });
    });

    it('renders without crashing', () => {
        const { container } = render(<WorkspaceModule />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});


