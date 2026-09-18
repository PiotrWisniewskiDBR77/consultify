const ENV_KEY = 'VITE_INTERVIEW_AI_SCORE';

export const INTERVIEW_AI_SCORE_FLAG_KEYS = { env: ENV_KEY } as const;

export function isInterviewAiScoreEnabled(): boolean {
  try {
    return (
      (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY] === 'true'
    );
  } catch {
    return false;
  }
}
