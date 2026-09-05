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

describe('day373 dataset analysis actions', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('workCanvas.viewMode.v2', 'document');
    window.localStorage.setItem('ff.canvas_dev_diagnostics', '1');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders one 7+1 dataset action set and a single menu link that closes the menu', async () => {
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel />);
    await screen.findByTestId('canvas-document-view');

    const file = new File(['Stage,Revenue\nWon,400'], 'pipeline.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', {
      configurable: true,
      value: vi.fn(async () => 'Stage,Revenue\nWon,400'),
    });
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);

    const actionNames = [
      'Dataset table',
      'Dataset chart',
      'KPI dashboard',
      'Findings report',
      'Profile summary',
      'Aggregate chart',
      'Filtered table',
    ];
    const outerActions = await screen.findByTestId('canvas-dataset-actions');
    expect(within(outerActions).getAllByRole('button')).toHaveLength(8);

    await user.click(screen.getByRole('button', { name: /Canvas menu/i }));
    await user.click(screen.getByText('Plik, eksport i workspace'));

    for (const name of actionNames) {
      expect(screen.getAllByRole('button', { name })).toHaveLength(1);
    }
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(1);
    const showAnalyses = screen.getAllByRole('button', { name: /Pokaż analizy|Show analyses/ });
    expect(showAnalyses).toHaveLength(1);

    await user.click(showAnalyses[0]);
    expect(screen.queryByTestId('canvas-diagnostics-menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('canvas-dataset-actions')).toBeInTheDocument();
  });
});
