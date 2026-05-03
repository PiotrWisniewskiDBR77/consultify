import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkCanvasDocumentPanel } from '../../../src/components/AIChat/WorkCanvasDocumentPanel';

describe('WorkCanvasDocumentPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('switches between document and Markdown views from the same source', async () => {
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel />);

    expect(await screen.findByTestId('canvas-document-view')).toHaveTextContent(
      'Company Work Note'
    );
    expect(screen.getByText('Canvas work area')).toBeInTheDocument();
    expect(screen.getByText('Markdown canonical')).toBeInTheDocument();
    expect(screen.getByText('Projection synced')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'MD' }));

    const mdView = screen.getByTestId('canvas-md-view') as HTMLTextAreaElement;
    expect(mdView.value).toContain('# Company Work Note');
    expect(mdView.value).not.toContain('{"');
  });

  it('renders GFM tables and checkboxes without raw Markdown bullets as the document UI', async () => {
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel />);

    expect(await screen.findByText('Define the business question.')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Zrób research/i }));

    expect(await screen.findByRole('columnheader', { name: 'Dimension' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Definition' })).toBeInTheDocument();
    expect(screen.getByTestId('canvas-document-view')).not.toHaveTextContent('{"');
  });

  it('updates active document state when a starter action is selected', async () => {
    const user = userEvent.setup();
    const onActiveDocumentChange = vi.fn();
    render(<WorkCanvasDocumentPanel onActiveDocumentChange={onActiveDocumentChange} />);

    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: /Przygotuj decyzję/i }));

    expect(await screen.findByTestId('canvas-active-title')).toHaveTextContent('Decision Memo');
    expect(onActiveDocumentChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Decision Memo', activeStarterId: 'decision' })
    );
  });

  it('marks Markdown edits unsaved and saves through the draft API when possible', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'draft-1',
          lifecycleState: 'draft',
          markdownProjectionStatus: 'synced',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);
    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: 'MD' }));
    await user.type(screen.getByTestId('canvas-md-view'), '\nNew note');

    expect(screen.getByTestId('canvas-save-state')).toHaveTextContent('Unsaved');

    await user.click(screen.getByRole('button', { name: /Save Canvas document/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/work-canvas/drafts', expect.any(Object))
    );
    await waitFor(() => expect(screen.getByTestId('canvas-save-state')).toHaveTextContent('Saved'));
  });

  it('remembers the last Document or MD view mode', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<WorkCanvasDocumentPanel />);

    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: 'MD' }));
    expect(await screen.findByTestId('canvas-md-view')).toBeInTheDocument();

    unmount();
    render(<WorkCanvasDocumentPanel />);

    expect(await screen.findByTestId('canvas-md-view')).toBeInTheDocument();
  });

  it('shows quiet projection degraded state with retry', async () => {
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel initialProjectionStatus="failed" />);

    expect(await screen.findByTestId('canvas-projection-status')).toHaveTextContent(
      'Projection failed'
    );

    await user.click(screen.getByRole('button', { name: /Retry projection/i }));
    await waitFor(() =>
      expect(screen.getByTestId('canvas-projection-status')).toHaveTextContent(
        'Projection synced'
      )
    );
  });
});

