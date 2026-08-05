/**
 * MFA is intentionally outside the Complete MVP demo contract.
 *
 * Keep the switch explicit and off by default. Round 2 may enable it only after
 * the versioned `user_mfa` schema and full setup/recovery flows are accepted.
 */
export const isMfaMvpEnabled = (): boolean =>
  String(import.meta.env.VITE_MFA_MVP_ENABLED || '').toLowerCase() === 'true';
