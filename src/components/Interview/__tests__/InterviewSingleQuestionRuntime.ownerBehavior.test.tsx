import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/services/api', () => ({
  Api: {},
  API_URL: 'http://local.test/api',
  getHeaders: () => ({}),
}));
vi.mock('../../shared/NModeBlocks/ArtifactAttachPopover', () => ({
  ArtifactAttachPopover: () => null,
}));

import { InterviewSingleQuestionRuntime } from '../InterviewSingleQuestionRuntime';
import type { InterviewQuestion } from '../QuestionsList';

const questions: InterviewQuestion[] = [
  {
    id: 'q-1',
    sessionId: 'session-1',
    category: 'general',
    questionText: 'What outcome must this transformation deliver?',
    answerText: '',
    answerType: 'open',
    status: 'in_progress',
    confidenceScore: 0,
    tags: [],
    sortOrder: 1,
    isTemplate: false,
  },
  {
    id: 'q-2',
    sessionId: 'session-1',
    category: 'general',
    questionText: 'Which executive owns the outcome?',
    answerText: 'COO',
    answerType: 'short_text',
    status: 'answered',
    confidenceScore: 80,
    tags: [],
    sortOrder: 2,
    isTemplate: false,
  },
];

const baseProps = {
  questions,
  evidence: [],
  activeCategory: 'general' as const,
  onCategoryChange: vi.fn(),
  onUploadFile: vi.fn(),
  onAddLink: vi.fn(),
  onAddVoiceEvidence: vi.fn(),
  onSubmitSession: vi.fn(),
};

describe('Interview single-question owner behavior', () => {
  it('renders the immersive list, progress and stable navigation controls', () => {
    render(
      <InterviewSingleQuestionRuntime
        {...baseProps}
        immersive
        onUpdateQuestion={vi.fn()}
      />
    );
    expect(
      screen.getByRole('navigation', {
        name: 'interview.singleQuestionRuntime.questionNavigation',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: questions[0].questionText })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'interview.singleQuestionRuntime.previousQuestion' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'interview.singleQuestionRuntime.saveAnswer' })
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'interview.singleQuestionRuntime.nextQuestion' })
    ).toBeEnabled();
  });

  it('saves the current answer before moving to the next question and exposes Review', async () => {
    const onUpdateQuestion = vi.fn().mockResolvedValue(undefined);
    render(
      <InterviewSingleQuestionRuntime
        {...baseProps}
        immersive
        onUpdateQuestion={onUpdateQuestion}
      />
    );
    fireEvent.change(
      screen.getByPlaceholderText('interview.singleQuestionRuntime.writeTheAnswerOrRecord'),
      { target: { value: 'A measurable EBITDA and lead-time improvement.' } }
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'interview.singleQuestionRuntime.nextQuestion' })
    );
    await waitFor(() =>
      expect(onUpdateQuestion).toHaveBeenCalledWith(
        'q-1',
        expect.objectContaining({
          answerText: 'A measurable EBITDA and lead-time improvement.',
          status: 'answered',
        })
      )
    );
    expect(
      await screen.findByRole('heading', { name: questions[1].questionText })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'interview.singleQuestionRuntime.reviewAndSubmit' })
    ).toBeEnabled();
  });
});
