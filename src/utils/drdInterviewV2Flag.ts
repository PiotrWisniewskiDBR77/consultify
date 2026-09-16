const ENV_KEY = 'VITE_DRD_INTERVIEW_V2';

export function isDrdInterviewV2Enabled(env: Record<string, string | undefined> = import.meta.env): boolean {
  return String(env[ENV_KEY] ?? '').trim().toLowerCase() === 'true';
}

export const DRD_INTERVIEW_V2_ENV_KEY = ENV_KEY;
