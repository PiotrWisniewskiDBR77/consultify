import { describe, expect, it } from 'vitest';

import {
  calculateInterviewProgress,
  getInterviewWorkspacePresentation,
} from '../InterviewWorkspace';

describe('calculateInterviewProgress', () => {
  it('counts organization-defined question categories in the session total', () => {
    const progress = calculateInterviewProgress([
      { status: 'answered' },
      { status: 'answered' },
      { status: 'answered' },
    ]);

    expect(progress).toEqual({
      totalQuestions: 3,
      answeredQuestions: 3,
      overallPercent: 100,
    });
  });

  it('keeps an empty interview at an honest zero percent', () => {
    expect(calculateInterviewProgress([])).toEqual({
      totalQuestions: 0,
      answeredQuestions: 0,
      overallPercent: 0,
    });
  });
});

describe('getInterviewWorkspacePresentation', () => {
  it('keeps the owner-approved single-question flow in its dedicated wide workspace', () => {
    expect(getInterviewWorkspacePresentation('single_question')).toBe(
      'dedicated_question_workspace'
    );
  });

  it.each(['task_list', 'conversational'] as const)(
    'keeps %s inside the shared N-mode shell',
    (runtimeMode) => {
      expect(getInterviewWorkspacePresentation(runtimeMode)).toBe('n_mode_shell');
    }
  );
});
