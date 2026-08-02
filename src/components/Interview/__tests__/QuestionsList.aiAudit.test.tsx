import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QuestionsList, type InterviewQuestion } from '../QuestionsList';

const apiPost = vi.fn();

vi.mock('@/services/api', () => ({
  Api: { post: (...args: unknown[]) => apiPost(...args) },
}));

vi.mock('@/services/ai/gemini', () => ({ sendMessageToAI: vi.fn() }));

const question: InterviewQuestion = {
  id: 'q-1',
  sessionId: 's-1',
  category: 'strategy',
  questionText: 'What should change?',
  answerText: '',
  status: 'not_started',
  confidenceScore: 0,
  tags: [],
  sortOrder: 1,
  isTemplate: false,
};

function renderList(onUpdateQuestion = vi.fn().mockResolvedValue(undefined)) {
  render(
    <QuestionsList
      questions={[question]}
      category="strategy"
      runtimeMode="single_question"
      onUpdateQuestion={onUpdateQuestion}
      onAddQuestion={vi.fn().mockResolvedValue(undefined)}
    />
  );
  return { onUpdateQuestion };
}

describe('QuestionsList Teresa audit decisions', () => {
  beforeEach(() => {
    apiPost.mockReset();
  });

  it('passes suggestionId into the explicit answer save', async () => {
    apiPost.mockResolvedValueOnce({ answerText: 'Teresa draft', suggestionId: 'suggestion-1' });
    const { onUpdateQuestion } = renderList();

    fireEvent.click(await screen.findByRole('button', { name: /draftWithAi/i }));
    expect(await screen.findByDisplayValue('Teresa draft')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /questionsList\.save/i }));

    await waitFor(() =>
      expect(onUpdateQuestion).toHaveBeenCalledWith(
        'q-1',
        expect.objectContaining({
          answerText: 'Teresa draft',
          status: 'answered',
          aiSuggestionId: 'suggestion-1',
        })
      )
    );
  });

  it('persists rejection before closing an AI draft', async () => {
    apiPost
      .mockResolvedValueOnce({ answerText: 'Teresa draft', suggestionId: 'suggestion-2' })
      .mockResolvedValueOnce({ decision: 'rejected' });
    renderList();

    fireEvent.click(await screen.findByRole('button', { name: /draftWithAi/i }));
    expect(await screen.findByDisplayValue('Teresa draft')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /questionsList\.cancel/i }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenLastCalledWith(
        '/interview/questions/q-1/ai-suggestions/suggestion-2/reject',
        {}
      )
    );
    await waitFor(() => expect(screen.queryByDisplayValue('Teresa draft')).not.toBeInTheDocument());
  });
});
