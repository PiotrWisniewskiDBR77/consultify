import { isPublicProductionHost } from './publicProduction';

export const DEMO_ACCEPTANCE_ENV_KEY = 'VITE_DEMO_ACCEPTANCE';

export interface DemoAcceptanceProfileSource {
  env?: Record<string, string | undefined>;
  hostname?: string;
}

function parseEnabled(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  return ['1', 'true', 'on', 'yes'].includes(String(raw).trim().toLowerCase());
}

function runtimeEnv(): Record<string, string | undefined> {
  try {
    return (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  } catch {
    return {};
  }
}

/**
 * Central acceptance profile for demo. The public production hosts are an
 * unconditional deny even if the build variable is copied accidentally.
 */
export function isDemoAcceptanceProfileEnabled(source: DemoAcceptanceProfileSource = {}): boolean {
  const hostname =
    source.hostname ?? (typeof window !== 'undefined' ? (window.location?.hostname ?? '') : '');
  if (isPublicProductionHost(hostname)) return false;
  return parseEnabled((source.env ?? runtimeEnv())[DEMO_ACCEPTANCE_ENV_KEY]);
}
