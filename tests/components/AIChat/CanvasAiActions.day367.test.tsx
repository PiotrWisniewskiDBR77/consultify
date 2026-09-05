import type { Editor } from '@tiptap/core';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasRichEditor } from '../../../src/components/AIChat/CanvasEditor/CanvasRichEditor';

function installSelectionRect() {
  const realGetSelection = window.getSelection.bind(window);
  vi.spyOn(window, 'getSelection').mockImplementation(() => {
    const selection = realGetSelection();
    if (selection) {
      selection.getRangeAt = () =>
        ({
          getBoundingClientRect: () => ({
            top: 100,
            left: 100,
            width: 50,
            height: 16,
            right: 150,
            bottom: 116,
            x: 100,
            y: 100,
            toJSON: () => ({}),
          }),
        }) as unknown as Range;
      Object.defineProperty(selection, 'rangeCount', { configurable: true, get: () => 1 });
    }
    return selection;
  });
}

async function selectEditorText(contentMd: string, to: number) {
  let editor: Editor | null = null;
  render(
    <CanvasRichEditor
      contentMd={contentMd}
      onContentChange={vi.fn()}
      onEditorReady={(instance) => {
        editor = instance;
      }}
    />
  );
  await waitFor(() => expect(editor).not.toBeNull());
  installSelectionRect();
  act(() => editor!.commands.setTextSelection({ from: 1, to }));
  await screen.findByTitle('Ask Teresa');
}

describe('Canvas AI actions — day 367', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows the shared provider error when a non-Explain floating action gets HTTP 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({ errorCode: 'AI_UNAVAILABLE' }) }))
    );
    await selectEditorText('The quick brown fox', 10);

    await userEvent.click(screen.getByTitle('Expand selection (max 2x)'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The assistant is temporarily unavailable.'
    );
  });

  it('rejects a message longer than 8000 characters before fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const content = 'x'.repeat(8010);
    await selectEditorText(content, content.length + 1);

    await userEvent.click(screen.getByTitle('Expand selection (max 2x)'));

    expect(await screen.findByRole('alert')).toHaveTextContent('too long');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the existing Explain error visible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({ errorCode: 'AI_UNAVAILABLE' }) }))
    );
    await selectEditorText('The quick brown fox', 10);

    await userEvent.click(screen.getByTitle('Explain selection (does not modify the document)'));

    expect(
      await screen.findByText('Could not get an explanation. Please try again.')
    ).toBeInTheDocument();
  });
});
