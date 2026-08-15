import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const chatWithAIStream = vi.fn();
vi.mock('@/services/api', () => ({
  Api: { chatWithAIStream: (...a: any[]) => chatWithAIStream(...a) },
}));

const trackFunnelEvent = vi.fn();
vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...a: any[]) => trackFunnelEvent(...a),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const i18nState = vi.hoisted(() => ({ language: 'en' }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: i18nState,
    t: (key: string) =>
      ({
        'myWorkNotebook.aiInlineResponse.label_ask': 'AI Answer',
        'myWorkNotebook.aiInlineResponse.label_expand': 'AI Expansion',
        'myWorkNotebook.aiInlineResponse.label_challenge': 'AI Challenge',
        'myWorkNotebook.aiInlineResponse.label_action': 'AI Action Plan',
        'myWorkNotebook.aiInlineResponse.proposeForNote': 'Propose for note',
        'myWorkNotebook.aiInlineResponse.failed': 'Failed to get AI response',
      })[key] ?? key,
  }),
}));

import { AIInlineResponse } from '@/components/MyWork/notebook/AIInlineResponse';

const baseProps = {
  pageId: 'p1',
  noteContent: 'Some note body',
  noteTitle: 'My note',
  onInsert: vi.fn(),
  onDismiss: vi.fn(),
};

describe('AIInlineResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18nState.language = 'en';
  });

  it('streams an answer and shows the ask label', async () => {
    chatWithAIStream.mockImplementation(async (_m: any, _h: any, onChunk: any, onComplete: any) => {
      onChunk('Here is the answer.');
      onComplete();
    });
    render(<AIInlineResponse {...baseProps} commandType="ask" />);
    expect(await screen.findByText('AI Answer')).toBeInTheDocument();
    expect(await screen.findByText('Here is the answer.')).toBeInTheDocument();
  });

  it('uses a distinct label for each command type', async () => {
    chatWithAIStream.mockImplementation(async (_m: any, _h: any, onChunk: any, onComplete: any) => {
      onChunk('x');
      onComplete();
    });
    const expandView = render(<AIInlineResponse {...baseProps} commandType="expand" />);
    expect(await screen.findByText('AI Expansion')).toBeInTheDocument();
    expandView.unmount();

    render(<AIInlineResponse {...baseProps} commandType="challenge" />);
    expect(await screen.findByText('AI Challenge')).toBeInTheDocument();
  });

  it('inserts the response when "Propose for note" is clicked', async () => {
    const onInsert = vi.fn();
    chatWithAIStream.mockImplementation(async (_m: any, _h: any, onChunk: any, onComplete: any) => {
      onChunk('Generated plan');
      onComplete();
    });
    render(<AIInlineResponse {...baseProps} commandType="action" onInsert={onInsert} />);
    fireEvent.click(await screen.findByText('Propose for note'));
    expect(onInsert).toHaveBeenCalledWith('Generated plan');
  });

  it('passes the user query into the ask message', async () => {
    chatWithAIStream.mockImplementation(async (_m: any, _h: any, onChunk: any, onComplete: any) => {
      onComplete();
    });
    render(<AIInlineResponse {...baseProps} commandType="ask" userQuery="What is the risk?" />);
    await waitFor(() => expect(chatWithAIStream).toHaveBeenCalled());
    const message = chatWithAIStream.mock.calls[0][0] as string;
    expect(message).toContain('What is the risk?');
  });

  it('shows an error state when the stream rejects', async () => {
    chatWithAIStream.mockRejectedValueOnce(new Error('stream failed'));
    render(<AIInlineResponse {...baseProps} commandType="ask" />);
    expect(await screen.findByText('Failed to get AI response')).toBeInTheDocument();
  });

  it('tracks a funnel event for the command', async () => {
    chatWithAIStream.mockImplementation(async (_m: any, _h: any, onChunk: any, onComplete: any) => {
      onComplete();
    });
    render(<AIInlineResponse {...baseProps} commandType="challenge" />);
    await waitFor(() =>
      expect(trackFunnelEvent).toHaveBeenCalledWith('notebook_ai_command_used', { command: 'challenge' })
    );
  });
});
