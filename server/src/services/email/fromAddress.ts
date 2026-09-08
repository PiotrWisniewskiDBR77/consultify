/**
 * From-address display name formatting.
 *
 * Split out of `emailService.ts` (not merely for style) because
 * `tests/setup.ts` globally `vi.mock()`s `emailService.js` for every vitest
 * suite in the repo (to stop tests sending real mail) — a unit test that
 * imports the real `formatFromAddress` alongside `emailService.ts` would
 * always get the mocked module back. Keeping this pure, dependency-free
 * function in its own file lets it be unit-tested directly.
 */

/**
 * Ensure a From address carries a display name, e.g. turns
 * `hello@consultinity.com` into `"Consultify" <hello@consultinity.com>`.
 * Leaves an already-named value (`Name <email>` / `"Name" <email>`) alone —
 * an operator who configured SMTP_FROM/smtp_from with an explicit name wins.
 * Never modifies the email address itself.
 */
export function formatFromAddress(rawFrom: string, displayNameOverride?: string): string {
  const trimmed = String(rawFrom || '').trim();
  if (!trimmed) return '"Consultify" <system@consultify.com>';

  // Already has a display name in front of an <email> part.
  if (/^.+<[^<>]+>$/.test(trimmed)) {
    return trimmed;
  }

  const displayName = String(displayNameOverride || '').trim() || 'Consultify';
  const safeDisplayName = displayName.replace(/"/g, '');
  return `"${safeDisplayName}" <${trimmed}>`;
}

export default { formatFromAddress };
