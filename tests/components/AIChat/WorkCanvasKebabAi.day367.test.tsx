import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/components/AIChat/CanvasEditor/CanvasRichEditor', async (importActual) => {
  const actual = await importActual<
    typeof import('../../../src/components/AIChat/CanvasEditor/CanvasRichEditor')
  >();
  return {
    ...actual,
    CanvasRichEditor: ({ onSelectionChange }: { onSelectionChange?: (value: unknown) => void }) => {
      useEffect(() => {
        onSelectionChange?.({
          selectedText: 'Selected canvas text',
          from: 1,
          to: 21,
          mode: 'rich',
        });
      }, []);
      return <div data-testid="rich-editor-stub">Selected canvas text</div>;
    },
  };
});

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: (state: unknown) => unknown) => {
    const state = { currentUser: null, currentOrganization: null, isAuthInitializing: true };
    return selector ? selector(state) : state;
  },
}));

import { WorkCanvasDocumentPanel } from '../../../src/components/AIChat/WorkCanvasDocumentPanel';

describe('Canvas kebab AI — day 367', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('workCanvas.viewMode.v2', 'rich');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function openKebabSelectionAction() {
    render(<WorkCanvasDocumentPanel />);
    await userEvent.click(await screen.findByRole('button', { name: /Canvas menu/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Expand idea' }));
    await userEvent.click(screen.getByRole('button', { name: 'Preview AI edit' }));
  }

  it('sends the selected text and instruction to /api/ai/chat/quick', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/ai/chat/quick') {
        return { ok: true, json: async () => ({ response: 'Generated replacement' }) };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await openKebabSelectionAction();

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url === '/api/ai/chat/quick')).toBe(true)
    );
    const [url, init] = fetchMock.mock.calls.find(([calledUrl]) => calledUrl === '/api/ai/chat/quick')!;
    expect(url).toBe('/api/ai/chat/quick');
    const body = JSON.parse(String(init?.body));
    expect(body.message).toContain('Expand this thought');
    expect(body.context.selectedText).toBe('Selected canvas text');
    expect(await screen.findByText('Apply edit suggestion')).toBeInTheDocument();
  });

  it('uses a deterministic replacement and shows a visible fallback notice', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({ errorCode: 'AI_CONFIG' }) }))
    );

    await openKebabSelectionAction();

    expect(await screen.findByRole('alert')).toHaveTextContent('template');
    expect(await screen.findByText('Apply edit suggestion')).toBeInTheDocument();
  });

  it('routes Add element through the same AI request boundary', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ response: '## Generated section' }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<WorkCanvasDocumentPanel />);

    await userEvent.click(await screen.findByRole('button', { name: /Canvas menu/i }));
    fireEvent.change(screen.getByLabelText('Element instruction for Teresa'), {
      target: { value: 'Quarterly risks' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Add to canvas' }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url === '/api/ai/chat/quick')).toBe(true)
    );
    const [url, init] = fetchMock.mock.calls.find(([calledUrl]) => calledUrl === '/api/ai/chat/quick')!;
    expect(url).toBe('/api/ai/chat/quick');
    expect(JSON.parse(String(init?.body)).message).toContain('Quarterly risks');
  });

  it('keeps the manual selection preview literal and does not call AI', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<WorkCanvasDocumentPanel />);

    await userEvent.click(await screen.findByRole('radio', { name: 'MD' }));
    const panel = await screen.findByTestId('canvas-selection-edit-panel');
    fireEvent.change(screen.getByLabelText('Selection edit replacement'), {
      target: { value: 'Literal manual replacement' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Preview edit' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(panel).toBeInTheDocument();
    expect(await screen.findByText('Apply edit suggestion')).toBeInTheDocument();
  });
});
