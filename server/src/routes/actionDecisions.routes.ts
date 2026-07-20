/**
 * Action Decisions Routes
 * API endpoints for managing AI action decisions
 *
 * Fully migrated to TypeScript ES modules
 */

import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

// Apply rate limiting
const router = Router();
const notConfigured = (res: Response) =>
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });
const respondIfUnavailable = (res: Response, err: unknown, _fallbackMessage: string) => {
  const code = (err as any)?.code;
  const statusCode = (err as any)?.statusCode;

  if (code === 'FEATURE_UNAVAILABLE' || statusCode === 503) {
    return notConfigured(res);
  }
  return null;
};

// Service interfaces
interface ActionDecisionServiceInterface {
  [key: string]: any;
  recordDecision?: (data: {
    proposal_id: string;
    organization_id: string;
    decision: string;
    decided_by_user_id: string;
    reason?: string;
    modified_payload?: unknown;
  }) => Promise<{ id: string; decision: string }>;
  getAuditLog?: (
    orgId: string,
    filters?: {
      actionType?: string;
      decision?: string;
      limit?: number;
      offset?: number;
    }
  ) => Promise<
    Array<{
      id?: string;
      organization_id?: string;
      decision?: string;
      correlation_id?: string;
      [key: string]: unknown;
    }>
  >;
  evaluatePolicyForProposal?: (proposal: unknown, organizationId: string) => Promise<unknown>;
}

interface ActionExecutionAdapterInterface {
  [key: string]: any;
  executeDecision?: (
    decisionId: string,
    executedBy: string,
    options?: { dry_run?: boolean }
  ) => Promise<{
    success: boolean;
    correlation_id?: string;
    [key: string]: unknown;
  }>;
}

interface AuditExportServiceInterface {
  [key: string]: any;
  exportDecisions?: (options: {
    organizationId: string;
    format: string;
    includeArchived?: boolean;
  }) => Promise<{ format: string; data: string | unknown }>;
  exportExecutions?: (options: {
    organizationId: string;
    format: string;
    includeArchived?: boolean;
  }) => Promise<{ format: string; data: string | unknown }>;
}

interface PolicyEngineInterface {
  [key: string]: any;
  getAllRules?: () => Promise<unknown[]>;
  getRules?: (organizationId: string) => Promise<unknown[]>;
  toggleRule?: (id: string, enabled: boolean) => Promise<unknown>;
  createRule?: (data: {
    organization_id: string;
    action_type: string;
    scope: string;
    max_risk_level: string;
    conditions?: Record<string, unknown>;
    auto_decision: string;
    auto_decision_reason: string;
    created_by_user_id: string;
  }) => Promise<unknown>;
  getGlobalStatus?: () => Promise<unknown>;
  setGlobalStatus?: (enabled: boolean, userId: string) => Promise<unknown>;
}

interface ActionProposalEngineInterface {
  [key: string]: any;
  getProposalById?: (organizationId: string, id: string) => Promise<unknown>;
}

interface AsyncJobServiceInterface {
  [key: string]: any;
  enqueueActionExecution?: (options: {
    decisionId: string;
    organizationId: string;
    correlationId: string;
    priority?: string;
    createdBy: string;
  }) => Promise<unknown>;
  getJob?: (jobId: string, organizationId: string) => Promise<unknown>;
  retryJob?: (jobId: string, organizationId: string) => Promise<unknown>;
  cancelJob?: (jobId: string, organizationId: string) => Promise<unknown>;
  listJobs?: (
    organizationId: string,
    options: {
      deadLetterOnly?: boolean;
      limit: number;
      offset: number;
    }
  ) => Promise<unknown[]>;
  getDeadLetterStats?: (organizationId: string) => Promise<unknown>;
}

// Dynamic imports for services (may not be migrated yet)
let ActionDecisionService: ActionDecisionServiceInterface | null = null;
let ActionExecutionAdapter: ActionExecutionAdapterInterface | null = null;
let AuditExportService: AuditExportServiceInterface | null = null;
let PolicyEngine: PolicyEngineInterface | null = null;
let ActionProposalEngine: ActionProposalEngineInterface | null = null;
let AsyncJobService: AsyncJobServiceInterface | null = null;

try {
  const decisionModule = (await import('../ai/actionDecisionService.js')) as any;
  ActionDecisionService = (decisionModule.default ||
    decisionModule) as ActionDecisionServiceInterface;
} catch {
  logger.warn('[ActionDecisions Routes] ActionDecisionService not available');
}

try {
  const executionModule = (await import('../ai/actionExecutionAdapter.js')) as any;
  ActionExecutionAdapter = (executionModule.default ||
    executionModule) as ActionExecutionAdapterInterface;
} catch {
  logger.warn('[ActionDecisions Routes] ActionExecutionAdapter not available');
}

try {
  const auditModule = (await import('../ai/auditExport.js')) as any;
  AuditExportService = (auditModule.default || auditModule) as AuditExportServiceInterface;
} catch {
  logger.warn('[ActionDecisions Routes] AuditExportService not available');
}

try {
  const policyModule = (await import('../ai/policyEngine.js')) as any;
  PolicyEngine = (policyModule.default || policyModule) as PolicyEngineInterface;
} catch {
  logger.warn('[ActionDecisions Routes] PolicyEngine not available');
}

try {
  const proposalModule = (await import('../ai/actionProposalEngine.js')) as any;
  ActionProposalEngine = (proposalModule.default ||
    proposalModule) as ActionProposalEngineInterface;
} catch {
  logger.warn('[ActionDecisions Routes] ActionProposalEngine not available');
}

try {
  const asyncModule = (await import('../ai/asyncJobService.js')) as any;
  AsyncJobService = (asyncModule.default || asyncModule) as AsyncJobServiceInterface;
} catch {
  logger.warn('[ActionDecisions Routes] AsyncJobService not available');
}

// Apply auth to all routes in this file
router.use(verifyToken);

/**
 * @route POST /api/ai/actions/decide
 * @desc Record a decision for an AI Action Proposal (Snapshot server-side)
 * @access Private (Admin / SuperAdmin)
 */
router.post(
  '/decide',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!ActionDecisionService?.recordDecision) {
      return notConfigured(res);
    }

    try {
      // STRICT PARSING: Only accept proposal_id, decision, reason, and modified_payload.
      // DO NOT accept snapshot or original_payload from client to prevent audit tampering.
      const { proposal_id, decision, reason, modified_payload } = req.body;
      const userRole = req.user?.role;
      const organizationId = req.user?.organizationId || req.user?.organization_id;
      const userId = req.user?.id;

      // RBAC CHECK
      if (
        !userId ||
        !userRole ||
        !['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(
          (userRole || '').toLowerCase()
        )
      ) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const decisionRecord = await ActionDecisionService.recordDecision({
        proposal_id,
        organization_id: organizationId,
        decision,
        decided_by_user_id: userId,
        reason,
        modified_payload,
      });

      return res.status(201).json({
        message: 'Decision recorded successfully',
        audit_id: decisionRecord.id,
        decision: decisionRecord.decision,
      });
    } catch (err: any) {
      logger.error('[ActionDecisionsRoute] Error:', err);
      const status = (err as { status?: number })?.status || 400;
      return res.status(status).json({
        error: 'Unknown error',
      });
    }
  })
);

/**
 * @route GET /api/ai/actions/audit
 * @desc Get decision audit log (Isolated by organization)
 * @access Private (Admin / SuperAdmin)
 */
router.get(
  '/audit',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!ActionDecisionService?.getAuditLog) {
      return notConfigured(res);
    }

    try {
      // RBAC CHECK
      const userRole = req.user?.role;
      if (
        !userRole ||
        !['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(
          (userRole || '').toLowerCase()
        )
      ) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      // Filters from query params
      const { actionType, decision, limit, offset } = req.query;
      const organizationId = req.user?.organizationId || req.user?.organization_id;

      // ADMIN can only see their own org. SUPERADMIN can bypass.
      const orgId =
        userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN'
          ? 'SUPERADMIN_BYPASS'
          : organizationId;

      if (!orgId || (orgId !== 'SUPERADMIN_BYPASS' && !organizationId)) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const log = await ActionDecisionService.getAuditLog(orgId, {
        actionType: actionType as string | undefined,
        decision: decision as string | undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });

      return res.json(log);
    } catch (err: any) {
      logger.error('[ActionAuditRoute] Error:', err);
      return res.status(500).json({ error: 'Failed to fetch audit log' });
    }
  })
);

/**
 * @route POST /api/ai/actions/decisions/:id/execute
 * @desc Execute an approved decision (Hardened Isolation)
 * @access Private (Admin / SuperAdmin)
 */
router.post(
  '/decisions/:id/execute',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!ActionDecisionService?.getAuditLog || !ActionExecutionAdapter?.executeDecision) {
      return notConfigured(res);
    }

    try {
      const { id } = req.params;
      const userRole = req.user?.role;
      const organizationId = req.user?.organizationId || req.user?.organization_id;
      const userId = req.user?.id;

      if (
        !userId ||
        !userRole ||
        !['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(
          (userRole || '').toLowerCase()
        )
      ) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      // RBAC check: ADMIN only their own org, SUPERADMIN any org
      // Fetch specific decision to check organization_id
      const orgId = (
        userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN'
          ? 'SUPERADMIN_BYPASS'
          : organizationId
      ) as string;
      const decisions = await ActionDecisionService.getAuditLog(orgId);
      const decision = decisions.find((d) => d.id === id);

      if (!decision) {
        return res.status(404).json({ error: `Decision not found: ${id}` });
      }

      // Double check isolation for non-superadmins
      if (
        userRole !== 'SUPERADMIN' &&
        userRole !== 'SUPER_ADMIN' &&
        decision.organization_id !== organizationId
      ) {
        return res.status(403).json({ error: 'Forbidden: Organization mismatch' });
      }

      const executionResult = await ActionExecutionAdapter.executeDecision(id, userId);

      if (!executionResult.success) {
        if ((executionResult as any)?.error_code === 'FEATURE_UNAVAILABLE') {
          return res.status(503).json(executionResult);
        }
        return res.status(400).json(executionResult);
      }

      // Include correlation_id in response (Step 9.5)
      return res.json(executionResult);
    } catch (err: any) {
      logger.error('[ActionExecutionRoute] Error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

/**
 * @route POST /api/ai/actions/decisions/:id/dry-run
 * @desc Dry-run an approved decision (no side effects) - Step 9.6
 * @access Private (Admin / SuperAdmin)
 */
router.post(
  '/decisions/:id/dry-run',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!ActionDecisionService?.getAuditLog || !ActionExecutionAdapter?.executeDecision) {
      return notConfigured(res);
    }

    try {
      const { id } = req.params;
      const userRole = req.user?.role;
      const organizationId = req.user?.organizationId || req.user?.organization_id;
      const userId = req.user?.id;

      // RBAC check
      if (
        !userId ||
        !userRole ||
        !['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(
          (userRole || '').toLowerCase()
        )
      ) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      // Fetch specific decision to check organization_id
      const orgId = (
        userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN'
          ? 'SUPERADMIN_BYPASS'
          : organizationId
      ) as string;
      const decisions = await ActionDecisionService.getAuditLog(orgId);
      const decision = decisions.find((d) => d.id === id);

      if (!decision) {
        return res.status(404).json({ error: `Decision not found: ${id}` });
      }

      // Double check isolation for non-superadmins
      if (
        userRole !== 'SUPERADMIN' &&
        userRole !== 'SUPER_ADMIN' &&
        decision.organization_id !== organizationId
      ) {
        return res.status(403).json({ error: 'Forbidden: Organization mismatch' });
      }

      const dryRunResult = await ActionExecutionAdapter.executeDecision(id, userId, {
        dry_run: true,
      });

      return res.json(dryRunResult);
    } catch (err: any) {
      logger.error('[ActionDryRunRoute] Error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

/**
 * @route GET /api/ai/actions/audit/export
 * @desc Export decisions audit log (CSV or JSON) - Step 9.7
 * @access Private (Admin / SuperAdmin)
 */
router.get(
  '/audit/export',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AuditExportService?.exportDecisions) {
      return notConfigured(res);
    }

    try {
      // RBAC check
      const userRole = req.user?.role;
      if (
        !userRole ||
        !['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(
          (userRole || '').toLowerCase()
        )
      ) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      const { format = 'json', include_archived } = req.query;
      const organizationId = req.user?.organizationId || req.user?.organization_id;

      // ADMIN can only see their own org. SUPERADMIN can bypass.
      const orgId =
        userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN'
          ? 'SUPERADMIN_BYPASS'
          : organizationId;
      const includeArchived =
        (userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN') && include_archived === 'true';

      if (!orgId || (orgId !== 'SUPERADMIN_BYPASS' && !organizationId)) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const result = await AuditExportService.exportDecisions({
        organizationId: orgId,
        format: format as string,
        includeArchived,
      });

      if (result.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="audit_decisions.csv"');
        return res.send(
          typeof result.data === 'string' ? result.data : JSON.stringify(result.data)
        );
      }

      return res.json(result.data);
    } catch (err: any) {
      logger.error('[AuditExportRoute] Error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

/**
 * @route GET /api/ai/actions/executions/export
 * @desc Export executions audit log (CSV or JSON) - Step 9.7
 * @access Private (Admin / SuperAdmin)
 */
router.get(
  '/executions/export',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AuditExportService?.exportExecutions) {
      return notConfigured(res);
    }

    try {
      // RBAC check
      const userRole = req.user?.role;
      if (
        !userRole ||
        !['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(
          (userRole || '').toLowerCase()
        )
      ) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      const { format = 'json', include_archived } = req.query;
      const organizationId = req.user?.organizationId || req.user?.organization_id;

      // ADMIN can only see their own org. SUPERADMIN can bypass.
      const orgId =
        userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN'
          ? 'SUPERADMIN_BYPASS'
          : organizationId;
      const includeArchived =
        (userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN') && include_archived === 'true';

      if (!orgId || (orgId !== 'SUPERADMIN_BYPASS' && !organizationId)) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const result = await AuditExportService.exportExecutions({
        organizationId: orgId,
        format: format as string,
        includeArchived,
      });

      if (result.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="audit_executions.csv"');
        return res.send(
          typeof result.data === 'string' ? result.data : JSON.stringify(result.data)
        );
      }

      return res.json(result.data);
    } catch (err: any) {
      logger.error('[ExecutionsExportRoute] Error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

// ==========================================
// STEP 9.8: POLICY ENGINE ROUTES
// ==========================================

/**
 * @route GET /api/ai/actions/policy-rules
 * @desc List policy rules (ADMIN: own org, SUPERADMIN: all)
 * @access Private (Admin / SuperAdmin)
 */
router.get(
  '/policy-rules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!PolicyEngine?.getAllRules || !PolicyEngine?.getRules) {
      return notConfigured(res);
    }

    try {
      const userRole = req.user?.role;
      if (
        !userRole ||
        !['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(
          (userRole || '').toLowerCase()
        )
      ) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      const organizationId = req.user?.organizationId || req.user?.organization_id;

      let rules;
      if (userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN') {
        rules = await PolicyEngine.getAllRules();
      } else {
        if (!organizationId) {
          return res.status(400).json({ error: 'Organization ID required' });
        }
        rules = await PolicyEngine.getRules(organizationId);
      }

      return res.json(rules);
    } catch (err: any) {
      logger.error('[PolicyRulesRoute] Error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

/**
 * @route PATCH /api/ai/actions/policy-rules/:id/toggle
 * @desc Enable/disable a policy rule
 * @access Private (Admin / SuperAdmin)
 */
router.patch(
  '/policy-rules/:id/toggle',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!PolicyEngine?.toggleRule) {
      return notConfigured(res);
    }

    try {
      const userRole = req.user?.role;
      if (
        !userRole ||
        !['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(
          (userRole || '').toLowerCase()
        )
      ) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled (boolean) is required' });
      }

      const result = await PolicyEngine.toggleRule(req.params.id, enabled);
      return res.json(result);
    } catch (err: any) {
      if (err instanceof Error && err.message === 'Rule not found') {
        return res.status(404).json({ error: err.message });
      }
      logger.error('[PolicyToggleRoute] Error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

/**
 * @route POST /api/ai/actions/policy-rules
 * @desc Create a new policy rule (ADMIN: own org only)
 * @access Private (Admin / SuperAdmin)
 */
router.post(
  '/policy-rules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!PolicyEngine?.createRule) {
      return notConfigured(res);
    }

    try {
      const userRole = req.user?.role;
      if (
        !userRole ||
        !['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(
          (userRole || '').toLowerCase()
        )
      ) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      const {
        action_type,
        scope,
        max_risk_level,
        conditions,
        auto_decision,
        auto_decision_reason,
        organization_id,
      } = req.body;
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId || req.user?.organization_id;

      // SUPERADMIN can specify organization_id, ADMIN can only create for own org
      const targetOrgId =
        (userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN') && organization_id
          ? organization_id
          : organizationId;

      if (!userId || !targetOrgId) {
        return res.status(400).json({ error: 'User ID and Organization ID required' });
      }

      if (!action_type || !scope || !max_risk_level || !auto_decision || !auto_decision_reason) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const rule = await PolicyEngine.createRule({
        organization_id: targetOrgId,
        action_type,
        scope,
        max_risk_level,
        conditions: conditions || {},
        auto_decision,
        auto_decision_reason,
        created_by_user_id: userId,
      });

      return res.status(201).json(rule);
    } catch (err: any) {
      logger.error('[PolicyCreateRoute] Error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

/**
 * @route GET /api/ai/actions/policy-engine/status
 * @desc Get global Policy Engine status
 * @access Private (SUPERADMIN only)
 */
router.get(
  '/policy-engine/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!PolicyEngine?.getGlobalStatus) {
      return notConfigured(res);
    }

    try {
      const userRole = req.user?.role;
      if (!userRole || (userRole !== 'SUPERADMIN' && userRole !== 'SUPER_ADMIN')) {
        return res.status(403).json({ error: 'Forbidden: SuperAdmin access required' });
      }

      const status = await PolicyEngine.getGlobalStatus();
      return res.json(status);
    } catch (err: any) {
      logger.error('[PolicyStatusRoute] Error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

/**
 * @route PATCH /api/ai/actions/policy-engine/global
 * @desc Toggle global Policy Engine status (emergency kill switch)
 * @access Private (SUPERADMIN only)
 */
router.patch(
  '/policy-engine/global',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!PolicyEngine?.setGlobalStatus) {
      return notConfigured(res);
    }

    try {
      const userRole = req.user?.role;
      if (!userRole || (userRole !== 'SUPERADMIN' && userRole !== 'SUPER_ADMIN')) {
        return res.status(403).json({ error: 'Forbidden: SuperAdmin access required' });
      }

      const { enabled } = req.body;
      const userId = req.user?.id;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled (boolean) is required' });
      }

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const result = await PolicyEngine.setGlobalStatus(enabled, userId);
      return res.json(result);
    } catch (err: any) {
      logger.error('[PolicyGlobalRoute] Error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

/**
 * @route POST /api/ai/actions/proposals/:id/evaluate-policy
 * @desc Evaluate a proposal against policy rules (pre-check, no side effects)
 * @access Private (Admin / SuperAdmin)
 */
router.post(
  '/proposals/:id/evaluate-policy',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (
      !ActionProposalEngine?.getProposalById ||
      !ActionDecisionService?.evaluatePolicyForProposal
    ) {
      return notConfigured(res);
    }

    try {
      const userRole = req.user?.role;
      if (
        !userRole ||
        !['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(
          (userRole || '').toLowerCase()
        )
      ) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      const organizationId = req.user?.organizationId || req.user?.organization_id;
      const targetOrgId =
        (userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN') && req.query.organizationId
          ? (req.query.organizationId as string)
          : organizationId;

      if (!targetOrgId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const proposal = await ActionProposalEngine.getProposalById(targetOrgId, req.params.id);
      if (!proposal) {
        return res.status(404).json({ error: 'Proposal not found' });
      }

      const result = await ActionDecisionService.evaluatePolicyForProposal(proposal, targetOrgId);
      return res.json(result);
    } catch (err: any) {
      logger.error('[PolicyEvaluateRoute] Error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

// ==========================================
// STEP 11: ASYNC JOB ENDPOINTS
// ==========================================

/**
 * @route POST /api/ai/actions/decisions/:id/execute-async
 * @desc Enqueue async execution of an approved decision
 * @access Private (Admin / SuperAdmin)
 */
router.post(
  '/decisions/:id/execute-async',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!ActionDecisionService?.getAuditLog || !AsyncJobService?.enqueueActionExecution) {
      return notConfigured(res);
    }

    try {
      const { id } = req.params;
      const { priority = 'normal' } = req.body;
      const userRole = req.user?.role;
      const organizationId = req.user?.organizationId || req.user?.organization_id;
      const userId = req.user?.id;

      // RBAC check
      if (
        !userId ||
        !userRole ||
        !['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(
          (userRole || '').toLowerCase()
        )
      ) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      // Fetch decision to validate org isolation
      const orgId = (
        userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN'
          ? 'SUPERADMIN_BYPASS'
          : organizationId
      ) as string;
      const decisions = await ActionDecisionService.getAuditLog(orgId);
      const decision = decisions.find((d) => d.id === id);

      if (!decision) {
        return res.status(404).json({ error: `Decision not found: ${id}` });
      }

      // Validate org isolation for ADMIN
      if (
        userRole !== 'SUPERADMIN' &&
        userRole !== 'SUPER_ADMIN' &&
        decision.organization_id !== organizationId
      ) {
        return res.status(403).json({ error: 'Forbidden: Organization mismatch' });
      }

      // Validate decision state
      const validStates = ['APPROVED', 'MODIFIED'];
      if (!decision.decision || !validStates.includes(decision.decision)) {
        return res.status(400).json({
          error: `Decision ${id} is ${decision.decision}, but only APPROVED/MODIFIED are executable`,
        });
      }

      // Enqueue the job
      const correlationId = decision.correlation_id || `corr-${uuidv4()}`;
      const result = await AsyncJobService.enqueueActionExecution({
        decisionId: id,
        organizationId: (decision.organization_id || organizationId) as string,
        correlationId,
        priority,
        createdBy: userId,
      });

      return res.status(202).json(result);
    } catch (err: any) {
      logger.error('[AsyncExecuteRoute] Error:', err);
      const unavailable = respondIfUnavailable(res, err, 'Async execution unavailable');
      if (unavailable) return unavailable;
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

/**
 * @route GET /api/ai/actions/jobs/:jobId
 * @desc Get async job status
 * @access Private (Admin / SuperAdmin)
 */
router.get(
  '/jobs/:jobId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AsyncJobService?.getJob) {
      return notConfigured(res);
    }

    try {
      const { jobId } = req.params;
      const userRole = req.user?.role;
      const organizationId = req.user?.organizationId || req.user?.organization_id;

      if (
        !userRole ||
        !['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(
          (userRole || '').toLowerCase()
        )
      ) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      const orgId =
        userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN'
          ? 'SUPERADMIN_BYPASS'
          : organizationId;

      if (!orgId || (orgId !== 'SUPERADMIN_BYPASS' && !organizationId)) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const job = await AsyncJobService.getJob(jobId, orgId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      return res.json(job);
    } catch (err: any) {
      logger.error('[AsyncJobStatusRoute] Error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

/**
 * @route POST /api/ai/actions/jobs/:jobId/retry
 * @desc Retry a failed or dead-letter job
 * @access Private (Admin / SuperAdmin)
 */
router.post(
  '/jobs/:jobId/retry',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AsyncJobService?.retryJob) {
      return notConfigured(res);
    }

    try {
      const { jobId } = req.params;
      const userRole = req.user?.role;
      const organizationId = req.user?.organizationId || req.user?.organization_id;

      if (
        !userRole ||
        !['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(
          (userRole || '').toLowerCase()
        )
      ) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      const orgId =
        userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN'
          ? 'SUPERADMIN_BYPASS'
          : organizationId;

      if (!orgId || (orgId !== 'SUPERADMIN_BYPASS' && !organizationId)) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const result = await AsyncJobService.retryJob(jobId, orgId);
      return res.json(result);
    } catch (err: any) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'JOB_NOT_FOUND') {
        return res.status(404).json({ error: 'Job not found', code: 'JOB_NOT_FOUND' });
      }
      if (error.code === 'JOB_INVALID_STATE') {
        return res
          .status(400)
          .json({ error: 'Job is not in a retryable state', code: 'JOB_INVALID_STATE' });
      }
      const unavailable = respondIfUnavailable(res, err, 'Async retry unavailable');
      if (unavailable) return unavailable;
      logger.error('[AsyncJobRetryRoute] Error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

/**
 * @route POST /api/ai/actions/jobs/:jobId/cancel
 * @desc Cancel a queued job
 * @access Private (Admin / SuperAdmin)
 */
router.post(
  '/jobs/:jobId/cancel',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AsyncJobService?.cancelJob) {
      return notConfigured(res);
    }

    try {
      const { jobId } = req.params;
      const userRole = req.user?.role;
      const organizationId = req.user?.organizationId || req.user?.organization_id;

      if (
        !userRole ||
        !['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(
          (userRole || '').toLowerCase()
        )
      ) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      const orgId =
        userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN'
          ? 'SUPERADMIN_BYPASS'
          : organizationId;

      if (!orgId || (orgId !== 'SUPERADMIN_BYPASS' && !organizationId)) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const result = await AsyncJobService.cancelJob(jobId, orgId);
      return res.json(result);
    } catch (err: any) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'JOB_NOT_FOUND') {
        return res.status(404).json({ error: 'Job not found', code: 'JOB_NOT_FOUND' });
      }
      if (error.code === 'JOB_INVALID_STATE') {
        return res
          .status(400)
          .json({ error: 'Job is not in a cancellable state', code: 'JOB_INVALID_STATE' });
      }
      logger.error('[AsyncJobCancelRoute] Error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

/**
 * @route GET /api/ai/actions/jobs/dead-letter
 * @desc List dead-letter jobs for UI visibility
 * @access Private (Admin / SuperAdmin)
 */
router.get(
  '/jobs/dead-letter',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AsyncJobService?.listJobs) {
      return notConfigured(res);
    }

    try {
      const userRole = req.user?.role;
      if (
        !userRole ||
        !['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(
          (userRole || '').toLowerCase()
        )
      ) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      const organizationId = req.user?.organizationId || req.user?.organization_id;
      const orgId =
        userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN'
          ? 'SUPERADMIN_BYPASS'
          : organizationId;
      const { limit = 50, offset = 0 } = req.query;

      if (!orgId || (orgId !== 'SUPERADMIN_BYPASS' && !organizationId)) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const jobs = await AsyncJobService.listJobs(orgId, {
        deadLetterOnly: true,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      return res.json({ jobs, count: jobs.length });
    } catch (err: any) {
      logger.error('[DeadLetterListRoute] Error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

/**
 * @route GET /api/ai/actions/jobs/stats
 * @desc Get dead-letter and job statistics for dashboard
 * @access Private (Admin / SuperAdmin)
 */
router.get(
  '/jobs/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AsyncJobService?.getDeadLetterStats) {
      return notConfigured(res);
    }

    try {
      const userRole = req.user?.role;
      if (
        !userRole ||
        !['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(
          (userRole || '').toLowerCase()
        )
      ) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      const organizationId = req.user?.organizationId || req.user?.organization_id;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const stats = await AsyncJobService.getDeadLetterStats(organizationId);

      return res.json(stats);
    } catch (err: any) {
      logger.error('[JobStatsRoute] Error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

export default router;
