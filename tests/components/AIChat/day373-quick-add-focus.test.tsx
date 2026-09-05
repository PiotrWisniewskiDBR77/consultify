import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { canvasAuthState } = vi.hoisted(() => ({
  canvasAuthState: {
    currentUser: null as { id: string } | null,
    currentOrganization: null as { id: string; name: string } | null,
    isAuthInitializing: true,
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: (state: typeof canvasAuthState) => unknown) =>
    selector ? selector(canvasAuthState) : canvasAuthState,
}));

import { WorkCanvasDocumentPanel } from '../../../src/components/AIChat/WorkCanvasDocumentPanel';

describe('day373 quick add navigation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('workCanvas.viewMode.v2', 'document');
    window.localStorage.setItem('ff.canvas_dev_diagnostics', '1');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens the Add element details and focuses its instruction field', async () => {
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel />);
    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: /Canvas menu/i }));

    const addSummary = screen.getByText('Add element', { selector: 'span' });
    const addDetails = addSummary.closest('details') as HTMLDetailsElement;
    expect(addDetails.open).toBe(false);

    const commonSummary = screen.getByText('Most common actions').closest('details');
    expect(commonSummary).not.toBeNull();
    await user.click(screen.getByText('Most common actions'));
    await user.click(within(commonSummary as HTMLElement).getByRole('button', { name: 'Add element' }));

    const prompt = screen.getByLabelText('Element instruction for Teresa');
    expect(addDetails.open).toBe(true);
    expect(document.activeElement).toBe(prompt);
  });
});
