export function getSafeTeresaWelcomeFirstName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const firstName = value.trim().split(/\s+/u)[0]?.slice(0, 40) || '';
  return firstName || null;
}
