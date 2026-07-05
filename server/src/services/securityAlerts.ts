/**
 * Security alerting — "szybka reakcja" on suspicious auth/authorization events.
 *
 * The platform already COLLECTS the raw signals (login_history, audit_events)
 * but nobody was paged on them. This module turns two high-value signals into
 * throttled Slack #alerts:
 *
 *   1. Brute-force login — repeated failed logins against one account or from
 *      one IP within a short window (complements the existing rate-limiter,
 *      which blocks but stays silent).
 *   2. Privilege escalation — a user being granted SUPER_ADMIN / OWNER.
 *
 * All best-effort / fail-soft: alerting must never break login or admin flows.
 * The counting is pure and exported so it can be unit-tested without Slack.
 */

import logger from '../utils/Logger.js';
import { sendSystemAlert } from './systemAlertNotifier.js';

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const FAILED_LOGIN_THRESHOLD = 8; // failed attempts per key within the window
const ALERT_THROTTLE_MS = 30 * 60 * 1000; // 30 min between alerts per key
const MAX_TRACKED_KEYS = 2000;

const buckets = new Map<string, number[]>();

/**
 * Record one occurrence for `key` and return the count within the sliding
 * window. Pure/synchronous and exported for testing. Evicts the least-recently
 * touched key when the map overflows.
 */
export function bumpAndCount(key: string, now: number = Date.now()): number {
  const recent = (buckets.get(key) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  buckets.set(key, recent);

  if (buckets.size > MAX_TRACKED_KEYS) {
    let oldestKey: string | null = null;
    let oldestTs = Infinity;
    for (const [k, times] of buckets) {
      const last = times[times.length - 1] ?? 0;
      if (last < oldestTs) {
        oldestTs = last;
        oldestKey = k;
      }
    }
    if (oldestKey) buckets.delete(oldestKey);
  }

  return recent.length;
}

/** Test-only: reset the in-memory window state. */
export function __resetSecurityWindows(): void {
  buckets.clear();
}

export const SECURITY_ALERT_CONFIG = {
  WINDOW_MS,
  FAILED_LOGIN_THRESHOLD,
  ALERT_THROTTLE_MS,
} as const;

/**
 * Record a failed login and page if it crosses the brute-force threshold for
 * either the targeted account or the source IP.
 */
export async function recordFailedLogin(
  email: string | null | undefined,
  ip: string | null | undefined
): Promise<void> {
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();
  const normalizedIp = String(ip || '').trim();

  // `suffix` adds the source IP to the ACCOUNT-keyed alert only; the IP-keyed
  // alert already names the IP in its label, so it stays suffix-free (avoids
  // "na adres IP X (IP X)").
  const targets: Array<{ key: string; label: string; suffix: string }> = [];
  if (normalizedEmail)
    targets.push({
      key: `email:${normalizedEmail}`,
      label: `konto ${normalizedEmail}`,
      suffix: normalizedIp ? ` (IP ${normalizedIp})` : '',
    });
  if (normalizedIp)
    targets.push({ key: `ip:${normalizedIp}`, label: `adres IP ${normalizedIp}`, suffix: '' });

  for (const { key, label, suffix } of targets) {
    const count = bumpAndCount(key);
    // Fire on the crossing edge; sendSystemAlert's throttle is the backstop.
    if (count === FAILED_LOGIN_THRESHOLD) {
      try {
        await sendSystemAlert({
          title: 'Podejrzenie ataku brute-force',
          message:
            `${count} nieudanych prób logowania w ciągu ${Math.round(WINDOW_MS / 60000)} min na ${label}` +
            suffix +
            '. Możliwe zgadywanie hasła.',
          severity: 'WARNING',
          source: 'Security',
          throttleKey: `bruteforce:${key}`,
          throttleMs: ALERT_THROTTLE_MS,
        });
      } catch (err) {
        logger.warn('[SecurityAlerts] brute-force alert failed (non-fatal)', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

const PRIVILEGED_ROLES = new Set(['SUPER_ADMIN', 'SUPERADMIN', 'OWNER']);

/**
 * Page when a user is granted a privileged role. No-op when the new role is not
 * privileged or the role is unchanged.
 */
export async function alertPrivilegeEscalation(input: {
  actorEmail?: string | null;
  targetEmail?: string | null;
  targetUserId?: string | null;
  oldRole?: string | null;
  newRole?: string | null;
}): Promise<void> {
  const newRole = String(input.newRole || '')
    .trim()
    .toUpperCase();
  const oldRole = String(input.oldRole || '')
    .trim()
    .toUpperCase();

  if (!PRIVILEGED_ROLES.has(newRole)) return;
  if (oldRole === newRole) return; // no actual escalation

  const target = input.targetEmail || input.targetUserId || 'nieznany użytkownik';
  try {
    await sendSystemAlert({
      title: `Nadano uprawnienia: ${newRole}`,
      message:
        `Użytkownik ${target} otrzymał rolę ${newRole}` +
        (oldRole ? ` (poprzednio ${oldRole})` : '') +
        (input.actorEmail ? `. Zmianę wykonał: ${input.actorEmail}.` : '.'),
      severity: 'WARNING',
      source: 'Security',
      throttleKey: `privesc:${input.targetUserId || input.targetEmail || target}:${newRole}`,
      throttleMs: 60 * 1000,
    });
  } catch (err) {
    logger.warn('[SecurityAlerts] privilege-escalation alert failed (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export default {
  recordFailedLogin,
  alertPrivilegeEscalation,
  bumpAndCount,
  __resetSecurityWindows,
  SECURITY_ALERT_CONFIG,
};
