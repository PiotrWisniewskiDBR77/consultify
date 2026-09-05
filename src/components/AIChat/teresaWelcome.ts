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

/**
 * Powitanie Teresy (właściciel 05.09, odbiór MVP): nagłówek ma być POWITANIEM, nie „Porozmawiaj
 * z Teresą", i ma rotować między pięcioma wariantami, żeby pierwsze wrażenie nie było zawsze
 * tym samym zdaniem. Klucze i18n: `aiChat.teresaGreetings.1`…`.5`. Wybór jest losowy per
 * zamontowanie ekranu (seed podaje komponent), deterministyczny w testach.
 */
export const TERESA_WELCOME_GREETING_COUNT = 5;

export function pickTeresaWelcomeGreetingIndex(seed: number = Math.random()): number {
  const n = TERESA_WELCOME_GREETING_COUNT;
  if (!Number.isFinite(seed)) return 1;
  const unit = seed >= 0 && seed < 1 ? seed : Math.abs(seed % 1);
  return Math.min(n, Math.floor(unit * n) + 1);
}
