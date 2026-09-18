import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('interviewAiScoreFlag (VITE_INTERVIEW_AI_SCORE)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns false when env var is not set (default OFF)', async () => {
    vi.stubEnv('VITE_INTERVIEW_AI_SCORE', '');
    const { isInterviewAiScoreEnabled } = await import('@/utils/interviewAiScoreFlag');
    expect(isInterviewAiScoreEnabled()).toBe(false);
  });

  it('returns false when env var is "false"', async () => {
    vi.stubEnv('VITE_INTERVIEW_AI_SCORE', 'false');
    const { isInterviewAiScoreEnabled } = await import('@/utils/interviewAiScoreFlag');
    expect(isInterviewAiScoreEnabled()).toBe(false);
  });

  it('returns true when env var is "true"', async () => {
    vi.stubEnv('VITE_INTERVIEW_AI_SCORE', 'true');
    const { isInterviewAiScoreEnabled } = await import('@/utils/interviewAiScoreFlag');
    expect(isInterviewAiScoreEnabled()).toBe(true);
  });

  it('exports the env key name', async () => {
    const { INTERVIEW_AI_SCORE_FLAG_KEYS } = await import('@/utils/interviewAiScoreFlag');
    expect(INTERVIEW_AI_SCORE_FLAG_KEYS.env).toBe('VITE_INTERVIEW_AI_SCORE');
  });
});
