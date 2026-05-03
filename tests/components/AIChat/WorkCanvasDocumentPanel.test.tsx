import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkCanvasDocumentPanel } from '../../../src/components/AIChat/WorkCanvasDocumentPanel';

describe('WorkCanvasDocumentPanel', () => {
  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => undefined) },
    });
  });

  it('switches between document and Markdown views from the same source', async () => {
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel />);

    expect(await screen.findByTestId('canvas-document-view')).toHaveTextContent(
      'Company Work Note'
    );
    expect(screen.getByText('Canvas')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-workspace-actions')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-output-actions')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-view-actions')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-file-actions')).toBeInTheDocument();
    expect(screen.queryByText('Start pracy')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Markdown view' }));

    const mdView = screen.getByTestId('canvas-md-view') as HTMLTextAreaElement;
    expect(mdView.value).toContain('# Company Work Note');
    expect(mdView.value).not.toContain('{"');
  });

  it('renders GFM tables and checkboxes without raw Markdown bullets as the document UI', async () => {
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel />);

    expect(await screen.findByText('Define the business question.')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Open Canvas templates/i }));
    expect(await screen.findByTestId('canvas-templates-menu')).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: /Open Canvas templates/i }));
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
    await user.click(screen.getByRole('button', { name: 'Markdown view' }));
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
    await user.click(screen.getByRole('button', { name: 'Markdown view' }));
    expect(await screen.findByTestId('canvas-md-view')).toBeInTheDocument();

    unmount();
    render(<WorkCanvasDocumentPanel />);

    expect(await screen.findByTestId('canvas-md-view')).toBeInTheDocument();
  });

  it('shows quiet projection degraded state with retry', async () => {
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel initialProjectionStatus="failed" />);

    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: /Canvas diagnostics/i }));
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

  it('runs workspace and output command actions through real Canvas runtimes', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: '# Company Work Note',
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/save-to-workspace') {
        expect(JSON.parse(String(init?.body))).toEqual({ target: 'idea' });
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: { id: 'draft-1', title: 'Company Work Note', contentMd: '# Company Work Note' },
              linkedResource: {
                type: 'idea',
                id: 'idea-1',
                title: 'Company Work Note',
                url: '/my-work/ideas/idea-1',
              },
              readBack: { status: 'created' },
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/create-output') {
        expect(JSON.parse(String(init?.body))).toEqual({ outputType: 'presentation' });
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: { id: 'draft-1', title: 'Company Work Note', contentMd: '# Company Work Note' },
              outputResource: {
                type: 'presentation',
                id: 'deck-1',
                title: 'Presentation: Company Work Note',
                url: '/presentations/builder/deck-1',
              },
              readBack: { status: 'created' },
            },
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel />);

    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: /Send to idea/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Company Work Note saved to idea. idea-1'
    );

    await user.click(screen.getByRole('button', { name: /Create presentation/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Presentation: Company Work Note created. deck-1'
    );
    expect(screen.getByRole('button', { name: /Create presentation/i })).toHaveAttribute(
      'data-action-status',
      'enabled'
    );
    expect(screen.getByRole('button', { name: /Share Canvas document/i })).toHaveAttribute(
      'data-action-status',
      'enabled'
    );
  });

  it('captures Markdown selection and sends selected context to Teresa', async () => {
    const user = userEvent.setup();
    const onAskTeresaSelection = vi.fn();
    const onCanvasSelectionChange = vi.fn();
    render(
      <WorkCanvasDocumentPanel
        onAskTeresaSelection={onAskTeresaSelection}
        onCanvasSelectionChange={onCanvasSelectionChange}
      />
    );

    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: 'Markdown view' }));
    const mdView = screen.getByTestId('canvas-md-view') as HTMLTextAreaElement;
    const selected = 'Operating workspace';
    const start = mdView.value.indexOf(selected);
    mdView.setSelectionRange(start, start + selected.length);
    fireEvent.select(mdView);

    expect(await screen.findByTestId('canvas-selection-bar')).toHaveTextContent('Selected context');
    expect(onCanvasSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedText: selected, mode: 'md' })
    );

    await user.click(screen.getByRole('button', { name: /Ask Teresa/i }));

    expect(onAskTeresaSelection).toHaveBeenCalledWith(
      expect.objectContaining({ selectedText: selected, mode: 'md' }),
      expect.objectContaining({ title: 'Company Work Note' })
    );
  });

  it('autosaves persisted Markdown edits after debounce without manual save', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({
        data: {
          id: 'draft-1',
          title: 'Company Work Note',
          contentMd: url === '/api/work-canvas/drafts' ? '# Company Work Note' : '# Company Work Note\nAutosaved',
          saveState: 'saved',
          lifecycleState: 'draft',
          markdownProjectionStatus: 'synced',
        },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);

    await screen.findByTestId('canvas-document-view');
    fireEvent.click(screen.getByRole('button', { name: 'Markdown view' }));
    fireEvent.click(screen.getByRole('button', { name: /Save Canvas document/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/work-canvas/drafts', expect.any(Object)));

    const mdView = screen.getByTestId('canvas-md-view') as HTMLTextAreaElement;
    fireEvent.change(mdView, { target: { value: `${mdView.value}\nAutosaved` } });
    expect(screen.getByTestId('canvas-save-state')).toHaveTextContent('Unsaved');

    vi.advanceTimersByTime(1500);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/work-canvas/drafts/draft-1', expect.any(Object))
    );
  });

  it('shares Canvas drafts and loads version history from diagnostics', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: '# Company Work Note',
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/share') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: { id: 'draft-1', title: 'Company Work Note', contentMd: '# Company Work Note' },
              share: { token: 'share-token', url: '/work-canvas/shared/share-token', title: 'Company Work Note' },
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/versions') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 'version-1',
                draftId: 'draft-1',
                operationType: 'replace_selection',
                summary: 'Updated text',
                contentMd: '# Company Work Note',
                createdBy: 'user-1',
                createdAt: '2026-05-03T00:00:00.000Z',
              },
            ],
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);

    await screen.findByTestId('canvas-document-view');
    fireEvent.click(screen.getByRole('button', { name: /Share Canvas document/i }));
    expect(await screen.findByRole('status')).toHaveTextContent('/work-canvas/shared/share-token');

    fireEvent.click(screen.getByRole('button', { name: /Canvas diagnostics/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Versions' }));

    expect(await screen.findByText('replace_selection')).toBeInTheDocument();
    expect(screen.getByText(/Updated text/)).toBeInTheDocument();
  });
});

