export function getSafeTeresaWelcomeFirstName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim().normalize('NFC').split(/\s+/u)[0] || '';
  const codePoints = Array.from(candidate);
  if (codePoints.length === 0 || codePoints.length > 40) return null;
  if (!/^[\p{L}\p{M}]+(?:[’'-][\p{L}\p{M}]+)*$/u.test(candidate)) return null;
  if (
    ['undefined', 'null', 'unknown', 'user', 'admin', 'guest', 'test', 'demo'].includes(
      candidate.toLocaleLowerCase()
    )
  ) {
    return null;
  }
  return candidate;
}

export function getHydratedTeresaWelcomeFirstName(input: {
  firstName: unknown;
  userId: unknown;
  isAuthenticated: boolean | undefined;
  isAuthInitializing: boolean;
}): string | null {
  if (input.isAuthInitializing || input.isAuthenticated !== true) return null;
  if (typeof input.userId !== 'string' || !input.userId.trim()) return null;
  return getSafeTeresaWelcomeFirstName(input.firstName);
}
