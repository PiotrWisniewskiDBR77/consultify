/**
 * Billing Sandbox Guard
 *
 * Provides an opt-in safety net so QA/E2E flows cannot accidentally mutate
 * billing state for real tenants. Activated by env var `BILLING_SANDBOX_MODE=true`.
 *
 * When active, only org IDs whose prefix matches one of the allowed prefixes
 * (default: `qa-`, `qa-superadmin-`, `sandbox-`) can pass through guarded
 * billing entrypoints. Production keeps the guard disabled by default, so
 * normal customer flows are not affected.
 *
 * To complement Stripe-side mocking already controlled by `MOCK_BILLING`, this
 * guard protects DB writes too (plans, organization_billing, subscription
 * changes, payment methods).
 */

import { AppError } from '../../utils/ErrorHandler.js';
import logger from '../../utils/Logger.js';

const DEFAULT_ALLOWED_PREFIXES = ['qa-', 'qa-superadmin-', 'sandbox-'];

const isSandboxModeEnabled = (): boolean =>
  String(process.env.BILLING_SANDBOX_MODE || '').toLowerCase() === 'true';

const getAllowedPrefixes = (): string[] => {
  const raw = process.env.BILLING_SANDBOX_ALLOWED_PREFIXES;
  if (!raw) return DEFAULT_ALLOWED_PREFIXES;
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
};

export const isBillingSandbox = (): boolean => isSandboxModeEnabled();

export const isAllowedSandboxOrgId = (orgId: string): boolean => {
  if (!orgId) return false;
  const prefixes = getAllowedPrefixes();
  return prefixes.some((prefix) => orgId.startsWith(prefix));
};

/**
 * Throws an AppError when sandbox mode is on and the target org is not allowed.
 * No-op when sandbox mode is off.
 */
export const assertSandboxAllowed = (orgId: string | undefined | null, action: string): void => {
  if (!isSandboxModeEnabled()) return;
  const id = String(orgId || '');
  if (!isAllowedSandboxOrgId(id)) {
    logger.warn('[BillingSandboxGuard] Blocked mutation', {
      action,
      organizationId: id || '(empty)',
    });
    throw new AppError(
      `Billing sandbox mode is enabled. Action '${action}' is only permitted for sandbox organizations.`,
      403,
      'BILLING_SANDBOX_BLOCKED',
      { action, organizationId: id, allowedPrefixes: getAllowedPrefixes() }
    );
  }
};
