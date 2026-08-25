import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../public/locales/en/translation.json';

// AICommandPrompt.tsx calls t('myWorkNotebook.aiCommandPrompt.placeholder') etc. with NO
// inline fallback (relies on public/locales/en/translation.json). A `t: (k) => k` identity
// mock returns the raw key, so placeholder/title assertions against real product copy never
// matched. Resolve real English copy instead (same pattern as IdeaExportMenu.test.tsx).
function resolveTranslation(key: string, options?: Record<string, unknown>): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, segment) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined),
      enTranslation
    );
  const template = typeof value === 'string' ? value : key;
  if (!options) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name) =>
    Object.prototype.hasOwnProperty.call(options, name) ? String(options[name]) : `{{${name}}}`
  );
}

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
  useTranslation: () => ({ i18n: i18nState, t: (k: string, opts?: Record<string, unknown>) => resolveTranslation(k, opts) }),
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
    expect(screen.getByPlaceholderText(/write a 5-step plan/i)).toBeInTheDocument();
  });

  it('disables the send button until a command is typed', () => {
    render(<AICommandPrompt {...baseProps} />);
    const send = screen.getByTitle('Execute command');
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/write a 5-step plan/i), {
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
    fireEvent.change(screen.getByPlaceholderText(/write a 5-step plan/i), {
      target: { value: 'draft a plan' },
    });
    fireEvent.click(screen.getByTitle('Execute command'));

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
    const input = screen.getByPlaceholderText(/write a 5-step plan/i);
    fireEvent.change(input, { target: { value: 'do it' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(chatWithAIStream).toHaveBeenCalled());
  });

  it('does nothing when the editor is null', () => {
    render(<AICommandPrompt {...baseProps} editor={null} />);
    fireEvent.change(screen.getByPlaceholderText(/write a 5-step plan/i), {
      target: { value: 'no editor' },
    });
    fireEvent.click(screen.getByTitle('Execute command'));
    expect(chatWithAIStream).not.toHaveBeenCalled();
  });
});
