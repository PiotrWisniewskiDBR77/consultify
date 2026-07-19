// @ts-nocheck
/**
 * AI Watchdog - Autonomous Project Monitoring System
 *
 * Runs as a background job to:
 * - Monitor all active projects continuously
 * - Detect early warning signals proactively
 * - Generate smart alerts with AI recommendations
 * - Create daily briefings for managers
 * - Auto-escalate critical issues
 *
 * Designed to run every 15-30 minutes in production.
 *
 * STATUS (2026-07-19): DISABLED — dead end-to-end, honest no-op below.
 * - Not mounted anywhere: no cron/scheduler references this file (grepped
 *   server/src/cron/index.ts, Scheduler.ts and all of server/src — zero
 *   live callers besides this file itself).
 * - Its predictive-signal dependency (`predictiveService.js`) does not exist
 *   anywhere in this codebase — there is no module to point the import at.
 * - Its AI-briefing dependency (`getCoordinator()` from
 *   services/ai/agents/index.ts) always throws AgentCoordinatorUnavailableError
 *   by design: "the specialist agent classes and coordinator were gutted
 *   during the ESM migration" (see that file's docstring).
 * The original code destructured these two dependencies out of an
 * un-awaited `import(...)` call (`const { getCoordinator } = import(...)`),
 * which resolves to a Promise, not the module — silently producing
 * `undefined` bindings instead of throwing. `run()` is now a guarded no-op
 * so nothing crashes if this job is ever wired into a scheduler again. Do
 * not re-enable without (a) building a real predictiveService.js and
 * (b) restoring a working AgentCoordinator.
 */

import { getDatabase } from '../database/index.js';
import logger from '../utils/Logger.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';

// Alert severity levels
const ALERT_SEVERITY = {
  CRITICAL: 'critical', // Immediate action required
  HIGH: 'high', // Action within 24 hours
  MEDIUM: 'medium', // Action within 1 week
  LOW: 'low', // Informational
  INFO: 'info', // Daily briefing only
};

// Alert types
const ALERT_TYPES = {
  EARLY_WARNING: 'early_warning',
  PROJECT_AT_RISK: 'project_at_risk',
  MILESTONE_OVERDUE: 'milestone_overdue',
  RESOURCE_ISSUE: 'resource_issue',
  STAKEHOLDER_CONCERN: 'stakeholder_concern',
  BUDGET_ALERT: 'budget_alert',
  DAILY_BRIEFING: 'daily_briefing',
  WEEKLY_SUMMARY: 'weekly_summary',
};

// Watchdog configuration
const CONFIG = {
  runIntervalMinutes: 30,
  criticalAlertThreshold: 0.8,
  highAlertThreshold: 0.6,
  maxAlertsPerProject: 5,
  briefingHour: 8, // 8 AM local time
  enableAutoEscalation: true,
  escalationDelayHours: 4,
};

const AIWatchdog = {
  ALERT_SEVERITY,
  ALERT_TYPES,
  CONFIG,

  // State tracking
  lastRun: null,
  isRunning: false,
  stats: {
    runsCompleted: 0,
    alertsGenerated: 0,
    briefingsCreated: 0,
    escalationsTriggered: 0,
  },

  /**
   * Main watchdog execution - called by scheduler
   */
  run: async () => {
    // Disabled: see file header. predictiveService.js does not exist and the
    // AI coordinator is intentionally unavailable in this build, so a real
    // run() would have zero analytical value. Fail safe instead of crashing.
    // (Original body preserved below the return, commented out, so a future
    // reactivation has the intended pipeline shape to work from.)
    logger.warn(
      '[AIWatchdog] disabled: predictive analysis service and AI coordinator are unavailable — skipping run (see server/src/jobs/aiWatchdog.ts header)'
    );
    return {
      skipped: true,
      reason: 'watchdog disabled: predictiveService.js missing, AgentCoordinator unavailable',
    };

    /* istanbul ignore next -- intentionally unreachable, kept for reference only
    if (AIWatchdog.isRunning) {
      logger.info('[AIWatchdog] Already running, skipping...');
      return { skipped: true };
    }

    AIWatchdog.isRunning = true;
    const startTime = Date.now();
    const runId = uuidv4();

    logger.info(`[AIWatchdog] Starting run ${runId}`);

    try {
      // 1. Get all active projects
      const activeProjects = await AIWatchdog.getActiveProjects();
      logger.info(`[AIWatchdog] Monitoring ${activeProjects.length} active projects`);

      const results = {
        runId,
        projectsAnalyzed: activeProjects.length,
        alertsGenerated: 0,
        briefingsCreated: 0,
        errors: [],
      };

      // 2. Analyze each project
      for (const project of activeProjects) {
        try {
          const projectResults = await AIWatchdog.analyzeProject(project);
          results.alertsGenerated += projectResults.alertsCreated;
        } catch (error) {
          logger.error(`[AIWatchdog] Error analyzing project ${project.id}:`, error);
          results.errors.push({ projectId: project.id, error: error.message });
        }
      }

      // 3. Generate daily briefings (if it's briefing time)
      const briefingResults = await AIWatchdog.generateDailyBriefings();
      results.briefingsCreated = briefingResults.count;

      // 4. Check for unacknowledged critical alerts (auto-escalation)
      if (CONFIG.enableAutoEscalation) {
        const escalated = await AIWatchdog.checkAndEscalate();
        results.escalationsTriggered = escalated;
      }

      // 5. Update stats
      AIWatchdog.stats.runsCompleted++;
      AIWatchdog.stats.alertsGenerated += results.alertsGenerated;
      AIWatchdog.stats.briefingsCreated += results.briefingsCreated;
      AIWatchdog.lastRun = new Date();

      // 6. Log run
      await AIWatchdog.logRun(runId, results, Date.now() - startTime);

      logger.info(`[AIWatchdog] Run ${runId} completed in ${Date.now() - startTime}ms`);
      return results;
    } catch (error) {
      logger.error('[AIWatchdog] Critical error:', error);
      throw error;
    } finally {
      AIWatchdog.isRunning = false;
    }
    */
  },

  /**
   * Get all active projects for monitoring
   */
  getActiveProjects: async () => {
    return new Promise((resolve) => {
      db.all(
        `
                SELECT p.*, o.name as organization_name
                FROM projects p
                LEFT JOIN organizations o ON p.organization_id = o.id
                WHERE p.status IN ('active', 'in_progress', 'planning')
                AND p.created_at > NOW() - INTERVAL '1 year'
                ORDER BY p.updated_at DESC
            `,
        [],
        (err, rows) => {
          if (err) {
            logger.error('[AIWatchdog] Error fetching projects:', err);
            return resolve([]);
          }
          resolve(rows || []);
        }
      );
    });
  },

  /**
   * Analyze a single project
   */
  analyzeProject: async (project) => {
    const results = { alertsCreated: 0 };

    // 1. Run predictive analysis
    // predictiveService.js does not exist anywhere in this codebase (see file
    // header) — there is no real module to call here. Fail safe instead of
    // throwing a ReferenceError on the removed PredictiveService import.
    logger.warn(
      `[AIWatchdog] analyzeProject(${project?.id}) called but predictiveService.js is unavailable — returning empty analysis`
    );
    const analysis = { error: 'predictive_service_unavailable', signals: [] };

    if (analysis.error) {
      return results;
    }

    // 2. Generate alerts for significant signals
    for (const signal of analysis.signals) {
      if (signal.probability >= CONFIG.highAlertThreshold) {
        const alert = await AIWatchdog.createAlert({
          projectId: project.id,
          organizationId: project.organization_id,
          type: ALERT_TYPES.EARLY_WARNING,
          severity:
            signal.severity === 'critical'
              ? ALERT_SEVERITY.CRITICAL
              : signal.severity === 'high'
                ? ALERT_SEVERITY.HIGH
                : ALERT_SEVERITY.MEDIUM,
          title: signal.title,
          description: signal.description,
          signalType: signal.type,
          probability: signal.probability,
          recommendations: signal.recommendations,
          indicators: signal.indicators,
        });

        if (alert) results.alertsCreated++;
      }
    }

    // 3. Check for project-level risks
    if (analysis.overallRisk?.level === 'critical') {
      const alert = await AIWatchdog.createAlert({
        projectId: project.id,
        organizationId: project.organization_id,
        type: ALERT_TYPES.PROJECT_AT_RISK,
        severity: ALERT_SEVERITY.CRITICAL,
        title: `Project "${project.name}" at Critical Risk`,
        description: `${analysis.signals.length} active risk signals detected`,
        probability: analysis.overallRisk.score,
        recommendations: analysis.recommendations?.map((r) => r.action) || [],
      });

      if (alert) results.alertsCreated++;
    }

    // 4. Check for milestone issues
    const milestoneAlerts = await AIWatchdog.checkMilestones(project.id);
    results.alertsCreated += milestoneAlerts;

    return results;
  },

  /**
   * Check for overdue milestones
   */
  checkMilestones: async (projectId) => {
    return new Promise((resolve) => {
      const now = new Date().toISOString();

      db.all(
        `
                SELECT * FROM milestones
                WHERE project_id = ?
                AND target_date < ?
                AND status NOT IN ('completed', 'cancelled')
            `,
        [projectId, now],
        async (err, milestones) => {
          if (err || !milestones || milestones.length === 0) {
            return resolve(0);
          }

          let alertsCreated = 0;

          for (const milestone of milestones) {
            const daysOverdue = Math.floor(
              (new Date() - new Date(milestone.target_date)) / (24 * 60 * 60 * 1000)
            );

            // Check if we already have an alert for this milestone
            const exists = await AIWatchdog.alertExists(
              ALERT_TYPES.MILESTONE_OVERDUE,
              milestone.id
            );

            if (!exists) {
              const alert = await AIWatchdog.createAlert({
                projectId,
                type: ALERT_TYPES.MILESTONE_OVERDUE,
                severity:
                  daysOverdue > 14
                    ? ALERT_SEVERITY.HIGH
                    : daysOverdue > 7
                      ? ALERT_SEVERITY.MEDIUM
                      : ALERT_SEVERITY.LOW,
                title: `Milestone Overdue: ${milestone.name}`,
                description: `${daysOverdue} days overdue`,
                entityId: milestone.id,
                entityType: 'milestone',
              });

              if (alert) alertsCreated++;
            }
          }

          resolve(alertsCreated);
        }
      );
    });
  },

  /**
   * Create an alert
   */
  createAlert: async (alertData) => {
    // Check for duplicate alerts (same type, entity, within 24 hours)
    const isDuplicate = await AIWatchdog.isDuplicateAlert(alertData);
    if (isDuplicate) {
      return null;
    }

    const alertId = uuidv4();

    return new Promise((resolve) => {
      db.run(
        `
                INSERT INTO watchdog_alerts (
                    id, project_id, organization_id, type, severity,
                    title, description, signal_type, probability,
                    recommendations, indicators, entity_id, entity_type,
                    status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', CURRENT_TIMESTAMP)
            `,
        [
          alertId,
          alertData.projectId,
          alertData.organizationId,
          alertData.type,
          alertData.severity,
          alertData.title,
          alertData.description,
          alertData.signalType || null,
          alertData.probability || null,
          JSON.stringify(alertData.recommendations || []),
          JSON.stringify(alertData.indicators || []),
          alertData.entityId || null,
          alertData.entityType || null,
        ],
        function (err) {
          if (err) {
            logger.error('[AIWatchdog] Error creating alert:', err);
            return resolve(null);
          }

          // Send notification for critical/high alerts
          if ([ALERT_SEVERITY.CRITICAL, ALERT_SEVERITY.HIGH].includes(alertData.severity)) {
            AIWatchdog.sendAlertNotification(alertId, alertData);
          }

          resolve({ id: alertId, ...alertData });
        }
      );
    });
  },

  /**
   * Check if an alert already exists
   */
  alertExists: async (type, entityId) => {
    return new Promise((resolve) => {
      db.get(
        `
                SELECT id FROM watchdog_alerts
                WHERE type = ? AND entity_id = ?
                AND created_at > datetime('now', '-24 hours')
            `,
        [type, entityId],
        (err, row) => {
          resolve(!!row);
        }
      );
    });
  },

  /**
   * Check for duplicate alerts
   */
  isDuplicateAlert: async (alertData) => {
    return new Promise((resolve) => {
      db.get(
        `
                SELECT id FROM watchdog_alerts
                WHERE project_id = ?
                AND type = ?
                AND signal_type = ?
                AND created_at > datetime('now', '-24 hours')
            `,
        [alertData.projectId, alertData.type, alertData.signalType || null],
        (err, row) => {
          resolve(!!row);
        }
      );
    });
  },

  /**
   * Send alert notification
   */
  sendAlertNotification: async (alertId, alertData) => {
    // Get project managers and admins
    return new Promise((resolve) => {
      db.all(
        `
                SELECT DISTINCT u.id, u.email, u.first_name
                FROM project_members pm
                JOIN users u ON pm.user_id = u.id
                WHERE pm.project_id = ?
                AND pm.role IN ('owner', 'admin', 'manager')
            `,
        [alertData.projectId],
        (err, users) => {
          if (err || !users || users.length === 0) {
            return resolve();
          }

          // Create notifications
          for (const user of users) {
            db.run(
              `
                        INSERT INTO notifications (
                            id, user_id, organization_id, type, title, message,
                            entity_type, entity_id, action_url, read, created_at
                        ) VALUES (?, ?, ?, 'ai_alert', ?, ?, 'alert', ?, ?, 0, CURRENT_TIMESTAMP)
                    `,
              [
                uuidv4(),
                user.id,
                alertData.organizationId,
                alertData.title,
                alertData.description,
                alertId,
                `/projects/${alertData.projectId}/alerts`,
              ]
            );
          }

          resolve();
        }
      );
    });
  },

  /**
   * Generate daily briefings for managers
   */
  generateDailyBriefings: async () => {
    const now = new Date();
    const currentHour = now.getHours();

    // Only generate briefings at the configured hour
    if (currentHour !== CONFIG.briefingHour) {
      return { count: 0, skipped: true };
    }

    // Check if we already generated today
    const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    const alreadyGenerated = await new Promise((resolve) => {
      db.get(
        `
                SELECT id FROM watchdog_alerts
                WHERE type = ? AND created_at > ?
            `,
        [ALERT_TYPES.DAILY_BRIEFING, todayStart],
        (err, row) => {
          resolve(!!row);
        }
      );
    });

    if (alreadyGenerated) {
      return { count: 0, alreadyGenerated: true };
    }

    // Get organizations with active projects
    const orgs = await new Promise((resolve) => {
      db.all(
        `
                SELECT DISTINCT o.id, o.name
                FROM organizations o
                JOIN projects p ON p.organization_id = o.id
                WHERE p.status IN ('active', 'in_progress')
            `,
        [],
        (err, rows) => {
          resolve(rows || []);
        }
      );
    });

    let briefingsCreated = 0;

    for (const org of orgs) {
      const briefing = await AIWatchdog.generateOrgBriefing(org.id);
      if (briefing) briefingsCreated++;
    }

    return { count: briefingsCreated };
  },

  /**
   * Generate daily briefing for an organization
   */
  generateOrgBriefing: async (organizationId) => {
    // Get org summary data
    const summary = await AIWatchdog.getOrgSummary(organizationId);

    if (!summary.activeProjects) {
      return null;
    }

    // Use AI to generate briefing content
    let briefingContent;
    try {
      // getCoordinator() is intentionally unavailable in this build (throws
      // AgentCoordinatorUnavailableError — see services/ai/agents/index.ts).
      // Import it for real (properly awaited, correct relative path) so the
      // throw is caught below and we degrade to the static summary instead
      // of silently no-op'ing on an undefined destructured import.
      const { getCoordinator } = await import('../services/ai/agents/index.js');
      const coordinator = getCoordinator();
      const result = await coordinator.processQuery(
        `Generate a concise daily briefing for ${summary.orgName}. 
                Active projects: ${summary.activeProjects}
                At-risk projects: ${summary.atRiskProjects}
                Key alerts: ${
                  summary.recentAlerts
                    ?.slice(0, 3)
                    .map((a) => a.title)
                    .join(', ') || 'None'
                }
                Overall health: ${summary.overallHealth}`,
        { organization: { id: organizationId, name: summary.orgName } }
      );

      briefingContent = result.response?.synthesis || result.response?.mainInsight;
    } catch (error) {
      briefingContent = `Daily update: ${summary.activeProjects} active projects, ${summary.atRiskProjects} at risk.`;
    }

    // Create briefing alert
    const alert = await AIWatchdog.createAlert({
      organizationId,
      type: ALERT_TYPES.DAILY_BRIEFING,
      severity: ALERT_SEVERITY.INFO,
      title: `Daily Briefing - ${new Date().toLocaleDateString()}`,
      description: briefingContent,
      recommendations: summary.priorities,
    });

    return alert;
  },

  /**
   * Get organization summary for briefing
   */
  getOrgSummary: async (organizationId) => {
    return new Promise((resolve) => {
      db.get(`SELECT name FROM organizations WHERE id = ?`, [organizationId], (err, org) => {
        if (!org) return resolve({});

        db.all(
          `
                    SELECT 
                        COUNT(*) as active_projects,
                        SUM(CASE WHEN health = 'red' OR status = 'blocked' THEN 1 ELSE 0 END) as at_risk
                    FROM projects
                    WHERE organization_id = ? AND status IN ('active', 'in_progress')
                `,
          [organizationId],
          (err, stats) => {
            const projectStats = stats?.[0] || {};

            db.all(
              `
                        SELECT title, severity FROM watchdog_alerts
                        WHERE organization_id = ?
                        AND created_at > datetime('now', '-24 hours')
                        ORDER BY created_at DESC
                        LIMIT 5
                    `,
              [organizationId],
              (err, alerts) => {
                resolve({
                  orgName: org.name,
                  activeProjects: projectStats.active_projects || 0,
                  atRiskProjects: projectStats.at_risk || 0,
                  recentAlerts: alerts || [],
                  overallHealth: projectStats.at_risk > 0 ? 'at risk' : 'healthy',
                  priorities: [],
                });
              }
            );
          }
        );
      });
    });
  },

  /**
   * Check for unacknowledged critical alerts and escalate
   */
  checkAndEscalate: async () => {
    const escalationTime = new Date(Date.now() - CONFIG.escalationDelayHours * 60 * 60 * 1000);

    return new Promise((resolve) => {
      db.all(
        `
                SELECT * FROM watchdog_alerts
                WHERE severity IN ('critical', 'high')
                AND status = 'new'
                AND created_at < ?
            `,
        [escalationTime.toISOString()],
        async (err, alerts) => {
          if (err || !alerts || alerts.length === 0) {
            return resolve(0);
          }

          let escalated = 0;

          for (const alert of alerts) {
            // Mark as escalated
            db.run(`UPDATE watchdog_alerts SET status = 'escalated' WHERE id = ?`, [alert.id]);

            // Create escalation notification for org admins
            await AIWatchdog.notifyOrgAdmins(alert);
            escalated++;
          }

          AIWatchdog.stats.escalationsTriggered += escalated;
          resolve(escalated);
        }
      );
    });
  },

  /**
   * Notify organization admins about escalation
   */
  notifyOrgAdmins: async (alert) => {
    return new Promise((resolve) => {
      db.all(
        `
                SELECT u.id, u.email FROM users u
                WHERE u.organization_id = ? AND u.role IN ('ADMIN', 'SUPERADMIN')
            `,
        [alert.organization_id],
        (err, admins) => {
          if (!admins) return resolve();

          for (const admin of admins) {
            db.run(
              `
                        INSERT INTO notifications (
                            id, user_id, organization_id, type, title, message,
                            entity_type, entity_id, read, created_at
                        ) VALUES (?, ?, ?, 'escalation', ?, ?, 'alert', ?, 0, CURRENT_TIMESTAMP)
                    `,
              [
                uuidv4(),
                admin.id,
                alert.organization_id,
                `🚨 ESCALATED: ${alert.title}`,
                `This alert has been unacknowledged for ${CONFIG.escalationDelayHours}+ hours and requires immediate attention.`,
                alert.id,
              ]
            );
          }

          resolve();
        }
      );
    });
  },

  /**
   * Log watchdog run
   */
  logRun: async (runId, results, durationMs) => {
    return new Promise((resolve) => {
      db.run(
        `
                INSERT INTO watchdog_runs (id, results, duration_ms, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `,
        [runId, JSON.stringify(results), durationMs],
        resolve
      );
    });
  },

  /**
   * Get watchdog status
   */
  getStatus: () => {
    return {
      isRunning: AIWatchdog.isRunning,
      lastRun: AIWatchdog.lastRun,
      stats: AIWatchdog.stats,
      config: CONFIG,
    };
  },

  /**
   * Get alerts for a project
   */
  getProjectAlerts: async (projectId, options = {}) => {
    const { limit = 20, status, severity } = options;

    return new Promise((resolve) => {
      let sql = `SELECT * FROM watchdog_alerts WHERE project_id = ?`;
      const params = [projectId];

      if (status) {
        sql += ` AND status = ?`;
        params.push(status);
      }
      if (severity) {
        sql += ` AND severity = ?`;
        params.push(severity);
      }

      sql += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);

      db.all(sql, params, (err, rows) => {
        resolve(
          (rows || []).map((r) => ({
            ...r,
            recommendations: JSON.parse(r.recommendations || '[]'),
            indicators: JSON.parse(r.indicators || '[]'),
          }))
        );
      });
    });
  },

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert: async (alertId, userId) => {
    return new Promise((resolve) => {
      db.run(
        `
                UPDATE watchdog_alerts 
                SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
        [userId, alertId],
        function (err) {
          resolve(!err && this.changes > 0);
        }
      );
    });
  },

  /**
   * Initialize database tables
   */
  initialize: async () => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(`
                    CREATE TABLE IF NOT EXISTS watchdog_alerts (
                        id TEXT PRIMARY KEY,
                        project_id TEXT,
                        organization_id TEXT,
                        type TEXT NOT NULL,
                        severity TEXT NOT NULL,
                        title TEXT NOT NULL,
                        description TEXT,
                        signal_type TEXT,
                        probability REAL,
                        recommendations TEXT,
                        indicators TEXT,
                        entity_id TEXT,
                        entity_type TEXT,
                        status TEXT DEFAULT 'new',
                        acknowledged_by TEXT,
                        acknowledged_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        db.run(`CREATE INDEX IF NOT EXISTS idx_wa_project ON watchdog_alerts(project_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_wa_org ON watchdog_alerts(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_wa_status ON watchdog_alerts(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_wa_severity ON watchdog_alerts(severity)`);

        db.run(`
                    CREATE TABLE IF NOT EXISTS watchdog_runs (
                        id TEXT PRIMARY KEY,
                        results TEXT,
                        duration_ms INTEGER,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        resolve();
      });
    });
  },
};

export default AIWatchdog;
