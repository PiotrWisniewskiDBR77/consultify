/**
 * Feedback Routes - Enterprise SaaS
 * API endpoints for system feedback, pulse, and feature requests
 *
 * Endpoints:
 * - POST /api/feedback - Submit bug/idea feedback
 * - GET /api/feedback - List all feedback (admin)
 * - PATCH /api/feedback/:id/status - Update status
 * - POST /api/feedback/:id/respond - Admin response
 * - GET /api/feedback/:id - Get single feedback
 * - GET /api/feedback/stats/summary - Statistics
 * - POST /api/feedback/pulse - Quick pulse feedback
 * - POST /api/feedback/feature - Feature request
 * - POST /api/feedback/ai-insights - Get AI insights
 * - GET /api/feedback/ai-analysis/:id - Get AI analysis
 * - GET /api/feedback/trending - Trending topics
 * - GET /api/feedback/pulse-summary - Pulse analytics
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import feedbackAIService from '../services/feedbackAIService.js';
import NotificationService from '../services/notificationService.js';
import WhatsAppService from '../services/WhatsAppService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';

// Apply rate limiting
const router = Router();

/**
 * POST /api/feedback
 * Submit new feedback
 */
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, userEmail, userName, type, message, rating, severity, metadata } = req.body;

    if (!message || !type) {
      return res.status(400).json({ error: 'Message and type are required' });
    }

    const id = uuidv4();
    const cols = await getTableColumns('system_feedback');

    // Schema compatibility:
    // - legacy schema: (id, user_id, organization_id, feedback_type, message, status, created_at)
    // - enhanced schema: adds user_name, rating, metadata, admin_response, etc.
    const insertCols: string[] = ['id', 'message'];
    const values: unknown[] = [id, message];

    if (cols.has('user_id')) {
      insertCols.push('user_id');
      values.push(userId || null);
    }

    // Resolve organizationId when possible
    let organizationId: string | null = null;
    try {
      if ((req as any).user?.organizationId) {
        organizationId = String((req as any).user.organizationId);
      } else if (userId) {
        const userRow = await dbGet<{ organization_id?: string }>(
          `SELECT organization_id FROM users WHERE id = ?`,
          [userId]
        );
        if (userRow?.organization_id) organizationId = String(userRow.organization_id);
      }
    } catch {
      // ignore
    }

    if (cols.has('organization_id')) {
      insertCols.push('organization_id');
      values.push(organizationId || 'system');
    }

    // Feedback type column name differs between schemas
    if (cols.has('type')) {
      insertCols.push('type');
      values.push(type);
    } else if (cols.has('feedback_type')) {
      insertCols.push('feedback_type');
      values.push(type);
    }

    if (cols.has('user_name')) {
      insertCols.push('user_name');
      values.push(userName || null);
    }

    if (cols.has('rating')) {
      insertCols.push('rating');
      values.push(typeof rating === 'number' ? rating : rating ? Number(rating) : null);
    }

    if (cols.has('metadata')) {
      const contextFields = [
        'routePath',
        'deviceType',
        'screenSize',
        'uiLanguage',
        'uiTheme',
        'workspaceContext',
      ];
      const contextMeta: Record<string, unknown> = {};
      for (const field of contextFields) {
        if (req.body[field] !== undefined) contextMeta[field] = req.body[field];
      }
      insertCols.push('metadata');
      values.push(
        JSON.stringify({
          ...(metadata || {}),
          ...contextMeta,
          ...(userEmail ? { userEmail } : {}),
          ...(userName ? { userName } : {}),
          ...(type ? { type } : {}),
          ...(severity ? { severity } : {}),
        })
      );
    }

    // T106: Write context to dedicated columns if available
    const contextCols: Record<string, string> = {
      route_path: req.body.routePath,
      device_type: req.body.deviceType,
      screen_size: req.body.screenSize,
      ui_language: req.body.uiLanguage,
      ui_theme: req.body.uiTheme,
      workspace_context_json: req.body.workspaceContext
        ? JSON.stringify(req.body.workspaceContext)
        : undefined,
    };
    for (const [col, val] of Object.entries(contextCols)) {
      if (val !== undefined && cols.has(col)) {
        insertCols.push(col);
        values.push(val);
      }
    }
    if (severity && cols.has('severity')) {
      insertCols.push('severity');
      values.push(severity);
    }

    if (cols.has('status')) {
      insertCols.push('status');
      values.push('NEW');
    }

    const placeholders = insertCols.map(() => '?').join(', ');
    const sql = `INSERT INTO system_feedback (${insertCols.join(', ')}) VALUES (${placeholders})`;
    const runResult = await dbRun(sql, values);

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to insert feedback');
    }

    // Even if `system_feedback` table doesn't store organization_id (legacy schema),
    // we still want to route notifications/integrations by the user's organization when possible.
    const orgIdForNotifications = String(organizationId || 'system');

    // Send Notifications (Async)
    try {
      await WhatsAppService.sendNewFeedbackAlert({ userId, userEmail, type, message });
    } catch (e: unknown) {
      logger.warn('WhatsApp notification failed:', e);
    }

    // Create Internal Notification (Triggers Slack via NotificationService)
    try {
      const isCritical = severity === 'CRITICAL';
      const notificationType = isCritical ? 'CLIENT_TICKET' : 'USER_FEEDBACK';
      const notificationSeverity = isCritical ? 'WARNING' : 'INFO';

      await NotificationService.send({
        userId: userId,
        organizationId: orgIdForNotifications,
        type: notificationType,
        severity: notificationSeverity as 'INFO' | 'WARNING' | 'CRITICAL',
        title: isCritical ? `Critical Feedback: ${type}` : `New Feedback: ${type}`,
        body: message.substring(0, 200) + (message.length > 200 ? '...' : ''),
        message: message.substring(0, 200) + (message.length > 200 ? '...' : ''),
        relatedObjectType: 'FEEDBACK',
        relatedObjectId: id,
        isActionable: true,
        actionUrl: '/admin?section=feedback',
        metadata: {
          ...(metadata || {}),
          userEmail,
          feedbackType: type,
        },
      });
    } catch (noteErr) {
      logger.error('Failed to create notification for feedback:', noteErr);
    }

    return res.json({ success: true, id });
  })
);

/**
 * GET /api/feedback
 * List all feedback (Admin only)
 */
router.get(
  '/',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const sql = `SELECT * FROM system_feedback ORDER BY created_at DESC`;

    const rows = await dbAll<{
      id: string;
      user_id: string | null;
      user_email: string | null;
      user_name: string | null;
      type: string;
      message: string;
      rating: number | null;
      status: string;
      metadata: string | null;
      admin_response: string | null;
      responded_at: string | null;
      created_at: string;
      updated_at: string | null;
    }>(sql, []);

    return res.json(rows);
  })
);

/**
 * PATCH /api/feedback/:id/status
 * Update feedback status
 */
router.patch(
  '/:id/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status, note } = req.body;
    const { id } = req.params;
    const changedBy = (req as any).user?.id || req.body.userId || null;

    const validStatuses = ['NEW', 'PENDING', 'IN_PROGRESS', 'REVIEWED', 'RESOLVED', 'ARCHIVED'];
    if (!validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const current = await dbGet<{ status: string }>(
      `SELECT status FROM system_feedback WHERE id = ?`,
      [id]
    );
    const fromStatus = current?.status || null;

    const sql = `UPDATE system_feedback SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    const runResult = await dbRun(sql, [status.toUpperCase(), id]);

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to update feedback status');
    }

    // T106: Record status change in history
    try {
      const { v4: histUuid } = await import('uuid');
      await dbRun(
        `INSERT INTO feedback_status_history (id, feedback_id, from_status, to_status, changed_by, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [histUuid(), id, fromStatus, status.toUpperCase(), changedBy, note || null]
      );
    } catch {
      /* History table may not exist yet */
    }

    return res.json({ success: true });
  })
);

/**
 * POST /api/feedback/:id/respond
 * Admin response to feedback
 */
router.post(
  '/:id/respond',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { response } = req.body;
    const { id } = req.params;

    if (!response || !response.trim()) {
      return res.status(400).json({ error: 'Response is required' });
    }

    const sql = `UPDATE system_feedback SET admin_response = ?, responded_at = CURRENT_TIMESTAMP, status = 'REVIEWED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

    const runResult = await dbRun(sql, [response.trim(), id]);

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to update feedback');
    }

    // Get the feedback to notify the user
    const feedback = await dbGet<{
      id: string;
      user_id: string | null;
      user_email: string | null;
      user_name: string | null;
      type: string;
      message: string;
      rating: number | null;
      status: string;
      metadata: string | null;
      admin_response: string | null;
      responded_at: string | null;
      created_at: string;
      updated_at: string | null;
    }>('SELECT * FROM system_feedback WHERE id = ?', [id]);

    if (feedback && feedback.user_id) {
      try {
        await NotificationService.send({
          userId: feedback.user_id,
          organizationId: 'system',
          type: 'FEEDBACK_RESPONSE',
          severity: 'INFO',
          title: 'Odpowiedź na Twój feedback',
          body: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
          message: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
          relatedObjectType: 'FEEDBACK',
          relatedObjectId: id,
          isActionable: false,
        });
      } catch (noteErr) {
        logger.error('Failed to create response notification:', noteErr);
      }
    }

    return res.json({ success: true });
  })
);

/**
 * GET /api/feedback/:id
 * Get single feedback item
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const row = await dbGet<{
      id: string;
      user_id: string | null;
      user_email: string | null;
      user_name: string | null;
      type: string;
      message: string;
      rating: number | null;
      status: string;
      metadata: string | null;
      admin_response: string | null;
      responded_at: string | null;
      created_at: string;
      updated_at: string | null;
    }>('SELECT * FROM system_feedback WHERE id = ?', [id]);

    if (!row) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    let statusHistory: unknown[] = [];
    try {
      statusHistory = await dbAll(
        `SELECT * FROM feedback_status_history WHERE feedback_id = ? ORDER BY created_at ASC`,
        [id]
      );
    } catch {
      /* Table may not exist */
    }

    return res.json({ ...row, statusHistory });
  })
);

/**
 * GET /api/feedback/stats/summary
 * Get feedback statistics
 */
router.get(
  '/stats/summary',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const queries = {
      total: 'SELECT COUNT(*) as count FROM system_feedback',
      new: "SELECT COUNT(*) as count FROM system_feedback WHERE status = 'NEW'",
      pending:
        "SELECT COUNT(*) as count FROM system_feedback WHERE status IN ('PENDING', 'IN_PROGRESS')",
      bugs: "SELECT COUNT(*) as count FROM system_feedback WHERE type = 'bug' AND status != 'RESOLVED'",
      avgRating: 'SELECT AVG(rating) as avg FROM system_feedback WHERE rating IS NOT NULL',
    };

    const results: Record<string, number> = {};
    const promises = Object.entries(queries).map(async ([key, sql]) => {
      const row = await dbGet<{ avg?: number; count?: number }>(sql, []);
      results[key] = key === 'avgRating' ? row?.avg || 0 : row?.count || 0;
    });

    await Promise.all(promises);
    return res.json(results);
  })
);

// =====================================================
// QUICK PULSE FEEDBACK
// =====================================================

/**
 * POST /api/feedback/pulse
 * Submit quick pulse feedback (rating 1-5)
 */
router.post(
  '/pulse',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, rating, context, comment, timestamp } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const id = uuidv4();
    const actualUserId = userId || req.user?.id;

    const runResult = await dbRun(
      `INSERT INTO feedback_pulse (id, user_id, rating, context, comment, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        actualUserId,
        rating,
        context || '/',
        comment || null,
        timestamp || new Date().toISOString(),
      ]
    );

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to insert pulse feedback');
    }

    // Log for analytics
    logger.info(`[Pulse] User ${actualUserId} rated ${rating}/5 on ${context}`);

    // If low rating, create notification for admins
    if (rating <= 2 && comment) {
      try {
        await NotificationService.send({
          userId: 'admin',
          organizationId: 'system',
          type: 'LOW_PULSE_ALERT',
          severity: 'WARNING',
          title: `Low Pulse Rating: ${rating}/5`,
          body: comment.substring(0, 200),
          message: comment.substring(0, 200),
          relatedObjectType: 'PULSE',
          relatedObjectId: id,
          isActionable: true,
        });
      } catch (e) {
        logger.warn('[Pulse] Failed to create notification:', e);
      }
    }

    return res.json({ success: true, id });
  })
);

/**
 * GET /api/feedback/pulse-summary
 * Get pulse feedback analytics
 */
router.get(
  '/pulse-summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { period = '30d' } = req.query;

    try {
      const summary = await feedbackAIService.getPulseSummary(period as '7d' | '30d' | '90d');
      return res.json({ success: true, summary });
    } catch (error) {
      logger.error('[Pulse] Summary error:', error);
      return res.status(500).json({ error: 'Failed to get pulse summary' });
    }
  })
);

// =====================================================
// FEATURE REQUESTS
// =====================================================

/**
 * POST /api/feedback/feature
 * Submit feature request with AI analysis
 */
router.post(
  '/feature',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      userId,
      userEmail,
      category,
      featureName,
      description,
      impact,
      context,
      requestAIAnalysis,
    } = req.body;

    if (!featureName || !description) {
      return res.status(400).json({ error: 'Feature name and description are required' });
    }

    const id = uuidv4();
    const actualUserId = userId || req.user?.id;
    const actualEmail = userEmail || req.user?.email;

    // Store feature request
    const runResult = await dbRun(
      `INSERT INTO feature_requests 
             (id, user_id, user_email, category, feature_name, description, impact, context, status, votes_count, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NEW', 1, CURRENT_TIMESTAMP)`,
      [
        id,
        actualUserId,
        actualEmail,
        category || 'other',
        featureName,
        description,
        impact || 'medium',
        context || '/',
      ]
    );

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to insert feature request');
    }

    let aiSuggestion = null;

    // Optionally run AI analysis
    if (requestAIAnalysis) {
      try {
        const analysis = await feedbackAIService.analyzeFeatureRequest(
          featureName,
          description,
          category
        );
        aiSuggestion = analysis;

        // If similar features exist, notify user
        if (analysis.existingSimilar.length > 0) {
          logger.info(
            `[Feature] Found ${analysis.existingSimilar.length} similar requests for: ${featureName}`
          );
        }
      } catch (e) {
        logger.warn('[Feature] AI analysis failed:', e);
      }
    }

    // Create notification for product team
    try {
      await NotificationService.send({
        userId: 'product',
        organizationId: 'system',
        type: 'FEATURE_REQUEST',
        severity: impact === 'high' ? 'WARNING' : 'INFO',
        title: `New Feature Request: ${featureName}`,
        body: description.substring(0, 200),
        message: description.substring(0, 200),
        relatedObjectType: 'FEATURE',
        relatedObjectId: id,
        isActionable: true,
        actionUrl: '/admin?section=features',
      });
    } catch (e) {
      logger.warn('[Feature] Failed to create notification:', e);
    }

    return res.json({
      success: true,
      id,
      aiSuggestion,
      message: aiSuggestion?.existingSimilar?.length
        ? 'Feature request submitted! We found similar requests.'
        : 'Feature request submitted!',
    });
  })
);

/**
 * GET /api/feedback/features
 * List feature requests (admin)
 */
router.get(
  '/features',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status, category, limit = 50 } = req.query;

    let sql = `SELECT * FROM feature_requests WHERE 1=1`;
    const params: unknown[] = [];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY votes_count DESC, created_at DESC LIMIT ?`;
    params.push(Number(limit));

    const features = await dbAll(sql, params);
    return res.json(features);
  })
);

/**
 * POST /api/feedback/features/:id/vote
 * Vote on a feature request
 */
router.post(
  '/features/:id/vote',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if already voted
    const existing = await dbGet(
      `SELECT id FROM feature_votes WHERE feature_id = ? AND user_id = ?`,
      [id, userId]
    );

    if (existing) {
      return res.status(400).json({ error: 'Already voted' });
    }

    // Add vote
    await dbRun(
      `INSERT INTO feature_votes (id, feature_id, user_id, created_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [uuidv4(), id, userId]
    );

    // Update vote count
    await dbRun(`UPDATE feature_requests SET votes_count = votes_count + 1 WHERE id = ?`, [id]);

    return res.json({ success: true });
  })
);

// =====================================================
// AI INSIGHTS & ANALYSIS
// =====================================================

/**
 * POST /api/feedback/ai-insights
 * Get AI-generated insights for the current context
 */
router.post(
  '/ai-insights',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { context, userId } = req.body;
    const actualUserId = userId || req.user?.id;

    try {
      const insights = await feedbackAIService.generateInsights(actualUserId, context || '/');
      return res.json({ success: true, insights });
    } catch (error) {
      logger.error('[AI Insights] Error:', error);
      return res.json({ success: true, insights: [] }); // Return empty on error
    }
  })
);

/**
 * GET /api/feedback/ai-analysis/:id
 * Get AI analysis for a specific feedback
 */
router.get(
  '/ai-analysis/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const analysis = await dbGet(`SELECT * FROM feedback_analysis WHERE feedback_id = ?`, [id]);

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    // Parse JSON fields
    const analysisObj = analysis as Record<string, unknown>;
    const result = {
      ...analysisObj,
      categories: JSON.parse((analysisObj.categories_json as string) || '[]'),
      keywords: JSON.parse((analysisObj.keywords_json as string) || '[]'),
      similarFeedbackIds: JSON.parse((analysisObj.similar_feedback_ids_json as string) || '[]'),
      suggestedActions: JSON.parse((analysisObj.suggested_actions_json as string) || '[]'),
    };

    return res.json(result);
  })
);

/**
 * POST /api/feedback/:id/analyze
 * Trigger AI analysis for a feedback (admin)
 */
router.post(
  '/:id/analyze',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    // Get the feedback
    const feedback = await dbGet<{ id: string; message: string; type: string }>(
      `SELECT id, message, type FROM system_feedback WHERE id = ?`,
      [id]
    );

    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    try {
      const analysis = await feedbackAIService.analyzeFeedback(
        feedback.id,
        feedback.message,
        feedback.type
      );
      return res.json({ success: true, analysis });
    } catch (error) {
      logger.error('[AI Analysis] Error:', error);
      return res.status(500).json({ error: 'Failed to analyze feedback' });
    }
  })
);

/**
 * GET /api/feedback/trending
 * Get trending topics from feedback
 */
router.get(
  '/trending',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const trending = await feedbackAIService.getTrendingTopics();
      return res.json({ success: true, trending });
    } catch (error) {
      logger.error('[Trending] Error:', error);
      return res.json({ success: true, trending: [] });
    }
  })
);

/**
 * POST /api/feedback/seed-demo
 * Seed demo data for testing (admin only)
 */
router.post(
  '/seed-demo',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Check if admin/superadmin
    const userRole = (req.user?.role || '').toLowerCase();
    if (!['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(userRole)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    logger.info('[Feedback] Seeding demo data...');

    const DEMO_USERS = [
      { id: 'demo-user-1', email: 'jan.kowalski@acme.pl', name: 'Jan Kowalski' },
      { id: 'demo-user-2', email: 'anna.nowak@techcorp.com', name: 'Anna Nowak' },
      { id: 'demo-user-3', email: 'piotr.wisniewski@enterprise.io', name: 'Piotr Wiśniewski' },
      { id: 'demo-user-4', email: 'maria.zielinska@startup.pl', name: 'Maria Zielińska' },
      { id: 'demo-user-5', email: 'tomasz.kaczmarek@consulting.com', name: 'Tomasz Kaczmarek' },
    ];

    const FEEDBACK_DATA = [
      {
        type: 'BUG',
        message: 'PDF export crashes on large reports (>50 pages). Browser becomes unresponsive.',
        severity: 'CRITICAL',
        status: 'IN_PROGRESS',
        context: '/reports/export',
      },
      {
        type: 'BUG',
        message: 'SSO login fails intermittently - about 20% of attempts show session expired.',
        severity: 'HIGH',
        status: 'NEW',
        context: '/login',
      },
      {
        type: 'BUG',
        message: 'Dashboard charts not loading on Safari 17. Works on Chrome.',
        severity: 'MEDIUM',
        status: 'PENDING',
        context: '/dashboard',
      },
      {
        type: 'BUG',
        message: 'Notification count shows wrong number of unread items.',
        severity: 'LOW',
        status: 'NEW',
        context: '/notifications',
      },
      {
        type: 'IDEA',
        message: 'Would love a mobile app! Need to check status when away from desk.',
        severity: 'NORMAL',
        status: 'REVIEWED',
        context: '/dashboard',
        rating: 5,
      },
      {
        type: 'IDEA',
        message: 'Microsoft Teams integration would be amazing for notifications.',
        severity: 'NORMAL',
        status: 'IN_PROGRESS',
        context: '/settings',
        rating: 5,
      },
      {
        type: 'IDEA',
        message: 'Keyboard shortcuts for power users - Ctrl+N, Ctrl+S, etc.',
        severity: 'NORMAL',
        status: 'NEW',
        context: '/',
        rating: 4,
      },
      {
        type: 'IDEA',
        message: 'Dark mode please! Working late and bright interface is harsh.',
        severity: 'NORMAL',
        status: 'IN_PROGRESS',
        context: '/settings',
        rating: 5,
      },
      {
        type: 'IDEA',
        message: 'Custom dashboard widgets with drag-and-drop would be great.',
        severity: 'NORMAL',
        status: 'PENDING',
        context: '/dashboard',
        rating: 4,
      },
      {
        type: 'IDEA',
        message: 'Bulk actions for initiatives - select multiple and change status.',
        severity: 'NORMAL',
        status: 'NEW',
        context: '/initiatives',
        rating: 4,
      },
    ];

    const PULSE_DATA = [
      { rating: 5, context: '/dashboard', comment: null },
      { rating: 4, context: '/assessment', comment: null },
      { rating: 5, context: '/ai-chat', comment: 'AI is really helpful!' },
      { rating: 2, context: '/reports/export', comment: 'PDF export is slow' },
      { rating: 3, context: '/roadmap', comment: 'Charts could be more responsive' },
      { rating: 5, context: '/economics', comment: 'Great ROI calculator!' },
      { rating: 1, context: '/login', comment: 'SSO keeps failing' },
      { rating: 4, context: '/initiatives', comment: null },
      { rating: 5, context: '/dashboard', comment: null },
      { rating: 4, context: '/assessment', comment: null },
    ];

    const FEATURE_DATA = [
      {
        category: 'missing',
        featureName: 'Mobile Application',
        description: 'Native mobile apps for iOS and Android',
        impact: 'high',
        status: 'PLANNED',
        votes: 47,
      },
      {
        category: 'integration',
        featureName: 'Microsoft Teams Integration',
        description: 'Notifications and embedded widgets in Teams',
        impact: 'high',
        status: 'IN_PROGRESS',
        votes: 38,
      },
      {
        category: 'improvement',
        featureName: 'Dark Mode',
        description: 'System-wide dark theme option',
        impact: 'medium',
        status: 'IN_PROGRESS',
        votes: 52,
      },
      {
        category: 'missing',
        featureName: 'Keyboard Shortcuts',
        description: 'Global shortcuts for common actions',
        impact: 'medium',
        status: 'PLANNED',
        votes: 29,
      },
      {
        category: 'improvement',
        featureName: 'Customizable Dashboard',
        description: 'Drag-and-drop dashboard builder',
        impact: 'high',
        status: 'REVIEWING',
        votes: 41,
      },
      {
        category: 'missing',
        featureName: 'PowerPoint Export',
        description: 'Export reports to .pptx format',
        impact: 'medium',
        status: 'NEW',
        votes: 31,
      },
    ];

    let feedbackCount = 0;
    let pulseCount = 0;
    let featureCount = 0;

    try {
      // Insert feedback
      for (let i = 0; i < FEEDBACK_DATA.length; i++) {
        const fb = FEEDBACK_DATA[i];
        const user = DEMO_USERS[i % DEMO_USERS.length];
        const id = uuidv4();

        await dbRun(
          `
                    INSERT INTO system_feedback 
                    (id, user_id, user_email, user_name, type, message, rating, severity, status, metadata, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'))
                `,
          [
            id,
            user.id,
            user.email,
            user.name,
            fb.type,
            fb.message,
            fb.rating || null,
            fb.severity,
            fb.status,
            JSON.stringify({ context: fb.context }),
            Math.floor(Math.random() * 30),
          ]
        );
        feedbackCount++;
      }

      // Insert pulse
      for (const pulse of PULSE_DATA) {
        const user = DEMO_USERS[Math.floor(Math.random() * DEMO_USERS.length)];

        await dbRun(
          `
                    INSERT INTO feedback_pulse (id, user_id, rating, context, comment, created_at)
                    VALUES (?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'))
                `,
          [
            uuidv4(),
            user.id,
            pulse.rating,
            pulse.context,
            pulse.comment,
            Math.floor(Math.random() * 7),
          ]
        );
        pulseCount++;
      }

      // Insert features
      for (let i = 0; i < FEATURE_DATA.length; i++) {
        const fr = FEATURE_DATA[i];
        const user = DEMO_USERS[i % DEMO_USERS.length];

        await dbRun(
          `
                    INSERT INTO feature_requests 
                    (id, user_id, user_email, category, feature_name, description, impact, status, votes_count, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'))
                `,
          [
            uuidv4(),
            user.id,
            user.email,
            fr.category,
            fr.featureName,
            fr.description,
            fr.impact,
            fr.status,
            fr.votes,
            Math.floor(Math.random() * 60),
          ]
        );
        featureCount++;
      }

      // Insert trending topics
      const topics = ['mobile', 'integration', 'performance', 'dark mode', 'export'];
      for (const topic of topics) {
        await dbRun(
          `
                    INSERT OR REPLACE INTO feedback_trending_topics 
                    (id, topic, topic_count, sentiment, trend, period, calculated_at)
                    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                `,
          [uuidv4(), topic, Math.floor(Math.random() * 15) + 3, 'positive', 'rising', '7d']
        );
      }

      logger.info(
        `[Feedback] Demo data seeded: ${feedbackCount} feedback, ${pulseCount} pulse, ${featureCount} features`
      );

      return res.json({
        success: true,
        message: 'Demo data seeded successfully',
        counts: {
          feedback: feedbackCount,
          pulse: pulseCount,
          features: featureCount,
          trending: topics.length,
        },
      });
    } catch (error: any) {
      logger.error('[Feedback] Seed error:', error);
      return res.status(500).json({ error: 'Failed to seed demo data', details: error.message });
    }
  })
);

export default router;
