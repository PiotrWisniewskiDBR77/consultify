/**
 * MFA grace-period policy (pure).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Before 2026-09-02 the product had a closed loop: `organizations.mfa_required`
 * refused every login of a member without an enrolled factor, while the only
 * way to enroll a factor sits BEHIND that login. `organizations
 * .mfa_grace_period_days` already existed, and the refusal even echoed it back
 * as `gracePeriodRemaining` — but nothing ever computed a remaining period and
 * nothing ever let a login through. The number was the organisation's static
 * configuration, not a countdown, and there was no date recording WHEN the
 * requirement was switched on.
 *
 * This module is the missing arithmetic, kept pure so it can be asserted
 * directly and reused by both the login path and the admin guard.
 */

export const DEFAULT_MFA_GRACE_PERIOD_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type MfaGraceInput = {
  /** organizations.mfa_required */
  enforced: boolean;
  /** user_mfa.enabled — an enrolled member is never inside a grace period */
  enabled: boolean;
  /** organizations.mfa_required_since — when enforcement was switched on */
  requiredSince?: string | Date | null;
  /** users.created_at — a member who joined later gets their own runway */
  userCreatedAt?: string | Date | null;
  /** organizations.mfa_grace_period_days */
  gracePeriodDays?: number | string | null;
  now?: Date;
};

export type MfaGraceDecision = {
  /** Effective configured length of the runway, in days. */
  gracePeriodDays: number;
  /** True while login must be allowed despite the missing factor. */
  graceActive: boolean;
  /** Whole days left (rounded up); 0 once the runway is spent. */
  daysRemaining: number;
  /** ISO instant after which enforcement bites; null when not applicable. */
  deadline: string | null;
};

function toTime(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeGraceDays(raw: number | string | null | undefined): number {
  if (raw === null || raw === undefined || raw === '') return DEFAULT_MFA_GRACE_PERIOD_DAYS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_MFA_GRACE_PERIOD_DAYS;
  // A deliberate 0 means "no runway" and must survive; negatives are nonsense.
  return Math.max(0, Math.floor(parsed));
}

/**
 * Decide whether a member without an enrolled second factor may still log in.
 *
 * Anchor = the later of (a) the moment the organisation switched enforcement on
 * and (b) the moment the member's account was created. A member who joins an
 * already-enforcing organisation therefore gets their own onboarding runway
 * instead of being locked out on day one.
 *
 * When BOTH dates are missing the anchor falls back to "now" only if the row
 * genuinely carries no history; a known `created_at` always wins. This is
 * deliberately NOT fail-open on enforcement: an organisation whose anchor was
 * lost still enforces, and the member reaches the scoped enrollment ticket
 * instead of a dead end.
 */
export function evaluateMfaGrace(input: MfaGraceInput): MfaGraceDecision {
  const gracePeriodDays = normalizeGraceDays(input.gracePeriodDays);
  if (!input.enforced || input.enabled) {
    return { gracePeriodDays, graceActive: false, daysRemaining: 0, deadline: null };
  }

  const now = (input.now ?? new Date()).getTime();
  const since = toTime(input.requiredSince);
  const created = toTime(input.userCreatedAt);
  const anchor =
    since !== null && created !== null
      ? Math.max(since, created)
      : (since ?? created ?? now);

  const deadlineMs = anchor + gracePeriodDays * DAY_MS;
  const graceActive = gracePeriodDays > 0 && now < deadlineMs;
  const daysRemaining = graceActive ? Math.max(1, Math.ceil((deadlineMs - now) / DAY_MS)) : 0;

  return {
    gracePeriodDays,
    graceActive,
    daysRemaining,
    deadline: new Date(deadlineMs).toISOString(),
  };
}
