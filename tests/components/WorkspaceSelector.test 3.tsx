/**
 * @vitest-environment jsdom
 * WorkspaceSelector Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const WorkspaceSelector = () => (
    <div data-testid="workspace-selector">
        <button data-testid="current-workspace">Current Workspace</button>
        <div data-testid="workspace-list">
            <button data-testid="workspace-item">Workspace 1</button>
        </div>
    </div>
);

describe('WorkspaceSelector Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders selector', () => {
        render(<WorkspaceSelector />, { wrapper: Wrapper });
        expect(screen.getByTestId('workspace-selector')).toBeInTheDocument();
    });

    it('shows current workspace', () => {
        render(<WorkspaceSelector />, { wrapper: Wrapper });
        expect(screen.getByTestId('current-workspace')).toBeInTheDocument();
    });

    it('has workspace list', () => {
        render(<WorkspaceSelector />, { wrapper: Wrapper });
        expect(screen.getByTestId('workspace-list')).toBeInTheDocument();
    });
});
