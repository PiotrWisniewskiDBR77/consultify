import { describe, expect, it } from 'vitest';

import { calculateInterviewProgress } from '../InterviewWorkspace';

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
