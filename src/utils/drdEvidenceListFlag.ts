const ENV_KEY = 'VITE_DRD_EVIDENCE_LIST';

export function isDrdEvidenceListEnabled(
  env: Record<string, string | undefined> = import.meta.env
): boolean {
  return String(env[ENV_KEY] ?? '').trim().toLowerCase() === 'true';
}

export const DRD_EVIDENCE_LIST_ENV_KEY = ENV_KEY;
