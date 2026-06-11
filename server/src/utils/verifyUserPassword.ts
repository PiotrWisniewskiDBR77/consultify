import bcrypt from 'bcryptjs';

import { get as dbGet } from './DbPromise.js';

/**
 * Result of {@link verifyUserPassword}. On failure it carries the exact HTTP
 * status the caller should send so every guarded route behaves identically.
 */
export type PasswordCheckResult =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 404; error: string };

/**
 * Verify a user's password before allowing an irreversible action such as
 * scheduling account deletion.
 *
 * This is the single source of truth for the "confirm with password" gate. Any
 * route that schedules account deletion MUST go through it so the behaviour
 * (missing password -> 400, wrong password -> 403, unknown user -> 404) is
 * uniform and cannot drift between endpoints.
 *
 * @param userId   Authenticated user id (from the verified token, never the body).
 * @param password Raw password from the request body (untrusted, validated here).
 */
export async function verifyUserPassword(
  userId: string,
  password: unknown
): Promise<PasswordCheckResult> {
  if (!password || typeof password !== 'string') {
    return { ok: false, status: 400, error: 'Password is required to confirm account deletion' };
  }

  const user = await dbGet<{ id: string; password: string | null }>(
    'SELECT id, password FROM users WHERE id = ?',
    [userId]
  );

  if (!user || !user.password) {
    return { ok: false, status: 404, error: 'User not found' };
  }

  if (!bcrypt.compareSync(password, user.password)) {
    return { ok: false, status: 403, error: 'Password is incorrect' };
  }

  return { ok: true };
}
