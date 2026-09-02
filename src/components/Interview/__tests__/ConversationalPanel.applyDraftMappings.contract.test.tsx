/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: toastSuccess, error: toastError }),
}));

vi.mock('@/components/shared/TeresaMark', () => ({ TeresaMark: () => null }));
vi.mock('../../../services/api', () => ({ getHeaders: () => ({}) }));
vi.mock('../../../services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));

import { ConversationalPanel } from '../ConversationalPanel';

const questions = [
  { id: 'q-1', questionText: 'First?', category: 'general', status: 'in_progress' },
  { id: 'q-2', questionText: 'Second?', category: 'general', status: 'in_progress' },
];

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/ai-parse')) {
        return {
          ok: true,
          json: async () => ({
            answers: [
              { questionId: 'q-1', answerText: 'one' },
              { questionId: 'q-2', answerText: 'two' },
            ],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          messages: [
            { id: 'm-1', role: 'user', content: 'answers', createdAt: '2026-09-01T00:00:00Z' },
          ],
        }),
      };
    })
  );
});

async function parseAndApply(onQuestionAnswered: (id: string, answer: string) => Promise<void>) {
  render(
    <ConversationalPanel
      sessionId="session-1"
      questions={questions}
      onQuestionAnswered={onQuestionAnswered}
    />
  );
  await waitFor(() => expect(screen.getByText('answers')).toBeInTheDocument());
  fireEvent.click(screen.getByTitle('interview.conversational.parseToAnswers'));
  await waitFor(() =>
    expect(screen.getByText('interview.conversational.acceptAnswer (2)')).toBeInTheDocument()
  );
  fireEvent.click(screen.getByText('interview.conversational.acceptAnswer (2)'));
}

describe('ConversationalPanel applyDraftMappings save contract', () => {
  it('waits for every accepted answer before reporting the real successful count', async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const onQuestionAnswered = vi
      .fn<(id: string, answer: string) => Promise<void>>()
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce(undefined);

    await parseAndApply(onQuestionAnswered);
    expect(toastSuccess).not.toHaveBeenCalled();
    release?.();

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Applied 2 answers'));
    expect(onQuestionAnswered).toHaveBeenCalledTimes(2);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('reports partial failure and keeps only failed mappings available for retry', async () => {
    const onQuestionAnswered = vi
      .fn<(id: string, answer: string) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Object.assign(new Error('stale version'), { status: 409 }));

    await parseAndApply(onQuestionAnswered);

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Saved 1 of 2 answers. 1 failed; review and retry.')
    );
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('interview.conversational.acceptAnswer (1)')).toBeInTheDocument();
    expect(screen.queryByText('one')).not.toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
  });
});
