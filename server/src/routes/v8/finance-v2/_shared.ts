/**
 * Finance v3 canonical adapter — shared helpers for `/api/v8/finance-v2/*`
 * routers added in Pakiet B (API & Runtime Integration).
 *
 * Deliberately duplicates (rather than imports/refactors) the small helpers
 * `models.routes.ts` already defines privately (`mapOrgRoleToFinanceRole`,
 * the `{version,contract}` meta envelope, idempotency/expected-version
 * header parsing) — `models.routes.ts` is frozen contract code from a prior
 * work package (WP-C02) and this package's mandate is "nie zmieniaj
 * sygnatur serwisów bez konieczności" / minimal footprint, so a new shared
 * file is safer than exporting from and thereby touching a file with its
 * own bit-identical fixture tests.
 */

import type { Response } from 'express';

import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import type { FinanceRole } from '../../../services/finance/canonical/lifecycleService.js';

/** Stable contract id for this package's new routes — same convention as `FINANCE_V2_CONTRACT` in `models.routes.ts`. */
export const FINANCE_V2_PKG_B_CONTRACT = 'finance_v3_canonical_v1';

export function financeV2Meta(): { version: 'v2'; contract: string } {
  return { version: 'v2', contract: FINANCE_V2_PKG_B_CONTRACT };
}

/**
 * WP-B02 §7.1 — until per-user Finance role assignment (AP-09, out of scope)
 * exists, map today's org roles onto the five ADR roles using the ADR's own
 * documented default mapping. Byte-identical to the private copy in
 * `models.routes.ts` — same source of truth (WP-B02 §7.1), not a fork.
 */
export function mapOrgRoleToFinanceRole(orgRole: string | undefined | null): FinanceRole {
  const role = String(orgRole || '').toLowerCase();
  if (role === 'finance_admin') return 'finance_admin';
  if (role === 'owner' || role === 'admin') return 'approver';
  if (role === 'editor' || role === 'finance_editor') return 'preparer';
  return 'viewer';
}

export function readExpectedVersion(req: AuthRequest): number | undefined {
  const raw = (req.body ?? {}).expectedVersion ?? req.headers['x-model-version'];
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN; // NaN signals "supplied but invalid" to the caller below
}

export function readIdempotencyKey(req: AuthRequest): string | undefined {
  const header = req.headers['idempotency-key'];
  if (typeof header === 'string' && header.trim()) return header;
  const body = (req.body ?? {}).idempotencyKey;
  return typeof body === 'string' && body.trim() ? body : undefined;
}

/** Uniform error envelope for this package's new routes — `{error, code}`, matching `models.routes.ts`'s existing shape. */
export function sendError(res: Response, status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return res.status(status).json({ error: message, code, ...(extra ?? {}) });
}
