import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotebookInlineAIMenu } from '../NotebookInlineAIMenu';

const { chatWithAIStream, createProposal, resolveProposal } = vi.hoisted(() => ({
  chatWithAIStream: vi.fn(),
  createProposal: vi.fn(),
  resolveProposal: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    chatWithAIStream,
    notebookCreateAIProposal: createProposal,
    notebookResolveAIProposal: resolveProposal,
  },
}));

vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
    i18n: { language: 'en' },
  }),
}));

function fakeEditor() {
  let selectionListener: (() => void) | null = null;
  const editor = {
    state: {
      selection: {
        empty: false,
        from: 1,
        to: 9,
        content: () => ({ size: 8 }),
        $from: { index: () => 0, before: () => 0 },
        $to: { index: () => 0, after: () => 10 },
      },
      doc: { textBetween: () => 'Original text' },
    },
    view: { coordsAtPos: () => ({ top: 10, bottom: 20, left: 20, right: 30 }) },
    on: (_event: string, listener: () => void) => {
      selectionListener = listener;
    },
    off: vi.fn(),
  };
  return { editor: editor as any, show: () => selectionListener?.() };
}

async function reachPreview(onApplied = vi.fn()) {
  const { editor, show } = fakeEditor();
  render(<NotebookInlineAIMenu editor={editor} pageId="page-1" onApplied={onApplied} />);
  act(show);
  fireEvent.click(screen.getByTestId('notebook-inline-ai-trigger'));
  fireEvent.click(screen.getByTestId('notebook-inline-ai-shorten'));
  await waitFor(() => expect(screen.getByTestId('notebook-inline-ai-preview')).toBeInTheDocument());
  return onApplied;
}

describe('NotebookInlineAIMenu governed lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createProposal.mockResolvedValue({ id: 'proposal-1' });
    resolveProposal.mockResolvedValue({ success: true });
    chatWithAIStream.mockImplementation(async (...args: any[]) => {
      args[2]('Revised text');
      args[3]();
    });
  });

  it('renders Before/Proposed provenance before one explicit approval', async () => {
    const onApplied = await reachPreview();
    expect(screen.getByText('Original text')).toBeInTheDocument();
    expect(screen.getByText('Revised text')).toBeInTheDocument();
    expect(screen.getByText(/Teresa proposal · Shorten/)).toBeInTheDocument();
    const approve = screen.getByTestId('notebook-inline-ai-approve');
    fireEvent.click(approve);
    fireEvent.click(approve);
    await waitFor(() => expect(resolveProposal).toHaveBeenCalledWith('proposal-1', 'accepted'));
    expect(resolveProposal).toHaveBeenCalledOnce();
    expect(onApplied).toHaveBeenCalledOnce();
  });

  it('keeps a failed rejection pending and retries the same proposal', async () => {
    resolveProposal.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({});
    await reachPreview();
    fireEvent.click(screen.getByTestId('notebook-inline-ai-reject'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Nie udało się'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(resolveProposal).toHaveBeenCalledTimes(2));
    expect(resolveProposal).toHaveBeenLastCalledWith('proposal-1', 'rejected');
  });

  it('keeps unqualified rewrite actions focusable, explained and fail closed', () => {
    const { editor, show } = fakeEditor();
    render(
      <NotebookInlineAIMenu
        editor={editor}
        pageId="page-1"
        onApplied={vi.fn()}
        receiptCapableActionIds={[]}
      />
    );
    act(show);
    fireEvent.click(screen.getByTestId('notebook-inline-ai-trigger'));
    const shorten = screen.getByTestId('notebook-inline-ai-shorten');
    expect(shorten).toHaveAttribute('aria-disabled', 'true');
    expect(shorten).toHaveAccessibleDescription(/durable action receipt/);
    fireEvent.click(shorten);
    expect(chatWithAIStream).not.toHaveBeenCalled();
    expect(createProposal).not.toHaveBeenCalled();
  });
});
