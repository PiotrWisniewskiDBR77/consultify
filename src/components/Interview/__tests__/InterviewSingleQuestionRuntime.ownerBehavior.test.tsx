import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    render(<InterviewSingleQuestionRuntime {...baseProps} immersive onUpdateQuestion={vi.fn()} />);
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

  it('uses the per-question approval lock while a returned sibling stays editable', async () => {
    render(
      <InterviewSingleQuestionRuntime
        {...baseProps}
        immersive
        readOnly
        isQuestionReadOnly={(questionId) => questionId !== 'q-1'}
        onUpdateQuestion={vi.fn()}
      />
    );
    expect(
      screen.getByRole('button', { name: 'interview.singleQuestionRuntime.saveAnswer' })
    ).toBeEnabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'interview.singleQuestionRuntime.nextQuestion' })
    );
    expect(
      await screen.findByRole('heading', { name: questions[1].questionText })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'interview.singleQuestionRuntime.saveAnswer' })
    ).toBeNull();
    expect(
      screen.getByPlaceholderText('interview.singleQuestionRuntime.writeTheAnswerOrRecord')
    ).toBeDisabled();
  });

  it('renders approval as question state and records neutral reviewer decisions', async () => {
    const onAnswerDecision = vi.fn().mockResolvedValue(undefined);
    const approval = {
      questionId: 'q-1',
      submissionId: 'submission-1',
      answerUpdatedAt: '2026-09-15T10:00:00.000Z',
      answerDigest: 'digest',
      policyMode: 'manager' as const,
      policyVersion: 1,
      status: 'pending' as const,
      nextStage: 'manager' as const,
      latestDecision: null,
      reason: null,
      decidedAt: null,
      actor: null,
    };

    render(
      <InterviewSingleQuestionRuntime
        {...baseProps}
        immersive
        readOnly
        isReviewerMode
        answerApprovals={[approval]}
        onAnswerDecision={onAnswerDecision}
        onUpdateQuestion={vi.fn()}
      />
    );

    expect(screen.getAllByText('interview.workspace.answerApprovalStatus.pending')).toHaveLength(2);
    const approve = screen.getByRole('button', { name: 'interview.workspace.approveAnswer' });
    const sendBack = screen.getByRole('button', { name: 'interview.workspace.sendBackAnswer' });
    expect(approve.className).not.toMatch(/bg-c-success|bg-c-danger/);
    expect(sendBack.className).not.toMatch(/bg-c-success|bg-c-danger/);

    fireEvent.click(approve);
    await waitFor(() => expect(onAnswerDecision).toHaveBeenCalledWith(approval, 'approved'));

    fireEvent.click(sendBack);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: 'Add the measured baseline.' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'interview.workspace.sendBackAnswer' })
    );
    await waitFor(() =>
      expect(onAnswerDecision).toHaveBeenCalledWith(
        approval,
        'sent_back',
        'Add the measured baseline.'
      )
    );
  });
});
