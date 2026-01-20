/**
 * MyWork Service
 * FLOW-MYWORK-001: Personal dashboard data aggregation
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface MyWorkDashboard {
  stats: QuickStats;
  focus: FocusItem[];
  tasks: {
    dueToday: TaskSummary[];
    thisWeek: TaskSummary[];
    overdue: TaskSummary[];
  };
  decisions: {
    awaitingMe: DecisionSummary[];
    myRequestsPending: DecisionSummary[];
  };
  aiInbox: AIInboxItem[];
  recentActivity: ActivityItem[];
}

export interface QuickStats {
  pendingTasks: number;
  decisionsNeeded: number;
  overdueTasks: number;
  inProgressTasks: number;
}

export interface FocusItem {
  type: 'task' | 'decision' | 'assessment';
  id: string;
  title: string;
  reason: string;
  urgency: number;
  dueDate?: string;
  projectName?: string;
}

export interface TaskSummary {
  id: string;
  title: string;
  priority: string;
  status: string;
  progress: number;
  dueDate?: string;
  projectId?: string;
  projectName?: string;
  initiativeName?: string;
}

export interface DecisionSummary {
  id: string;
  title: string;
  type: string;
  deadline?: string;
  status: string;
  decisionMakerId?: string;
  decisionMakerName?: string;
  projectName?: string;
}

export interface AIInboxItem {
  id: string;
  type: string;
  category?: string;
  title: string;
  content: string;
  priority: string;
  relatedType?: string;
  relatedId?: string;
  actionUrl?: string;
  status: string;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  activityType: string;
  description: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  projectName?: string;
  createdAt: string;
}

// ==========================================
// SERVICE
// ==========================================

class MyWorkService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  /**
   * Get full MyWork dashboard
   */
  async getDashboard(userId: string, orgId: string): Promise<MyWorkDashboard> {
    const [stats, focus, tasks, decisions, aiInbox, recentActivity] = await Promise.all([
      this.getStats(userId, orgId),
      this.getFocus(userId, orgId),
      this.getTasks(userId, orgId),
      this.getDecisions(userId, orgId),
      this.getAIInbox(userId, orgId),
      this.getRecentActivity(userId, orgId),
    ]);

    return {
      stats,
      focus,
      tasks,
      decisions,
      aiInbox,
      recentActivity,
    };
  }

  /**
   * Get quick stats
   */
  async getStats(userId: string, orgId: string): Promise<QuickStats> {
    const db = await this.getDb();
    const today = new Date().toISOString().split('T')[0];

    // Get task stats
    const taskStats = await db.get<{
      pending: number;
      overdue: number;
      in_progress: number;
    }>(
      `SELECT 
                COUNT(CASE WHEN status IN ('todo', 'in_progress') THEN 1 END) as pending,
                COUNT(CASE WHEN due_date < ? AND status NOT IN ('done', 'cancelled') THEN 1 END) as overdue,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress
             FROM tasks 
             WHERE assignee_id = ? AND organization_id = ?`,
      [today, userId, orgId]
    );

    // Get decision stats
    const decisionStats = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM decisions 
             WHERE decision_maker_id = ? AND organization_id = ? AND status IN ('pending', 'escalated')`,
      [userId, orgId]
    );

    return {
      pendingTasks: taskStats?.pending || 0,
      overdueTasks: taskStats?.overdue || 0,
      inProgressTasks: taskStats?.in_progress || 0,
      decisionsNeeded: decisionStats?.count || 0,
    };
  }

  /**
   * Get AI-curated focus items
   */
  async getFocus(userId: string, orgId: string, maxItems: number = 5): Promise<FocusItem[]> {
    const db = await this.getDb();
    const today = new Date().toISOString().split('T')[0];
    const items: FocusItem[] = [];

    // 1. Overdue tasks (highest priority)
    const overdueTasks = await db.all<{
      id: string;
      title: string;
      due_date: string;
      project_name: string;
    }>(
      `SELECT t.id, t.title, t.due_date, p.name as project_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.assignee_id = ? AND t.organization_id = ?
             AND t.due_date < ? AND t.status NOT IN ('done', 'cancelled')
             ORDER BY t.due_date ASC LIMIT 2`,
      [userId, orgId, today]
    );

    for (const task of overdueTasks || []) {
      items.push({
        type: 'task',
        id: task.id,
        title: task.title,
        reason: 'Overdue - needs immediate attention',
        urgency: 100,
        dueDate: task.due_date,
        projectName: task.project_name,
      });
    }

    // 2. Pending decisions
    const decisions = await db.all<{
      id: string;
      title: string;
      deadline: string;
    }>(
      `SELECT id, title, deadline FROM decisions 
             WHERE decision_maker_id = ? AND organization_id = ? AND status IN ('pending', 'escalated')
             ORDER BY deadline ASC LIMIT 2`,
      [userId, orgId]
    );

    for (const dec of decisions || []) {
      items.push({
        type: 'decision',
        id: dec.id,
        title: dec.title,
        reason: 'Awaiting your decision',
        urgency: 90,
        dueDate: dec.deadline,
      });
    }

    // 3. Tasks due today
    const dueTodayTasks = await db.all<{
      id: string;
      title: string;
      project_name: string;
    }>(
      `SELECT t.id, t.title, p.name as project_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.assignee_id = ? AND t.organization_id = ?
             AND DATE(t.due_date) = ? AND t.status NOT IN ('done', 'cancelled')
             LIMIT 2`,
      [userId, orgId, today]
    );

    for (const task of dueTodayTasks || []) {
      if (!items.find((i) => i.id === task.id)) {
        items.push({
          type: 'task',
          id: task.id,
          title: task.title,
          reason: 'Due today',
          urgency: 80,
          dueDate: today,
          projectName: task.project_name,
        });
      }
    }

    // Sort by urgency and limit
    return items.sort((a, b) => b.urgency - a.urgency).slice(0, maxItems);
  }

  /**
   * Get tasks grouped by urgency
   */
  async getTasks(
    userId: string,
    orgId: string
  ): Promise<{
    dueToday: TaskSummary[];
    thisWeek: TaskSummary[];
    overdue: TaskSummary[];
  }> {
    const db = await this.getDb();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const query = `
            SELECT t.id, t.title, t.priority, t.status, t.progress, t.due_date,
                   p.id as project_id, p.name as project_name, i.title as initiative_name
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN initiatives i ON t.initiative_id = i.id
            WHERE t.assignee_id = ? AND t.organization_id = ?
            AND t.status NOT IN ('done', 'cancelled')
            ORDER BY t.due_date ASC, t.priority DESC
        `;

    const tasks = await db.all<{
      id: string;
      title: string;
      priority: string;
      status: string;
      progress: number;
      due_date: string;
      project_id: string;
      project_name: string;
      initiative_name: string;
    }>(query, [userId, orgId]);

    const mapTask = (t: (typeof tasks)[0]): TaskSummary => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      progress: t.progress || 0,
      dueDate: t.due_date,
      projectId: t.project_id,
      projectName: t.project_name,
      initiativeName: t.initiative_name,
    });

    return {
      overdue: (tasks || []).filter((t) => t.due_date && t.due_date < todayStr).map(mapTask),
      dueToday: (tasks || []).filter((t) => t.due_date && t.due_date === todayStr).map(mapTask),
      thisWeek: (tasks || [])
        .filter((t) => t.due_date && t.due_date > todayStr && t.due_date <= weekEnd)
        .map(mapTask),
    };
  }

  /**
   * Get decisions
   */
  async getDecisions(
    userId: string,
    orgId: string
  ): Promise<{
    awaitingMe: DecisionSummary[];
    myRequestsPending: DecisionSummary[];
  }> {
    const db = await this.getDb();

    // Decisions awaiting my decision
    const awaitingMe = await db.all<{
      id: string;
      title: string;
      type: string;
      deadline: string;
      status: string;
    }>(
      `SELECT id, title, type, deadline, status FROM decisions 
             WHERE decision_maker_id = ? AND organization_id = ? AND status IN ('pending', 'escalated')
             ORDER BY deadline ASC`,
      [userId, orgId]
    );

    // My requests pending others' decisions
    const myRequestsPending = await db.all<{
      id: string;
      title: string;
      type: string;
      deadline: string;
      status: string;
      decision_maker_id: string;
    }>(
      `SELECT d.id, d.title, d.type, d.deadline, d.status, d.decision_maker_id
             FROM decisions d
             WHERE d.created_by = ? AND d.organization_id = ? 
             AND d.decision_maker_id != ? AND d.status IN ('pending', 'escalated')
             ORDER BY d.deadline ASC`,
      [userId, orgId, userId]
    );

    return {
      awaitingMe: (awaitingMe || []).map((d) => ({
        id: d.id,
        title: d.title,
        type: d.type,
        deadline: d.deadline,
        status: d.status,
      })),
      myRequestsPending: (myRequestsPending || []).map((d) => ({
        id: d.id,
        title: d.title,
        type: d.type,
        deadline: d.deadline,
        status: d.status,
        decisionMakerId: d.decision_maker_id,
      })),
    };
  }

  /**
   * Get AI inbox items
   */
  async getAIInbox(userId: string, orgId: string, limit: number = 10): Promise<AIInboxItem[]> {
    const db = await this.getDb();

    const items = await db.all<{
      id: string;
      type: string;
      category: string;
      title: string;
      content: string;
      priority: string;
      related_type: string;
      related_id: string;
      action_url: string;
      status: string;
      created_at: string;
    }>(
      `SELECT * FROM ai_inbox 
             WHERE user_id = ? AND organization_id = ?
             AND status NOT IN ('dismissed', 'actioned')
             AND (expires_at IS NULL OR expires_at > datetime('now'))
             ORDER BY 
                CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
                created_at DESC
             LIMIT ?`,
      [userId, orgId, limit]
    );

    return (items || []).map((i) => ({
      id: i.id,
      type: i.type,
      category: i.category,
      title: i.title,
      content: i.content,
      priority: i.priority,
      relatedType: i.related_type,
      relatedId: i.related_id,
      actionUrl: i.action_url,
      status: i.status,
      createdAt: i.created_at,
    }));
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(
    userId: string,
    orgId: string,
    limit: number = 10
  ): Promise<ActivityItem[]> {
    const db = await this.getDb();

    const activities = await db.all<{
      id: string;
      activity_type: string;
      description: string;
      entity_type: string;
      entity_id: string;
      entity_name: string;
      project_name: string;
      created_at: string;
    }>(
      `SELECT * FROM user_activity 
             WHERE user_id = ? AND organization_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
      [userId, orgId, limit]
    );

    return (activities || []).map((a) => ({
      id: a.id,
      activityType: a.activity_type,
      description: a.description,
      entityType: a.entity_type,
      entityId: a.entity_id,
      entityName: a.entity_name,
      projectName: a.project_name,
      createdAt: a.created_at,
    }));
  }

  /**
   * Add AI inbox item
   */
  async addAIInboxItem(input: {
    userId: string;
    organizationId: string;
    type: string;
    category?: string;
    title: string;
    content: string;
    priority?: string;
    relatedType?: string;
    relatedId?: string;
    actionUrl?: string;
    expiresAt?: string;
  }): Promise<string> {
    const db = await this.getDb();
    const id = `inbox-${uuidv4()}`;

    await db.run(
      `INSERT INTO ai_inbox (
                id, user_id, organization_id, type, category, title, content,
                priority, related_type, related_id, action_url, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.userId,
        input.organizationId,
        input.type,
        input.category || null,
        input.title,
        input.content,
        input.priority || 'medium',
        input.relatedType || null,
        input.relatedId || null,
        input.actionUrl || null,
        input.expiresAt || null,
      ]
    );

    return id;
  }

  /**
   * Log user activity
   */
  async logActivity(input: {
    userId: string;
    organizationId: string;
    activityType: string;
    description: string;
    entityType?: string;
    entityId?: string;
    entityName?: string;
    projectId?: string;
    projectName?: string;
    activityData?: Record<string, unknown>;
  }): Promise<void> {
    const db = await this.getDb();
    const id = `activity-${uuidv4()}`;

    await db.run(
      `INSERT INTO user_activity (
                id, user_id, organization_id, activity_type, description,
                activity_data, entity_type, entity_id, entity_name, project_id, project_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.userId,
        input.organizationId,
        input.activityType,
        input.description,
        input.activityData ? JSON.stringify(input.activityData) : null,
        input.entityType || null,
        input.entityId || null,
        input.entityName || null,
        input.projectId || null,
        input.projectName || null,
      ]
    );
  }

  /**
   * Mark AI inbox item as read/dismissed/actioned
   */
  async updateInboxItemStatus(
    itemId: string,
    status: 'read' | 'dismissed' | 'actioned'
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const statusField =
      status === 'read' ? 'read_at' : status === 'dismissed' ? 'dismissed_at' : 'actioned_at';

    await db.run(`UPDATE ai_inbox SET status = ?, ${statusField} = ? WHERE id = ?`, [
      status,
      now,
      itemId,
    ]);
  }
}

// Export singleton
const myWorkService = new MyWorkService();
export default myWorkService;

// Named exports
export const getDashboard = (userId: string, orgId: string) =>
  myWorkService.getDashboard(userId, orgId);
export const getStats = (userId: string, orgId: string) => myWorkService.getStats(userId, orgId);
export const getFocus = (userId: string, orgId: string, maxItems?: number) =>
  myWorkService.getFocus(userId, orgId, maxItems);
export const getTasks = (userId: string, orgId: string) => myWorkService.getTasks(userId, orgId);
export const getDecisions = (userId: string, orgId: string) =>
  myWorkService.getDecisions(userId, orgId);
export const getAIInbox = (userId: string, orgId: string, limit?: number) =>
  myWorkService.getAIInbox(userId, orgId, limit);
export const getRecentActivity = (userId: string, orgId: string, limit?: number) =>
  myWorkService.getRecentActivity(userId, orgId, limit);
export const addAIInboxItem = (input: Parameters<typeof myWorkService.addAIInboxItem>[0]) =>
  myWorkService.addAIInboxItem(input);
export const logActivity = (input: Parameters<typeof myWorkService.logActivity>[0]) =>
  myWorkService.logActivity(input);
export const updateInboxItemStatus = (itemId: string, status: 'read' | 'dismissed' | 'actioned') =>
  myWorkService.updateInboxItemStatus(itemId, status);
