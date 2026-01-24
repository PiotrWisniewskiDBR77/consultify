/**
 * User Activity Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Tracks and aggregates user activity metrics
 * Migrated from server/services/userActivityService.js
 */

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';

// ==========================================
// TYPES
// ==========================================

interface UserActivityServiceDeps {
  db: IDatabase;
  uuidv4: () => string;
}

interface ActivitySummary {
  id: string;
  user_id: string;
  organization_id: string;
  period_start: string;
  period_end: string;
  login_count: number;
  last_login_at: string | null;
  ai_interactions: number;
  tasks_created: number;
  tasks_completed: number;
  projects_accessed: number;
  engagement_score: number;
}

interface CalculatedSummary {
  id: string;
  userId: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  loginCount: number;
  lastLoginAt: string | null;
  aiInteractions: number;
  tasksCreated: number;
  tasksCompleted: number;
  projectsAccessed: number;
  engagementScore: number;
}

// ==========================================
// CLASS IMPLEMENTATION
// ==========================================

export class UserActivityServiceClass {
  #deps: UserActivityServiceDeps | null = null;
  #initialized = false;
  #initPromise: Promise<void> | null = null;

  constructor(deps?: Partial<UserActivityServiceDeps>) {
    if (deps?.db && deps?.uuidv4) {
      this.#deps = deps as UserActivityServiceDeps;
      this.#initialized = true;
    }
  }

  async #initDeps() {
    if (this.#initialized) return;
    if (this.#initPromise) return this.#initPromise;

    this.#initPromise = (async () => {
      const [uuidModule] = await Promise.all([import('uuid')]);

      this.#deps = {
        db: getDatabase(),
        uuidv4: uuidModule.v4,
      };
      this.#initialized = true;
    })();

    return this.#initPromise;
  }

  setDependencies(newDeps: Partial<UserActivityServiceDeps>) {
    this.#deps = { ...this.#deps!, ...newDeps };
    this.#initialized = true;
  }

  private async dbGet<T>(sql: string, params: any[] = []): Promise<T | null> {
    await this.#initDeps();
    return DbPromise.get<T>(this.#deps!.db, sql, params);
  }

  private async dbRun(
    sql: string,
    params: any[] = []
  ): Promise<{ lastID?: number; changes: number }> {
    await this.#initDeps();
    const result = await DbPromise.run(this.#deps!.db, sql, params);
    return {
      lastID: result.lastID,
      changes: result.changes || 0,
    };
  }

  private async dbAll<T>(sql: string, params: any[] = []): Promise<T[]> {
    await this.#initDeps();
    return DbPromise.all<T>(this.#deps!.db, sql, params);
  }

  // ==========================================
  // SERVICE METHODS
  // ==========================================

  async getActivitySummary(
    userId: string,
    organizationId: string,
    periodStart: string
  ): Promise<ActivitySummary | null> {
    return this.dbGet<ActivitySummary>(
      `SELECT * FROM user_activity_summary 
             WHERE user_id = ? AND organization_id = ? AND period_start = ?`,
      [userId, organizationId, periodStart]
    );
  }

  async calculateActivitySummary(
    userId: string,
    organizationId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<CalculatedSummary> {
    await this.#initDeps();
    const { uuidv4 } = this.#deps!;

    // Get activity data
    const [loginData, aiData, taskData, projectData] = await Promise.all([
      this.dbGet<{ login_count: number; last_login_at: string | null }>(
        `SELECT COUNT(*) as login_count, MAX(last_login) as last_login_at
                 FROM users WHERE id = ? AND last_login BETWEEN ? AND ?`,
        [userId, periodStart, periodEnd]
      ).then((row) => row || { login_count: 0, last_login_at: null }),

      this.dbGet<{ interactions: number }>(
        `SELECT COUNT(*) as interactions
                 FROM ai_logs WHERE user_id = ? AND created_at BETWEEN ? AND ?`,
        [userId, periodStart, periodEnd]
      ).then((row) => row || { interactions: 0 }),

      this.dbGet<{ created: number; completed: number }>(
        `SELECT 
                 COUNT(CASE WHEN created_at BETWEEN ? AND ? THEN 1 END) as created,
                 COUNT(CASE WHEN completed_at BETWEEN ? AND ? THEN 1 END) as completed
                 FROM tasks WHERE assignee_id = ?`,
        [periodStart, periodEnd, periodStart, periodEnd, userId]
      ).then((row) => row || { created: 0, completed: 0 }),

      this.dbGet<{ accessed: number }>(
        `SELECT COUNT(DISTINCT project_id) as accessed
                 FROM project_users WHERE user_id = ?`,
        [userId]
      ).then((row) => row || { accessed: 0 }),
    ]);

    // Calculate engagement score (0-100)
    const engagementScore = Math.min(
      100,
      loginData.login_count * 10 +
        aiData.interactions * 2 +
        taskData.created * 5 +
        taskData.completed * 10
    );

    const id = uuidv4();
    await this.dbRun(
      `INSERT INTO user_activity_summary 
             (id, user_id, organization_id, period_start, period_end, login_count, last_login_at,
              ai_interactions, tasks_created, tasks_completed, projects_accessed, engagement_score)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id, organization_id, period_start) DO UPDATE SET
             login_count = excluded.login_count,
             last_login_at = excluded.last_login_at,
             ai_interactions = excluded.ai_interactions,
             tasks_created = excluded.tasks_created,
             tasks_completed = excluded.tasks_completed,
             projects_accessed = excluded.projects_accessed,
             engagement_score = excluded.engagement_score`,
      [
        id,
        userId,
        organizationId,
        periodStart,
        periodEnd,
        loginData.login_count,
        loginData.last_login_at,
        aiData.interactions,
        taskData.created,
        taskData.completed,
        projectData.accessed,
        engagementScore,
      ]
    );

    return {
      id,
      userId,
      organizationId,
      periodStart,
      periodEnd,
      loginCount: loginData.login_count,
      lastLoginAt: loginData.last_login_at,
      aiInteractions: aiData.interactions,
      tasksCreated: taskData.created,
      tasksCompleted: taskData.completed,
      projectsAccessed: projectData.accessed,
      engagementScore,
    };
  }

  async getActivityHistory(
    userId: string,
    organizationId: string,
    limit: number = 30
  ): Promise<ActivitySummary[]> {
    return this.dbAll<ActivitySummary>(
      `SELECT * FROM user_activity_summary 
             WHERE user_id = ? AND organization_id = ?
             ORDER BY period_start DESC LIMIT ?`,
      [userId, organizationId, limit]
    );
  }
}

// ==========================================
// EXPORTS
// ==========================================

const UserActivityService = new UserActivityServiceClass();

export const getActivitySummary = (userId: string, orgId: string, periodStart: string) =>
  UserActivityService.getActivitySummary(userId, orgId, periodStart);
export const calculateActivitySummary = (
  userId: string,
  orgId: string,
  periodStart: string,
  periodEnd: string
) => UserActivityService.calculateActivitySummary(userId, orgId, periodStart, periodEnd);
export const getActivityHistory = (userId: string, orgId: string, limit?: number) =>
  UserActivityService.getActivityHistory(userId, orgId, limit);

export default UserActivityService;
