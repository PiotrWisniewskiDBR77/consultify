/**
 * Super Admin Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All super admin API endpoints (requires SUPERADMIN role)
 *
 * Note: This route file uses wrappers to the existing JS controller
 * for backward compatibility during migration. Full TypeScript migration
 * of the controller logic will be done in subsequent stages.
 */

import { randomUUID } from 'crypto';
import { type NextFunction, Response, Router } from 'express';

import SuperAdminController from '../controllers/SuperAdminController.js';
import { getIntegrationsCatalogSeed } from '../data/integrationsCatalog.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { requireConfirmation } from '../middleware/confirmAction.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { requireAudit } from '../middleware/requireAudit.middleware.js';
import {
  requireSuperAdminCapability,
  verifySuperAdmin as requireSuperAdmin,
} from '../middleware/superAdmin.middleware.js';
import { superadminAuditMonitor } from '../middleware/superadminAuditMonitor.middleware.js';
import { validateBody, validateParams } from '../middleware/validation.middleware.js';
import {
  getAllOrgPolicies,
  getOrgPolicy,
  requireNoLegalHold,
  upsertOrgPolicy,
} from '../services/OrgPoliciesService.js';
import { invalidateOrganizationSuspensionCache } from '../services/organizationSuspensionGuard.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import {
  CreateAccessCodeSchema,
  CreateUserAdminSchema,
  ImpersonateUserSchema,
  UpdateOrganizationAdminSchema,
  UpdateUserAdminSchema,
} from '../validators/admin.validators.js';

const router = Router();
const STATUS_CHANGES_REQUIRING_CONFIRMATION = new Set(['suspended', 'blocked', 'cancelled']);
const confirmOrganizationStatusChange = requireConfirmation('update_organization', 'critical');

export const conditionalOrganizationConfirmation = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const status = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
    if (!STATUS_CHANGES_REQUIRING_CONFIRMATION.has(status)) return next();

    // Gate on the TRANSITION, not on the presence of a critical status value in
    // the body: forms always submit the current status alongside unrelated
    // field edits (e.g. changing the plan of an already-suspended org), so
    // gating on presence alone 428s every edit of a critical-status org even
    // when nothing about its status is changing. Only require confirmation
    // when the submitted status actually differs from the org's current
    // status in the database (a real transition into/across a critical state).
    const org = await dbGet('SELECT status FROM organizations WHERE id = $1', [req.params.id]);
    const currentStatus =
      typeof (org as any)?.status === 'string' ? (org as any).status : undefined;
    if (currentStatus === status) return next();

    res.locals.organizationStatusChangeReason =
      typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    return confirmOrganizationStatusChange(req, res, next);
  }
);

interface AtomicAuditEventInput {
  actorType?: 'USER' | 'SYSTEM' | 'AI' | 'INTEGRATION' | 'CONSULTANT';
  action: string;
  resourceType: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface AtomicGatedResult {
  auditEvent: AtomicAuditEventInput;
  response: Record<string, unknown>;
}

function isSchemaMissingError(err: unknown): boolean {
  const msg = String((err as any)?.message || '').toLowerCase();
  return (
    msg.includes('no such table') || msg.includes('does not exist') || msg.includes('relation')
  );
}

function respondSchemaUnavailable(res: Response) {
  return res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Invoice service is unavailable because billing tables are not configured',
  });
}

function parseInvoiceJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeInvoiceLineItems(lineItems: any[]) {
  return lineItems.map((item) => {
    const quantity = Number(item.quantity ?? 1);
    const unitPrice = Number(item.unitPrice ?? item.amount);
    const amount = Number((quantity * unitPrice).toFixed(2));
    return {
      description: String(item.description || 'Invoice item').trim(),
      quantity,
      unitPrice,
      amount,
    };
  });
}

function mapInvoiceRow(inv: any) {
  const lineItems = parseInvoiceJsonField<any[]>(inv.line_items, []);
  const metadata = parseInvoiceJsonField<Record<string, unknown>>(inv.metadata, {});
  const subtotal = Number(inv.subtotal ?? inv.amount ?? 0);
  const taxAmount = Number(inv.tax_amount ?? inv.tax ?? 0);
  const total = Number(inv.total ?? subtotal + taxAmount);

  return {
    ...inv,
    line_items: lineItems,
    lineItems,
    items: lineItems,
    metadata,
    invoiceNumber: inv.invoice_number,
    organizationId: inv.organization_id,
    organizationName: inv.organization_name,
    amount: subtotal,
    tax: taxAmount,
    total,
    amountDue: Number(inv.amount_due ?? total),
    amountPaid: Number(inv.amount_paid ?? 0),
    dueDate: inv.due_date,
    paidAt: inv.paid_at,
    createdAt: inv.created_at,
    updatedAt: inv.updated_at,
  };
}

async function getPersistedInvoice(id: string) {
  const invoice = await dbGet(
    `
      SELECT i.*, o.name as organization_name
      FROM invoices i
      LEFT JOIN organizations o ON i.organization_id = o.id
      WHERE i.id = ?
    `,
    [id]
  );
  return invoice ? mapInvoiceRow(invoice) : null;
}

async function insertAuditEventAtomic(
  req: AuthRequest,
  input: AtomicAuditEventInput
): Promise<string> {
  const id = `ae-${randomUUID()}`;
  const timestamp = new Date().toISOString();
  const metadata = input.metadata || {};

  try {
    await dbRun(
      `INSERT INTO audit_events (
        id, ts, actor_id, actor_type, org_id, action, resource_type, resource_id,
        before_json, after_json, metadata_json, ip, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        timestamp,
        req.user?.id || null,
        input.actorType || 'USER',
        req.user?.organizationId || null,
        input.action,
        input.resourceType,
        input.resourceId || null,
        input.before ? JSON.stringify(input.before) : null,
        input.after ? JSON.stringify(input.after) : null,
        JSON.stringify(metadata),
        req.ip || null,
        req.get('user-agent') || null,
      ],
      { fallback: false }
    );
    return id;
  } catch (unifiedErr: any) {
    try {
      await dbRun(
        `INSERT INTO audit_events (
          id, ts, actor_user_id, actor_type, org_id, action_type, entity_type, entity_id,
          metadata_json, ip, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          timestamp,
          req.user?.id || null,
          input.actorType || 'USER',
          req.user?.organizationId || null,
          input.action,
          input.resourceType,
          input.resourceId || null,
          JSON.stringify({
            before: input.before || null,
            after: input.after || null,
            ...metadata,
          }),
          req.ip || null,
          req.get('user-agent') || null,
        ],
        { fallback: false }
      );
      return id;
    } catch (legacyErr: any) {
      throw new Error(
        `AUDIT_WRITE_FAILED: ${legacyErr?.message || unifiedErr?.message || 'unknown audit error'}`
      );
    }
  }
}

function isAuditWriteFailure(error: unknown): boolean {
  return String((error as Error | undefined)?.message || '').includes('AUDIT_WRITE_FAILED');
}

function sendAuditUnavailable(res: Response, actionType: string): void {
  res.status(503).json({
    error:
      'Audit system unavailable — gated action blocked. No sensitive action may proceed without audit.',
    code: 'AUDIT_UNAVAILABLE',
    actionType,
    guidance: 'Retry the action. If the problem persists, contact platform support.',
  });
}

async function executeAtomicGatedAction(
  req: AuthRequest,
  res: Response,
  actionType: string,
  operation: () => Promise<AtomicGatedResult>
): Promise<void> {
  await dbRun('BEGIN TRANSACTION', [], { fallback: false });

  try {
    const result = await operation();
    await insertAuditEventAtomic(req, result.auditEvent);
    await dbRun('COMMIT', [], { fallback: false });
    res.json(result.response);
  } catch (error) {
    try {
      await dbRun('ROLLBACK', [], { fallback: false });
    } catch {
      // Best-effort rollback; preserve original error for response handling.
    }

    if (isAuditWriteFailure(error)) {
      sendAuditUnavailable(res, actionType);
      return;
    }

    throw error;
  }
}

function parseAuditJsonField(raw: unknown): Record<string, unknown> | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    return JSON.parse(String(raw));
  } catch {
    return undefined;
  }
}

function isDatabaseExplorerEnabled(): boolean {
  return (
    process.env.ENABLE_SUPERADMIN_DB_EXPLORER === 'true' && process.env.NODE_ENV !== 'production'
  );
}

async function querySettingAuditVersions(settingKey: string): Promise<any[]> {
  try {
    return await dbAll(
      `SELECT id,
              resource_id,
              before_json,
              after_json,
              metadata_json,
              ts,
              actor_id
       FROM audit_events
       WHERE resource_type = 'settings'
         AND resource_id = ?
         AND action IN ('settings_create', 'settings_update', 'settings_delete', 'settings_rollback')
       ORDER BY ts DESC
       LIMIT 200`,
      [settingKey],
      { fallback: false }
    );
  } catch {
    return await dbAll(
      `SELECT id,
              entity_id as resource_id,
              old_value as before_json,
              new_value as after_json,
              metadata as metadata_json,
              created_at as ts,
              admin_user_id as actor_id
       FROM superadmin_audit_log
       WHERE entity_type = 'settings' AND entity_id = ?
       ORDER BY created_at DESC
       LIMIT 200`,
      [settingKey],
      { fallback: false }
    );
  }
}

async function safeDbGet<T>(query: string, params: any[] = [], fallback: T): Promise<T> {
  try {
    const result = await dbGet<T>(query, params);
    return (result as T) || fallback;
  } catch (error) {
    logger.warn('[SuperAdmin] safeDbGet fallback applied', {
      query: query.slice(0, 160),
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

async function safeDbAll<T>(query: string, params: any[] = [], fallback: T[] = []): Promise<T[]> {
  try {
    const result = await dbAll<T>(query, params);
    return result || fallback;
  } catch (error) {
    logger.warn('[SuperAdmin] safeDbAll fallback applied', {
      query: query.slice(0, 160),
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

function sortByTimestampDesc<T extends { timestamp?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aTs = new Date(a.timestamp || 0).getTime();
    const bTs = new Date(b.timestamp || 0).getTime();
    return bTs - aTs;
  });
}

// Apply rate limiting
router.use(apiAuthRateLimiter);

// verifyToken checks JWT signature, token revocation (revoked_tokens table),
// session tracking, and attaches req.user. Without this, revoked JWTs would
// still pass verifySuperAdmin's own JWT check.
router.use(verifyToken);

// Apply super admin middleware to all routes (DB-backed role verification)
router.use(requireSuperAdmin);

// Attach req.emitAuditEvent globally so every handler can emit audit records.
// Gated actions that already pass requireAudit per-route get a second (harmless)
// assignment; ungated mutations now have the function available too.
router.use(requireAudit);

// Monitor 5xx on superadmin audit-log endpoints for SRE alerting.
router.use(superadminAuditMonitor);
router.use('/security', requireSuperAdminCapability('security_ops'));
router.use('/admin/sessions', requireSuperAdminCapability('security_ops'));
router.use('/admin/approval-workflows', requireSuperAdminCapability('security_ops'));
router.use('/platform', requireSuperAdminCapability('security_ops'));
router.use('/connectors', requireSuperAdminCapability('platform_ops', 'security_ops'));
router.use('/virtual-workers', requireSuperAdminCapability('ai_ops'));
router.use('/impersonate', requireSuperAdminCapability('support_ops'));
router.use('/ai', requireSuperAdminCapability('ai_ops'));
router.use('/data', requireSuperAdminCapability('security_ops', 'platform_ops'));
router.use('/tenants/:id/purge', requireSuperAdminCapability('security_ops'));

router.get(
  '/operator/overview',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const [auditStats, approvalStats, sessionStats, incidentStats, eventStats, orgPolicyStats] =
      await Promise.all([
        safeDbGet(
          `SELECT
              COUNT(*) as total,
              SUM(CASE WHEN status != 'resolved' THEN 1 ELSE 0 END) as unresolved,
              SUM(CASE WHEN risk_score >= 80 THEN 1 ELSE 0 END) as critical,
              SUM(CASE WHEN risk_score >= 60 THEN 1 ELSE 0 END) as high
           FROM admin_audit_logs`,
          [],
          { total: 0, unresolved: 0, critical: 0, high: 0 }
        ),
        safeDbGet(
          `SELECT
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
              SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
              SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
           FROM approval_requests`,
          [],
          { pending: 0, approved: 0, rejected: 0 }
        ),
        safeDbGet(
          `SELECT
              COUNT(*) as total,
              SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
              SUM(CASE WHEN is_active = 1 AND mfa_verified = 1 THEN 1 ELSE 0 END) as "mfaVerified",
              SUM(CASE WHEN is_active = 1 AND session_type = 'jit' THEN 1 ELSE 0 END) as "jitActive",
              SUM(CASE WHEN is_active = 1 AND session_type = 'break_glass' THEN 1 ELSE 0 END) as "breakGlassActive"
           FROM admin_sessions`,
          [],
          { total: 0, active: 0, mfaVerified: 0, jitActive: 0, breakGlassActive: 0 }
        ),
        safeDbGet(
          `SELECT
              SUM(CASE WHEN status != 'resolved' AND severity = 'critical' THEN 1 ELSE 0 END) as critical,
              SUM(CASE WHEN status != 'resolved' AND severity = 'high' THEN 1 ELSE 0 END) as high
           FROM security_incidents`,
          [],
          { critical: 0, high: 0 }
        ),
        safeDbGet(
          `SELECT COUNT(*) as today
           FROM security_events
           WHERE created_at >= datetime('now', '-1 day')`,
          [],
          { today: 0 }
        ),
        safeDbGet(
          `SELECT
              SUM(CASE WHEN legal_hold_enabled = 1 THEN 1 ELSE 0 END) as "legalHolds",
              SUM(CASE WHEN residency_region IS NULL OR residency_region = '' THEN 1 ELSE 0 END) as "residencyReview"
           FROM org_policies`,
          [],
          { legalHolds: 0, residencyReview: 0 }
        ),
      ]);

    const [mfaOverride, ssoOverride] = await Promise.all([
      safeDbGet(`SELECT value FROM settings WHERE key = ?`, ['platform:mfa_override'], {
        value: null,
      }),
      safeDbGet(`SELECT value FROM settings WHERE key = ?`, ['platform:sso_override'], {
        value: null,
      }),
    ]);

    res.json({
      audit: {
        total: Number((auditStats as any).total || 0),
        unresolved: Number((auditStats as any).unresolved || 0),
        critical: Number((auditStats as any).critical || 0),
        high: Number((auditStats as any).high || 0),
      },
      approvals: {
        pending: Number((approvalStats as any).pending || 0),
        approved: Number((approvalStats as any).approved || 0),
        rejected: Number((approvalStats as any).rejected || 0),
      },
      sessions: {
        total: Number((sessionStats as any).total || 0),
        active: Number((sessionStats as any).active || 0),
        mfaVerified: Number((sessionStats as any).mfaVerified || 0),
        jitActive: Number((sessionStats as any).jitActive || 0),
        breakGlassActive: Number((sessionStats as any).breakGlassActive || 0),
      },
      incidents: {
        critical: Number((incidentStats as any).critical || 0),
        high: Number((incidentStats as any).high || 0),
      },
      events: {
        today: Number((eventStats as any).today || 0),
      },
      compliance: {
        legalHolds: Number((orgPolicyStats as any).legalHolds || 0),
        residencyReview: Number((orgPolicyStats as any).residencyReview || 0),
      },
      overrides: {
        mfa: (mfaOverride as any)?.value || 'disabled',
        sso: (ssoOverride as any)?.value || 'disabled',
      },
    });
  })
);

router.get(
  '/operator/timeline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || 50), 10) || 50, 1), 200);
    const [auditEvents, approvalRequests] = await Promise.all([
      safeDbAll<any>(
        `SELECT id, ts, action, resource_type, resource_id, metadata_json
         FROM audit_events
         ORDER BY ts DESC
         LIMIT ?`,
        [limit],
        []
      ),
      safeDbAll<any>(
        `SELECT id, status, workflow_id, requester_id, resolved_by, resolution_notes, created_at, resolved_at
         FROM approval_requests
         ORDER BY COALESCE(resolved_at, created_at) DESC
         LIMIT ?`,
        [limit],
        []
      ),
    ]);

    const auditRows = auditEvents.map((row) => {
      const metadata = parseAuditJsonField(row.metadata_json);
      return {
        id: `audit:${row.id}`,
        source: 'audit',
        timestamp: row.ts,
        state: String(metadata?.propagationState || metadata?.state || 'executed'),
        action: row.action,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        summary: metadata?.recoveryPath || metadata?.guidance || row.action,
        metadata,
      };
    });

    const approvalRows = approvalRequests.map((row) => ({
      id: `approval:${row.id}`,
      source: 'approval',
      timestamp: row.resolved_at || row.created_at,
      state:
        row.status === 'pending'
          ? 'requested'
          : row.status === 'approved'
            ? 'approved'
            : row.status === 'rejected'
              ? 'recovered'
              : row.status,
      action: 'approval.request',
      resourceType: 'approval_request',
      resourceId: row.id,
      summary: row.resolution_notes || row.status,
      metadata: {
        workflowId: row.workflow_id,
        requesterId: row.requester_id,
        resolvedBy: row.resolved_by,
      },
    }));

    res.json({
      items: sortByTimestampDesc([...auditRows, ...approvalRows]).slice(0, limit),
    });
  })
);

router.get(
  '/operator/policy-enforcement',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const [providers, connectors, workers, overrides] = await Promise.all([
      safeDbAll<any>(
        `SELECT id, name, provider, is_active, health_status, updated_at
         FROM llm_providers
         ORDER BY updated_at DESC, name ASC`,
        [],
        []
      ),
      safeDbAll<any>(
        `SELECT connector_id, status, COUNT(*) as count
         FROM integrations
         GROUP BY connector_id, status
         ORDER BY connector_id ASC`,
        [],
        []
      ),
      safeDbAll<any>(
        `SELECT key, value, updated_at
         FROM settings
         WHERE key LIKE 'vw:%:status'
         ORDER BY updated_at DESC`,
        [],
        []
      ),
      safeDbAll<any>(
        `SELECT key, value, updated_at
         FROM settings
         WHERE key IN ('platform:mfa_override', 'platform:sso_override')
         ORDER BY key ASC`,
        [],
        []
      ),
    ]);

    const connectorGroups = new Map<
      string,
      { enabledCount: number; disabledCount: number; totalCount: number }
    >();
    connectors.forEach((row) => {
      const key = String(row.connector_id || 'unknown');
      const current = connectorGroups.get(key) || {
        enabledCount: 0,
        disabledCount: 0,
        totalCount: 0,
      };
      const count = Number(row.count || 0);
      current.totalCount += count;
      if (String(row.status) === 'disabled') current.disabledCount += count;
      else current.enabledCount += count;
      connectorGroups.set(key, current);
    });

    const rows = [
      ...providers.map((provider) => ({
        id: `provider:${provider.id || provider.provider}`,
        domain: `Model provider: ${provider.name || provider.provider || provider.id}`,
        desiredState: provider.is_active ? 'enabled' : 'disabled',
        appliedState: provider.health_status || 'unknown',
        drift:
          provider.is_active &&
          !['healthy', 'enabled', 'ok'].includes(
            String(provider.health_status || '').toLowerCase()
          ),
        note: 'Provider runtime health should match intended platform availability.',
        updatedAt: provider.updated_at || null,
      })),
      ...Array.from(connectorGroups.entries()).map(([connectorType, counts]) => ({
        id: `connector:${connectorType}`,
        domain: `Connector: ${connectorType}`,
        desiredState: counts.disabledCount === counts.totalCount ? 'disabled' : 'enabled',
        appliedState:
          counts.disabledCount > 0 && counts.enabledCount > 0
            ? 'partial'
            : counts.disabledCount === counts.totalCount
              ? 'disabled'
              : 'enabled',
        drift: counts.disabledCount > 0 && counts.enabledCount > 0,
        note: 'Mixed connector states indicate incomplete propagation across tenants.',
        updatedAt: null,
      })),
      ...workers.map((worker) => ({
        id: `worker:${worker.key}`,
        domain: `Virtual worker: ${String(worker.key).split(':')[1] || worker.key}`,
        desiredState: worker.value || 'unknown',
        appliedState: worker.value || 'unknown',
        drift: false,
        note: 'Worker suspensions should remain observable as explicit runtime state.',
        updatedAt: worker.updated_at || null,
      })),
      ...overrides.map((override) => ({
        id: `override:${override.key}`,
        domain:
          override.key === 'platform:mfa_override'
            ? 'Platform MFA override'
            : 'Platform SSO override',
        desiredState: override.value || 'disabled',
        appliedState: override.value || 'disabled',
        drift: false,
        note: 'Global emergency overrides must remain explicitly visible in platform posture.',
        updatedAt: override.updated_at || null,
      })),
    ];

    res.json({
      health: {
        status: rows.some((row) => row.drift) ? 'degraded' : 'healthy',
      },
      summary: {
        total: rows.length,
        drift: rows.filter((row) => row.drift).length,
        providers: rows.filter((row) => row.id.startsWith('provider:')).length,
        connectors: rows.filter((row) => row.id.startsWith('connector:')).length,
        workers: rows.filter((row) => row.id.startsWith('worker:')).length,
      },
      rows,
    });
  })
);

// ==========================================
// ORGANIZATIONS
// ==========================================

router.get(
  '/connectors',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const rows = await dbAll<any>(
      `SELECT connector_id AS id,
              connector_id AS name,
              COUNT(DISTINCT organization_id) AS affected_tenants,
              COUNT(*) AS integrations
         FROM integrations
        WHERE status != 'disabled' AND connector_id IS NOT NULL AND connector_id != ''
        GROUP BY connector_id
        ORDER BY connector_id`,
      [],
      { fallback: false }
    );
    return res.json({
      connectors: rows.map((row) => ({
        id: String(row.id),
        name: String(row.name || row.id),
        affectedTenants: Number(row.affected_tenants || 0),
      })),
    });
  })
);

router.get('/organizations', SuperAdminController.getOrganizations);
router.get('/activities', SuperAdminController.getActivities);
router.get('/activities/stats', SuperAdminController.getActivities);
router.get('/dashboard', SuperAdminController.getDashboardStats);
router.put(
  '/organizations/:id',
  conditionalOrganizationConfirmation,
  requireAudit,
  validateBody(UpdateOrganizationAdminSchema),
  SuperAdminController.updateOrganization
);
router.delete(
  '/organizations/:id',
  requireConfirmation('delete_organization', 'critical'),
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    try {
      await requireNoLegalHold(req.params.id, 'Organization deletion');
    } catch (e: any) {
      if (e?.code === 'LEGAL_HOLD') {
        return res.status(403).json({
          error: e.message,
          code: 'CROSS_TENANT_DENIED',
          guidance: 'Tenant is in compliance hold. Contact the compliance team before retrying.',
        });
      }
      throw e;
    }
    return SuperAdminController.deleteOrganization(req, res, next);
  })
);
router.get('/organizations/:id/billing', SuperAdminController.getOrgBilling);

// ==========================================
// ORG POLICIES (V4-ENT-04) — retention, legal hold, residency
// ==========================================

router.get(
  '/org-policies',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const policies = await getAllOrgPolicies();
    res.json({ policies });
  })
);

router.get(
  '/org-policies/:orgId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const policy = await getOrgPolicy(req.params.orgId);
    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    res.json(policy);
  })
);

router.put(
  '/org-policies/:orgId',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { retentionDays, legalHoldEnabled, residencyRegion } = req.body || {};
    const before = await getOrgPolicy(req.params.orgId);
    const policy = await upsertOrgPolicy(req.params.orgId, {
      retentionDays: retentionDays != null ? Number(retentionDays) : undefined,
      legalHoldEnabled: legalHoldEnabled !== undefined ? Boolean(legalHoldEnabled) : undefined,
      residencyRegion:
        residencyRegion !== undefined
          ? residencyRegion === null
            ? null
            : String(residencyRegion)
          : undefined,
    });
    await req.emitAuditEvent?.({
      actorType: 'USER',
      action: before ? 'update' : 'create',
      resourceType: 'org_policy',
      resourceId: req.params.orgId,
      before: before
        ? {
            retentionDays: before.retention_days,
            legalHoldEnabled: Boolean(before.legal_hold_enabled),
            residencyRegion: before.residency_region,
          }
        : undefined,
      after: {
        retentionDays: policy.retention_days,
        legalHoldEnabled: Boolean(policy.legal_hold_enabled),
        residencyRegion: policy.residency_region,
      },
      metadata: { organizationId: req.params.orgId },
    });
    res.json(policy);
  })
);

// ==========================================
// USERS
// ==========================================

router.get('/users', SuperAdminController.getUsers);
router.put('/users/:id', validateBody(UpdateUserAdminSchema), SuperAdminController.updateUser);
router.post('/users', validateBody(CreateUserAdminSchema), SuperAdminController.createUser);
router.delete('/users/:id', SuperAdminController.deleteUser);
router.post(
  '/users/invite',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.inviteUser(req, res, next);
  })
);
router.post(
  '/users/:id/reset-password',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.resetUserPassword(req, res, next);
  })
);

// ==========================================
// GATED ACTIONS — P33 §2.3.2 (4-column guardrails)
// ==========================================

// #1 Suspend tenant
router.post(
  '/tenants/:id/suspend',
  requireConfirmation('suspend_tenant', 'critical'),
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tenantId = req.params.id;
    const { reason } = req.body;

    const tenant = await dbGet('SELECT id, name, status FROM organizations WHERE id = $1', [
      tenantId,
    ]);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (tenant.status === 'suspended') {
      return res.status(409).json({
        error: 'Tenant already suspended',
        code: 'CROSS_TENANT_DENIED',
        guidance: 'Tenant is already in the requested state.',
      });
    }

    const userCount = await dbGet(
      'SELECT COUNT(*) as count FROM users WHERE organization_id = $1',
      [tenantId]
    );

    await executeAtomicGatedAction(req, res, 'suspend_tenant', async () => {
      await dbRun(
        'UPDATE organizations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['suspended', tenantId],
        { fallback: false }
      );
      // DEC-91: drop the memoised status so enforcement is immediate in this
      // process instead of waiting out the guard's TTL. Other workers converge
      // within the TTL on their own.
      invalidateOrganizationSuspensionCache(tenantId);

      return {
        auditEvent: {
          action: 'tenant.suspended',
          resourceType: 'organization',
          resourceId: tenantId,
          before: { status: tenant.status },
          after: { status: 'suspended' },
          metadata: { reason, affectedUsers: userCount?.count || 0, tenantName: tenant.name },
        },
        response: {
          success: true,
          action: 'tenant.suspended',
          tenantId,
          reversible: true,
          recoveryPath: 'POST /api/superadmin/tenants/:id/reactivate',
        },
      };
    });
  })
);

// #1b Reactivate tenant
router.post(
  '/tenants/:id/reactivate',
  requireConfirmation('reactivate_tenant', 'high'),
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tenantId = req.params.id;
    const tenant = await dbGet('SELECT id, status FROM organizations WHERE id = $1', [tenantId]);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    await executeAtomicGatedAction(req, res, 'reactivate_tenant', async () => {
      await dbRun(
        'UPDATE organizations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['active', tenantId],
        { fallback: false }
      );
      // DEC-91: without this the reactivated tenant would stay locked out for
      // up to one TTL — the operator would appear to have done nothing.
      invalidateOrganizationSuspensionCache(tenantId);

      return {
        auditEvent: {
          action: 'tenant.reactivated',
          resourceType: 'organization',
          resourceId: tenantId,
          before: { status: tenant.status },
          after: { status: 'active' },
          metadata: { reason: req.body.reason },
        },
        response: {
          success: true,
          action: 'tenant.reactivated',
          tenantId,
          reversible: true,
          recoveryPath: 'POST /api/superadmin/tenants/:id/suspend',
        },
      };
    });
  })
);

// #2 Force-reset user MFA
router.post(
  '/users/:id/force-reset-mfa',
  requireSuperAdminCapability('security_ops'),
  requireConfirmation('force_reset_mfa', 'high'),
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.params.id;
    const user = await dbGet('SELECT id, email FROM users WHERE id = $1', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await executeAtomicGatedAction(req, res, 'force_reset_mfa', async () => {
      await dbRun(
        'UPDATE users SET mfa_enabled = $1, mfa_secret = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [false, userId],
        { fallback: false }
      );

      return {
        auditEvent: {
          action: 'user.mfa_reset',
          resourceType: 'user',
          resourceId: userId,
          metadata: { userEmail: user.email },
          after: { mfa_enabled: false },
        },
        response: {
          success: true,
          action: 'user.mfa_reset',
          userId,
          reversible: true,
          note: 'User will re-enroll MFA on next login',
          recoveryPath: 'User re-enrolls MFA on next login',
        },
      };
    });
  })
);

// #3 Platform-wide MFA override
router.post(
  '/platform/mfa-override',
  requireConfirmation('platform_mfa_override', 'critical'),
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { enforce } = req.body;
    const tenantCount = await dbGet('SELECT COUNT(*) as count FROM organizations');

    await executeAtomicGatedAction(req, res, 'platform_mfa_override', async () => {
      await dbRun(
        'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
        ['platform:mfa_override', enforce ? 'enforced' : 'disabled'],
        { fallback: false }
      );

      return {
        auditEvent: {
          action: 'platform.mfa_override',
          resourceType: 'platform',
          resourceId: 'global',
          after: { enforce: Boolean(enforce) },
          metadata: { enforce, affectedTenants: tenantCount?.count || 0 },
        },
        response: {
          success: true,
          action: 'platform.mfa_override',
          enforce,
          reversible: true,
          affectedTenants: tenantCount?.count || 0,
          recoveryPath: 'POST /api/superadmin/platform/mfa-override with enforce=false',
        },
      };
    });
  })
);

// #4 Platform-wide SSO override
router.post(
  '/platform/sso-override',
  requireConfirmation('platform_sso_override', 'critical'),
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { enforce } = req.body;

    await executeAtomicGatedAction(req, res, 'platform_sso_override', async () => {
      await dbRun(
        'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
        ['platform:sso_override', enforce ? 'enforced' : 'disabled'],
        { fallback: false }
      );

      return {
        auditEvent: {
          action: 'platform.sso_override',
          resourceType: 'platform',
          resourceId: 'global',
          after: { enforce: Boolean(enforce) },
          metadata: { enforce },
        },
        response: {
          success: true,
          action: 'platform.sso_override',
          enforce,
          reversible: true,
          recoveryPath: 'POST /api/superadmin/platform/sso-override with enforce=false',
        },
      };
    });
  })
);

// #5 Suspend AI model
router.post(
  '/ai/models/:modelId/suspend',
  requireConfirmation('suspend_ai_model', 'high'),
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { modelId } = req.params;
    const { reason } = req.body;

    await executeAtomicGatedAction(req, res, 'suspend_ai_model', async () => {
      await dbRun(
        'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
        [`ai:model:${modelId}:status`, 'suspended'],
        { fallback: false }
      );

      return {
        auditEvent: {
          action: 'ai.model_suspended',
          resourceType: 'ai_model',
          resourceId: modelId,
          after: { status: 'suspended' },
          metadata: { reason },
        },
        response: {
          success: true,
          action: 'ai.model_suspended',
          modelId,
          reversible: true,
          recoveryPath: `Set ai:model:${modelId}:status back to enabled after review`,
        },
      };
    });
  })
);

// #6 Emergency connector kill-switch
router.post(
  '/connectors/:connectorId/emergency-kill',
  requireConfirmation('emergency_connector_kill', 'critical'),
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { connectorId } = req.params;

    const affected = await dbAll(
      'SELECT DISTINCT organization_id FROM integrations WHERE connector_id = $1 AND status != $2',
      [connectorId, 'disabled']
    );

    await executeAtomicGatedAction(req, res, 'emergency_connector_kill', async () => {
      await dbRun(
        'UPDATE integrations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE connector_id = $2',
        ['disabled', connectorId],
        { fallback: false }
      );

      return {
        auditEvent: {
          action: 'connector.emergency_kill',
          resourceType: 'connector',
          resourceId: connectorId,
          after: { status: 'disabled' },
          metadata: { affectedTenants: affected?.length || 0 },
        },
        response: {
          success: true,
          action: 'connector.emergency_kill',
          connectorId,
          reversible: true,
          affectedTenants: affected?.length || 0,
          recoveryPath:
            'Re-enable connector after vendor/security review; tenants may need reauth via Admin.',
        },
      };
    });
  })
);

// #8 Bulk data export
router.post(
  '/data/bulk-export',
  requireConfirmation('bulk_data_export', 'critical'),
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { scope, format = 'json' } = req.body;

    await executeAtomicGatedAction(req, res, 'bulk_data_export', async () => ({
      auditEvent: {
        action: 'data.bulk_export',
        resourceType: 'data',
        resourceId: scope || 'all',
        metadata: { scope, format },
      },
      response: {
        success: true,
        action: 'data.bulk_export',
        status: 'queued',
        message: 'Export has been queued. You will be notified when ready.',
        reversible: false,
      },
    }));
  })
);

// #9 Tenant data purge (IRREVERSIBLE)
router.post(
  '/tenants/:id/purge',
  requireConfirmation('tenant_data_purge', 'critical'),
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tenantId = req.params.id;
    const { confirmTenantName } = req.body;

    const tenant = await dbGet('SELECT id, name FROM organizations WHERE id = $1', [tenantId]);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    if (confirmTenantName !== tenant.name) {
      return res.status(422).json({
        error: 'Type-to-confirm failed. You must type the exact tenant name to confirm purge.',
        code: 'TYPE_TO_CONFIRM_FAILED',
        expectedName: tenant.name,
        irreversible: true,
      });
    }

    await executeAtomicGatedAction(req, res, 'tenant_data_purge', async () => {
      await dbRun(
        'UPDATE organizations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['purge_scheduled', tenantId],
        { fallback: false }
      );

      return {
        auditEvent: {
          action: 'tenant.data_purge',
          resourceType: 'organization',
          resourceId: tenantId,
          after: { status: 'purge_scheduled' },
          metadata: { tenantName: tenant.name, irreversible: true, preExportRecommended: true },
        },
        response: {
          success: true,
          action: 'tenant.data_purge',
          tenantId,
          irreversible: true,
          warning:
            'ALL data for this tenant will be PERMANENTLY DELETED. This action CANNOT be undone.',
        },
      };
    });
  })
);

// #10 Suspend Virtual Worker
router.post(
  '/virtual-workers/:workerId/suspend',
  requireConfirmation('suspend_virtual_worker', 'high'),
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { workerId } = req.params;
    const { reason } = req.body;

    await executeAtomicGatedAction(req, res, 'suspend_virtual_worker', async () => {
      await dbRun(
        'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
        [`vw:${workerId}:status`, 'suspended'],
        { fallback: false }
      );

      return {
        auditEvent: {
          action: 'ai.virtual_worker_suspended',
          resourceType: 'virtual_worker',
          resourceId: workerId,
          after: { status: 'suspended' },
          metadata: { reason },
        },
        response: {
          success: true,
          action: 'ai.virtual_worker_suspended',
          workerId,
          reversible: true,
          recoveryPath: 'Re-enable worker; queued tasks resume from last checkpoint.',
        },
      };
    });
  })
);

// Emergency tenant lockdown
router.post(
  '/tenants/:id/lockdown',
  requireSuperAdminCapability('security_ops'),
  requireConfirmation('emergency_tenant_lockdown', 'critical'),
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tenantId = req.params.id;
    const tenant = await dbGet('SELECT id, status FROM organizations WHERE id = $1', [tenantId]);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    await executeAtomicGatedAction(req, res, 'emergency_tenant_lockdown', async () => {
      await dbRun(
        'UPDATE organizations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['locked', tenantId],
        { fallback: false }
      );

      return {
        auditEvent: {
          action: 'tenant.emergency_lockdown',
          resourceType: 'organization',
          resourceId: tenantId,
          before: { status: tenant.status },
          after: { status: 'locked' },
          metadata: { reason: req.body.reason },
        },
        response: {
          success: true,
          action: 'tenant.emergency_lockdown',
          tenantId,
          reversible: true,
          recoveryPath: 'POST /api/superadmin/tenants/:id/reactivate after investigation',
        },
      };
    });
  })
);

// ==========================================
// ACCESS REQUESTS
// ==========================================

router.get(
  '/access-requests',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getAccessRequests(req, res, next);
  })
);
router.post(
  '/access-requests/:id/approve',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.approveAccessRequest(req, res, next);
  })
);
router.post(
  '/access-requests/:id/reject',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.rejectAccessRequest(req, res, next);
  })
);

// ==========================================
// ACCESS CODES
// ==========================================

router.get(
  '/access-codes',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getAccessCodes(req, res, next);
  })
);
router.post(
  '/access-codes',
  validateBody(CreateAccessCodeSchema),
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.createAccessCode(req, res, next);
  })
);
router.post(
  '/access-codes/:id/deactivate',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.deactivateAccessCode(req, res, next);
  })
);

// ==========================================
// IMPERSONATION
// ==========================================

router.post(
  '/impersonate',
  validateBody(ImpersonateUserSchema),
  requireConfirmation('impersonate_user', 'critical'),
  requireAudit,
  SuperAdminController.impersonateUser
);

// ==========================================
// DATABASE EXPLORER
// ==========================================

router.get(
  '/database/tables',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    if (!isDatabaseExplorerEnabled()) {
      return res.status(404).json({
        error: 'Database explorer is disabled',
        code: 'SUPERADMIN_DB_EXPLORER_DISABLED',
        guidance:
          'Use audited exports or enable the dev-only explorer explicitly outside production.',
      });
    }
    await SuperAdminController.getDatabaseTables(req, res, next);
  })
);
router.get(
  '/database/rows/:tableName',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    if (!isDatabaseExplorerEnabled()) {
      return res.status(404).json({
        error: 'Database explorer is disabled',
        code: 'SUPERADMIN_DB_EXPLORER_DISABLED',
        guidance:
          'Use audited exports or enable the dev-only explorer explicitly outside production.',
      });
    }
    await SuperAdminController.getDatabaseRows(req, res, next);
  })
);

// ==========================================
// STORAGE
// ==========================================

router.get(
  '/storage/usage',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getStorageUsage(req, res, next);
  })
);
router.get(
  '/storage/files/:orgId',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getStorageFiles(req, res, next);
  })
);
router.delete(
  '/storage/files',
  requireConfirmation('delete_storage_files', 'high'),
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.deleteStorageFile(req, res, next);
  })
);

// ==========================================
// LEGAL DOCUMENT MANAGEMENT
// ==========================================

router.get(
  '/legal/all',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getAllLegalDocs(req, res, next);
  })
);
router.post(
  '/legal/publish',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.publishLegalDoc(req, res, next);
  })
);
router.put(
  '/legal/:id/toggle-active',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.toggleLegalDocActive(req, res, next);
  })
);
router.get(
  '/legal/:id',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getLegalDocById(req, res, next);
  })
);

// ==========================================
// LEGAL EVENTS AUDIT LOG
// ==========================================

router.get(
  '/legal-events',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getLegalEvents(req, res, next);
  })
);
router.get(
  '/legal-events/stats',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getLegalEventStats(req, res, next);
  })
);

// ==========================================
// ATTRIBUTION SYSTEM
// ==========================================

router.get(
  '/organizations/:id/attribution',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getOrgAttribution(req, res, next);
  })
);
router.get(
  '/attribution/export',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.exportAttribution(req, res, next);
  })
);
router.get(
  '/attribution/partner-summary',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getPartnerSummary(req, res, next);
  })
);

// ==========================================
// USAGE STATS BY ORGANIZATION
// ==========================================

router.get(
  '/usage/by-organization',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getUsageByOrganization(req, res, next);
  })
);

// ==========================================
// INVOICES
// ==========================================

router.get(
  '/invoices',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { period = '30d' } = req.query;
      const periodDays = period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : 30;
      const params: any[] = [];
      let where = `WHERE 1=1`;

      if (period !== 'all') {
        where += ` AND i.created_at >= ?`;
        params.push(new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString());
      }

      const rows = await dbAll(
        `
          SELECT i.*, o.name as organization_name
          FROM invoices i
          LEFT JOIN organizations o ON i.organization_id = o.id
          ${where}
          ORDER BY i.created_at DESC
          LIMIT 100
        `,
        params,
        { fallback: false }
      );
      const total = (await dbGet(`SELECT COUNT(*) as total FROM invoices i ${where}`, params, {
        fallback: false,
      })) as { total?: number } | null;

      return res.json({
        invoices: (rows || []).map(mapInvoiceRow),
        total: total?.total ?? (rows || []).length,
      });
    } catch (error: any) {
      logger.error('[SuperAdmin] Error fetching invoices:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res);
      }
      return res.status(500).json({ error: 'Failed to fetch invoices' });
    }
  })
);
router.get(
  '/invoices/stats',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getInvoiceStats(req, res, next);
  })
);
router.post(
  '/invoices/:id/remind',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.remindInvoice(req, res, next);
  })
);
router.post(
  '/invoices/:id/mark-paid',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.markInvoicePaid(req, res, next);
  })
);
router.get(
  '/invoices/:id/pdf',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getInvoicePdf(req, res, next);
  })
);
router.post(
  '/invoices',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { organizationId, lineItems, currency, dueDate, description, metadata } = req.body;
      if (!organizationId || typeof organizationId !== 'string') {
        return res.status(400).json({ error: 'organizationId is required' });
      }
      if (!Array.isArray(lineItems) || lineItems.length === 0) {
        return res.status(400).json({ error: 'At least one invoice line item is required' });
      }

      const organization = await dbGet(
        `SELECT id FROM organizations WHERE id = ?`,
        [organizationId],
        { fallback: false }
      );
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const items = normalizeInvoiceLineItems(
        lineItems.map((item: any) => ({
          ...item,
          description: item.description || description || 'Invoice item',
        }))
      );
      if (
        items.some(
          (item: any) =>
            !item.description ||
            !Number.isFinite(item.quantity) ||
            item.quantity <= 0 ||
            !Number.isFinite(item.unitPrice) ||
            item.unitPrice <= 0
        )
      ) {
        return res.status(400).json({ error: 'Invoice line item price must be greater than zero' });
      }

      const subtotal = items.reduce((sum: number, item: any) => sum + item.amount, 0);
      const taxAmount = 0;
      const total = subtotal + taxAmount;
      const count = (await dbGet(`SELECT COUNT(*) as count FROM invoices`, [], {
        fallback: false,
      })) as { count?: number } | null;
      const invoiceNumber = `INV-${String((count?.count || 0) + 1).padStart(6, '0')}`;
      const id = randomUUID();

      await dbRun(
        `
          INSERT INTO invoices (
            id, organization_id, invoice_number, status, currency,
            subtotal, tax_amount, total, amount_due, amount_paid, due_date,
            line_items, metadata
          ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, 0, ?, ?, ?)
        `,
        [
          id,
          organizationId,
          invoiceNumber,
          currency || 'USD',
          subtotal,
          taxAmount,
          total,
          total,
          dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          JSON.stringify(items),
          JSON.stringify(metadata || {}),
        ],
        { fallback: false }
      );

      const invoice = await getPersistedInvoice(id);
      return res.status(201).json({
        success: true,
        id,
        invoiceNumber,
        organizationId,
        invoice,
      });
    } catch (error: any) {
      logger.error('[SuperAdmin] Error creating invoice:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res);
      }
      return res.status(500).json({ error: 'Failed to create invoice' });
    }
  })
);

// ==========================================
// BRANDING
// ==========================================

router.post(
  '/branding/:orgId/logo',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.uploadBrandingLogo(req, res, next);
  })
);

// ==========================================
// API KEYS
// ==========================================

router.get(
  '/api-keys',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getApiKeys(req, res, next);
  })
);
router.post(
  '/api-keys',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.createApiKey(req, res, next);
  })
);
router.delete(
  '/api-keys/:id',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.deleteApiKey(req, res, next);
  })
);
router.get(
  '/api-keys/:id/usage',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getApiKeyUsage(req, res, next);
  })
);

// ==========================================
// COMPLIANCE
// ==========================================

router.get(
  '/compliance/frameworks',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getComplianceFrameworks(req, res, next);
  })
);
router.get(
  '/compliance/summary',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getComplianceSummary(req, res, next);
  })
);
router.get(
  '/compliance/status/:frameworkId',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getComplianceStatus(req, res, next);
  })
);
router.get(
  '/compliance/dsar',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getDsarRequests(req, res, next);
  })
);
router.get(
  '/compliance/audits',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getComplianceAudits(req, res, next);
  })
);
router.put(
  '/compliance/controls/:controlId',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.updateComplianceControl(req, res, next);
  })
);
router.post(
  '/compliance/dsar',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.createDsarRequest(req, res, next);
  })
);
router.get(
  '/compliance/dsar/:dsarId',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getDsarRequestById(req, res, next);
  })
);
router.post(
  '/compliance/audits',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.createComplianceAudit(req, res, next);
  })
);
router.post(
  '/compliance/processing-records',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.createProcessingRecord(req, res, next);
  })
);
router.get(
  '/compliance/processing-records',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getProcessingRecords(req, res, next);
  })
);
router.get(
  '/compliance/export',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.exportComplianceReport(req, res, next);
  })
);

// ==========================================
// GDPR REQUESTS (for Legal Panel)
// ==========================================

router.get(
  '/gdpr/requests',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Query GDPR requests from the database
    const requests = await dbAll(
      `SELECT 
                gr.id,
                gr.user_id as "userId",
                u.email as "userEmail",
                gr.type,
                gr.status,
                gr.reason,
                gr.download_url as "downloadUrl",
                gr.scheduled_at as "scheduledAt",
                gr.created_at as "createdAt",
                gr.completed_at as "completedAt"
             FROM gdpr_requests gr
             LEFT JOIN users u ON gr.user_id = u.id
             ORDER BY gr.created_at DESC
             LIMIT 100`,
      []
    ).catch(() => []);

    res.json({ requests });
  })
);

router.post(
  '/gdpr/requests/:id/:action',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id, action } = req.params;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use approve or reject.' });
    }

    const newStatus = action === 'approve' ? 'processing' : 'cancelled';

    await dbRun(`UPDATE gdpr_requests SET status = ?, updated_at = datetime('now') WHERE id = ?`, [
      newStatus,
      id,
    ]);

    res.json({ success: true, status: newStatus });
  })
);

// ==========================================
// INTEGRATIONS & WEBHOOKS
// ==========================================

router.get(
  '/integrations/catalog',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const rows = await dbAll<Record<string, unknown>>(
        'SELECT id, name, description, category, icon, auth_type, status FROM integrations_catalog ORDER BY category, name'
      );
      if (rows && rows.length > 0) {
        return res.json({ connectors: rows });
      }
    } catch {
      // Table may not exist yet -- fall through to seed data
    }

    const catalog = await getIntegrationsCatalogSeed();
    return res.json({ connectors: catalog });
  })
);

router.get(
  '/integrations',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getIntegrations(req, res, next);
  })
);
router.post(
  '/integrations/:provider/connect',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.connectIntegration(req, res, next);
  })
);
router.delete(
  '/integrations/:provider',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.disconnectIntegration(req, res, next);
  })
);
router.post(
  '/integrations/:provider/test',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.testIntegration(req, res, next);
  })
);
router.post(
  '/integrations/:provider/refresh',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.refreshIntegration(req, res, next);
  })
);
router.put(
  '/integrations/:provider/config',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.updateIntegrationConfig(req, res, next);
  })
);

router.get(
  '/webhooks',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getWebhooks(req, res, next);
  })
);
router.post(
  '/webhooks',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.createWebhook(req, res, next);
  })
);
router.put(
  '/webhooks/:id',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.updateWebhook(req, res, next);
  })
);
router.delete(
  '/webhooks/:id',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.deleteWebhook(req, res, next);
  })
);
router.post(
  '/webhooks/:id/test',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.testWebhook(req, res, next);
  })
);
router.get(
  '/webhooks/:id/deliveries',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getWebhookDeliveries(req, res, next);
  })
);

// ==========================================
// SYSTEM HEALTH & ANALYTICS
// ==========================================

router.get('/system-health', SuperAdminController.getSystemHealth);
router.get('/system-analytics', SuperAdminController.getSystemAnalytics);

// ==========================================
// SYSTEM HEALTH ALERTS (persisted)
// ==========================================

const ensureAlertsTable = async () => {
  await dbRun(
    `CREATE TABLE IF NOT EXISTS system_health_alerts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      metric TEXT NOT NULL,
      operator TEXT NOT NULL,
      threshold REAL NOT NULL,
      severity TEXT DEFAULT 'warning',
      channels TEXT DEFAULT '[]',
      is_enabled INTEGER DEFAULT 1,
      last_triggered_at TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`,
    [],
    { fallback: false }
  );

  await Promise.all([
    dbRun(`ALTER TABLE backup_configurations ADD COLUMN enabled INTEGER DEFAULT 1`, [], {
      fallback: true,
    }),
    dbRun(`ALTER TABLE backup_configurations ADD COLUMN frequency TEXT DEFAULT 'daily'`, [], {
      fallback: true,
    }),
    dbRun(`ALTER TABLE backup_configurations ADD COLUMN retention_days INTEGER DEFAULT 30`, [], {
      fallback: true,
    }),
    dbRun(
      `ALTER TABLE backup_configurations ADD COLUMN include_attachments INTEGER DEFAULT 1`,
      [],
      {
        fallback: true,
      }
    ),
    dbRun(`ALTER TABLE backup_configurations ADD COLUMN include_audit_logs INTEGER DEFAULT 1`, [], {
      fallback: true,
    }),
    dbRun(`ALTER TABLE backup_configurations ADD COLUMN last_backup_at TEXT`, [], {
      fallback: true,
    }),
    dbRun(`ALTER TABLE backup_configurations ADD COLUMN next_backup_at TEXT`, [], {
      fallback: true,
    }),
    dbRun(`ALTER TABLE backup_configurations ADD COLUMN updated_at TIMESTAMPTZ`, [], {
      fallback: true,
    }),
  ]);
};

router.get(
  '/system-health/alerts',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    // Fail-soft: lazy DDL must not surface as a bare 500 on a read.
    try {
      await ensureAlertsTable();
      const rows =
        (await dbAll(`SELECT * FROM system_health_alerts ORDER BY created_at DESC`, [], {
          fallback: false,
        })) || [];
      const alerts = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        metric: r.metric,
        operator: r.condition,
        threshold: r.threshold,
        severity: r.severity || 'warning',
        channels: (() => {
          try {
            return JSON.parse(r.channels || '[]');
          } catch {
            return [];
          }
        })(),
        enabled: !!r.is_enabled,
        lastTriggeredAt: r.last_triggered_at || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
      return res.json(alerts);
    } catch (err) {
      console.error(
        '[superadmin] GET /system-health/alerts failed (fail-soft, returning empty):',
        err
      );
      return res.json([]);
    }
  })
);

router.post(
  '/system-health/alerts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureAlertsTable();
    const { name, metric, operator, threshold, severity, channels } = req.body;
    if (!name || !metric) return res.status(400).json({ error: 'name and metric are required' });
    const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await dbRun(
      `INSERT INTO system_health_alerts (id, name, metric, operator, threshold, severity, channels)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        String(name).trim(),
        String(metric),
        String(operator || 'gt'),
        Number(threshold ?? 90),
        String(severity || 'warning'),
        JSON.stringify(channels || []),
      ],
      { fallback: false }
    );
    return res.status(201).json({ success: true, id });
  })
);

router.put(
  '/system-health/alerts/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureAlertsTable();
    const { id } = req.params;
    const existing = await dbGet(`SELECT id FROM system_health_alerts WHERE id = ?`, [id], {
      fallback: false,
    });
    if (!existing) return res.status(404).json({ error: 'Alert not found' });
    const { name, metric, operator, threshold, severity, channels } = req.body;
    await dbRun(
      `UPDATE system_health_alerts
       SET name = COALESCE(?, name),
           metric = COALESCE(?, metric),
           condition = COALESCE(?, condition),
           threshold = COALESCE(?, threshold),
           severity = COALESCE(?, severity),
           channels = COALESCE(?, channels),
           updated_at = datetime('now')
       WHERE id = ?`,
      [
        name ?? null,
        metric ?? null,
        operator ?? null,
        threshold ?? null,
        severity ?? null,
        channels ? JSON.stringify(channels) : null,
        id,
      ],
      { fallback: false }
    );
    return res.json({ success: true });
  })
);

router.put(
  '/system-health/alerts/:id/toggle',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureAlertsTable();
    const { id } = req.params;
    await dbRun(
      `UPDATE system_health_alerts
       SET is_enabled = CASE WHEN is_enabled = 1 THEN 0 ELSE 1 END,
           updated_at = datetime('now')
       WHERE id = ?`,
      [id],
      { fallback: false }
    );
    return res.json({ success: true });
  })
);

router.delete(
  '/system-health/alerts/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureAlertsTable();
    const { id } = req.params;
    await dbRun(`DELETE FROM system_health_alerts WHERE id = ?`, [id], { fallback: false });
    return res.json({ success: true });
  })
);

// ==========================================
// SYSTEM CONFIGURATION (settings table)
// ==========================================

function inferSettingType(row: any): 'string' | 'number' | 'boolean' | 'json' | 'secret' {
  if (row?.is_sensitive) return 'secret';
  const raw = String(row?.value ?? '').trim();
  if (raw === 'true' || raw === 'false') return 'boolean';
  if (raw && !Number.isNaN(Number(raw)) && /^-?\d+(\.\d+)?$/.test(raw)) return 'number';
  if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']')))
    return 'json';
  return 'string';
}

router.get(
  '/system-configs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { category } = req.query as any;
    const where: string[] = [];
    const params: any[] = [];
    if (category && category !== 'all') {
      where.push(`category = ?`);
      params.push(String(category));
    }
    const sql = `SELECT id, key, value, description, category, is_sensitive, updated_at, updated_by
                 FROM settings
                 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                 ORDER BY category ASC, key ASC`;
    const rows = await dbAll(sql, params, { fallback: true });
    const configs = (rows || []).map((r: any) => ({
      id: String(r.id),
      key: r.key,
      value: r.value ?? '',
      type: inferSettingType(r),
      category: r.category || 'general',
      description: r.description || '',
      is_sensitive: !!r.is_sensitive,
      updated_at: r.updated_at || new Date().toISOString(),
      updated_by: r.updated_by || undefined,
    }));
    return res.json(configs);
  })
);

router.post(
  '/system-configs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { key, value, description, category, is_sensitive } = req.body || {};
    if (!key) return res.status(400).json({ error: 'key is required' });
    const k = String(key).trim();
    const v =
      typeof value === 'object'
        ? JSON.stringify(value)
        : value === null || value === undefined
          ? ''
          : String(value);
    const desc = description ? String(description) : '';
    const cat = category ? String(category) : 'general';
    const sensitive = is_sensitive ? 1 : 0;

    await dbRun(
      `INSERT INTO settings (key, value, description, category, is_sensitive, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`,
      [k, v, desc, cat, sensitive, req.user?.id || null],
      { fallback: false }
    );

    await insertAuditEventAtomic(req, {
      action: 'settings_create',
      resourceType: 'settings',
      resourceId: k,
      after: { value: v, description: desc, category: cat, is_sensitive: Boolean(sensitive) },
      metadata: { source: 'superadmin.system-configs' },
    });

    const created = await dbGet(
      `SELECT id, key, value, description, category, is_sensitive, updated_at, updated_by FROM settings WHERE key = ?`,
      [k],
      { fallback: false }
    );
    return res.status(201).json({
      id: String((created as any)?.id),
      key: (created as any)?.key,
      value: (created as any)?.value ?? '',
      type: inferSettingType(created),
      category: (created as any)?.category || 'general',
      description: (created as any)?.description || '',
      is_sensitive: !!(created as any)?.is_sensitive,
      updated_at: (created as any)?.updated_at || new Date().toISOString(),
      updated_by: (created as any)?.updated_by || undefined,
    });
  })
);

router.put(
  '/system-configs/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const existing = await dbGet(
      `SELECT id, key, value, description, category, is_sensitive FROM settings WHERE id = ?`,
      [id],
      { fallback: false }
    );
    if (!existing) return res.status(404).json({ error: 'Config not found' });

    const { value, description, category, is_sensitive } = req.body || {};
    const nextValue =
      typeof value === 'object'
        ? JSON.stringify(value)
        : value === null || value === undefined
          ? ((existing as any).value ?? '')
          : String(value);
    const nextDesc =
      description !== undefined ? String(description) : ((existing as any).description ?? '');
    const nextCat =
      category !== undefined ? String(category) : ((existing as any).category ?? 'general');
    const nextSensitive =
      is_sensitive !== undefined ? (is_sensitive ? 1 : 0) : (existing as any).is_sensitive ? 1 : 0;

    await dbRun(
      `UPDATE settings
       SET value = ?, description = ?, category = ?, is_sensitive = ?, updated_at = datetime('now'), updated_by = ?
       WHERE id = ?`,
      [nextValue, nextDesc, nextCat, nextSensitive, req.user?.id || null, id],
      { fallback: false }
    );

    await insertAuditEventAtomic(req, {
      action: 'settings_update',
      resourceType: 'settings',
      resourceId: (existing as any).key,
      before: {
        value: (existing as any).value,
        description: (existing as any).description,
        category: (existing as any).category,
        is_sensitive: Boolean((existing as any).is_sensitive),
      },
      after: {
        value: nextValue,
        description: nextDesc,
        category: nextCat,
        is_sensitive: Boolean(nextSensitive),
      },
      metadata: { source: 'superadmin.system-configs' },
    });

    return res.json({ success: true });
  })
);

router.delete(
  '/system-configs/:id',
  requireConfirmation('delete_system_config', 'high'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const existing = await dbGet(`SELECT id, key, value FROM settings WHERE id = ?`, [id], {
      fallback: false,
    });
    if (!existing) return res.status(404).json({ error: 'Config not found' });

    await executeAtomicGatedAction(req, res, 'delete_system_config', async () => {
      await dbRun(`DELETE FROM settings WHERE id = ?`, [id], { fallback: false });
      return {
        auditEvent: {
          action: 'settings_delete',
          resourceType: 'settings',
          resourceId: (existing as any).key,
          before: { value: (existing as any).value },
          metadata: { source: 'superadmin.system-configs' },
        },
        response: { success: true },
      };
    });
  })
);

router.get(
  '/system-configs/:id/versions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const existing = await dbGet(`SELECT id, key FROM settings WHERE id = ?`, [id], {
      fallback: false,
    });
    if (!existing) return res.status(404).json({ error: 'Config not found' });
    const key = (existing as any).key;

    const rows = await querySettingAuditVersions(String(key));

    const versions = (rows || []).map((r: any) => ({
      id: r.id,
      config_key: r.resource_id,
      old_value: parseAuditJsonField(r.before_json),
      new_value: parseAuditJsonField(r.after_json),
      changed_at: r.ts,
      changed_by: r.actor_id,
      metadata: parseAuditJsonField(r.metadata_json) || {},
    }));

    return res.json({ versions });
  })
);

router.post(
  '/system-configs/:id/rollback',
  requireConfirmation('rollback_system_config', 'high'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { versionId, reason } = req.body || {};
    if (!versionId) return res.status(400).json({ error: 'versionId is required' });

    const existing = await dbGet(`SELECT id, key, value FROM settings WHERE id = ?`, [id], {
      fallback: false,
    });
    if (!existing) return res.status(404).json({ error: 'Config not found' });
    const key = (existing as any).key;

    const versionRows = await querySettingAuditVersions(String(key));
    const versionRow = (versionRows || []).find((row: any) => String(row.id) === String(versionId));
    if (!versionRow) return res.status(404).json({ error: 'Version not found' });

    const currentValue = (existing as any).value ?? '';
    const beforePayload = parseAuditJsonField((versionRow as any).before_json);
    const rolledValue =
      beforePayload && 'value' in beforePayload
        ? String((beforePayload as any).value ?? '')
        : String(currentValue);

    await executeAtomicGatedAction(req, res, 'rollback_system_config', async () => {
      await dbRun(
        `UPDATE settings
         SET value = ?, updated_at = datetime('now'), updated_by = ?
         WHERE id = ?`,
        [rolledValue, req.user?.id || null, id],
        { fallback: false }
      );

      return {
        auditEvent: {
          action: 'settings_rollback',
          resourceType: 'settings',
          resourceId: key,
          before: { value: currentValue },
          after: { value: rolledValue },
          metadata: {
            source: 'superadmin.system-configs',
            rollbackFromVersionId: String(versionId),
            reason: reason ? String(reason) : undefined,
          },
        },
        response: { success: true },
      };
    });
  })
);

// ==========================================
// BACKUP SCHEDULING (backup_configurations table)
// ==========================================

const ensureBackupConfigurationsTable = async () => {
  await dbRun(
    `CREATE TABLE IF NOT EXISTS backup_configurations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      frequency TEXT DEFAULT 'daily',
      retention_days INTEGER DEFAULT 30,
      include_attachments INTEGER DEFAULT 1,
      include_audit_logs INTEGER DEFAULT 1,
      last_backup_at TEXT,
      next_backup_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    [],
    { fallback: false }
  );
};

router.post(
  '/system/backup',
  requireSuperAdminCapability('platform_ops'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      // T7b-2 (2026-07-19): backupService is now a REAL implementation
      // (finding_42_self_import_wrappers_services_2026-07-15). The 503 catch below is genuine
      // fail-soft, no longer a guaranteed-dead self-import wrapper.
      const type = req.body?.type || 'full';
      if (type !== 'full') {
        return res.status(400).json({ success: false, code: 'BACKUP_TYPE_INVALID' });
      }
      const { triggerManualBackup } = await import('../cron/BackupCron.js');
      const backup = await triggerManualBackup(req.body?.reason || 'superadmin_manual', {
        type,
        actorId: String(req.user?.id || 'system'),
      });
      return res.json({ success: true, backup });
    } catch (error: any) {
      logger.warn('[SuperAdmin] Manual backup unavailable:', error?.message || error);
      return res.status(503).json({
        success: false,
        error: 'Manual backup is not available.',
        code: 'BACKUP_SERVICE_UNAVAILABLE',
        guidance: 'Check backup service configuration before retrying.',
      });
    }
  })
);

router.get(
  '/backup/schedules',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      await ensureBackupConfigurationsTable();
    } catch (error: any) {
      logger.warn('[SuperAdmin] Backup schedule schema unavailable:', error?.message || error);
      return res.status(503).json({
        success: false,
        error: 'Backup schedules are not available.',
        code: 'BACKUP_SCHEDULES_UNAVAILABLE',
      });
    }

    // Model schedules as a single platform-level configuration row (organization_id = 'system')
    const cfgId = 'backupcfg-system';
    const existing = await dbGet(
      `SELECT * FROM backup_configurations WHERE organization_id = 'system' LIMIT 1`,
      [],
      { fallback: false }
    );
    if (!existing) {
      await dbRun(
        `INSERT INTO backup_configurations (id, organization_id, enabled, frequency, retention_days, include_attachments, include_audit_logs, created_at, updated_at)
         VALUES (?, 'system', 1, 'daily', 30, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [cfgId],
        { fallback: false }
      );
    }

    const row = await dbGet(
      `SELECT * FROM backup_configurations WHERE organization_id = 'system' LIMIT 1`,
      [],
      { fallback: false }
    );

    const schedules = row
      ? [
          {
            id: (row as any).id,
            name: 'System Backup',
            type: 'full',
            frequency: (row as any).frequency || 'daily',
            time: '02:00',
            retention_days: (row as any).retention_days ?? 30,
            enabled: !!(row as any).enabled,
            last_run: (row as any).last_backup_at || null,
            next_run: (row as any).next_backup_at || null,
          },
        ]
      : [];

    return res.json({ schedules });
  })
);

router.put(
  '/backup/schedules/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      await ensureBackupConfigurationsTable();
    } catch (error: any) {
      logger.warn('[SuperAdmin] Backup schedule schema unavailable:', error?.message || error);
      return res.status(503).json({
        success: false,
        error: 'Backup schedules are not available.',
        code: 'BACKUP_SCHEDULES_UNAVAILABLE',
      });
    }

    const { id } = req.params;
    const { enabled, frequency, retention_days } = req.body || {};
    const existing = await dbGet(`SELECT * FROM backup_configurations WHERE id = ?`, [id], {
      fallback: false,
    });
    if (!existing) return res.status(404).json({ error: 'Schedule not found' });

    await dbRun(
      `UPDATE backup_configurations
       SET enabled = COALESCE(?, enabled),
           frequency = COALESCE(?, frequency),
           retention_days = COALESCE(?, retention_days),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        enabled === undefined ? null : enabled ? 1 : 0,
        frequency === undefined ? null : String(frequency),
        retention_days === undefined ? null : Number(retention_days),
        id,
      ],
      { fallback: false }
    );

    return res.json({ success: true });
  })
);

// ==========================================
// SECURITY EVENTS & INCIDENTS
// ==========================================

router.get(
  '/security/events',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getSecurityEvents(req, res, next);
  })
);
router.post(
  '/security/events/:id/resolve',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.resolveSecurityEvent(req, res, next);
  })
);
router.get(
  '/security/events/stats',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getSecurityEventStats(req, res, next);
  })
);
router.get(
  '/security/ip-rules',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getIPAccessRules(req, res, next);
  })
);
router.put(
  '/security/ip-rules/:id',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.updateIPRule(req, res, next);
  })
);
router.get(
  '/security/policies',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getSecurityPolicies(req, res, next);
  })
);
router.put(
  '/security/policies/:id',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.updateSecurityPolicy(req, res, next);
  })
);

// ==========================================
// SECURITY SESSIONS (Platform view)
// ==========================================

router.get(
  '/security/sessions',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    // This endpoint intentionally uses a defensive strategy because the project contains
    // multiple historical `user_sessions` schemas (SQLite vs Postgres / early vs extended).
    const parseDeviceType = (raw?: string) => {
      const v = (raw || '').toLowerCase();
      if (v.includes('tablet')) return 'tablet';
      if (v.includes('mobile') || v.includes('iphone') || v.includes('android')) return 'mobile';
      return 'desktop';
    };
    const parseBrowser = (ua?: string) => {
      const v = ua || '';
      if (v.includes('Edg/')) return 'Edge';
      if (v.includes('Chrome/')) return 'Chrome';
      if (v.includes('Firefox/')) return 'Firefox';
      if (v.includes('Safari/') && !v.includes('Chrome/')) return 'Safari';
      return 'Unknown';
    };

    const mapRow = (r: any) => {
      const deviceType = r.device_type || parseDeviceType(r.device_info || r.user_agent);
      const browser = r.browser || parseBrowser(r.user_agent || r.device_info);
      return {
        id: r.id,
        user_id: r.user_id,
        user_email: r.user_email || r.email || 'unknown',
        device_type: deviceType,
        browser,
        ip_address: r.ip_address || 'unknown',
        location: r.location || 'unknown',
        created_at: r.created_at,
        last_activity: r.last_activity || r.last_active_at || r.last_activity_at || r.created_at,
        is_current: !!r.is_current,
      };
    };

    try {
      // Extended schema (has `is_active`, `last_activity`, browser/os fields)
      const rows = await dbAll(
        `
          SELECT s.*, u.email as user_email
          FROM user_sessions s
          LEFT JOIN users u ON u.id = s.user_id
          WHERE s.is_active = TRUE
          ORDER BY COALESCE(s.last_activity, s.last_active_at, s.created_at) DESC
          LIMIT 200
        `,
        []
      );
      return res.json({ sessions: (rows || []).map(mapRow) });
    } catch (_err) {
      // Fallback schema (no `is_active` / `last_activity`)
      const rows = await dbAll(
        `
          SELECT s.*, u.email as user_email
          FROM user_sessions s
          LEFT JOIN users u ON u.id = s.user_id
          ORDER BY COALESCE(s.last_active_at, s.created_at) DESC
          LIMIT 200
        `,
        []
      ).catch(() => []);
      return res.json({ sessions: (rows || []).map(mapRow) });
    }
  })
);

router.delete(
  '/security/sessions/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
      // Extended schema prefers soft-revoke.
      await dbRun(
        `
          UPDATE user_sessions
          SET is_active = FALSE,
              terminated_at = COALESCE(terminated_at, CURRENT_TIMESTAMP),
              termination_reason = COALESCE(termination_reason, 'forced')
          WHERE id = ?
        `,
        [id]
      );
      return res.json({ success: true });
    } catch (_err) {
      // Fallback schema: hard delete.
      await dbRun(`DELETE FROM user_sessions WHERE id = ?`, [id]);
      return res.json({ success: true });
    }
  })
);

router.get(
  '/security/incidents',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getSecurityIncidents(req, res, next);
  })
);
router.get(
  '/security/incidents/stats',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getSecurityIncidentStats(req, res, next);
  })
);
router.post(
  '/security/incidents',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.createSecurityIncident(req, res, next);
  })
);
router.put(
  '/security/incidents/:id/resolve',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.resolveSecurityIncident(req, res, next);
  })
);
router.delete(
  '/security/incidents/:id',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.deleteSecurityIncident(req, res, next);
  })
);

// ==========================================
// THREAT INTELLIGENCE
// ==========================================
router.get(
  '/security/threats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { threat_type, threat_level, is_blocked, limit = 100, offset = 0 } = req.query;
    let query = `SELECT * FROM threat_intelligence WHERE 1=1`;
    const params: any[] = [];

    if (threat_type) {
      query += ` AND threat_type = ?`;
      params.push(threat_type);
    }
    if (threat_level) {
      query += ` AND threat_level = ?`;
      params.push(threat_level);
    }
    if (is_blocked !== undefined) {
      query += ` AND is_blocked = ?`;
      params.push(is_blocked === 'true' ? 1 : 0);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const threats = (await dbAll(query, params)) || [];
    res.json(threats);
  })
);

router.get(
  '/security/threats/stats',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const raw =
      (await dbGet<Record<string, any>>(`
            SELECT 
                COUNT(*) as "totalThreats",
                SUM(CASE WHEN is_blocked = 1 THEN 1 ELSE 0 END) as "blockedCount",
                SUM(CASE WHEN threat_level = 'CRITICAL' OR threat_level = 'critical' THEN 1 ELSE 0 END) as critical,
                SUM(CASE WHEN threat_level = 'HIGH' OR threat_level = 'high' THEN 1 ELSE 0 END) as high,
                SUM(CASE WHEN threat_level = 'MEDIUM' OR threat_level = 'medium' THEN 1 ELSE 0 END) as medium,
                SUM(CASE WHEN threat_level = 'LOW' OR threat_level = 'low' THEN 1 ELSE 0 END) as low,
                SUM(CASE WHEN threat_type = 'ip' OR threat_type = 'malicious_ip' OR indicator LIKE '%.%.%.%' THEN 1 ELSE 0 END) as "ipCount",
                SUM(CASE WHEN (threat_type = 'domain' OR threat_type = 'suspicious_domain') AND indicator NOT LIKE '%.%.%.%' THEN 1 ELSE 0 END) as "domainCount",
                AVG(reputation_score) as "avgReputation"
            FROM threat_intelligence
        `)) || {};

    const s = (key: string) => Number(raw[key] ?? raw[key.toLowerCase()]) || 0;

    res.json({
      totalThreats: s('totalThreats'),
      blockedCount: s('blockedCount'),
      byThreatLevel: {
        critical: s('critical'),
        high: s('high'),
        medium: s('medium'),
        low: s('low'),
      },
      ipCount: s('ipCount'),
      domainCount: s('domainCount'),
      avgReputation: Math.round(s('avgReputation') || 50),
    });
  })
);

router.get(
  '/security/threats/check-ip',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ip = String((req.query as any)?.ip || '').trim();
    if (!ip) return res.status(400).json({ error: 'ip is required' });

    const row =
      (await dbGet<any>(
        `SELECT * FROM threat_intelligence WHERE threat_type = 'ip' AND indicator = ? ORDER BY created_at DESC LIMIT 1`,
        [ip]
      ).catch(() => null)) || null;

    if (!row) {
      return res.json({
        found: false,
        threatLevel: 'CLEAN',
        reputationScore: 90,
        isBlocked: false,
      });
    }

    return res.json({
      found: true,
      threatLevel: row.threat_level || 'MEDIUM',
      reputationScore: Number(row.reputation_score ?? 50),
      isBlocked: !!(row.is_blocked ?? row.isBlocked),
      description: row.description || '',
    });
  })
);

router.get(
  '/security/threats/check-domain',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const domain = String((req.query as any)?.domain || '').trim();
    if (!domain) return res.status(400).json({ error: 'domain is required' });

    const row =
      (await dbGet<any>(
        `SELECT * FROM threat_intelligence WHERE threat_type = 'domain' AND indicator = ? ORDER BY created_at DESC LIMIT 1`,
        [domain]
      ).catch(() => null)) || null;

    if (!row) {
      return res.json({
        found: false,
        threatLevel: 'CLEAN',
        reputationScore: 90,
        isBlocked: false,
      });
    }

    return res.json({
      found: true,
      threatLevel: row.threat_level || 'MEDIUM',
      reputationScore: Number(row.reputation_score ?? 50),
      isBlocked: !!(row.is_blocked ?? row.isBlocked),
      description: row.description || '',
    });
  })
);

router.post(
  '/security/threats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { threat_type, indicator, threat_level, reputation_score, source, description } =
      req.body;
    const id = `threat-${Date.now()}`;

    await dbRun(
      `
            INSERT INTO threat_intelligence (id, threat_type, indicator, threat_level, reputation_score, source, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `,
      [
        id,
        threat_type,
        indicator,
        threat_level || 'MEDIUM',
        reputation_score || 50,
        source || 'manual',
        description,
      ]
    );

    res.json({ success: true, id });
  })
);

router.put(
  '/security/threats/:id/block',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await dbRun(
      `UPDATE threat_intelligence SET is_blocked = 1, blocked_at = datetime('now'), blocked_by = ? WHERE id = ?`,
      [req.user?.id, id]
    );
    res.json({ success: true });
  })
);

router.put(
  '/security/threats/:id/unblock',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await dbRun(
      `UPDATE threat_intelligence SET is_blocked = 0, blocked_at = NULL, blocked_by = NULL WHERE id = ?`,
      [id]
    );
    res.json({ success: true });
  })
);

router.delete(
  '/security/threats/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await dbRun(`DELETE FROM threat_intelligence WHERE id = ?`, [id]);
    res.json({ success: true });
  })
);

// ==========================================
// APPROVAL WORKFLOWS
// ==========================================
router.get(
  '/security/workflows',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const workflows =
      (await dbAll(`SELECT * FROM approval_workflows ORDER BY created_at DESC`)) || [];
    res.json(workflows);
  })
);

router.get(
  '/security/workflows/requests',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status, workflow_id } = req.query;
    let query = `
            SELECT ar.*, aw.name as workflow_name, u.email as requester_email
            FROM approval_requests ar
            LEFT JOIN approval_workflows aw ON ar.workflow_id = aw.id
            LEFT JOIN users u ON ar.requester_id = u.id
            WHERE 1=1
        `;
    const params: any[] = [];

    if (status) {
      query += ` AND ar.status = ?`;
      params.push(status);
    }
    if (workflow_id) {
      query += ` AND ar.workflow_id = ?`;
      params.push(workflow_id);
    }

    query += ` ORDER BY ar.created_at DESC`;

    const requests = (await dbAll(query, params)) || [];
    res.json(requests);
  })
);

router.post(
  '/security/workflows',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      name,
      description,
      workflow_type,
      approvers,
      require_all_approvers,
      auto_expire_hours,
    } = req.body;
    const id = `wf-${Date.now()}`;

    await dbRun(
      `
            INSERT INTO approval_workflows (id, name, description, workflow_type, approvers, require_all_approvers, auto_expire_hours, is_active, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
        `,
      [
        id,
        name,
        description,
        workflow_type,
        JSON.stringify(approvers),
        require_all_approvers ? 1 : 0,
        auto_expire_hours || 72,
        req.user?.id,
      ]
    );

    res.json({ success: true, id });
  })
);

router.put(
  '/security/workflows/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, description, approvers, require_all_approvers, auto_expire_hours, is_active } =
      req.body;

    await dbRun(
      `
            UPDATE approval_workflows 
            SET name = COALESCE(?, name), 
                description = COALESCE(?, description),
                approvers = COALESCE(?, approvers),
                require_all_approvers = COALESCE(?, require_all_approvers),
                auto_expire_hours = COALESCE(?, auto_expire_hours),
                is_active = COALESCE(?, is_active)
            WHERE id = ?
        `,
      [
        name,
        description,
        approvers ? JSON.stringify(approvers) : null,
        require_all_approvers,
        auto_expire_hours,
        is_active,
        id,
      ]
    );

    res.json({ success: true });
  })
);

router.delete(
  '/security/workflows/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await dbRun(`DELETE FROM approval_workflows WHERE id = ?`, [id]);
    res.json({ success: true });
  })
);

router.put(
  '/security/workflows/requests/:id/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { comment } = req.body;

    await dbRun(
      `
            UPDATE approval_requests 
            SET status = 'approved', resolved_at = datetime('now'), resolved_by = ?, resolution_notes = ?
            WHERE id = ?
        `,
      [req.user?.id, comment, id]
    );

    res.json({ success: true });
  })
);

router.put(
  '/security/workflows/requests/:id/reject',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;

    await dbRun(
      `
            UPDATE approval_requests 
            SET status = 'rejected', resolved_at = datetime('now'), resolved_by = ?, resolution_notes = ?
            WHERE id = ?
        `,
      [req.user?.id, reason, id]
    );

    res.json({ success: true });
  })
);

// ==========================================
// DLP (DATA LOSS PREVENTION)
// ==========================================
router.get(
  '/security/dlp/policies',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const policies = (await dbAll(`SELECT * FROM dlp_policies ORDER BY created_at DESC`)) || [];
    res.json(policies);
  })
);

router.get(
  '/security/dlp/violations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { policy_id, severity, is_resolved } = req.query;
    let query = `
            SELECT dv.*, dp.name as policy_name, u.email as user_email
            FROM dlp_violations dv
            LEFT JOIN dlp_policies dp ON dv.policy_id = dp.id
            LEFT JOIN users u ON dv.user_id = u.id
            WHERE 1=1
        `;
    const params: any[] = [];

    if (policy_id) {
      query += ` AND dv.policy_id = ?`;
      params.push(policy_id);
    }
    if (severity) {
      query += ` AND dv.severity = ?`;
      params.push(severity);
    }
    if (is_resolved !== undefined) {
      query += ` AND dv.is_resolved = ?`;
      params.push(is_resolved === 'true' ? 1 : 0);
    }

    query += ` ORDER BY dv.detected_at DESC`;

    const violations = (await dbAll(query, params)) || [];
    res.json(violations);
  })
);

router.get(
  '/security/dlp/stats',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const policyStats = (await dbGet<{ total: number; active: number }>(`
            SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active
            FROM dlp_policies
        `)) || { total: 0, active: 0 };

    const violationStats = (await dbGet<{
      total: number;
      unresolved: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    }>(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_resolved = 0 THEN 1 ELSE 0 END) as unresolved,
                SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical,
                SUM(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) as high,
                SUM(CASE WHEN severity = 'MEDIUM' THEN 1 ELSE 0 END) as medium,
                SUM(CASE WHEN severity = 'LOW' THEN 1 ELSE 0 END) as low
            FROM dlp_violations
        `)) || { total: 0, unresolved: 0, critical: 0, high: 0, medium: 0, low: 0 };

    res.json({
      policies: { total: policyStats.total || 0, active: policyStats.active || 0 },
      violations: {
        total: violationStats.total || 0,
        unresolved: violationStats.unresolved || 0,
        bySeverity: {
          critical: violationStats.critical || 0,
          high: violationStats.high || 0,
          medium: violationStats.medium || 0,
          low: violationStats.low || 0,
        },
      },
    });
  })
);

router.post(
  '/security/dlp/policies',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, description, policy_type, rules_json, enforcement_action, severity, applies_to } =
      req.body;
    const id = `dlp-${Date.now()}`;

    await dbRun(
      `
            INSERT INTO dlp_policies (id, name, description, policy_type, rules_json, enforcement_action, severity, applies_to, is_active, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
        `,
      [
        id,
        name,
        description,
        policy_type,
        JSON.stringify(rules_json),
        enforcement_action || 'warn',
        severity || 'MEDIUM',
        JSON.stringify(applies_to),
        req.user?.id,
      ]
    );

    res.json({ success: true, id });
  })
);

router.put(
  '/security/dlp/policies/:id/toggle',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { is_active } = req.body;
    await dbRun(`UPDATE dlp_policies SET is_active = ? WHERE id = ?`, [is_active ? 1 : 0, id]);
    res.json({ success: true });
  })
);

router.delete(
  '/security/dlp/policies/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await dbRun(`DELETE FROM dlp_policies WHERE id = ?`, [id]);
    res.json({ success: true });
  })
);

router.put(
  '/security/dlp/violations/:id/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { notes } = req.body;
    await dbRun(
      `
            UPDATE dlp_violations 
            SET is_resolved = 1, resolved_at = datetime('now'), resolved_by = ?, resolution_notes = ?
            WHERE id = ?
        `,
      [req.user?.id, notes, id]
    );
    res.json({ success: true });
  })
);

// ==========================================
// ADMIN IAM MODULE
// ==========================================

logger.info(
  '[SuperAdminRoutes] SuperAdminController keys:',
  Object.keys(SuperAdminController || {})
);

router.get('/admin/sessions', SuperAdminController.getAdminSessions);
router.post('/admin/sessions', SuperAdminController.createAdminSession);
router.delete('/admin/sessions/:id', SuperAdminController.revokeAdminSession);
router.get('/admin/sessions/stats', SuperAdminController.getAdminSessionStats);
router.post(
  '/admin/sessions/revoke-all',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const exceptSessionId = (req.body as any)?.exceptSessionId
      ? String((req.body as any).exceptSessionId)
      : null;
    try {
      const params: any[] = [];
      let sql = `UPDATE admin_sessions SET is_active = 0 WHERE is_active = 1`;
      if (exceptSessionId) {
        sql += ` AND id != ?`;
        params.push(exceptSessionId);
      }
      await dbRun(sql, params);
      return res.json({ success: true });
    } catch (_err) {
      // Minimal schema fallback: expire sessions by timestamp.
      const params: any[] = [];
      let sql = `UPDATE admin_sessions SET expires_at = CURRENT_TIMESTAMP WHERE expires_at > CURRENT_TIMESTAMP`;
      if (exceptSessionId) {
        sql += ` AND id != ?`;
        params.push(exceptSessionId);
      }
      await dbRun(sql, params);
      return res.json({ success: true });
    }
  })
);

/**
 * GET /api/superadmin/platform-stats
 * Comprehensive platform statistics for SuperAdmin dashboard header
 * Returns grouped data for: Infrastructure, Users, Business, Security, Performance
 */
router.get(
  '/platform-stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const safeQuery = async <T>(query: string, defaultValue: T): Promise<T> => {
      try {
        const result = await dbGet<T>(query);
        return result || defaultValue;
      } catch {
        return defaultValue;
      }
    };

    const safeQueryAll = async <T>(query: string): Promise<T[]> => {
      try {
        const result = await dbAll<T>(query);
        return result || [];
      } catch {
        return [];
      }
    };

    try {
      // ==================== INFRASTRUCTURE ====================
      const dbSize = await safeQuery<{ size: number }>(
        `SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()`,
        { size: 0 }
      );

      // ==================== USERS ====================
      const activeUsers = await safeQuery<{ count: number }>(
        `
                SELECT COUNT(DISTINCT user_id) as count 
                FROM refresh_tokens 
                WHERE revoked_at IS NULL 
                AND expires_at > datetime('now')
                AND (last_used_at IS NULL OR datetime(last_used_at) > datetime('now', '-30 minutes'))
            `,
        { count: 0 }
      );

      const totalUsers = await safeQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM users WHERE status != 'deleted' OR status IS NULL`,
        { count: 0 }
      );

      const totalOrgs = await safeQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM organizations WHERE status != 'deleted' OR status IS NULL`,
        { count: 0 }
      );

      const todaySignups = await safeQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM users WHERE date(created_at) = date('now')`,
        { count: 0 }
      );

      const todayLogins = await safeQuery<{ count: number }>(
        `SELECT COUNT(DISTINCT user_id) as count FROM login_history WHERE date(created_at) = date('now') AND status = 'success'`,
        { count: 0 }
      );

      // Recent signups list
      const recentSignups = await safeQueryAll<{
        email: string;
        created_at: string;
        org_name: string | null;
      }>(`
                SELECT u.email, u.created_at, o.name as org_name
                FROM users u
                LEFT JOIN organizations o ON u.organization_id = o.id
                WHERE u.created_at > datetime('now', '-24 hours')
                ORDER BY u.created_at DESC
                LIMIT 10
            `);

      // ==================== BUSINESS ====================
      const trialsExpiringSoon = await safeQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM organizations WHERE trial_ends_at BETWEEN datetime('now') AND datetime('now', '+7 days')`,
        { count: 0 }
      );

      const trialsExpiringSoonList = await safeQueryAll<{ name: string; trial_ends_at: string }>(`
                SELECT name, trial_ends_at 
                FROM organizations 
                WHERE trial_ends_at BETWEEN datetime('now') AND datetime('now', '+7 days')
                ORDER BY trial_ends_at ASC
                LIMIT 10
            `);

      const overdueInvoices = await safeQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM invoices WHERE status = 'overdue' OR (status = 'pending' AND due_date < date('now'))`,
        { count: 0 }
      );

      const overdueInvoicesList = await safeQueryAll<{
        org_name: string;
        amount: number;
        due_date: string;
      }>(`
                SELECT o.name as org_name, i.amount, i.due_date
                FROM invoices i
                JOIN organizations o ON i.organization_id = o.id
                WHERE i.status = 'overdue' OR (i.status = 'pending' AND i.due_date < date('now'))
                ORDER BY i.due_date ASC
                LIMIT 10
            `);

      const pendingFeedback = await safeQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM feedback WHERE status = 'pending' OR status = 'new'`,
        { count: 0 }
      );

      const recentFeedback = await safeQueryAll<{
        type: string;
        message: string;
        created_at: string;
        user_email: string | null;
      }>(`
                SELECT f.type, substr(f.message, 1, 100) as message, f.created_at, u.email as user_email
                FROM feedback f
                LEFT JOIN users u ON f.user_id = u.id
                WHERE f.status = 'pending' OR f.status = 'new'
                ORDER BY f.created_at DESC
                LIMIT 10
            `);

      // ==================== SECURITY ====================
      const failedLoginsLastHour = await safeQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM login_history WHERE status = 'failed' AND created_at > datetime('now', '-1 hour')`,
        { count: 0 }
      );

      const failedLoginsList = await safeQueryAll<{
        email: string;
        ip_address: string;
        created_at: string;
        failure_reason: string | null;
      }>(`
                SELECT lh.email, lh.ip_address, lh.created_at, lh.failure_reason
                FROM login_history lh
                WHERE lh.status = 'failed' AND lh.created_at > datetime('now', '-1 hour')
                ORDER BY lh.created_at DESC
                LIMIT 20
            `);

      const suspiciousActivity = await safeQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM login_history WHERE status = 'failed' AND created_at > datetime('now', '-1 hour') GROUP BY ip_address HAVING COUNT(*) > 5`,
        { count: 0 }
      );

      const apiErrorsLast15Min = await safeQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM api_logs WHERE status_code >= 500 AND created_at > datetime('now', '-15 minutes')`,
        { count: 0 }
      );

      const recentErrors = await safeQueryAll<{
        endpoint: string;
        status_code: number;
        error_message: string | null;
        created_at: string;
      }>(`
                SELECT endpoint, status_code, error_message, created_at
                FROM api_logs
                WHERE status_code >= 500 AND created_at > datetime('now', '-1 hour')
                ORDER BY created_at DESC
                LIMIT 20
            `);

      // ==================== PERFORMANCE ====================
      const avgApiLatency = await safeQuery<{ avg_latency: number }>(
        `SELECT AVG(response_time_ms) as avg_latency FROM api_logs WHERE created_at > datetime('now', '-15 minutes')`,
        { avg_latency: 0 }
      );

      const slowQueries = await safeQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM api_logs WHERE response_time_ms > 1000 AND created_at > datetime('now', '-1 hour')`,
        { count: 0 }
      );

      const slowQueriesList = await safeQueryAll<{
        endpoint: string;
        response_time_ms: number;
        created_at: string;
      }>(`
                SELECT endpoint, response_time_ms, created_at
                FROM api_logs
                WHERE response_time_ms > 1000 AND created_at > datetime('now', '-1 hour')
                ORDER BY response_time_ms DESC
                LIMIT 10
            `);

      const aiRequestsToday = await safeQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM llm_logs WHERE date(created_at) = date('now')`,
        { count: 0 }
      );

      const aiTokensToday = await safeQuery<{ total: number }>(
        `SELECT SUM(total_tokens) as total FROM llm_logs WHERE date(created_at) = date('now')`,
        { total: 0 }
      );

      const aiErrorsToday = await safeQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM llm_logs WHERE date(created_at) = date('now') AND error IS NOT NULL`,
        { count: 0 }
      );

      return res.json({
        timestamp: new Date().toISOString(),

        infrastructure: {
          dbSizeMB: Math.round(((dbSize.size || 0) / 1024 / 1024) * 10) / 10,
        },

        users: {
          activeNow: activeUsers.count,
          totalUsers: totalUsers.count,
          totalOrgs: totalOrgs.count,
          todaySignups: todaySignups.count,
          todayLogins: todayLogins.count,
          recentSignups,
        },

        business: {
          trialsExpiring: trialsExpiringSoon.count,
          trialsExpiringSoonList,
          overdueInvoices: overdueInvoices.count,
          overdueInvoicesList,
          pendingFeedback: pendingFeedback.count,
          recentFeedback,
        },

        security: {
          failedLoginsLastHour: failedLoginsLastHour.count,
          failedLoginsList,
          suspiciousIPs: suspiciousActivity.count,
          apiErrors15Min: apiErrorsLast15Min.count,
          recentErrors,
        },

        performance: {
          avgApiLatencyMs: Math.round(avgApiLatency.avg_latency || 0),
          slowQueries: slowQueries.count,
          slowQueriesList,
          aiRequestsToday: aiRequestsToday.count,
          aiTokensToday: aiTokensToday.total || 0,
          aiErrorsToday: aiErrorsToday.count,
        },
      });
    } catch (error: any) {
      // Dashboard enrichment read — degrade to safe zeroed defaults instead of failing the panel.
      logger.warn('[SuperAdmin] Platform stats error, degrading', {
        err: error,
        correlationId: (req as any).correlationId,
      });
      return res.json({
        timestamp: new Date().toISOString(),
        infrastructure: { dbSizeMB: 0 },
        users: {
          activeNow: 0,
          totalUsers: 0,
          totalOrgs: 0,
          todaySignups: 0,
          todayLogins: 0,
          recentSignups: [],
        },
        business: {
          trialsExpiring: 0,
          trialsExpiringSoonList: [],
          overdueInvoices: 0,
          overdueInvoicesList: [],
          pendingFeedback: 0,
          recentFeedback: [],
        },
        security: {
          failedLoginsLastHour: 0,
          failedLoginsList: [],
          suspiciousIPs: 0,
          apiErrors15Min: 0,
          recentErrors: [],
        },
        performance: {
          avgApiLatencyMs: 0,
          slowQueries: 0,
          slowQueriesList: [],
          aiRequestsToday: 0,
          aiTokensToday: 0,
          aiErrorsToday: 0,
        },
        degraded: true,
      });
    }
  })
);

// Keep legacy endpoint for backward compatibility
router.get(
  '/online-users',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const activeUsers = await dbGet<{ count: number }>(`
            SELECT COUNT(DISTINCT user_id) as count 
            FROM refresh_tokens 
            WHERE revoked_at IS NULL AND expires_at > datetime('now')
        `);
      return res.json({
        activeSessions: activeUsers?.count || 0,
        totalActive: activeUsers?.count || 0,
      });
    } catch {
      return res.json({ activeSessions: 0, totalActive: 0 });
    }
  })
);

router.get('/admin/audit-logs', SuperAdminController.getAdminAuditLogs);
router.get('/admin/audit-logs/stats', SuperAdminController.getAdminAuditStats);
// Frontend (Api.exportAdminAuditLogs) calls this; previously unregistered → 404 in UI.
router.get('/admin/audit-logs/export', SuperAdminController.exportAuditLogs);
router.put(
  '/admin/audit-logs/:id/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { notes } = req.body;
    await insertAuditEventAtomic(req, {
      action: 'admin_audit_log.reviewed',
      resourceType: 'admin_audit_log',
      resourceId: id,
      metadata: {
        reviewNotes: notes || '',
        immutable: true,
      },
    });
    res.json({
      success: true,
      immutable: true,
      action: 'admin_audit_log.reviewed',
      message: 'Review note appended without modifying the original audit record.',
    });
  })
);

router.get('/admin/permissions', SuperAdminController.getAdminPermissions);
router.get('/admin/permissions/matrix', SuperAdminController.getPermissionsMatrix);
router.post('/admin/permissions', SuperAdminController.createAdminPermission);
router.get('/admin/permissions/stats', SuperAdminController.getPermissionsStats);
router.put('/admin/permissions/:key', SuperAdminController.updateAdminPermission);
router.delete('/admin/permissions/:key', SuperAdminController.deleteAdminPermission);
router.put('/admin/permissions/roles/:roleId', SuperAdminController.updateRolePermissions);
router.put(
  '/admin/permissions/roles/:roleId/permissions/:permissionKey',
  SuperAdminController.toggleRolePermission
);
router.post('/admin/permissions/roles/copy', SuperAdminController.copyRolePermissions);
router.get('/admin/permissions/roles/compare', SuperAdminController.compareRoles);

// Security Permissions endpoints (aliased from /admin/)
router.get('/security/permissions', SuperAdminController.getAdminPermissions);
router.get('/security/permissions/matrix', SuperAdminController.getPermissionsMatrix);
router.get(
  '/security/permissions/stats',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const permDefs = (await dbAll(`SELECT * FROM permission_definitions`)) || [];
    const customRoles = (await dbAll(`SELECT * FROM custom_roles`)) || [];

    // Group permissions by category
    const categoryBreakdown: Record<string, number> = {};
    permDefs.forEach((p: any) => {
      categoryBreakdown[p.category] = (categoryBreakdown[p.category] || 0) + 1;
    });

    res.json({
      totalPermissions: permDefs.length,
      systemPermissions: permDefs.filter((p: any) => p.is_system).length,
      customPermissions: permDefs.filter((p: any) => !p.is_system).length,
      totalRoles: customRoles.length,
      categoryBreakdown,
    });
  })
);

router.get('/admin/approval-workflows', SuperAdminController.getApprovalWorkflows);
router.post('/admin/approval-workflows', SuperAdminController.createApprovalWorkflow);
router.put('/admin/approval-workflows/:id', SuperAdminController.updateApprovalWorkflow);
router.delete('/admin/approval-workflows/:id', SuperAdminController.deleteApprovalWorkflow);
router.get('/admin/approval-requests', SuperAdminController.getApprovalRequests);
router.post('/admin/approval-requests/:id/approve', SuperAdminController.approveRequest);
router.post('/admin/approval-requests/:id/reject', SuperAdminController.rejectRequest);

// ==========================================
// SIGNALS - System Alerts, Client Tickets, Feedback
// ==========================================

router.get(
  '/signals',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    try {
      // Import database utility
      const { all: dbAll } = await import('../utils/DbPromise.js');

      // Fetch all unread notifications of signal types. We expose link
      // fields (related_object_*, action_url) so the UI can deep-link from
      // the signal popover directly to the source module (e.g. a specific
      // feedback item inside Superadmin > Customers > Feedback).
      const signals = await dbAll(`
                SELECT id, user_id, type, title, message, severity, created_at, read, data,
                       related_object_type, related_object_id, action_url
                FROM notifications
                WHERE type IN ('SYSTEM_ALERT', 'CLIENT_TICKET', 'USER_FEEDBACK')
                AND read = 0
                ORDER BY 
                    CASE severity 
                        WHEN 'CRITICAL' THEN 1 
                        WHEN 'HIGH' THEN 2 
                        WHEN 'WARNING' THEN 3 
                        ELSE 4 
                    END,
                    created_at DESC
                LIMIT 100
            `);

      // Normalize to camelCase for the frontend and provide a resolved
      // deep-link. For USER_FEEDBACK / CLIENT_TICKET we always route to the
      // Superadmin feedback tab with the feedback id as a query param, even
      // on legacy rows whose stored action_url still points at /admin.
      const shaped = (signals || []).map((row: any) => {
        const relatedObjectType: string | null =
          row.related_object_type ||
          (row.type === 'USER_FEEDBACK' || row.type === 'CLIENT_TICKET' ? 'FEEDBACK' : null);
        const relatedObjectId: string | null = row.related_object_id || null;
        let actionUrl: string | null = row.action_url || null;
        if (relatedObjectId && (row.type === 'USER_FEEDBACK' || row.type === 'CLIENT_TICKET')) {
          actionUrl = `/superadmin/customers/feedback?feedbackId=${encodeURIComponent(relatedObjectId)}`;
        }
        return {
          ...row,
          relatedObjectType,
          relatedObjectId,
          actionUrl,
        };
      });

      return res.json(shaped);
    } catch (err: any) {
      // Read — signal popover badge (unread system alerts). Fail-soft: degrade to
      // an empty list instead of breaking the superadmin header with a 500.
      logger.warn('[SuperAdmin] Signals fetch degraded', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json([]);
    }
  })
);

// ==========================================
// CUSTOMER LIFECYCLE MANAGEMENT
// ==========================================

// Get all lifecycle stages
router.get(
  '/lifecycle/stages',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const { all: dbAll } = await import('../utils/DbPromise.js');
      const stages = await dbAll(`
                SELECT cls.*, 
                    (SELECT COUNT(*) FROM organizations o WHERE o.lifecycle_stage_id = cls.id) as organization_count
                FROM customer_lifecycle_stages cls
                WHERE cls.is_active = 1
                ORDER BY cls.order_index ASC
            `);
      return res.json(stages || []);
    } catch (err: any) {
      // Fail-closed — primary content of the lifecycle admin screen (not a side
      // enrichment). Code + log with correlationId, no err.message leak.
      logger.error('[SuperAdmin] Error fetching lifecycle stages:', {
        err,
        correlationId: (_req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się pobrać etapów cyklu życia klienta',
        code: 'SUPERADMIN_LIFECYCLE_STAGES_FETCH_FAILED',
      });
    }
  })
);

// Create lifecycle stage
router.post(
  '/lifecycle/stages',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    try {
      const { run: dbRun } = await import('../utils/DbPromise.js');
      const { name, description, orderIndex, color } = req.body;
      if (!String(name || '').trim()) {
        return res.status(400).json({ error: 'Stage name is required' });
      }
      const id = `stage-${Date.now()}`;

      await dbRun(
        `
                INSERT INTO customer_lifecycle_stages (id, name, description, order_index, color)
                VALUES (?, ?, ?, ?, ?)
            `,
        [id, name, description || '', orderIndex || 0, color || '#3B82F6']
      );

      return res.json({ success: true, id });
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[SuperAdmin] Error creating lifecycle stage:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się utworzyć etapu cyklu życia',
        code: 'SUPERADMIN_LIFECYCLE_STAGE_CREATE_FAILED',
      });
    }
  })
);

// Update lifecycle stage
router.put(
  '/lifecycle/stages/:id',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    try {
      const { run: dbRun } = await import('../utils/DbPromise.js');
      const { id } = req.params;
      const { name, description, orderIndex, color, isActive } = req.body;

      await dbRun(
        `
                UPDATE customer_lifecycle_stages 
                SET name = ?, description = ?, order_index = ?, color = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
        [name, description || '', orderIndex || 0, color || '#3B82F6', isActive ? 1 : 0, id]
      );

      return res.json({ success: true });
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[SuperAdmin] Error updating lifecycle stage:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zaktualizować etapu cyklu życia',
        code: 'SUPERADMIN_LIFECYCLE_STAGE_UPDATE_FAILED',
      });
    }
  })
);

// Delete lifecycle stage
router.delete(
  '/lifecycle/stages/:id',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    try {
      const { run: dbRun } = await import('../utils/DbPromise.js');
      const { id } = req.params;

      await dbRun(`DELETE FROM customer_lifecycle_stages WHERE id = ?`, [id]);

      return res.json({ success: true });
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[SuperAdmin] Error deleting lifecycle stage:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się usunąć etapu cyklu życia',
        code: 'SUPERADMIN_LIFECYCLE_STAGE_DELETE_FAILED',
      });
    }
  })
);

// Get lifecycle transitions
router.get(
  '/lifecycle/transitions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { all: dbAll } = await import('../utils/DbPromise.js');
      const transitions = await dbAll(`
                SELECT clt.*,
                    o.name as organization_name,
                    fs.name as from_stage_name,
                    ts.name as to_stage_name,
                    u.email as transitioned_by_email
                FROM customer_lifecycle_transitions clt
                LEFT JOIN organizations o ON clt.organization_id = o.id
                LEFT JOIN customer_lifecycle_stages fs ON clt.from_stage_id = fs.id
                LEFT JOIN customer_lifecycle_stages ts ON clt.to_stage_id = ts.id
                LEFT JOIN users u ON clt.transitioned_by = u.id
                ORDER BY clt.transitioned_at DESC
                LIMIT 50
            `);
      return res.json(transitions || []);
    } catch (err: any) {
      // Enrichment read — degrade to safe default instead of failing the whole response.
      logger.warn('[SuperAdmin] Error fetching lifecycle transitions, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json([]);
    }
  })
);

// Create lifecycle transition (move organization to new stage)
router.post(
  '/lifecycle/transitions',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    try {
      const { run: dbRun, get: dbGet } = await import('../utils/DbPromise.js');
      const { organizationId, fromStageId, toStageId, notes } = req.body;
      const userId = req.user?.id;
      const id = `trans-${Date.now()}`;
      if (!organizationId || !toStageId) {
        return res.status(400).json({ error: 'Organization and target stage are required' });
      }
      const organization = await dbGet(`SELECT id FROM organizations WHERE id = ?`, [
        organizationId,
      ]);
      if (!organization) return res.status(404).json({ error: 'Organization not found' });
      const targetStage = await dbGet(`SELECT id FROM customer_lifecycle_stages WHERE id = ?`, [
        toStageId,
      ]);
      if (!targetStage) return res.status(404).json({ error: 'Target lifecycle stage not found' });

      // Insert transition record
      await dbRun(
        `
                INSERT INTO customer_lifecycle_transitions (id, organization_id, from_stage_id, to_stage_id, transitioned_by, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            `,
        [id, organizationId, fromStageId || null, toStageId, userId, notes || '']
      );

      // Update organization's current stage
      await dbRun(
        `
                UPDATE organizations SET lifecycle_stage_id = ? WHERE id = ?
            `,
        [toStageId, organizationId]
      );

      return res.json({ success: true, id });
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[SuperAdmin] Error creating lifecycle transition:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się utworzyć przejścia cyklu życia',
        code: 'SUPERADMIN_LIFECYCLE_TRANSITION_CREATE_FAILED',
      });
    }
  })
);

// Get lifecycle stats
router.get(
  '/lifecycle/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { all: dbAll, get: dbGet } = await import('../utils/DbPromise.js');

      const stageStats = await dbAll(`
                SELECT cls.id as stage_id, cls.name as stage_name, cls.color,
                    COUNT(o.id) as count
                FROM customer_lifecycle_stages cls
                LEFT JOIN organizations o ON o.lifecycle_stage_id = cls.id
                WHERE cls.is_active = 1
                GROUP BY cls.id
                ORDER BY cls.order_index
            `);

      const totalTransitions = (await dbGet(`
                SELECT COUNT(*) as total FROM customer_lifecycle_transitions
            `)) as { total: number };

      return res.json({
        stageStats: stageStats || [],
        totalTransitions: totalTransitions?.total || 0,
      });
    } catch (err: any) {
      // Enrichment read — degrade to safe default instead of failing the whole response.
      logger.warn('[SuperAdmin] Error fetching lifecycle stats, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({ stageStats: [], totalTransitions: 0, degraded: true });
    }
  })
);

// ==========================================
// CUSTOMER SUCCESS PLAYBOOKS
// ==========================================

// Get all playbooks
router.get(
  '/playbooks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { all: dbAll } = await import('../utils/DbPromise.js');
      const playbooks = await dbAll(`
                SELECT * FROM customer_success_playbooks
                ORDER BY created_at DESC
            `);
      return res.json(playbooks || []);
    } catch (err: any) {
      // Enrichment read — degrade to safe default instead of failing the whole response.
      logger.warn('[SuperAdmin] Error fetching playbooks, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json([]);
    }
  })
);

// Get playbook actions
router.get(
  '/playbooks/actions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { all: dbAll } = await import('../utils/DbPromise.js');
      const actions = await dbAll(`
                SELECT cpa.*,
                    csp.name as playbook_name,
                    o.name as organization_name
                FROM customer_playbook_actions cpa
                LEFT JOIN customer_success_playbooks csp ON cpa.playbook_id = csp.id
                LEFT JOIN organizations o ON cpa.organization_id = o.id
                ORDER BY cpa.created_at DESC
                LIMIT 100
            `);
      return res.json(actions || []);
    } catch (err: any) {
      // Enrichment read — degrade to safe default instead of failing the whole response.
      logger.warn('[SuperAdmin] Error fetching playbook actions, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json([]);
    }
  })
);

// Get playbook stats
router.get(
  '/playbooks/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { get: dbGet } = await import('../utils/DbPromise.js');

      const stats = (await dbGet(`
                SELECT 
                    (SELECT COUNT(*) FROM customer_success_playbooks) as total_playbooks,
                    (SELECT COUNT(*) FROM customer_success_playbooks WHERE is_active = 1) as active_playbooks,
                    (SELECT COUNT(*) FROM customer_playbook_actions) as total_actions,
                    (SELECT COUNT(*) FROM customer_playbook_actions WHERE status = 'completed') as completed_actions
            `)) as any;

      return res.json(
        stats || { total_playbooks: 0, active_playbooks: 0, total_actions: 0, completed_actions: 0 }
      );
    } catch (err: any) {
      // Enrichment read — degrade to safe default instead of failing the whole response.
      logger.warn('[SuperAdmin] Error fetching playbook stats, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({
        total_playbooks: 0,
        active_playbooks: 0,
        total_actions: 0,
        completed_actions: 0,
        degraded: true,
      });
    }
  })
);

// Create playbook
router.post(
  '/playbooks',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    try {
      const { run: dbRun } = await import('../utils/DbPromise.js');
      const { name, description, triggerConditions, actions } = req.body;
      if (!String(name || '').trim())
        return res.status(400).json({ error: 'Playbook name is required' });
      if (!Array.isArray(actions) || actions.length === 0) {
        return res.status(400).json({ error: 'At least one playbook action is required' });
      }
      const id = `pb-${Date.now()}`;

      await dbRun(
        `
                INSERT INTO customer_success_playbooks (id, name, description, trigger_conditions_json, actions_json)
                VALUES (?, ?, ?, ?, ?)
            `,
        [
          id,
          name,
          description || '',
          JSON.stringify(triggerConditions || {}),
          JSON.stringify(actions || []),
        ]
      );

      return res.json({ success: true, id });
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[SuperAdmin] Error creating playbook:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się utworzyć playbooka',
        code: 'SUPERADMIN_PLAYBOOK_CREATE_FAILED',
      });
    }
  })
);

// Update playbook
router.put(
  '/playbooks/:id',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    try {
      const { run: dbRun } = await import('../utils/DbPromise.js');
      const { id } = req.params;
      const { name, description, triggerConditions, actions, isActive } = req.body;
      if (!String(name || '').trim())
        return res.status(400).json({ error: 'Playbook name is required' });
      if (!Array.isArray(actions) || actions.length === 0) {
        return res.status(400).json({ error: 'At least one playbook action is required' });
      }
      const result = await dbRun(
        `
                UPDATE customer_success_playbooks
                SET name = ?, description = ?, trigger_conditions_json = ?, actions_json = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
        [
          name,
          description || '',
          JSON.stringify(triggerConditions || {}),
          JSON.stringify(actions || []),
          isActive === false ? 0 : 1,
          id,
        ]
      );
      if (result.changes === 0) return res.status(404).json({ error: 'Playbook not found' });
      return res.json({ success: true });
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[SuperAdmin] Error updating playbook:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zaktualizować playbooka',
        code: 'SUPERADMIN_PLAYBOOK_UPDATE_FAILED',
      });
    }
  })
);

// Delete playbook
router.delete(
  '/playbooks/:id',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    try {
      const { run: dbRun } = await import('../utils/DbPromise.js');
      const { id } = req.params;

      await dbRun(`DELETE FROM customer_success_playbooks WHERE id = ?`, [id]);

      return res.json({ success: true });
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[SuperAdmin] Error deleting playbook:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się usunąć playbooka',
        code: 'SUPERADMIN_PLAYBOOK_DELETE_FAILED',
      });
    }
  })
);

// Execute playbook for organization
router.post(
  '/playbooks/:id/execute',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    try {
      const { run: dbRun, get: dbGet } = await import('../utils/DbPromise.js');
      const { id } = req.params;
      const { organizationId } = req.body;

      // Get playbook
      const playbook = (await dbGet(`SELECT * FROM customer_success_playbooks WHERE id = ?`, [
        id,
      ])) as any;
      if (!playbook) {
        return res.status(404).json({ error: 'Playbook not found' });
      }

      // Parse actions and create action records
      const actions = JSON.parse(playbook.actions_json || '[]');
      for (const action of actions) {
        const actionId = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await dbRun(
          `
                    INSERT INTO customer_playbook_actions (id, playbook_id, organization_id, action_type, action_config_json, status, executed_at)
                    VALUES (?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)
                `,
          [actionId, id, organizationId, action.type, JSON.stringify(action.config || {})]
        );
      }

      return res.json({ success: true, actionsExecuted: actions.length });
    } catch (err: any) {
      // Write (executes actions) — NEVER fail-soft.
      logger.error('[SuperAdmin] Error executing playbook:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się wykonać playbooka',
        code: 'SUPERADMIN_PLAYBOOK_EXECUTE_FAILED',
      });
    }
  })
);

// ==========================================
// CUSTOMER CONTRACTS
// ==========================================

// Get all contracts
router.get(
  '/contracts',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    try {
      const { all: dbAll } = await import('../utils/DbPromise.js');
      const { status } = req.query;

      let query = `
                SELECT cc.*, o.name as organization_name
                FROM customer_contracts cc
                LEFT JOIN organizations o ON cc.organization_id = o.id
            `;
      const params: any[] = [];

      if (status) {
        query += ` WHERE cc.status = ?`;
        params.push(status);
      }
      query += ` ORDER BY cc.created_at DESC`;

      const contracts = await dbAll(query, params);
      return res.json(contracts || []);
    } catch (err: any) {
      // Enrichment read — degrade to safe default instead of failing the whole response.
      logger.warn('[SuperAdmin] Error fetching contracts, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json([]);
    }
  })
);

// Get contract stats
router.get(
  '/contracts/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { get: dbGet } = await import('../utils/DbPromise.js');

      const stats = (await dbGet(`
                SELECT 
                    COUNT(*) as total_contracts,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_contracts,
                    COALESCE(SUM(value), 0) as total_value,
                    (SELECT COUNT(*) FROM customer_contracts WHERE renewal_date BETWEEN date('now') AND date('now', '+30 days')) as renewals_30d
                FROM customer_contracts
            `)) as any;

      return res.json(
        stats || { total_contracts: 0, active_contracts: 0, total_value: 0, renewals_30d: 0 }
      );
    } catch (err: any) {
      // Enrichment read — degrade to safe default instead of failing the whole response.
      logger.warn('[SuperAdmin] Error fetching contract stats, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({
        total_contracts: 0,
        active_contracts: 0,
        total_value: 0,
        renewals_30d: 0,
        degraded: true,
      });
    }
  })
);

// Get upcoming renewals
router.get(
  '/contracts/renewals',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    try {
      const { all: dbAll } = await import('../utils/DbPromise.js');
      const days = parseInt(req.query.days as string) || 30;

      const renewals = await dbAll(
        `
                SELECT cc.id, o.name as organization_name, cc.renewal_date, cc.value,
                    CAST(julianday(cc.renewal_date) - julianday('now') AS INTEGER) as days_until
                FROM customer_contracts cc
                LEFT JOIN organizations o ON cc.organization_id = o.id
                WHERE cc.renewal_date BETWEEN date('now') AND date('now', '+' || ? || ' days')
                AND cc.status = 'active'
                ORDER BY cc.renewal_date ASC
            `,
        [days]
      );

      return res.json(renewals || []);
    } catch (err: any) {
      // Enrichment read — degrade to safe default instead of failing the whole response.
      logger.warn('[SuperAdmin] Error fetching renewals, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json([]);
    }
  })
);

// Create contract
router.post(
  '/contracts',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    try {
      const { run: dbRun, get: dbGet } = await import('../utils/DbPromise.js');
      const {
        organizationId,
        contractType,
        startDate,
        endDate,
        renewalDate,
        value,
        currency,
        status,
        terms,
        documentUrl,
      } = req.body;
      const id = `contract-${Date.now()}`;
      const numericValue = Number(value);
      if (!organizationId) return res.status(400).json({ error: 'Organization is required' });
      if (!startDate) return res.status(400).json({ error: 'Start date is required' });
      if (!Number.isFinite(numericValue) || numericValue < 0) {
        return res.status(400).json({ error: 'Contract value must be a non-negative number' });
      }
      const organization = await dbGet(`SELECT id FROM organizations WHERE id = ?`, [
        organizationId,
      ]);
      if (!organization) return res.status(404).json({ error: 'Organization not found' });

      await dbRun(
        `
                INSERT INTO customer_contracts (id, organization_id, contract_type, start_date, end_date, renewal_date, value, currency, status, terms_json, document_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        [
          id,
          organizationId,
          contractType || 'subscription',
          startDate,
          endDate || null,
          renewalDate || null,
          numericValue,
          currency || 'USD',
          status || 'active',
          JSON.stringify(terms || {}),
          documentUrl || null,
        ]
      );

      return res.json({ success: true, id });
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[SuperAdmin] Error creating contract:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się utworzyć kontraktu',
        code: 'SUPERADMIN_CONTRACT_CREATE_FAILED',
      });
    }
  })
);

// Update contract
router.put(
  '/contracts/:id',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    try {
      const { run: dbRun, get: dbGet } = await import('../utils/DbPromise.js');
      const { id } = req.params;
      const {
        organizationId,
        contractType,
        startDate,
        endDate,
        renewalDate,
        value,
        currency,
        status,
        terms,
        documentUrl,
      } = req.body;
      const numericValue = Number(value);
      if (!organizationId) return res.status(400).json({ error: 'Organization is required' });
      if (!startDate) return res.status(400).json({ error: 'Start date is required' });
      if (!Number.isFinite(numericValue) || numericValue < 0) {
        return res.status(400).json({ error: 'Contract value must be a non-negative number' });
      }
      const organization = await dbGet(`SELECT id FROM organizations WHERE id = ?`, [
        organizationId,
      ]);
      if (!organization) return res.status(404).json({ error: 'Organization not found' });
      const result = await dbRun(
        `
                UPDATE customer_contracts
                SET organization_id = ?, contract_type = ?, start_date = ?, end_date = ?, renewal_date = ?, value = ?, currency = ?, status = ?, terms_json = ?, document_url = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
        [
          organizationId,
          contractType || 'subscription',
          startDate,
          endDate || null,
          renewalDate || null,
          numericValue,
          currency || 'USD',
          status || 'active',
          JSON.stringify(terms || {}),
          documentUrl || null,
          id,
        ]
      );
      if (result.changes === 0) return res.status(404).json({ error: 'Contract not found' });
      return res.json({ success: true });
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[SuperAdmin] Error updating contract:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zaktualizować kontraktu',
        code: 'SUPERADMIN_CONTRACT_UPDATE_FAILED',
      });
    }
  })
);

// Delete contract
router.delete(
  '/contracts/:id',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    try {
      const { run: dbRun } = await import('../utils/DbPromise.js');
      const { id } = req.params;

      await dbRun(`DELETE FROM customer_contracts WHERE id = ?`, [id]);

      return res.json({ success: true });
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[SuperAdmin] Error deleting contract:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się usunąć kontraktu',
        code: 'SUPERADMIN_CONTRACT_DELETE_FAILED',
      });
    }
  })
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Organizations
// ==========================================

router.get(
  '/organizations/:id/metadata',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getOrganizationMetadata(req, res, next);
  })
);
router.put(
  '/organizations/:id/metadata',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.updateOrganizationMetadata(req, res, next);
  })
);
router.get(
  '/organizations/:id/tags',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getOrganizationTags(req, res, next);
  })
);
router.post(
  '/organizations/:id/tags',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.addOrganizationTag(req, res, next);
  })
);
router.delete(
  '/organizations/:id/tags/:tagId',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.removeOrganizationTag(req, res, next);
  })
);
router.get(
  '/organizations/:id/health',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getOrganizationHealth(req, res, next);
  })
);
router.get(
  '/organizations/:id/relationships',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getOrganizationRelationships(req, res, next);
  })
);
router.get(
  '/organizations/:id/analytics',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getOrganizationAnalytics(req, res, next);
  })
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Users
// ==========================================

router.get(
  '/users/:id/profile-extended',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getUserProfileExtended(req, res, next);
  })
);
router.put(
  '/users/:id/profile-extended',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.updateUserProfileExtended(req, res, next);
  })
);
router.get(
  '/users/:id/activity',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getUserActivity(req, res, next);
  })
);
router.get(
  '/users/:id/sessions',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getUserSessions(req, res, next);
  })
);
router.delete(
  '/users/:id/sessions/:sessionId',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.revokeUserSession(req, res, next);
  })
);
router.get(
  '/users/:id/groups',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getUserGroups(req, res, next);
  })
);
router.get(
  '/users/:id/onboarding',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getUserOnboardingProgress(req, res, next);
  })
);
router.put(
  '/users/:id/onboarding',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.updateUserOnboardingProgress(req, res, next);
  })
);
router.get(
  '/users/:id/license',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getUserLicense(req, res, next);
  })
);
router.put(
  '/users/:id/license',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.assignUserLicense(req, res, next);
  })
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Security
// ==========================================

router.get(
  '/organizations/:id/ip-whitelist',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getIPWhitelist(req, res, next);
  })
);
router.post(
  '/organizations/:id/ip-whitelist',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.addIPWhitelist(req, res, next);
  })
);
router.delete(
  '/ip-whitelist/:id',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.removeIPWhitelist(req, res, next);
  })
);
router.get(
  '/users/:id/devices',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getUserDevices(req, res, next);
  })
);
router.post(
  '/devices/:id/block',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.blockDevice(req, res, next);
  })
);
router.get(
  '/users/:id/mfa',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getMFAMethods(req, res, next);
  })
);
router.post(
  '/users/:id/mfa/totp/setup',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.setupTOTP(req, res, next);
  })
);
router.post(
  '/users/:id/mfa/totp/verify',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.verifyTOTP(req, res, next);
  })
);
router.get(
  '/organizations/:id/password-policy',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getPasswordPolicy(req, res, next);
  })
);
router.put(
  '/organizations/:id/password-policy',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.updatePasswordPolicy(req, res, next);
  })
);
router.get(
  '/security-events',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getSecurityEvents(req, res, next);
  })
);
router.post(
  '/security-events/:id/resolve',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.resolveSecurityEvent(req, res, next);
  })
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Support
// ==========================================

router.get(
  '/support/tickets',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getSupportTickets(req, res, next);
  })
);
router.post(
  '/support/tickets',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.createSupportTicket(req, res, next);
  })
);
router.put(
  '/support/tickets/:id',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.updateSupportTicket(req, res, next);
  })
);
router.get(
  '/support/tickets/:id/comments',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getTicketComments(req, res, next);
  })
);
router.post(
  '/support/tickets/:id/comments',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.addTicketComment(req, res, next);
  })
);
router.get(
  '/organizations/:id/customer-success/notes',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getCustomerSuccessNotes(req, res, next);
  })
);
router.post(
  '/organizations/:id/customer-success/notes',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.createCustomerSuccessNote(req, res, next);
  })
);
router.get(
  '/organizations/:id/customer-success/health',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getCustomerHealthCheck(req, res, next);
  })
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Feedback
// ==========================================

router.get(
  '/feedback',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getFeedbackItems(req, res, next);
  })
);
router.post(
  '/feedback',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.createFeedbackItem(req, res, next);
  })
);
router.post(
  '/feedback/:id/vote',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.voteFeedback(req, res, next);
  })
);
router.post(
  '/feedback/:id/comments',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.addFeedbackComment(req, res, next);
  })
);
router.get(
  '/feature-roadmap',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getFeatureRoadmap(req, res, next);
  })
);
router.put(
  '/feature-roadmap/:id',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.updateFeatureRoadmap(req, res, next);
  })
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Analytics
// ==========================================

router.get(
  '/users/:id/adoption-metrics',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getUserAdoptionMetrics(req, res, next);
  })
);
router.get(
  '/organizations/:id/churn-prediction',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getChurnPrediction(req, res, next);
  })
);

// T113: Organization behavior summary
router.get(
  '/organizations/:id/behavior-summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
      const svc = await import('../services/behaviorIntelligenceService.js');
      const summary = await svc.getOrgBehaviorSummary(id);
      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: 'Failed to get behavior summary' });
    }
  })
);

// T113: Enhanced user adoption metrics (real data)
router.get(
  '/users/:id/journey-timeline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
      const svc = await import('../services/behaviorIntelligenceService.js');
      const metrics = await svc.getAdoptionMetrics(id);
      res.json(metrics);
    } catch (err) {
      res.status(500).json({ error: 'Failed to get journey timeline' });
    }
  })
);

// T113: Generate churn warnings for org
router.post(
  '/organizations/:id/churn-warnings/generate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
      const svc = await import('../services/behaviorIntelligenceService.js');
      const warnings = await svc.generateChurnWarnings(id);
      res.json({ generated: warnings.length, warnings });
    } catch (err) {
      res.status(500).json({ error: 'Failed to generate churn warnings' });
    }
  })
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Compliance
// ==========================================

router.get(
  '/compliance/retention-policies',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getDataRetentionPolicies(req, res, next);
  })
);
router.post(
  '/compliance/retention-policies',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.createDataRetentionPolicy(req, res, next);
  })
);
router.get(
  '/compliance/gdpr-requests',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getGDPRRequests(req, res, next);
  })
);
router.post(
  '/compliance/gdpr-requests',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.createGDPRRequest(req, res, next);
  })
);
router.get(
  '/users/:id/consents',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getUserConsents(req, res, next);
  })
);
router.put(
  '/users/:id/consents',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.updateUserConsent(req, res, next);
  })
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Automation
// ==========================================

router.get(
  '/automation/rules',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getAutomationRules(req, res, next);
  })
);
router.post(
  '/automation/rules',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.createAutomationRule(req, res, next);
  })
);
router.put(
  '/automation/rules/:id',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.updateAutomationRule(req, res, next);
  })
);
router.get(
  '/webhooks',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getWebhookSubscriptions(req, res, next);
  })
);
router.post(
  '/webhooks',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.createWebhookSubscription(req, res, next);
  })
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Communication
// ==========================================

router.get(
  '/email/templates',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getEmailTemplates(req, res, next);
  })
);
router.post(
  '/email/templates',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.createEmailTemplate(req, res, next);
  })
);
router.get(
  '/email/campaigns',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getEmailCampaigns(req, res, next);
  })
);
router.post(
  '/email/campaigns',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.createEmailCampaign(req, res, next);
  })
);
router.get(
  '/users/:id/notification-preferences',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.getNotificationPreferences(req, res, next);
  })
);
router.put(
  '/users/:id/notification-preferences',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.updateNotificationPreferences(req, res, next);
  })
);

// ==========================================
// CUSTOMER AUTOMATION RULES
// ==========================================

router.get(
  '/automation/rules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { is_active } = req.query;
    let query = `SELECT * FROM automation_rules`;
    const params: any[] = [];

    if (is_active !== undefined) {
      query += ` WHERE is_active = ?`;
      params.push(is_active === 'true' ? 1 : 0);
    }

    query += ` ORDER BY created_at DESC`;
    const rules = (await dbAll(query, params)) || [];
    res.json(rules);
  })
);

router.get(
  '/automation/rules/stats',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const stats = (await dbGet<{ total: number; active: number; total_executions: number }>(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                SUM(executions_count) as total_executions
            FROM automation_rules
        `)) || { total: 0, active: 0, total_executions: 0 };

    res.json(stats);
  })
);

router.post(
  '/automation/rules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, description, trigger_type, trigger_config, action_type, action_config } =
      req.body;
    const id = `rule-${Date.now()}`;

    await dbRun(
      `
            INSERT INTO automation_rules (id, name, description, trigger_type, trigger_config, action_type, action_config, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        id,
        name,
        description,
        trigger_type,
        JSON.stringify(trigger_config || {}),
        action_type,
        JSON.stringify(action_config || {}),
        req.user?.id,
      ]
    );

    res.json({ success: true, id });
  })
);

router.put(
  '/automation/rules/:id/toggle',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { is_active } = req.body;

    await dbRun(
      `UPDATE automation_rules SET is_active = ?, updated_at = datetime('now') WHERE id = ?`,
      [is_active ? 1 : 0, id]
    );
    res.json({ success: true });
  })
);

router.delete(
  '/automation/rules/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await dbRun(`DELETE FROM automation_rules WHERE id = ?`, [id]);
    res.json({ success: true });
  })
);

router.get(
  '/automation/rules/:id/executions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const executions =
      (await dbAll(
        `
            SELECT are.*, o.name as organization_name, u.email as user_email
            FROM automation_rule_executions are
            LEFT JOIN organizations o ON are.organization_id = o.id
            LEFT JOIN users u ON are.user_id = u.id
            WHERE are.rule_id = ?
            ORDER BY are.executed_at DESC
            LIMIT 50
        `,
        [id]
      )) || [];
    res.json(executions);
  })
);

// ==========================================
// CUSTOMER COMMUNICATIONS
// ==========================================

router.get(
  '/communications',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const communications =
      (await dbAll(`
            SELECT cc.*, u.email as created_by_email
            FROM customer_communications cc
            LEFT JOIN users u ON cc.created_by = u.id
            ORDER BY cc.created_at DESC
            LIMIT 100
        `)) || [];
    res.json(communications);
  })
);

router.get(
  '/communications/stats',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const stats = (await dbGet<{ total: number; sent: number; avg_open_rate: number }>(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                AVG(CASE WHEN open_count > 0 THEN (open_count * 100.0 / NULLIF(recipient_count, 0)) ELSE 0 END) as avg_open_rate
            FROM customer_communications
        `)) || { total: 0, sent: 0, avg_open_rate: 0 };

    res.json(stats);
  })
);

router.post(
  '/communications',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { type, subject, content, recipients_filter } = req.body;
    const id = `comm-${Date.now()}`;

    await dbRun(
      `
            INSERT INTO customer_communications (id, type, subject, content, recipients_filter, status, created_by)
            VALUES (?, ?, ?, ?, ?, 'draft', ?)
        `,
      [id, type, subject, content, JSON.stringify(recipients_filter || {}), req.user?.id]
    );

    res.json({ success: true, id });
  })
);

router.post(
  '/communications/:id/send',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    // In production, this would integrate with email service
    // For now, just update status
    await dbRun(
      `
            UPDATE customer_communications 
            SET status = 'sent', sent_at = datetime('now')
            WHERE id = ?
        `,
      [id]
    );

    res.json({ success: true });
  })
);

router.delete(
  '/communications/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await dbRun(`DELETE FROM customer_communications WHERE id = ?`, [id]);
    res.json({ success: true });
  })
);

// ==========================================
// REFRESH TOKEN
// ==========================================

router.post(
  '/refresh-token',
  asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
    await SuperAdminController.refreshToken(req, res, next);
  })
);

export default router;
