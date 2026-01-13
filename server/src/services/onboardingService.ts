/**
 * Onboarding Service
 * FLOW-ONBOARDING-001: User onboarding with gamification
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

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

    await db.run(
      `INSERT OR IGNORE INTO user_tooltips_seen (id, user_id, tooltip_id) VALUES (?, ?, ?)`,
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
