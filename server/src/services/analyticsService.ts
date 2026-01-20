/**
 * Analytics Service
 * FLOW-ANALYTICS-001: Dashboard analytics and metrics
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface OverviewStats {
  projects: { total: number; active: number; onTrack: number; atRisk: number };
  initiatives: { total: number; executing: number; blocked: number; done: number };
  tasks: { total: number; pending: number; overdue: number; completedToday: number };
  decisions: { pending: number; madeToday: number; avgTimeHours: number };
  users: { total: number; activeToday: number };
  ai: { tokensUsed: number; tokensLimit: number; suggestionsAccepted: number };
}

export interface TrendData {
  date: string;
  value: number;
}

export interface ProjectAnalytics {
  byStatus: { status: string; count: number }[];
  byHealth: { health: string; count: number }[];
  completionTrend: TrendData[];
}

export interface Dashboard {
  id: string;
  organizationId: string;
  userId?: string;
  name: string;
  description?: string;
  layout: Record<string, unknown>[];
  widgets: Record<string, unknown>[];
  isDefault: boolean;
  isShared: boolean;
}

// ==========================================
// SERVICE
// ==========================================

class AnalyticsService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  /**
   * Get overview stats for dashboard
   */
  async getOverviewStats(orgId: string): Promise<OverviewStats> {
    const db = await this.getDb();
    const today = new Date().toISOString().split('T')[0];

    // Projects
    const projectStats = await db.get<{
      total: number;
      active: number;
      on_track: number;
      at_risk: number;
    }>(
      `SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
                COUNT(CASE WHEN health = 'on_track' THEN 1 END) as on_track,
                COUNT(CASE WHEN health IN ('at_risk', 'critical') THEN 1 END) as at_risk
             FROM projects WHERE organization_id = ?`,
      [orgId]
    );

    // Initiatives
    const initiativeStats = await db.get<{
      total: number;
      executing: number;
      blocked: number;
      done: number;
    }>(
      `SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'executing' THEN 1 END) as executing,
                COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked,
                COUNT(CASE WHEN status = 'done' THEN 1 END) as done
             FROM initiatives WHERE organization_id = ?`,
      [orgId]
    );

    // Tasks
    const taskStats = await db.get<{
      total: number;
      pending: number;
      overdue: number;
      completed_today: number;
    }>(
      `SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status IN ('todo', 'in_progress') THEN 1 END) as pending,
                COUNT(CASE WHEN due_date < ? AND status NOT IN ('done', 'cancelled') THEN 1 END) as overdue,
                COUNT(CASE WHEN status = 'done' AND DATE(updated_at) = ? THEN 1 END) as completed_today
             FROM tasks WHERE organization_id = ?`,
      [today, today, orgId]
    );

    // Decisions
    const decisionStats = await db.get<{
      pending: number;
      made_today: number;
    }>(
      `SELECT 
                COUNT(CASE WHEN status IN ('pending', 'escalated') THEN 1 END) as pending,
                COUNT(CASE WHEN status IN ('approved', 'rejected') AND DATE(decided_at) = ? THEN 1 END) as made_today
             FROM decisions WHERE organization_id = ?`,
      [today, orgId]
    );

    // Users
    const userStats = await db.get<{
      total: number;
      active_today: number;
    }>(
      `SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN DATE(last_login_at) = ? THEN 1 END) as active_today
             FROM users WHERE organization_id = ?`,
      [today, orgId]
    );

    // AI (from ai_usage_logs if exists)
    const aiStats = await db.get<{
      tokens_used: number;
    }>(
      `SELECT COALESCE(SUM(tokens_used), 0) as tokens_used 
             FROM ai_usage_logs 
             WHERE organization_id = ? AND DATE(created_at) >= DATE('now', '-30 days')`,
      [orgId]
    );

    return {
      projects: {
        total: projectStats?.total || 0,
        active: projectStats?.active || 0,
        onTrack: projectStats?.on_track || 0,
        atRisk: projectStats?.at_risk || 0,
      },
      initiatives: {
        total: initiativeStats?.total || 0,
        executing: initiativeStats?.executing || 0,
        blocked: initiativeStats?.blocked || 0,
        done: initiativeStats?.done || 0,
      },
      tasks: {
        total: taskStats?.total || 0,
        pending: taskStats?.pending || 0,
        overdue: taskStats?.overdue || 0,
        completedToday: taskStats?.completed_today || 0,
      },
      decisions: {
        pending: decisionStats?.pending || 0,
        madeToday: decisionStats?.made_today || 0,
        avgTimeHours: 0, // Would calculate from actual data
      },
      users: {
        total: userStats?.total || 0,
        activeToday: userStats?.active_today || 0,
      },
      ai: {
        tokensUsed: aiStats?.tokens_used || 0,
        tokensLimit: 200000, // From plan
        suggestionsAccepted: 0,
      },
    };
  }

  /**
   * Get project analytics
   */
  async getProjectAnalytics(orgId: string): Promise<ProjectAnalytics> {
    const db = await this.getDb();

    // By status
    const byStatus = await db.all<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM projects 
             WHERE organization_id = ? GROUP BY status`,
      [orgId]
    );

    // By health
    const byHealth = await db.all<{ health: string; count: number }>(
      `SELECT COALESCE(health, 'unknown') as health, COUNT(*) as count FROM projects 
             WHERE organization_id = ? GROUP BY health`,
      [orgId]
    );

    // Completion trend (last 30 days)
    const completionTrend = await db.all<{ date: string; value: number }>(
      `SELECT DATE(updated_at) as date, COUNT(*) as value FROM projects 
             WHERE organization_id = ? AND status = 'completed' 
             AND updated_at >= DATE('now', '-30 days')
             GROUP BY DATE(updated_at) ORDER BY date`,
      [orgId]
    );

    return {
      byStatus: byStatus || [],
      byHealth: byHealth || [],
      completionTrend: completionTrend || [],
    };
  }

  /**
   * Get task velocity (tasks completed per day)
   */
  async getTaskVelocity(orgId: string, days: number = 30): Promise<TrendData[]> {
    const db = await this.getDb();

    const data = await db.all<{ date: string; value: number }>(
      `SELECT DATE(updated_at) as date, COUNT(*) as value FROM tasks 
             WHERE organization_id = ? AND status = 'done' 
             AND updated_at >= DATE('now', '-' || ? || ' days')
             GROUP BY DATE(updated_at) ORDER BY date`,
      [orgId, days]
    );

    return data || [];
  }

  /**
   * Get team activity heatmap data
   */
  async getTeamActivity(
    orgId: string,
    days: number = 30
  ): Promise<
    {
      userId: string;
      userName: string;
      activity: { date: string; count: number }[];
    }[]
  > {
    const db = await this.getDb();

    // Get user activity from user_activity table
    const activity = await db.all<{
      user_id: string;
      date: string;
      count: number;
    }>(
      `SELECT user_id, DATE(created_at) as date, COUNT(*) as count 
             FROM user_activity 
             WHERE organization_id = ? AND created_at >= DATE('now', '-' || ? || ' days')
             GROUP BY user_id, DATE(created_at)
             ORDER BY user_id, date`,
      [orgId, days]
    );

    // Group by user
    const userMap = new Map<string, { date: string; count: number }[]>();
    for (const row of activity || []) {
      if (!userMap.has(row.user_id)) {
        userMap.set(row.user_id, []);
      }
      userMap.get(row.user_id)!.push({ date: row.date, count: row.count });
    }

    return Array.from(userMap.entries()).map(([userId, activityData]) => ({
      userId,
      userName: userId, // Would fetch actual name
      activity: activityData,
    }));
  }

  // ==========================================
  // DASHBOARDS
  // ==========================================

  /**
   * Get dashboards
   */
  async getDashboards(orgId: string, userId?: string): Promise<Dashboard[]> {
    const db = await this.getDb();

    let query = `SELECT * FROM custom_dashboards WHERE organization_id = ?`;
    const params: string[] = [orgId];

    if (userId) {
      query += ` AND (user_id = ? OR user_id IS NULL OR is_shared = 1)`;
      params.push(userId);
    }

    query += ` ORDER BY is_default DESC, name`;

    const rows = await db.all<{
      id: string;
      organization_id: string;
      user_id: string;
      name: string;
      description: string;
      layout: string;
      widgets: string;
      is_default: number;
      is_shared: number;
    }>(query, params);

    return (rows || []).map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      userId: r.user_id,
      name: r.name,
      description: r.description,
      layout: JSON.parse(r.layout || '[]'),
      widgets: JSON.parse(r.widgets || '[]'),
      isDefault: r.is_default === 1,
      isShared: r.is_shared === 1,
    }));
  }

  /**
   * Create dashboard
   */
  async createDashboard(input: {
    organizationId: string;
    userId?: string;
    name: string;
    description?: string;
    layout?: Record<string, unknown>[];
    widgets?: Record<string, unknown>[];
    createdBy: string;
  }): Promise<string> {
    const db = await this.getDb();
    const id = `dash-${uuidv4()}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO custom_dashboards (
                id, organization_id, user_id, name, description,
                layout, widgets, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.organizationId,
        input.userId || null,
        input.name,
        input.description || null,
        JSON.stringify(input.layout || []),
        JSON.stringify(input.widgets || []),
        input.createdBy,
        now,
      ]
    );

    return id;
  }

  /**
   * Update dashboard
   */
  async updateDashboard(
    dashboardId: string,
    updates: Partial<Pick<Dashboard, 'name' | 'description' | 'layout' | 'widgets' | 'isShared'>>
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const fields: string[] = ['updated_at = ?'];
    const values: (string | number)[] = [now];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.layout !== undefined) {
      fields.push('layout = ?');
      values.push(JSON.stringify(updates.layout));
    }
    if (updates.widgets !== undefined) {
      fields.push('widgets = ?');
      values.push(JSON.stringify(updates.widgets));
    }
    if (updates.isShared !== undefined) {
      fields.push('is_shared = ?');
      values.push(updates.isShared ? 1 : 0);
    }

    values.push(dashboardId);

    await db.run(`UPDATE custom_dashboards SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  /**
   * Create daily snapshot (called by cron)
   */
  async createDailySnapshot(orgId: string): Promise<void> {
    const db = await this.getDb();
    const id = `snap-${uuidv4()}`;
    const today = new Date().toISOString().split('T')[0];

    const stats = await this.getOverviewStats(orgId);

    await db.run(
      `INSERT OR REPLACE INTO analytics_snapshots (
                id, organization_id, snapshot_date,
                projects_total, projects_active, projects_on_track, projects_at_risk,
                initiatives_total, initiatives_executing, initiatives_blocked, initiatives_done,
                tasks_total, tasks_overdue, tasks_completed_today,
                decisions_pending, decisions_made_today,
                users_total, users_active_today,
                ai_tokens_used_month
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        today,
        stats.projects.total,
        stats.projects.active,
        stats.projects.onTrack,
        stats.projects.atRisk,
        stats.initiatives.total,
        stats.initiatives.executing,
        stats.initiatives.blocked,
        stats.initiatives.done,
        stats.tasks.total,
        stats.tasks.overdue,
        stats.tasks.completedToday,
        stats.decisions.pending,
        stats.decisions.madeToday,
        stats.users.total,
        stats.users.activeToday,
        stats.ai.tokensUsed,
      ]
    );

    logger.info(`[AnalyticsService] Created daily snapshot for org ${orgId}`);
  }
}

// Export singleton
const analyticsService = new AnalyticsService();
export default analyticsService;

// Named exports
export const getOverviewStats = (orgId: string) => analyticsService.getOverviewStats(orgId);
export const getProjectAnalytics = (orgId: string) => analyticsService.getProjectAnalytics(orgId);
export const getTaskVelocity = (orgId: string, days?: number) =>
  analyticsService.getTaskVelocity(orgId, days);
export const getTeamActivity = (orgId: string, days?: number) =>
  analyticsService.getTeamActivity(orgId, days);
export const getDashboards = (orgId: string, userId?: string) =>
  analyticsService.getDashboards(orgId, userId);
export const createDashboard = (input: Parameters<typeof analyticsService.createDashboard>[0]) =>
  analyticsService.createDashboard(input);
export const updateDashboard = (
  dashboardId: string,
  updates: Parameters<typeof analyticsService.updateDashboard>[1]
) => analyticsService.updateDashboard(dashboardId, updates);
export const createDailySnapshot = (orgId: string) => analyticsService.createDailySnapshot(orgId);
