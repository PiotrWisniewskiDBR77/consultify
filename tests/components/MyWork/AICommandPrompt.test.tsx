import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const chatWithAIStream = vi.fn();
const notebookCreateAIProposal = vi.fn();
vi.mock('@/services/api', () => ({
  Api: {
    chatWithAIStream: (...a: any[]) => chatWithAIStream(...a),
    notebookCreateAIProposal: (...a: any[]) => notebookCreateAIProposal(...a),
  },
}));

const trackFunnelEvent = vi.fn();
vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...a: any[]) => trackFunnelEvent(...a),
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const i18nState = vi.hoisted(() => ({ language: 'en' }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: i18nState, t: (k: string) => k }),
}));

import { AICommandPrompt } from '@/components/MyWork/notebook/AICommandPrompt';

const editor = {} as any; // truthy editor is enough; component only gates on its presence

const baseProps = {
  editor,
  pageId: 'p1',
  noteTitle: 'My note',
  noteContent: 'note body',
  noteTags: ['strategy'],
};

describe('AICommandPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18nState.language = 'en';
    notebookCreateAIProposal.mockResolvedValue({ id: 'prop1' });
  });

  it('renders the command input with the English placeholder', () => {
    render(<AICommandPrompt {...baseProps} />);
    expect(screen.getByPlaceholderText('myWorkNotebook.aiCommandPrompt.placeholder')).toBeInTheDocument();
  });

  it('disables the send button until a command is typed', () => {
    render(<AICommandPrompt {...baseProps} />);
    const send = screen.getByTitle('myWorkNotebook.aiCommandPrompt.executeCommand');
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('myWorkNotebook.aiCommandPrompt.placeholder'), {
      target: { value: 'summarize this' },
    });
    expect(send).not.toBeDisabled();
  });

  it('streams a command and creates an AI proposal on completion', async () => {
    chatWithAIStream.mockImplementation(async (_m: any, _h: any, onChunk: any, onComplete: any) => {
      onChunk('Generated body');
      onComplete();
    });
    const onProposalCreated = vi.fn();
    render(<AICommandPrompt {...baseProps} onProposalCreated={onProposalCreated} />);
    fireEvent.change(screen.getByPlaceholderText('myWorkNotebook.aiCommandPrompt.placeholder'), {
      target: { value: 'draft a plan' },
    });
    fireEvent.click(screen.getByTitle('myWorkNotebook.aiCommandPrompt.executeCommand'));

    await waitFor(() => expect(chatWithAIStream).toHaveBeenCalled());
    await waitFor(() =>
      expect(notebookCreateAIProposal).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ proposalType: 'append' })
      )
    );
    await waitFor(() => expect(onProposalCreated).toHaveBeenCalled());
  });

  it('submits on Enter', async () => {
    chatWithAIStream.mockImplementation(async (_m: any, _h: any, _c: any, onComplete: any) => onComplete());
    render(<AICommandPrompt {...baseProps} />);
    const input = screen.getByPlaceholderText('myWorkNotebook.aiCommandPrompt.placeholder');
    fireEvent.change(input, { target: { value: 'do it' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(chatWithAIStream).toHaveBeenCalled());
  });

  it('does nothing when the editor is null', () => {
    render(<AICommandPrompt {...baseProps} editor={null} />);
    fireEvent.change(screen.getByPlaceholderText('myWorkNotebook.aiCommandPrompt.placeholder'), {
      target: { value: 'no editor' },
    });
    fireEvent.click(screen.getByTitle('myWorkNotebook.aiCommandPrompt.executeCommand'));
    expect(chatWithAIStream).not.toHaveBeenCalled();
  });
});
