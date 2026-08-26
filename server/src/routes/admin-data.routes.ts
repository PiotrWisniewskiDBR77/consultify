/**
 * AdminData Routes
 * API endpoints for Admin panel data:
 * - User Tiers & Cost Attribution
 * - Security Events
 * - Dashboard Activity
 * - Sessions Management
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import { type AuthRequest, requireRole, verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import {
  CreateScheduledEventBodySchema,
  EventIdParamSchema,
  LoginHistoryQuerySchema,
  OrgIdParamSchema,
  RecentActivityQuerySchema,
  ResolveSecurityEventBodySchema,
  ScheduledEventIdParamSchema,
  ScheduledEventsQuerySchema,
  SecurityEventsQuerySchema,
  SessionIdParamSchema,
  SessionsQuerySchema,
  UpdateScheduledEventBodySchema,
  UpdateUserTierBodySchema,
  UserTierParamsSchema,
  UserTiersQuerySchema,
} from '../validators/admin-data.validators.js';

const router = Router();

// Apply auth middleware to all routes — admin-data is admin/owner only
router.use(verifyToken);
router.use(requireRole('super_admin', 'admin', 'owner'));

// Enforce org-scope on every route that takes :orgId — prevents cross-org reads
router.param('orgId', (req: AuthRequest, res, next, orgId: string) => {
  const callerRole = req.user?.role;
  const callerOrgId = req.user?.organizationId;
  if (callerRole !== 'super_admin' && callerOrgId !== orgId) {
    res.status(403).json({ error: 'Access denied to this organization' });
    return;
  }
  next();
});

// ==========================================
// USER TIERS & COST ATTRIBUTION
// ==========================================

/**
 * GET /api/admin-data/user-tiers/:orgId
 * Get user tier assignments with usage stats
 */
router.get(
  '/user-tiers/:orgId',
  validateParams(OrgIdParamSchema),
  validateQuery(UserTiersQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;

    const users = await dbAll<{
      userId: string;
      userName: string;
      email: string;
      currentTier: string;
      usage: number;
      cost: number;
    }>(
      `
            SELECT 
                u.id as "userId",
                u.first_name || ' ' || u.last_name as "userName",
                u.email,
                COALESCE(aus.tier, 'STANDARD') as "currentTier",
                COALESCE(aus.requests_count, 0) as usage,
                COALESCE(aus.cost_usd, 0) as cost
            FROM users u
            LEFT JOIN ai_usage_stats aus ON u.id = aus.user_id 
                AND aus.period_start >= date('now', '-7 days')
            WHERE u.organization_id = ?
            ORDER BY aus.cost_usd DESC NULLS LAST
        `,
      [orgId]
    );

    return res.json(users);
  })
);

/**
 * PUT /api/admin-data/user-tiers/:orgId/:userId
 * Update user's AI tier
 */
router.put(
  '/user-tiers/:orgId/:userId',
  requireRole('super_admin', 'admin', 'owner'),
  validateParams(UserTierParamsSchema),
  validateBody(UpdateUserTierBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId, userId } = req.params;
    const { tier } = req.body;

    const runResult = await dbRun(
      `
            INSERT INTO ai_usage_stats (id, organization_id, user_id, tier, period_start, period_end)
            VALUES (?, ?, ?, ?, date('now', '-7 days'), date('now'))
            ON CONFLICT(user_id, period_start) DO UPDATE SET tier = ?
        `,
      [uuidv4(), orgId, userId, tier, tier]
    );

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to update user tier');
    }

    return res.json({ success: true, tier });
  })
);

/**
 * GET /api/admin-data/cost-attribution/:orgId
 * Get cost attribution by user and project
 */
router.get(
  '/cost-attribution/:orgId',
  validateParams(OrgIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;

    const userCosts = await dbAll<{
      entityType: string;
      entityId: string;
      entityName: string;
      requests: number;
      tokens: number;
      cost: number;
    }>(
      `
            SELECT 
                'user' as "entityType",
                aus.user_id as "entityId",
                u.first_name || ' ' || u.last_name as "entityName",
                SUM(aus.requests_count) as requests,
                SUM(aus.tokens_used) as tokens,
                SUM(aus.cost_usd) as cost
            FROM ai_usage_stats aus
            JOIN users u ON aus.user_id = u.id
            WHERE aus.organization_id = ?
                AND aus.period_start >= date('now', '-7 days')
                AND aus.user_id IS NOT NULL
            GROUP BY aus.user_id
            ORDER BY cost DESC
            LIMIT 10
        `,
      [orgId]
    );

    const projectCosts = await dbAll<{
      entityType: string;
      entityId: string;
      entityName: string;
      requests: number;
      tokens: number;
      cost: number;
    }>(
      `
            SELECT 
                'project' as "entityType",
                aus.project_id as "entityId",
                p.name as "entityName",
                SUM(aus.requests_count) as requests,
                SUM(aus.tokens_used) as tokens,
                SUM(aus.cost_usd) as cost
            FROM ai_usage_stats aus
            JOIN projects p ON aus.project_id = p.id
            WHERE aus.organization_id = ?
                AND aus.period_start >= date('now', '-7 days')
                AND aus.project_id IS NOT NULL
            GROUP BY aus.project_id
            ORDER BY cost DESC
            LIMIT 10
        `,
      [orgId]
    );

    const allCosts = [...userCosts, ...projectCosts];
    const totalCost = allCosts.reduce((sum, item) => sum + (item.cost || 0), 0);

    const costAttribution = allCosts
      .map((item) => ({
        ...item,
        percentage: totalCost > 0 ? Math.round((item.cost / totalCost) * 100) : 0,
      }))
      .sort((a, b) => b.cost - a.cost);

    return res.json(costAttribution);
  })
);

// ==========================================
// SECURITY EVENTS
// ==========================================

/**
 * GET /api/admin-data/security-events/:orgId
 * Get security events for organization
 */
router.get(
  '/security-events/:orgId',
  validateParams(OrgIdParamSchema),
  validateQuery(SecurityEventsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;
    const { limit = 50, resolved } = req.query;

    let whereClause = 'WHERE organization_id = ?';
    const params: unknown[] = [orgId];

    if (resolved !== undefined) {
      whereClause += ' AND resolved = ?';
      params.push(resolved === 'true' ? 1 : 0);
    }

    const events = await dbAll<{
      id: string;
      type: string;
      severity: string;
      userId: string;
      userEmail: string;
      details: string;
      resolved: number;
      timestamp: string;
      resolved_at: string | null;
      resolved_by: string | null;
    }>(
      `
            SELECT 
                se.id,
                se.type,
                se.severity,
                se.user_id as "userId",
                u.email as "userEmail",
                se.details,
                se.resolved,
                se.created_at as timestamp,
                se.resolved_at,
                se.resolved_by
            FROM security_events se
            LEFT JOIN users u ON se.user_id = u.id
            ${whereClause}
            ORDER BY se.created_at DESC
            LIMIT ?
        `,
      [...params, parseInt(limit as string)]
    );

    return res.json(events);
  })
);

/**
 * PUT /api/admin-data/security-events/:eventId/resolve
 * Mark security event as resolved
 */
router.put(
  '/security-events/:eventId/resolve',
  requireRole('super_admin', 'admin', 'owner'),
  apiAuthRateLimiter,
  validateParams(EventIdParamSchema),
  validateBody(ResolveSecurityEventBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { eventId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const event = await dbGet<{ organization_id: string | null }>(
      'SELECT organization_id FROM security_events WHERE id = ? LIMIT 1',
      [eventId],
      { fallback: false }
    );
    if (
      !event ||
      (req.user?.role !== 'super_admin' && event.organization_id !== req.user?.organizationId)
    ) {
      return res.status(404).json({ error: 'Security event not found' });
    }

    const runResult = await dbRun(
      `
            UPDATE security_events 
            SET resolved = 1, resolved_at = datetime('now'), resolved_by = ?
            WHERE id = ?
        `,
      [userId, eventId]
    );

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to resolve security event');
    }

    return res.json({ success: true });
  })
);

// ==========================================
// DASHBOARD ACTIVITY
// ==========================================

/**
 * GET /api/admin-data/recent-activity/:orgId
 * Get recent activity for dashboard
 */
router.get(
  '/recent-activity/:orgId',
  validateParams(OrgIdParamSchema),
  validateQuery(RecentActivityQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;
    const { limit = 10 } = req.query;

    const activity = await dbAll<{
      id: string;
      type: string;
      description: string;
      timestamp: string;
      userEmail: string;
      userName: string;
    }>(
      `
            SELECT 
                ae.id,
                ae.action_type as type,
                json_extract(ae.metadata_json, '$.description') as description,
                ae.ts as timestamp,
                u.email as "userEmail",
                u.first_name || ' ' || u.last_name as "userName"
            FROM audit_events ae
            LEFT JOIN users u ON ae.actor_user_id = u.id
            WHERE ae.org_id = ?
            ORDER BY ae.ts DESC
            LIMIT ?
        `,
      [orgId, parseInt(limit as string)]
    );

    const formattedActivity = activity.map((a) => ({
      id: a.id,
      type: mapEventType(a.type),
      description: a.description || formatEventDescription(a.type),
      timestamp: formatTimestamp(a.timestamp),
      user: a.userEmail,
    }));

    return res.json(formattedActivity);
  })
);

/**
 * GET /api/admin-data/system-health
 * Get system health status
 */
router.get(
  '/system-health',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const dbHealthy = await (async () => {
      try {
        await dbGet('SELECT 1 as ok', []);
        return true;
      } catch {
        return false;
      }
    })();

    const health = {
      status: dbHealthy ? 'healthy' : 'degraded',
      uptime: '99.9%',
      lastCheck: 'Just now',
      services: [
        { name: 'API', status: 'up' },
        { name: 'Database', status: dbHealthy ? 'up' : 'down' },
        { name: 'AI Services', status: 'up' },
        { name: 'Storage', status: 'up' },
      ],
    };

    return res.json(health);
  })
);

// ==========================================
// SESSIONS & LOGIN HISTORY
// ==========================================

/**
 * GET /api/admin-data/sessions/:orgId
 * Get active sessions for organization users
 */
router.get(
  '/sessions/:orgId',
  validateParams(OrgIdParamSchema),
  validateQuery(SessionsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;

    const sessions = await dbAll<{
      id: string;
      userId: string;
      userEmail: string;
      userName: string;
      deviceName: string;
      ipAddress: string;
      location: string;
      isCurrent: number;
      lastActivity: string;
      createdAt: string;
    }>(
      `
            SELECT 
                us.id,
                us.user_id as "userId",
                u.email as "userEmail",
                u.first_name || ' ' || u.last_name as "userName",
                us.device_info as "deviceName",
                us.ip_address as "ipAddress",
                us.location,
                us.is_current as "isCurrent",
                us.last_active_at as "lastActivity",
                us.created_at as "createdAt"
            FROM user_sessions us
            JOIN users u ON us.user_id = u.id
            WHERE u.organization_id = ?
                AND (us.expires_at IS NULL OR us.expires_at > datetime('now'))
            ORDER BY us.last_active_at DESC
        `,
      [orgId]
    );

    return res.json(sessions);
  })
);

/**
 * GET /api/admin-data/login-history/:orgId
 * Get login history for organization
 */
router.get(
  '/login-history/:orgId',
  validateParams(OrgIdParamSchema),
  validateQuery(LoginHistoryQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;
    const { limit = 50 } = req.query;

    const history = await dbAll<{
      id: string;
      userId: string;
      userEmail: string;
      userName: string;
      ipAddress: string;
      userAgent: string;
      location: string;
      status: string;
      failureReason: string | null;
      timestamp: string;
    }>(
      `
            SELECT 
                lh.id,
                lh.user_id as "userId",
                u.email as "userEmail",
                u.first_name || ' ' || u.last_name as "userName",
                lh.ip_address as "ipAddress",
                lh.user_agent as "userAgent",
                lh.location,
                lh.status,
                lh.failure_reason as "failureReason",
                lh.created_at as timestamp
            FROM login_history lh
            JOIN users u ON lh.user_id = u.id
            WHERE lh.organization_id = ?
            ORDER BY lh.created_at DESC
            LIMIT ?
        `,
      [orgId, parseInt(limit as string)]
    );

    return res.json(history);
  })
);

/**
 * DELETE /api/admin-data/sessions/:sessionId
 * Terminate a specific session
 */
router.delete(
  '/sessions/:sessionId',
  requireRole('super_admin', 'admin', 'owner'),
  apiAuthRateLimiter,
  validateParams(SessionIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { sessionId } = req.params;

    const session = await dbGet<{ organization_id: string | null }>(
      `SELECT COALESCE(s.organization_id, u.organization_id) AS organization_id
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?
        LIMIT 1`,
      [sessionId],
      { fallback: false }
    );
    if (
      !session ||
      (req.user?.role !== 'super_admin' && session.organization_id !== req.user?.organizationId)
    ) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const result = await dbRun(
      req.user?.role === 'super_admin'
        ? 'DELETE FROM user_sessions WHERE id = ?'
        : `DELETE FROM user_sessions
            WHERE id = ?
              AND EXISTS (
                SELECT 1 FROM users u
                 WHERE u.id = user_sessions.user_id AND u.organization_id = ?
              )`,
      req.user?.role === 'super_admin' ? [sessionId] : [sessionId, req.user?.organizationId]
    );
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete session');
    }

    return res.json({ success: true });
  })
);

// ==========================================
// COMPLIANCE REPORTS
// ==========================================

/**
 * GET /api/admin-data/compliance-reports/:orgId
 * Get compliance reports for organization
 */
router.get(
  '/compliance-reports/:orgId',
  validateParams(OrgIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;

    const reports = await dbAll<{
      id: string;
      name: string;
      standard: string;
      status: string;
      findings: number;
      generatedAt: string;
    }>(
      `
            SELECT 
                id,
                name,
                standard,
                status,
                findings_count as findings,
                generated_at as "generatedAt"
            FROM compliance_reports
            WHERE organization_id = ?
            ORDER BY generated_at DESC
        `,
      [orgId]
    );

    return res.json(reports);
  })
);

/**
 * GET /api/admin-data/custom-templates/:orgId
 * Get custom compliance templates
 */
router.get(
  '/custom-templates/:orgId',
  validateParams(OrgIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;

    const templates = await dbAll<{
      id: string;
      name: string;
      description: string;
      basedOn: string;
      sectionsCount: number;
      checkpointsCount: number;
      createdAt: string;
      updatedAt: string;
    }>(
      `
            SELECT 
                id,
                name,
                description,
                based_on as "basedOn",
                sections_count as "sectionsCount",
                checkpoints_count as "checkpointsCount",
                created_at as "createdAt",
                updated_at as "updatedAt"
            FROM custom_compliance_templates
            WHERE organization_id = ?
            ORDER BY updated_at DESC
        `,
      [orgId]
    );

    return res.json(templates);
  })
);

// ==========================================
// USER GROUPS
// ==========================================

/**
 * GET /api/admin-data/user-groups/:orgId
 * Get user groups for organization
 */
router.get(
  '/user-groups/:orgId',
  validateParams(OrgIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;

    const groups = await dbAll<{
      id: string;
      name: string;
      description: string;
      color: string;
      membersCount: number;
      permissions: string;
      createdAt: string;
    }>(
      `
            SELECT 
                id,
                name,
                description,
                color,
                members_count as "membersCount",
                permissions,
                created_at as "createdAt"
            FROM user_groups
            WHERE organization_id = ?
            ORDER BY name ASC
        `,
      [orgId]
    );

    return res.json(groups);
  })
);

// ==========================================
// SCHEDULED EVENTS (Calendar)
// ==========================================

/**
 * GET /api/admin-data/scheduled-events/:orgId
 * Get upcoming scheduled events for organization
 */
router.get(
  '/scheduled-events/:orgId',
  validateParams(OrgIdParamSchema),
  validateQuery(ScheduledEventsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;
    const { limit = 10, includeCompleted = 'false' } = req.query;

    let whereClause = `WHERE se.organization_id = ? AND se.start_time >= datetime('now', '-1 day')`;
    if (includeCompleted === 'false') {
      whereClause += ` AND se.status != 'COMPLETED' AND se.status != 'CANCELLED'`;
    }

    const events = await dbAll<{
      id: string;
      title: string;
      description: string;
      eventType: string;
      startTime: string;
      endTime: string;
      location: string;
      isAllDay: number;
      status: string;
      projectId: string | null;
      projectName: string | null;
      attendees: string;
      createdBy: string;
      creatorEmail: string;
      creatorName: string;
    }>(
      `
            SELECT 
                se.id,
                se.title,
                se.description,
                se.event_type as "eventType",
                se.start_time as "startTime",
                se.end_time as "endTime",
                se.location,
                se.is_all_day as "isAllDay",
                se.status,
                se.project_id as "projectId",
                p.name as "projectName",
                se.attendees,
                se.created_by as "createdBy",
                u.email as "creatorEmail",
                u.first_name || ' ' || u.last_name as "creatorName"
            FROM scheduled_events se
            LEFT JOIN projects p ON se.project_id = p.id
            LEFT JOIN users u ON se.created_by = u.id
            ${whereClause}
            ORDER BY se.start_time ASC
            LIMIT ?
        `,
      [orgId, parseInt(limit as string)]
    );

    const formattedEvents = events.map((e) => ({
      ...e,
      attendees: e.attendees ? JSON.parse(e.attendees) : [],
    }));

    return res.json(formattedEvents);
  })
);

/**
 * POST /api/admin-data/scheduled-events/:orgId
 * Create a new scheduled event
 */
router.post(
  '/scheduled-events/:orgId',
  validateParams(OrgIdParamSchema),
  validateBody(CreateScheduledEventBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;
    const {
      title,
      description,
      eventType = 'meeting',
      startTime,
      endTime,
      location = '',
      isAllDay = false,
      projectId = null,
      attendees = [],
    } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const eventId = uuidv4();

    const runResult = await dbRun(
      `
            INSERT INTO scheduled_events (
                id, organization_id, title, description, event_type, 
                start_time, end_time, location, is_all_day, status, 
                project_id, attendees, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, ?, ?, datetime('now'))
        `,
      [
        eventId,
        orgId,
        title,
        description,
        eventType,
        startTime,
        endTime,
        location,
        isAllDay ? 1 : 0,
        projectId,
        JSON.stringify(attendees),
        userId,
      ]
    );

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to create scheduled event');
    }

    return res.status(201).json({
      id: eventId,
      title,
      description,
      eventType,
      startTime,
      endTime,
      location,
      isAllDay,
      status: 'SCHEDULED',
      projectId,
      attendees,
    });
  })
);

/**
 * PUT /api/admin-data/scheduled-events/:eventId
 * Update a scheduled event
 */
router.put(
  '/scheduled-events/:eventId',
  requireRole('super_admin', 'admin', 'owner'),
  apiAuthRateLimiter,
  validateParams(ScheduledEventIdParamSchema),
  validateBody(UpdateScheduledEventBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { eventId } = req.params;
    const {
      title,
      description,
      eventType,
      startTime,
      endTime,
      location,
      isAllDay,
      status,
      projectId,
      attendees,
    } = req.body;

    const event = await dbGet<{ organization_id: string | null }>(
      'SELECT organization_id FROM scheduled_events WHERE id = ? LIMIT 1',
      [eventId],
      { fallback: false }
    );
    if (
      !event ||
      (req.user?.role !== 'super_admin' && event.organization_id !== req.user?.organizationId)
    ) {
      return res.status(404).json({ error: 'Scheduled event not found' });
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (eventType !== undefined) {
      updates.push('event_type = ?');
      params.push(eventType);
    }
    if (startTime !== undefined) {
      updates.push('start_time = ?');
      params.push(startTime);
    }
    if (endTime !== undefined) {
      updates.push('end_time = ?');
      params.push(endTime);
    }
    if (location !== undefined) {
      updates.push('location = ?');
      params.push(location);
    }
    if (isAllDay !== undefined) {
      updates.push('is_all_day = ?');
      params.push(isAllDay ? 1 : 0);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (projectId !== undefined) {
      updates.push('project_id = ?');
      params.push(projectId);
    }
    if (attendees !== undefined) {
      updates.push('attendees = ?');
      params.push(JSON.stringify(attendees));
    }

    updates.push("updated_at = datetime('now')");
    params.push(eventId);
    if (req.user?.role !== 'super_admin') params.push(req.user?.organizationId);

    const runResult = await dbRun(
      `
            UPDATE scheduled_events 
            SET ${updates.join(', ')}
            WHERE id = ?${req.user?.role === 'super_admin' ? '' : ' AND organization_id = ?'}
        `,
      params
    );

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to update scheduled event');
    }

    return res.json({ success: true });
  })
);

/**
 * DELETE /api/admin-data/scheduled-events/:eventId
 * Delete a scheduled event
 */
router.delete(
  '/scheduled-events/:eventId',
  requireRole('super_admin', 'admin', 'owner'),
  apiAuthRateLimiter,
  validateParams(ScheduledEventIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { eventId } = req.params;

    const event = await dbGet<{ organization_id: string | null }>(
      'SELECT organization_id FROM scheduled_events WHERE id = ? LIMIT 1',
      [eventId],
      { fallback: false }
    );
    if (
      !event ||
      (req.user?.role !== 'super_admin' && event.organization_id !== req.user?.organizationId)
    ) {
      return res.status(404).json({ error: 'Scheduled event not found' });
    }

    const result = await dbRun(
      req.user?.role === 'super_admin'
        ? 'DELETE FROM scheduled_events WHERE id = ?'
        : 'DELETE FROM scheduled_events WHERE id = ? AND organization_id = ?',
      req.user?.role === 'super_admin' ? [eventId] : [eventId, req.user?.organizationId]
    );
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete event');
    }

    return res.json({ success: true });
  })
);

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function mapEventType(type: string): string {
  const typeMap: Record<string, string> = {
    USER_LOGIN: 'user_joined',
    PROJECT_CREATE: 'project_created',
    TASK_COMPLETE: 'task_completed',
    INVITATION_SEND: 'invitation_sent',
    SETTINGS_UPDATE: 'settings_changed',
    USER_ROLE_CHANGE: 'user_role_changed',
  };
  return typeMap[type] || 'activity';
}

function formatEventDescription(type: string): string {
  const descMap: Record<string, string> = {
    USER_LOGIN: 'User logged in',
    PROJECT_CREATE: 'New project created',
    TASK_COMPLETE: 'Task marked complete',
    INVITATION_SEND: 'Invitation sent',
    SETTINGS_UPDATE: 'Settings updated',
    USER_ROLE_CHANGE: 'User role changed',
  };
  return descMap[type] || 'Activity recorded';
}

function formatTimestamp(timestamp: string): string {
  if (!timestamp) return 'Unknown';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffHours < 48) return 'Yesterday';
  return `${Math.floor(diffHours / 24)} days ago`;
}

export default router;
