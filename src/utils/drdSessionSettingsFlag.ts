const ENV_KEY = 'VITE_DRD_SESSION_SETTINGS';

export function isDrdSessionSettingsEnabled(
  env: Record<string, string | undefined> = import.meta.env
): boolean {
  return String(env[ENV_KEY] ?? '').trim().toLowerCase() === 'true';
}

export const DRD_SESSION_SETTINGS_ENV_KEY = ENV_KEY;
