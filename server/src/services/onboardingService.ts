/**
 * Onboarding Service
 * FLOW-ONBOARDING-001: User onboarding with gamification
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as sqliteAsync from '../database/sqliteAsync.js';
import { decodeHtmlEntities } from '../utils/htmlEntities.js';
import logger from '../utils/Logger.js';
import aiService from './aiService.js';
import { createInitiative as funnelCreateInitiative } from './initiative/createInitiativeService.js';
import { resolveInitiativeProjectId } from './initiativeProjectPolicyService.js';

// ==========================================
// TYPES
// ==========================================

export interface OnboardingStep {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  isRequired: boolean;
  points: number;
  icon?: string;
  estimatedMinutes?: number;
}

export interface StepProgress {
  stepId: string;
  stepName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completedAt?: string;
  skippedAt?: string;
}

export interface OnboardingProgress {
  userId: string;
  organizationId: string;
  steps: StepProgress[];
  points: number;
  achievements: string[];
  completionPercentage: number;
  isComplete: boolean;
  showChecklist: boolean;
  startedAt: string;
  completedAt?: string;
}

export interface Achievement {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  points: number;
  isUnlocked: boolean;
  unlockedAt?: string;
}

export interface Tooltip {
  id: string;
  targetSelector: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  orderIndex: number;
  seen: boolean;
}

// ==========================================
// SERVICE
// ==========================================

class OnboardingService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  private async runAsync(sql: string, params: any[] = []) {
    if (typeof (sqliteAsync as any).runAsync === 'function') {
      return (sqliteAsync as any).runAsync(sql, params);
    }
    const db = await this.getDb();
    return new Promise<{ lastID?: number; changes?: number }>((resolve, reject) => {
      db.run(sql, params, function (this: { lastID: number; changes: number }, err: Error | null) {
        if (err) reject(err);
        else resolve({ lastID: this?.lastID, changes: this?.changes });
      });
    });
  }

  private async getAsync<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    if (typeof (sqliteAsync as any).getAsync === 'function') {
      return (sqliteAsync as any).getAsync(sql, params);
    }
    const db = await this.getDb();
    return new Promise<T | null>((resolve, reject) => {
      db.get(sql, params, (err: Error | null, row: T | null) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }

  /**
   * Initialize onboarding for new user
   */
  async initializeOnboarding(userId: string, orgId: string): Promise<void> {
    const db = await this.getDb();
    const id = `onboarding-${uuidv4()}`;
    const now = new Date().toISOString();

    // Check if already exists
    const existing = await db.get<{ id: string }>(
      'SELECT id FROM user_onboarding WHERE user_id = ?',
      [userId]
    );

    if (existing) {
      logger.info(`[OnboardingService] Onboarding already exists for user ${userId}`);
      return;
    }

    // Get all steps
    const steps = await this.getStepDefinitions();
    const stepsProgress: Record<string, { status: string }> = {};
    steps.forEach((s) => {
      stepsProgress[s.name] = { status: 'pending' };
    });

    await db.run(
      `INSERT INTO user_onboarding (
                id, user_id, organization_id, steps_progress, points, achievements,
                completion_percentage, is_complete, show_checklist, started_at
            ) VALUES (?, ?, ?, ?, 0, '[]', 0, 0, 1, ?)`,
      [id, userId, orgId, JSON.stringify(stepsProgress), now]
    );

    logger.info(`[OnboardingService] Initialized onboarding for user ${userId}`);
  }

  /**
   * Get onboarding progress
   */
  async getProgress(userId: string): Promise<OnboardingProgress | null> {
    const db = await this.getDb();

    const row = await db.get<{
      user_id: string;
      organization_id: string;
      steps_progress: string;
      points: number;
      achievements: string;
      completion_percentage: number;
      is_complete: number;
      show_checklist: number;
      started_at: string;
      completed_at: string | null;
    }>('SELECT * FROM user_onboarding WHERE user_id = ?', [userId]);

    if (!row) return null;

    const stepsProgress = JSON.parse(row.steps_progress || '{}');
    const stepDefs = await this.getStepDefinitions();

    const steps: StepProgress[] = stepDefs.map((def) => ({
      stepId: def.id,
      stepName: def.name,
      status: stepsProgress[def.name]?.status || 'pending',
      completedAt: stepsProgress[def.name]?.completedAt,
      skippedAt: stepsProgress[def.name]?.skippedAt,
    }));

    return {
      userId: row.user_id,
      organizationId: row.organization_id,
      steps,
      points: row.points,
      achievements: JSON.parse(row.achievements || '[]'),
      completionPercentage: row.completion_percentage,
      isComplete: row.is_complete === 1,
      showChecklist: row.show_checklist === 1,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
    };
  }

  /**
   * Trigger step completion
   */
  async triggerStepCompletion(
    userId: string,
    stepName: string
  ): Promise<{
    stepCompleted: boolean;
    pointsEarned: number;
    newAchievements: string[];
    isOnboardingComplete: boolean;
  }> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    // Get current progress
    const progress = await this.getProgress(userId);
    if (!progress) {
      return {
        stepCompleted: false,
        pointsEarned: 0,
        newAchievements: [],
        isOnboardingComplete: false,
      };
    }

    // Get step definition
    const stepDef = await db.get<{ id: string; name: string; points: number }>(
      'SELECT * FROM onboarding_steps WHERE name = ?',
      [stepName]
    );

    if (!stepDef) {
      return {
        stepCompleted: false,
        pointsEarned: 0,
        newAchievements: [],
        isOnboardingComplete: false,
      };
    }

    // Check if already completed
    const existingStep = progress.steps.find((s) => s.stepName === stepName);
    if (existingStep?.status === 'completed') {
      return {
        stepCompleted: false,
        pointsEarned: 0,
        newAchievements: [],
        isOnboardingComplete: progress.isComplete,
      };
    }

    // Update step progress
    const stepsProgress: Record<string, { status: string; completedAt?: string }> = {};
    progress.steps.forEach((s) => {
      if (s.stepName === stepName) {
        stepsProgress[s.stepName] = { status: 'completed', completedAt: now };
      } else {
        stepsProgress[s.stepName] = { status: s.status, completedAt: s.completedAt };
      }
    });

    // Calculate new completion percentage
    const stepDefs = await this.getStepDefinitions();
    const requiredSteps = stepDefs.filter((s) => s.isRequired);
    const completedRequired = Object.entries(stepsProgress).filter(([name, data]) => {
      const def = stepDefs.find((s) => s.name === name);
      return def?.isRequired && data.status === 'completed';
    }).length;
    const completionPercentage = Math.round((completedRequired / requiredSteps.length) * 100);

    // Check if all required steps complete
    const isOnboardingComplete = completionPercentage === 100;

    // Calculate points
    const newPoints = progress.points + stepDef.points;

    // Check for new achievements
    const newAchievements = await this.checkAchievements(
      userId,
      stepName,
      newPoints,
      isOnboardingComplete,
      progress.achievements
    );

    // Update database
    await db.run(
      `UPDATE user_onboarding SET 
                steps_progress = ?,
                points = ?,
                achievements = ?,
                completion_percentage = ?,
                is_complete = ?,
                completed_at = ?,
                last_step_at = ?
             WHERE user_id = ?`,
      [
        JSON.stringify(stepsProgress),
        newPoints,
        JSON.stringify([...progress.achievements, ...newAchievements]),
        completionPercentage,
        isOnboardingComplete ? 1 : 0,
        isOnboardingComplete ? now : null,
        now,
        userId,
      ]
    );

    logger.info(
      `[OnboardingService] User ${userId} completed step ${stepName}, earned ${stepDef.points} points`
    );

    return {
      stepCompleted: true,
      pointsEarned: stepDef.points,
      newAchievements,
      isOnboardingComplete,
    };
  }

  /**
   * Skip a step
   */
  async skipStep(userId: string, stepName: string): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const progress = await this.getProgress(userId);
    if (!progress) return;

    const stepsProgress: Record<string, { status: string; skippedAt?: string }> = {};
    progress.steps.forEach((s) => {
      if (s.stepName === stepName) {
        stepsProgress[s.stepName] = { status: 'skipped', skippedAt: now };
      } else {
        stepsProgress[s.stepName] = { status: s.status };
      }
    });

    await db.run(
      `UPDATE user_onboarding SET steps_progress = ?, last_step_at = ? WHERE user_id = ?`,
      [JSON.stringify(stepsProgress), now, userId]
    );

    logger.info(`[OnboardingService] User ${userId} skipped step ${stepName}`);
  }

  /**
   * Dismiss checklist temporarily
   */
  async dismissChecklist(userId: string, hours: number = 24): Promise<void> {
    const db = await this.getDb();
    const dismissUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    await db.run(
      `UPDATE user_onboarding SET show_checklist = 0, dismissed_until = ? WHERE user_id = ?`,
      [dismissUntil, userId]
    );
  }

  /**
   * Save transformation context for onboarding
   */
  async saveContext(
    organizationId: string,
    context: { role?: string; problems?: string; industry?: string; [key: string]: any }
  ): Promise<{ success: boolean; status: string }> {
    const required = ['role', 'problems', 'industry'];
    for (const field of required) {
      if (!context?.[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const now = new Date().toISOString();
    await this.runAsync(
      `UPDATE organizations
       SET transformation_context = ?, onboarding_status = 'IN_PROGRESS', updated_at = ?
       WHERE id = ?`,
      [JSON.stringify(context), now, organizationId]
    );

    return { success: true, status: 'IN_PROGRESS' };
  }

  /**
   * Generate AI onboarding plan
   */
  async generatePlan(
    organizationId: string,
    userId: string
  ): Promise<{ success: boolean; plan: any; planId: string; planVersion: number }> {
    const org = await this.getAsync<{
      transformation_context: string;
      onboarding_plan_version: number;
      organization_type: string;
    }>(
      'SELECT transformation_context, onboarding_plan_version, organization_type FROM organizations WHERE id = ?',
      [organizationId]
    );

    if (!org?.transformation_context) {
      throw new Error('Missing transformation context');
    }

    const context = JSON.parse(org.transformation_context);
    const service = (aiService as any)?.getAiService
      ? await (aiService as any).getAiService()
      : aiService;
    const plan = await service.generateFirstValuePlan(context, userId);

    const nextVersion = (org.onboarding_plan_version || 0) + 1;
    const planId = `onbplan-${organizationId}-v${nextVersion}`;
    plan.planId = planId;

    await this.runAsync(
      `UPDATE organizations
       SET onboarding_plan_snapshot = ?, onboarding_plan_version = ?, onboarding_status = 'GENERATED'
       WHERE id = ?`,
      [JSON.stringify(plan), nextVersion, organizationId]
    );

    return { success: true, plan, planId, planVersion: nextVersion };
  }

  /**
   * Accept generated plan and create initiatives
   */
  async acceptPlan(
    organizationId: string,
    userId: string,
    {
      acceptedInitiativeIds,
      idempotencyKey,
    }: { acceptedInitiativeIds?: string[]; idempotencyKey?: string }
  ): Promise<{ success: boolean; createdCount: number; idempotent: boolean }> {
    const org = await this.getAsync<{
      onboarding_plan_snapshot: string;
      onboarding_status: string;
      onboarding_accept_idempotency_key: string | null;
    }>(
      'SELECT onboarding_plan_snapshot, onboarding_status, onboarding_accept_idempotency_key FROM organizations WHERE id = ?',
      [organizationId]
    );

    if (idempotencyKey && org?.onboarding_accept_idempotency_key === idempotencyKey) {
      return { success: true, createdCount: 0, idempotent: true };
    }

    const snapshot = org?.onboarding_plan_snapshot || '{}';
    const plan = JSON.parse(snapshot);
    const planId = plan.planId || `onbplan-${organizationId}-v1`;
    const initiatives = plan.suggested_initiatives || [];
    const acceptedSet = acceptedInitiativeIds ? new Set(acceptedInitiativeIds) : null;
    let createdCount = 0;

    for (const initiative of initiatives) {
      if (acceptedSet && !acceptedSet.has(initiative.id)) continue;
      const id = initiative.id || `init-${uuidv4()}`;
      // F15 (data-integrity, continuation of Z139): decode HTML entities that
      // may already be escaped on the plan-snapshot title before storing.
      const decodedInitTitle = decodeHtmlEntities(String(initiative.title || 'Initiative'));
      // Uspójnienie F1.9 — przez kanoniczny lejek (DRAFT + name/title + lineage).
      if (process.env.INITIATIVE_FUNNEL_ENABLED !== 'false') {
        const __r = await funnelCreateInitiative(
          organizationId,
          {
            title: decodedInitTitle,
            summary: initiative.summary || '',
            hypothesis: initiative.hypothesis || '',
            sourceType: 'ai_onboarding',
            sourceId: planId,
          },
          { validate: false, actor: { id: userId } }
        );
        // Funnel nie zna created_by/created_from/created_from_plan_id — dośpiewujemy.
        await this.runAsync(
          `UPDATE initiatives
           SET created_by = ?, created_from = 'AI_ONBOARDING', created_from_plan_id = ?
           WHERE id = ? AND organization_id = ?`,
          [userId, planId, __r.id, organizationId]
        );
      } else {
        // D1 (Zwornik §9 Faza 3): this branch is the LIVE path
        // (INITIATIVE_FUNNEL_ENABLED defaults ON; explicit 'false' selects rollback) and didn't even select a
        // project_id column — every AI-onboarding initiative was a silent
        // orphan. Anchor to the org's system portfolio project instead.
        const anchoredProjectId = await resolveInitiativeProjectId(organizationId, null, {
          createdBy: userId ?? null,
        });
        // FIX (NOT-NULL sweep): initiatives.name is NOT NULL with no DB default
        // (Postgres) — this branch only wrote `title`, which 500s with 23502.
        // Mirror title into name, same convention as createInitiativeService.ts /
        // InitiativeController.ts.
        await this.runAsync(
          `INSERT INTO initiatives
           (id, organization_id, project_id, title, name, summary, hypothesis, created_by, created_from, created_from_plan_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AI_ONBOARDING', ?)`,
          [
            id,
            organizationId,
            anchoredProjectId,
            decodedInitTitle,
            decodedInitTitle,
            initiative.summary || '',
            initiative.hypothesis || '',
            userId,
            planId,
          ]
        );
      }
      createdCount += 1;
    }

    await this.runAsync(
      `UPDATE organizations
       SET onboarding_status = 'ACCEPTED', onboarding_accept_idempotency_key = ?
       WHERE id = ?`,
      [idempotencyKey || null, organizationId]
    );

    return { success: true, createdCount, idempotent: false };
  }

  /**
   * Get tooltips for a page
   */
  async getTooltips(userId: string, pageUrl: string): Promise<Tooltip[]> {
    const db = await this.getDb();

    // Get all active tooltips
    const tooltips = await db.all<{
      id: string;
      target_selector: string;
      title: string;
      content: string;
      position: string;
      order_index: number;
      page_pattern: string;
      show_once: number;
    }>(`SELECT * FROM onboarding_tooltips WHERE is_active = 1 ORDER BY order_index`);

    // Get user's seen tooltips
    const seenTooltips = await db.all<{ tooltip_id: string }>(
      `SELECT tooltip_id FROM user_tooltips_seen WHERE user_id = ?`,
      [userId]
    );
    const seenIds = new Set((seenTooltips || []).map((t) => t.tooltip_id));

    // Filter by page pattern and show_once
    return (tooltips || [])
      .filter((t) => {
        // Check page pattern
        if (t.page_pattern) {
          try {
            const regex = new RegExp(t.page_pattern);
            if (!regex.test(pageUrl)) return false;
          } catch {
            // Invalid regex, skip pattern check
          }
        }
        // Check if already seen (for show_once)
        if (t.show_once && seenIds.has(t.id)) return false;
        return true;
      })
      .map((t) => ({
        id: t.id,
        targetSelector: t.target_selector,
        title: t.title,
        content: t.content,
        position: t.position as Tooltip['position'],
        orderIndex: t.order_index,
        seen: seenIds.has(t.id),
      }));
  }

  /**
   * Mark tooltip as seen
   */
  async markTooltipSeen(userId: string, tooltipId: string): Promise<void> {
    const db = await this.getDb();
    const id = uuidv4();

    // NOTE: real unique constraint on user_tooltips_seen is (user_id, tooltip_id), not `id`
    // (id is a freshly generated UUID per call). Conflict target must reference the actual
    // constraint or Postgres inserts a duplicate row every time instead of no-op'ing.
    await db.run(
      `INSERT INTO user_tooltips_seen (id, user_id, tooltip_id) VALUES (?, ?, ?)
       ON CONFLICT (user_id, tooltip_id) DO NOTHING`,
      [id, userId, tooltipId]
    );
  }

  /**
   * Get achievements
   */
  async getAchievements(userId: string): Promise<Achievement[]> {
    const db = await this.getDb();

    // Get all achievements
    const allAchievements = await db.all<{
      id: string;
      name: string;
      display_name: string;
      description: string;
      icon: string;
      points: number;
    }>(`SELECT * FROM onboarding_achievements WHERE is_hidden = 0`);

    // Get user's unlocked achievements
    const progress = await this.getProgress(userId);
    const unlockedIds = new Set(progress?.achievements || []);

    return (allAchievements || []).map((a) => ({
      id: a.id,
      name: a.name,
      displayName: a.display_name,
      description: a.description,
      icon: a.icon,
      points: a.points,
      isUnlocked: unlockedIds.has(a.name),
    }));
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private async getStepDefinitions(): Promise<OnboardingStep[]> {
    const db = await this.getDb();

    const steps = await db.all<{
      id: string;
      name: string;
      display_name: string;
      description: string;
      is_required: number;
      points: number;
      icon: string;
      estimated_minutes: number;
    }>(`SELECT * FROM onboarding_steps ORDER BY step_order`);

    return (steps || []).map((s) => ({
      id: s.id,
      name: s.name,
      displayName: s.display_name,
      description: s.description,
      isRequired: s.is_required === 1,
      points: s.points,
      icon: s.icon,
      estimatedMinutes: s.estimated_minutes,
    }));
  }

  private async checkAchievements(
    userId: string,
    completedStep: string,
    totalPoints: number,
    isOnboardingComplete: boolean,
    existingAchievements: string[]
  ): Promise<string[]> {
    const db = await this.getDb();
    const newAchievements: string[] = [];

    // Get all achievements
    const achievements = await db.all<{
      name: string;
      condition_type: string;
      condition_value: string;
    }>(`SELECT name, condition_type, condition_value FROM onboarding_achievements`);

    for (const ach of achievements || []) {
      // Skip if already unlocked
      if (existingAchievements.includes(ach.name)) continue;

      let unlocked = false;

      switch (ach.condition_type) {
        case 'step_complete':
          unlocked = completedStep === ach.condition_value;
          break;
        case 'all_complete':
          unlocked = isOnboardingComplete;
          break;
        case 'points_reached':
          unlocked = totalPoints >= parseInt(ach.condition_value || '0', 10);
          break;
      }

      if (unlocked) {
        newAchievements.push(ach.name);
        logger.info(`[OnboardingService] User ${userId} unlocked achievement: ${ach.name}`);
      }
    }

    return newAchievements;
  }
}

// Export singleton
const onboardingService = new OnboardingService();
export default onboardingService;

// Named exports
export const initializeOnboarding = (userId: string, orgId: string) =>
  onboardingService.initializeOnboarding(userId, orgId);
export const getProgress = (userId: string) => onboardingService.getProgress(userId);
export const triggerStepCompletion = (userId: string, stepName: string) =>
  onboardingService.triggerStepCompletion(userId, stepName);
export const skipStep = (userId: string, stepName: string) =>
  onboardingService.skipStep(userId, stepName);
export const dismissChecklist = (userId: string, hours?: number) =>
  onboardingService.dismissChecklist(userId, hours);
export const getTooltips = (userId: string, pageUrl: string) =>
  onboardingService.getTooltips(userId, pageUrl);
export const markTooltipSeen = (userId: string, tooltipId: string) =>
  onboardingService.markTooltipSeen(userId, tooltipId);
export const getAchievements = (userId: string) => onboardingService.getAchievements(userId);
