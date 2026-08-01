/**
 * Shared KPI permission gate (RES-003A). Extracted from v8/results.routes.ts
 * (P04-B) so BOTH the canonical /api/v8/results router and the legacy
 * /api/benefits router apply the exact same role-derivation and assertion —
 * no forked copy, no drift. v8/results.routes.ts imports assertKpiPermission
 * / kpiRoleFromRequest FROM here (aliased to the original p04* names at the
 * call sites) instead of defining them locally.
 *
 * Do not read a client-supplied header for role (e.g. x-kpi-role) here — that
 * was W3 (self-escalation), fixed by deriving role only from the verified JWT
 * (req.user.role). See server/src/routes/__tests__/cross-org-idor.test.ts
 * "W3" describe block.
 */
import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { canPerformKpiAction, type KpiPermissionRole } from '../v8/kpiWorkflowCanon.js';

/**
 * P04-B: Derive KPI permission role from the user's verified JWT org role.
 * Mapping: owner/administrator/admin/super_admin → kpi_owner,
 *          manager → finance_owner, everything else → viewer.
 */
export function kpiRoleFromRequest(req: AuthRequest): KpiPermissionRole {
  const orgRole = (req.user?.role ?? '').toLowerCase();
  if (['super_admin', 'owner', 'administrator', 'admin'].includes(orgRole)) return 'kpi_owner';
  if (orgRole === 'manager') return 'finance_owner';
  return 'viewer';
}

/**
 * Narrow, intentional subset of KPI_PERMISSION_MATRIX keys usable as a route
 * guard action. Mirrors the original P04KpiGuardedAction union in
 * v8/results.routes.ts. NOTE: 'edit_finance_artifacts' and
 * 'manage_reconciliation_finance' are deliberately NOT included here — both
 * exclude 'kpi_owner' in the matrix, and legacy /api/benefits/* callers are
 * exercised in cross-org-idor.test.ts with an admin (kpi_owner) role expecting
 * success. Gating a benefits route with either would flip those green tests to
 * 403. If Finance-only gating is genuinely wanted for a future route, that is
 * a deliberate product decision requiring a test-fixture update — not a
 * silent default here.
 */
export type KpiGuardedAction =
  | 'edit_definition'
  | 'edit_targets'
  | 'delete_kpi'
  | 'record_measurement'
  | 'create_report'
  | 'manage_deviation'
  | 'create_signal'
  | 'create_next_action'
  | 'manage_reconciliation'
  | 'comment';

export async function assertKpiPermission(
  req: AuthRequest,
  res: Response,
  action: KpiGuardedAction
): Promise<boolean> {
  const role = kpiRoleFromRequest(req);
  if (!canPerformKpiAction(role, action)) {
    res.status(403).json({ error: 'Permission denied', code: 'P04_PERMISSION_DENIED' });
    return false;
  }
  return true;
}
