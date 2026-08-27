export type QuickAccessEntry = { email: string; password: string } | { demo: true };

type QuickAccessEnv = {
  VITE_QUICK_ACCESS_MAP?: unknown;
};

function isCredentialEntry(value: unknown): value is { email: string; password: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.email === 'string' &&
    candidate.email.trim().length > 0 &&
    typeof candidate.password === 'string' &&
    candidate.password.trim().length > 0
  );
}

function isDemoEntry(value: unknown): value is { demo: true } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.demo === true && !('email' in candidate) && !('password' in candidate);
}

export function readQuickAccessMap(
  env: QuickAccessEnv = import.meta.env
): Record<string, QuickAccessEntry> {
  const raw = env.VITE_QUICK_ACCESS_MAP;
  if (typeof raw !== 'string' || raw.trim().length === 0) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([pin, entry]) => /^\d{4}$/.test(pin) && (isCredentialEntry(entry) || isDemoEntry(entry))
      )
    );
  } catch {
    return {};
  }
}
